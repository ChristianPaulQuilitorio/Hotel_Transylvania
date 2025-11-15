-- Migration: create analytics RPCs and materialized view for admin analytics
-- 2025-11-14

BEGIN;

-- Materialized view for daily bookings + revenue (optional, speeds up dashboards)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_daily_bookings') THEN
    CREATE MATERIALIZED VIEW public.mv_daily_bookings AS
    SELECT
      DATE(created_at) AS day,
      COUNT(*) AS bookings,
      COALESCE(SUM(total_price),0) AS revenue
    FROM public.bookings
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at);
  END IF;
END
$$ LANGUAGE plpgsql;

-- SECURITY DEFINER RPC for daily stats (per-day bookings and revenue)
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
        SELECT DATE(created_at) AS day, COUNT(*) AS bookings, COALESCE(SUM(total_price),0) AS revenue
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
        SELECT DATE(created_at) AS day, COUNT(*) AS bookings, COALESCE(SUM(total_price),0) AS revenue
        FROM public.bookings
        WHERE created_at >= _from AND room_id::text = p_room_id
        GROUP BY DATE(created_at)
      ) m ON m.day = d.day
      ORDER BY d.day;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Analytics summary RPC
CREATE OR REPLACE FUNCTION public.admin_get_analytics_summary(p_days integer DEFAULT 30)
RETURNS TABLE(total_rooms integer, total_bookings integer, revenue numeric, cancelled integer, cancellation_rate numeric) AS $$
DECLARE
  _from timestamp := (current_date - (p_days || ' days')::interval)::timestamp;
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.rooms)::int AS total_rooms,
    (SELECT COUNT(*) FROM public.bookings WHERE created_at >= _from)::int AS total_bookings,
    (SELECT COALESCE(SUM(total_price),0) FROM public.bookings WHERE created_at >= _from)::numeric AS revenue,
    (SELECT COUNT(*) FROM public.bookings WHERE created_at >= _from AND status = 'cancelled')::int AS cancelled,
    CASE WHEN (SELECT COUNT(*) FROM public.bookings WHERE created_at >= _from) = 0 THEN 0
         ELSE (SELECT COUNT(*) FROM public.bookings WHERE created_at >= _from AND status = 'cancelled')::numeric / (SELECT COUNT(*) FROM public.bookings WHERE created_at >= _from)::numeric
    END AS cancellation_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
