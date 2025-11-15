-- Migration: make history_bookings.room_id an integer (int4) to match bookings.room_id
-- Safe conversion: create temp int column, populate when room_id looks numeric, then replace.
-- 2025-11-14

BEGIN;

-- Only run if table/column exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history_bookings' AND column_name = 'room_id') THEN

    -- If the column is already integer, skip
    IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history_bookings' AND column_name = 'room_id') = 'integer' THEN
      RAISE NOTICE 'history_bookings.room_id already integer; skipping';
    ELSE
      -- Add a temporary integer column
      ALTER TABLE public.history_bookings ADD COLUMN IF NOT EXISTS room_id_tmp integer;

      -- Populate room_id_tmp with numeric values parsed from room_id (if present and numeric)
      UPDATE public.history_bookings
      SET room_id_tmp = CASE
        WHEN room_id IS NULL THEN NULL
        WHEN room_id::text ~ '^\\d+$' THEN (room_id::text)::integer
        ELSE NULL
      END;

      -- Drop any default/constraints referencing old column as needed (kept minimal here)

      -- Drop the old column and rename tmp into place
      ALTER TABLE public.history_bookings DROP COLUMN IF EXISTS room_id;
      ALTER TABLE public.history_bookings RENAME COLUMN room_id_tmp TO room_id;

      -- Optionally set default to NULL (no default) and keep column nullable
      ALTER TABLE public.history_bookings ALTER COLUMN room_id DROP NOT NULL;

      RAISE NOTICE 'Converted history_bookings.room_id to integer using numeric-only values; non-numeric preserved as NULL';
    END IF;
  ELSE
    RAISE NOTICE 'history_bookings.room_id does not exist; nothing to do';
  END IF;
END
$$ LANGUAGE plpgsql;

COMMIT;

-- Additional safety: backfill room_id from `rooms` jsonb and from joined `rooms` table when possible,
-- add a trigger to maintain `room_id` on future inserts/updates, and add a NOT VALID FK to rooms(id).

BEGIN;

-- 1) Backfill room_id from the `rooms` jsonb column if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='history_bookings' AND column_name='rooms') THEN
    -- Extract numeric id from JSON object or array element
    UPDATE public.history_bookings
    SET room_id = (CASE
      WHEN (rooms->> 'id') ~ '^\\d+$' THEN (rooms->> 'id')::integer
      WHEN jsonb_typeof(rooms) = 'array' AND (rooms->0->> 'id') ~ '^\\d+$' THEN (rooms->0->> 'id')::integer
      ELSE room_id
    END)
    WHERE room_id IS NULL AND rooms IS NOT NULL;

    -- If rooms json contains non-numeric id but matches a room by name, try name match
    UPDATE public.history_bookings hb
    SET room_id = r.id
    FROM public.rooms r
    WHERE hb.room_id IS NULL
      AND hb.rooms IS NOT NULL
      AND (hb.rooms->> 'name') IS NOT NULL
      AND r.name = hb.rooms->> 'name';
  END IF;
END
$$ LANGUAGE plpgsql;

-- 2) Backfill room_id by joining to rooms table when JSON-based extraction didn't work
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='history_bookings')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='rooms') THEN
    UPDATE public.history_bookings hb
    SET room_id = r.id
    FROM public.rooms r
    WHERE hb.room_id IS NULL
      AND (
        (hb.rooms IS NOT NULL AND (hb.rooms->> 'id') IS NOT NULL AND (hb.rooms->> 'id')::text = r.id::text)
        OR (hb.rooms IS NOT NULL AND jsonb_typeof(hb.rooms) = 'array' AND (hb.rooms->0->> 'id') IS NOT NULL AND (hb.rooms->0->> 'id')::text = r.id::text)
      );
  END IF;
END
$$ LANGUAGE plpgsql;

-- 3) Trigger function to ensure new/updated rows populate `room_id` from `rooms` jsonb when possible
CREATE OR REPLACE FUNCTION public.fn_history_ensure_room_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.room_id IS NULL THEN
    IF NEW.rooms IS NOT NULL THEN
      IF (NEW.rooms->> 'id') ~ '^\\d+$' THEN
        NEW.room_id := (NEW.rooms->> 'id')::integer;
      ELSIF jsonb_typeof(NEW.rooms) = 'array' AND (NEW.rooms->0->> 'id') ~ '^\\d+$' THEN
        NEW.room_id := (NEW.rooms->0->> 'id')::integer;
      ELSIF (NEW.rooms->> 'name') IS NOT NULL THEN
        SELECT id INTO NEW.room_id FROM public.rooms WHERE name = NEW.rooms->> 'name' LIMIT 1;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Attach trigger
DROP TRIGGER IF EXISTS trg_history_ensure_room_id ON public.history_bookings;
CREATE TRIGGER trg_history_ensure_room_id
BEFORE INSERT OR UPDATE ON public.history_bookings
FOR EACH ROW
EXECUTE FUNCTION public.fn_history_ensure_room_id();

-- 5) Add a NOT VALID foreign key constraint to link to rooms.id (will not validate existing bad rows)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'history_bookings_room_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.history_bookings ADD CONSTRAINT history_bookings_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) NOT VALID';
  END IF;
END
$$ LANGUAGE plpgsql;

COMMIT;
