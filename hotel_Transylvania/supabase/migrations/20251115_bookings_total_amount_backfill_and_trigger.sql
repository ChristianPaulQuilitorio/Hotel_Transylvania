-- Backfill and maintain bookings.total_amount using rooms.price * nights
-- 2025-11-15

BEGIN;

-- 1) Ensure total_amount column exists with the correct type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='total_amount') THEN
    ALTER TABLE public.bookings ADD COLUMN total_amount numeric(10,2) DEFAULT 0;
    RAISE NOTICE 'Added bookings.total_amount numeric(10,2)';
  ELSE
    -- If column exists but not numeric(10,2), try to alter type safely
    IF (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='total_amount') <> 'numeric' THEN
      BEGIN
        ALTER TABLE public.bookings ALTER COLUMN total_amount TYPE numeric(10,2) USING total_amount::numeric;
        RAISE NOTICE 'Altered bookings.total_amount to numeric(10,2)';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not alter bookings.total_amount to numeric(10,2); leaving as-is';
      END;
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;

-- 2) Backfill total_amount from rooms.price * nights for bookings missing total_amount or with zero
-- nights := GREATEST(1, DATE_PART('day', checkout_date - checkin_date))
UPDATE public.bookings b
SET total_amount = (GREATEST(1, (DATE_PART('day', b.checkout_date::timestamp - b.checkin_date::timestamp))::int) * COALESCE(r.price,0))::numeric(10,2)
FROM public.rooms r
WHERE b.room_id = r.id AND (b.total_amount IS NULL OR b.total_amount = 0);

-- 3) Backfill total_amount from rooms json price when room_id is null
UPDATE public.bookings b
SET total_amount = (GREATEST(1, (DATE_PART('day', b.checkout_date::timestamp - b.checkin_date::timestamp))::int) * (b.rooms->> 'price')::numeric)::numeric(10,2)
WHERE (b.total_amount IS NULL OR b.total_amount = 0)
  AND b.room_id IS NULL
  AND b.rooms IS NOT NULL
  AND (b.rooms->> 'price') ~ '^\\d+(\\.\\d+)?$';

-- 4) Create trigger function to set total_amount on insert/update when not provided
CREATE OR REPLACE FUNCTION public.fn_bookings_set_total_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  nights integer := 1;
  p numeric := 0;
BEGIN
  -- compute nights (minimum 1)
  IF NEW.checkin_date IS NOT NULL AND NEW.checkout_date IS NOT NULL THEN
    nights := GREATEST(1, COALESCE((DATE_PART('day', NEW.checkout_date::timestamp - NEW.checkin_date::timestamp))::int, 1));
  ELSE
    nights := 1;
  END IF;

  -- Only set total_amount when it's null or zero
  IF NEW.total_amount IS NULL OR NEW.total_amount = 0 THEN
    -- Try rooms table price first
    IF NEW.room_id IS NOT NULL THEN
      SELECT r.price INTO p FROM public.rooms r WHERE r.id = NEW.room_id LIMIT 1;
      IF p IS NOT NULL THEN
        NEW.total_amount := (nights * COALESCE(p,0))::numeric(10,2);
        RETURN NEW;
      END IF;
    END IF;

    -- Fallback: try price in rooms json
    IF NEW.rooms IS NOT NULL AND (NEW.rooms->> 'price') IS NOT NULL AND (NEW.rooms->> 'price') ~ '^\\d+(\\.\\d+)?$' THEN
      NEW.total_amount := (nights * (NEW.rooms->> 'price')::numeric)::numeric(10,2);
      RETURN NEW;
    END IF;

    -- Final fallback: set to 0
    NEW.total_amount := COALESCE(NEW.total_amount, 0)::numeric(10,2);
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Attach trigger
DROP TRIGGER IF EXISTS trg_bookings_set_total_amount ON public.bookings;
CREATE TRIGGER trg_bookings_set_total_amount
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.fn_bookings_set_total_amount();

COMMIT;
