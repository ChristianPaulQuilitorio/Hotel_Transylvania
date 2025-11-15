-- Migration: backfill history_bookings.rooms and add trigger to populate on insert/update
-- 2025-11-14

BEGIN;

-- 1) Ensure the `rooms` jsonb column exists on history_bookings with a safe default
ALTER TABLE IF EXISTS public.history_bookings
  ADD COLUMN IF NOT EXISTS rooms jsonb DEFAULT '{}'::jsonb;

-- 2) Backfill existing history rows by joining to `rooms` using text cast to be tolerant of id-type differences
-- This will populate history_bookings.rooms with the full room row as jsonb (id, name, etc.)
WITH found AS (
  SELECT h.id AS history_id, to_jsonb(r.*) AS room_json
  FROM public.history_bookings h
  JOIN public.rooms r
    ON r.id::text = h.room_id::text
)
UPDATE public.history_bookings hb
SET rooms = f.room_json
FROM found f
WHERE hb.id = f.history_id
  AND (hb.rooms IS NULL OR jsonb_strip_nulls(hb.rooms) = '{}'::jsonb);

-- 3) Create a trigger function that will auto-populate `rooms` when a new history row is inserted
-- It tries to look up the room by id (string or numeric) and stores the room row as jsonb.
CREATE OR REPLACE FUNCTION public.fn_history_set_rooms()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.rooms IS NULL OR NEW.rooms = '{}'::jsonb) AND NEW.room_id IS NOT NULL THEN
    BEGIN
      -- Try string match first
      SELECT to_jsonb(r.*) INTO STRICT NEW.rooms
      FROM public.rooms r
      WHERE r.id::text = NEW.room_id::text
      LIMIT 1;
    EXCEPTION WHEN NO_DATA_FOUND THEN
      NEW.rooms = '{}'::jsonb;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Create a trigger that runs before insert or update to ensure rooms is populated
DROP TRIGGER IF EXISTS trg_history_set_rooms ON public.history_bookings;
CREATE TRIGGER trg_history_set_rooms
BEFORE INSERT OR UPDATE ON public.history_bookings
FOR EACH ROW
EXECUTE FUNCTION public.fn_history_set_rooms();

COMMIT;
