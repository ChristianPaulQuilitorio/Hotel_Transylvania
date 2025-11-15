-- Combined analytics schema for Supabase
-- Includes a materialized view for daily bookings and two SECURITY DEFINER RPCs
-- Paste this file into the Supabase SQL editor (or run via psql/supabase CLI)
-- 2025-11-14

BEGIN;

-- Create materialized view for daily bookings + revenue if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_daily_bookings') THEN
    CREATE MATERIALIZED VIEW public.mv_daily_bookings AS
    SELECT
      DATE(created_at) AS day,
      COUNT(*) AS bookings,
      COALESCE(SUM(COALESCE(total_price,0)),0) AS revenue
    FROM public.bookings
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at);
  END IF;
END
$$ LANGUAGE plpgsql;

-- Helper to refresh the materialized view (call as needed)
CREATE OR REPLACE FUNCTION public.admin_refresh_daily_bookings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS public.mv_daily_bookings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: daily stats (per-day bookings + revenue). Optional room filter.
CREATE OR REPLACE FUNCTION public.admin_get_daily_stats(p_days integer DEFAULT 30, p_room_id text DEFAULT NULL)
RETURNS TABLE(day date, bookings integer, revenue numeric) AS $$
DECLARE
  _from date := (current_date - (p_days || ' days')::interval)::date;
BEGIN
  IF p_room_id IS NULL THEN
    RETURN QUERY
      SELECT d.day, COALESCE(m.bookings,0)::int, COALESCE(m.revenue,0)::numeric
      FROM (
        SELECT generate_series(_from, current_date, '1 day')::date AS day
      ) d
      LEFT JOIN (
        SELECT DATE(created_at) AS day, COUNT(*) AS bookings, COALESCE(SUM(COALESCE(total_price,0)),0) AS revenue
        FROM public.bookings
        WHERE created_at >= _from
        GROUP BY DATE(created_at)
      ) m ON m.day = d.day
      ORDER BY d.day;
  ELSE
    RETURN QUERY
      SELECT d.day, COALESCE(m.bookings,0)::int, COALESCE(m.revenue,0)::numeric
      FROM (
        SELECT generate_series(_from, current_date, '1 day')::date AS day
      ) d
      LEFT JOIN (
        SELECT DATE(created_at) AS day, COUNT(*) AS bookings, COALESCE(SUM(COALESCE(total_price,0)),0) AS revenue
        FROM public.bookings
        WHERE created_at >= _from AND room_id::text = p_room_id
        GROUP BY DATE(created_at)
      ) m ON m.day = d.day
      ORDER BY d.day;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: analytics summary (total rooms, bookings, revenue, cancellations, cancellation rate)
CREATE OR REPLACE FUNCTION public.admin_get_analytics_summary(p_days integer DEFAULT 30)
RETURNS TABLE(total_rooms integer, total_bookings integer, revenue numeric, cancelled integer, cancellation_rate numeric) AS $$
DECLARE
  _from timestamp := (current_date - (p_days || ' days')::interval)::timestamp;
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.rooms)::int AS total_rooms,
    (SELECT COUNT(*) FROM public.bookings WHERE created_at >= _from)::int AS total_bookings,
    (SELECT COALESCE(SUM(COALESCE(total_price,0)),0) FROM public.bookings WHERE created_at >= _from)::numeric AS revenue,
    (SELECT COUNT(*) FROM public.bookings WHERE created_at >= _from AND status = 'cancelled')::int AS cancelled,
    CASE WHEN (SELECT COUNT(*) FROM public.bookings WHERE created_at >= _from) = 0 THEN 0
         ELSE (SELECT COUNT(*) FROM public.bookings WHERE created_at >= _from AND status = 'cancelled')::numeric / (SELECT COUNT(*) FROM public.bookings WHERE created_at >= _from)::numeric
    END AS cancellation_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: restrict execute to authenticated role (uncomment if desired)
-- GRANT EXECUTE ON FUNCTION public.admin_get_daily_stats(integer,text) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.admin_get_analytics_summary(integer) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.admin_refresh_daily_bookings() TO authenticated;

COMMIT;

-- Notes:
-- 1) These functions are SECURITY DEFINER so they run with the DB owner's privileges. Be sure the function owner is an appropriate role.
-- 2) If you plan to call these from the browser, either use the admin client (`supabaseAdmin`) or grant execute to the authenticated role.
-- 3) The materialized view can be refreshed periodically by calling `SELECT public.admin_refresh_daily_bookings();` or by scheduling a cron job.
