-- Analytics schema (robust): creates mv_daily_bookings and admin RPCs
-- Uses dynamic SQL to avoid failures when `total_price` or `rooms.price` don't exist.
-- Paste this into Supabase SQL editor and run.
-- 2025-11-14

BEGIN;

-- Create materialized view robustly depending on available columns
DO $$
DECLARE
  has_total_price boolean := false;
  has_room_price boolean := false;
  has_total_amount boolean := false;
  has_checkin boolean := false;
  has_checkout boolean := false;
  has_room_id boolean := false;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='total_price') INTO has_total_price;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='price') INTO has_room_price;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='total_amount') INTO has_total_amount;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='checkin_date') INTO has_checkin;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='checkout_date') INTO has_checkout;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='room_id') INTO has_room_id;

  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_daily_bookings') THEN
    IF has_total_price OR has_total_amount THEN
      -- Use total_amount if present else total_price
      IF has_total_amount THEN
        EXECUTE $sql$
          CREATE MATERIALIZED VIEW public.mv_daily_bookings AS
          SELECT DATE(created_at) AS day, COUNT(*) AS bookings, COALESCE(SUM(COALESCE(total_amount,0)),0) AS revenue
          FROM public.bookings
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at);
        $sql$;
        RAISE NOTICE 'Created mv_daily_bookings using bookings.total_amount';
      ELSE
        EXECUTE $sql$
          CREATE MATERIALIZED VIEW public.mv_daily_bookings AS
          SELECT DATE(created_at) AS day, COUNT(*) AS bookings, COALESCE(SUM(COALESCE(total_price,0)),0) AS revenue
          FROM public.bookings
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at);
        $sql$;
        RAISE NOTICE 'Created mv_daily_bookings using bookings.total_price';
      END IF;

    ELSIF has_room_price AND has_checkin AND has_checkout AND has_room_id THEN
      -- Compute revenue by nights * rooms.price when total_price absent
      EXECUTE $sql$
        CREATE MATERIALIZED VIEW public.mv_daily_bookings AS
        SELECT DATE(b.created_at) AS day,
               COUNT(*) AS bookings,
               COALESCE(SUM( GREATEST(0, (DATE_PART('day', b.checkout_date::timestamp - b.checkin_date::timestamp)) ) * COALESCE(r.price,0) ),0) AS revenue
        FROM public.bookings b
        LEFT JOIN public.rooms r ON r.id::text = b.room_id::text
        GROUP BY DATE(b.created_at)
        ORDER BY DATE(b.created_at);
      $sql$;
      RAISE NOTICE 'Created mv_daily_bookings using rooms.price * nights';

    ELSE
      -- Fallback: revenue = 0
      EXECUTE $sql$
        CREATE MATERIALIZED VIEW public.mv_daily_bookings AS
        SELECT DATE(created_at) AS day, COUNT(*) AS bookings, 0::numeric AS revenue
        FROM public.bookings
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at);
      $sql$;
      RAISE NOTICE 'Created mv_daily_bookings with revenue=0 (no price data available)';
    END IF;
  ELSE
    RAISE NOTICE 'mv_daily_bookings already exists; skipping creation';
  END IF;
END
$$ LANGUAGE plpgsql;

-- Refresh helper (safe to call even if matview missing)
CREATE OR REPLACE FUNCTION public.admin_refresh_daily_bookings()
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_daily_bookings') THEN
    -- Try a concurrent refresh first (preferred). If it fails (no suitable unique index
    -- or other restriction), fall back to a regular refresh to ensure the matview is updated.
    BEGIN
      EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_bookings';
    EXCEPTION WHEN OTHERS THEN
      -- Fallback: non-concurrent refresh (may take locks)
      EXECUTE 'REFRESH MATERIALIZED VIEW public.mv_daily_bookings';
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: admin_get_daily_stats using dynamic SQL to avoid compile-time column checks
CREATE OR REPLACE FUNCTION public.admin_get_daily_stats(p_days integer DEFAULT 30, p_room_id text DEFAULT NULL)
RETURNS TABLE(day date, bookings integer, revenue numeric) AS $$
DECLARE
  _from date := (current_date - (p_days || ' days')::interval)::date;
  sql text;
BEGIN
  -- Choose revenue expression based on presence of total_price
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='total_amount') THEN
    sql := format($q$
      SELECT d.day, COALESCE(m.bookings,0)::int, COALESCE(m.revenue,0)::numeric
      FROM (SELECT generate_series(%L::date, current_date, '1 day')::date AS day) d
      LEFT JOIN (
        SELECT DATE(created_at) AS day, COUNT(*) AS bookings, COALESCE(SUM(COALESCE(total_amount,0)),0) AS revenue
        FROM public.bookings
        WHERE created_at >= %L
        %s
        GROUP BY DATE(created_at)
      ) m ON m.day = d.day
      ORDER BY d.day;
    $q$, _from::text, _from::text, CASE WHEN p_room_id IS NOT NULL THEN format('AND room_id::text = %L', p_room_id) ELSE '' END);
  ELSIF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='total_price') THEN
    sql := format($q$
      SELECT d.day, COALESCE(m.bookings,0)::int, COALESCE(m.revenue,0)::numeric
      FROM (SELECT generate_series(%L::date, current_date, '1 day')::date AS day) d
      LEFT JOIN (
        SELECT DATE(created_at) AS day, COUNT(*) AS bookings, COALESCE(SUM(COALESCE(total_price,0)),0) AS revenue
        FROM public.bookings
        WHERE created_at >= %L
        %s
        GROUP BY DATE(created_at)
      ) m ON m.day = d.day
      ORDER BY d.day;
    $q$, _from::text, _from::text, CASE WHEN p_room_id IS NOT NULL THEN format('AND room_id::text = %L', p_room_id) ELSE '' END);
  ELSIF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='price')
        AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='checkin_date')
        AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='checkout_date')
        AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='room_id') THEN
    sql := format($q$
      SELECT d.day, COALESCE(m.bookings,0)::int, COALESCE(m.revenue,0)::numeric
      FROM (SELECT generate_series(%L::date, current_date, '1 day')::date AS day) d
      LEFT JOIN (
        SELECT DATE(b.created_at) AS day, COUNT(*) AS bookings,
               COALESCE(SUM( GREATEST(0, (DATE_PART('day', b.checkout_date::timestamp - b.checkin_date::timestamp)) ) * COALESCE(r.price,0) ),0) AS revenue
        FROM public.bookings b
        LEFT JOIN public.rooms r ON r.id::text = b.room_id::text
        WHERE b.created_at >= %L
        %s
        GROUP BY DATE(b.created_at)
      ) m ON m.day = d.day
      ORDER BY d.day;
    $q$, _from::text, _from::text, CASE WHEN p_room_id IS NOT NULL THEN format('AND b.room_id::text = %L', p_room_id) ELSE '' END);

  ELSE
    -- fallback: no revenue data available
    sql := format($q$
      SELECT d.day, COALESCE(m.bookings,0)::int, 0::numeric AS revenue
      FROM (SELECT generate_series(%L::date, current_date, '1 day')::date AS day) d
      LEFT JOIN (
        SELECT DATE(created_at) AS day, COUNT(*) AS bookings
        FROM public.bookings
        WHERE created_at >= %L
        %s
        GROUP BY DATE(created_at)
      ) m ON m.day = d.day
      ORDER BY d.day;
    $q$, _from::text, _from::text, CASE WHEN p_room_id IS NOT NULL THEN format('AND room_id::text = %L', p_room_id) ELSE '' END);
  END IF;

  RETURN QUERY EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: admin_get_analytics_summary using dynamic SQL to avoid compile-time failures
CREATE OR REPLACE FUNCTION public.admin_get_analytics_summary(p_days integer DEFAULT 30)
RETURNS TABLE(total_rooms integer, total_bookings integer, revenue numeric, cancelled integer, cancellation_rate numeric) AS $$
DECLARE
  _from timestamp := (current_date - (p_days || ' days')::interval)::timestamp;
  revenue_sql text;
  total_bookings integer := 0;
  cancelled_count integer := 0;
BEGIN
  -- total rooms
  total_rooms := (SELECT COUNT(*) FROM public.rooms);

  -- total bookings and cancelled
  -- Count bookings from `bookings` and any archived history rows to get full totals
  SELECT COUNT(*) INTO total_bookings FROM public.bookings WHERE created_at >= _from;
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='history_bookings') THEN
    total_bookings := total_bookings + COALESCE((SELECT COUNT(*) FROM public.history_bookings hb
      WHERE (hb.archived_at IS NOT NULL AND hb.archived_at >= _from) OR (hb.created_at IS NOT NULL AND hb.created_at >= _from)
    ),0);
  END IF;
  -- cancelled bookings may be in active `bookings` (status='cancelled') or archived into `history_bookings`.
  -- Count both sources within the requested window. For history entries use `archived_at` when present.
  SELECT COUNT(*) INTO cancelled_count FROM public.bookings WHERE created_at >= _from AND status = 'cancelled';
  -- Add cancellations from history_bookings if table exists
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='history_bookings') THEN
    cancelled_count := cancelled_count + COALESCE((SELECT COUNT(*) FROM public.history_bookings hb
      WHERE (hb.archived_at IS NOT NULL AND hb.archived_at >= _from) OR (hb.created_at IS NOT NULL AND hb.created_at >= _from)
      AND (lower(coalesce(hb.status,'')) = 'cancelled')),0);
  END IF;

  -- revenue: prefer total_price, else compute by nights*room.price, else 0
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='total_amount') THEN
    SELECT COALESCE(SUM(COALESCE(total_amount,0)),0) INTO revenue FROM public.bookings WHERE created_at >= _from;
  ELSIF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='total_price') THEN
    SELECT COALESCE(SUM(COALESCE(total_price,0)),0) INTO revenue FROM public.bookings WHERE created_at >= _from;
  ELSIF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='price')
        AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='checkin_date')
        AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='checkout_date')
        AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='room_id') THEN
    SELECT COALESCE(SUM( GREATEST(0, (DATE_PART('day', b.checkout_date::timestamp - b.checkin_date::timestamp)) ) * COALESCE(r.price,0) ),0)
      INTO revenue
      FROM public.bookings b
      LEFT JOIN public.rooms r ON r.id::text = b.room_id::text
      WHERE b.created_at >= _from;
  ELSE
    revenue := 0;
  END IF;

  RETURN QUERY SELECT total_rooms::int, total_bookings::int, revenue::numeric, cancelled_count::int,
    CASE WHEN total_bookings = 0 THEN 0 ELSE (cancelled_count::numeric / total_bookings::numeric) END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- Notes:
-- 1) These functions use SECURITY DEFINER; ensure the function owner role is appropriate.
-- 2) If you call from the browser with the anon key, either grant execute to `authenticated` or call via an admin client.
