DO $$
DECLARE m date;
BEGIN
  FOR m IN
    SELECT (date_trunc('month', CURRENT_DATE)::date - (n || ' months')::interval)::date
    FROM generate_series(0, 23) AS n
  LOOP
    PERFORM public.recompute_mrr_for_month(m);
  END LOOP;
END $$;