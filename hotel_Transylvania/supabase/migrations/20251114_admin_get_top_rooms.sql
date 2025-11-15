-- RPC: admin_get_top_rooms(p_days, p_limit)
-- Returns top rooms by bookings in the last p_days.
-- Uses dynamic SQL to be tolerant of schema differences.

-- Drop existing function first so we can change the return rowtype safely
DROP FUNCTION IF EXISTS public.admin_get_top_rooms(integer, integer);

CREATE FUNCTION public.admin_get_top_rooms(p_days integer DEFAULT 30, p_limit integer DEFAULT 10)
RETURNS TABLE(room_id integer, name text, count integer, revenue numeric) AS $$
DECLARE
  since timestamp := (current_date - (p_days || ' days')::interval)::timestamp;
  has_total_amount boolean := false;
  has_total_price boolean := false;
  has_room_price boolean := false;
  has_checkin boolean := false;
  has_checkout boolean := false;
  has_room_id boolean := false;
  sql text;
BEGIN
  -- Detect available columns
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='total_amount') INTO has_total_amount;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='total_price') INTO has_total_price;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='price') INTO has_room_price;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='checkin_date') INTO has_checkin;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='checkout_date') INTO has_checkout;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='room_id') INTO has_room_id;

  -- Prefer `total_amount`, fall back to `total_price`, else compute from room.price * nights when possible, else revenue=0
  IF has_total_amount THEN
    sql := format($q$
      SELECT b.room_id::int AS room_id, r.name::text AS name, COUNT(*)::int AS count, COALESCE(SUM(COALESCE(b.total_amount,0)),0)::numeric AS revenue
      FROM public.bookings b
      LEFT JOIN public.rooms r ON r.id = b.room_id
      WHERE b.created_at >= %L
      GROUP BY b.room_id, r.name
      ORDER BY count DESC
      LIMIT %s;
    $q$, since::text, p_limit::text);
  ELSIF has_total_price THEN
    sql := format($q$
      SELECT b.room_id::int AS room_id, r.name::text AS name, COUNT(*)::int AS count, COALESCE(SUM(COALESCE(b.total_price,0)),0)::numeric AS revenue
      FROM public.bookings b
      LEFT JOIN public.rooms r ON r.id = b.room_id
      WHERE b.created_at >= %L
      GROUP BY b.room_id, r.name
      ORDER BY count DESC
      LIMIT %s;
    $q$, since::text, p_limit::text);
  ELSIF has_room_price AND has_checkin AND has_checkout AND has_room_id THEN
    -- Compute revenue using room price * nights when total_amount/total_price missing
    sql := format($q$
      SELECT b.room_id::int AS room_id, r.name::text AS name, COUNT(*)::int AS count,
             COALESCE(SUM( GREATEST(0, (DATE_PART('day', b.checkout_date::timestamp - b.checkin_date::timestamp)) ) * COALESCE(r.price,0) ),0)::numeric AS revenue
      FROM public.bookings b
      LEFT JOIN public.rooms r ON r.id = b.room_id
      WHERE b.created_at >= %L
      GROUP BY b.room_id, r.name
      ORDER BY count DESC
      LIMIT %s;
    $q$, since::text, p_limit::text);
  ELSE
    -- No total_amount/total_price: return counts and revenue as 0
    sql := format($q$
      SELECT b.room_id::int AS room_id, r.name::text AS name, COUNT(*)::int AS count, 0::numeric AS revenue
      FROM public.bookings b
      LEFT JOIN public.rooms r ON r.id = b.room_id
      WHERE b.created_at >= %L
      GROUP BY b.room_id, r.name
      ORDER BY count DESC
      LIMIT %s;
    $q$, since::text, p_limit::text);
  END IF;

  RETURN QUERY EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optionally grant to authenticated or a specific role if you want browser access:
-- GRANT EXECUTE ON FUNCTION public.admin_get_top_rooms(integer, integer) TO authenticated;
