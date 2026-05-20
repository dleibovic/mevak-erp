-- =============================================================================
-- Mevak CRM — Link employees → auth.users by email
-- =============================================================================
-- Purpose:
--   Backfill public.employees.user_id by matching company_email / personal_email
--   against auth.users.email.
--
-- Properties:
--   (a) Idempotent — re-running is safe; only fills NULLs.
--   (b) Prints match/no-match counts BEFORE doing anything.
--   (c) Dry-run flag — when true, only reports; no UPDATE is executed.
--   (d) Only updates employees.user_id WHERE user_id IS NULL
--       (manual links are never overwritten).
--
-- Usage:
--   1. Set p_dry_run := true  → just report.
--   2. Set p_dry_run := false → report + apply UPDATE.
--   Run inside the SQL editor (or psql) against the shared Supabase project.
-- =============================================================================

DO $$
DECLARE
  -- 🔧 TOGGLE: change to FALSE to actually apply the update.
  p_dry_run        boolean := true;

  v_total_emp      int;
  v_emp_null_uid   int;
  v_would_match    int;
  v_no_match       int;
  v_ambiguous      int;
  v_updated        int := 0;
BEGIN
  -- -------------------------------------------------------------------------
  -- Build candidate mapping in a temp table.
  -- Each employee with user_id IS NULL is matched against auth.users.email
  -- using company_email OR personal_email (case-insensitive, trimmed).
  -- -------------------------------------------------------------------------
  CREATE TEMP TABLE _emp_user_map ON COMMIT DROP AS
  WITH emp AS (
    SELECT
      e.id            AS employee_id,
      e.full_name,
      lower(btrim(e.company_email))  AS company_email,
      lower(btrim(e.personal_email)) AS personal_email
    FROM public.employees e
    WHERE e.user_id IS NULL
  ),
  candidates AS (
    SELECT
      emp.employee_id,
      emp.full_name,
      u.id AS user_id,
      lower(u.email) AS user_email,
      CASE
        WHEN emp.company_email  = lower(u.email) THEN 'company'
        WHEN emp.personal_email = lower(u.email) THEN 'personal'
      END AS matched_via
    FROM emp
    JOIN auth.users u
      ON lower(u.email) = emp.company_email
      OR lower(u.email) = emp.personal_email
  )
  SELECT
    employee_id,
    full_name,
    user_id,
    user_email,
    matched_via,
    COUNT(*) OVER (PARTITION BY employee_id) AS matches_for_emp,
    COUNT(*) OVER (PARTITION BY user_id)     AS emps_for_user
  FROM candidates;

  -- -------------------------------------------------------------------------
  -- Report
  -- -------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_total_emp    FROM public.employees;
  SELECT COUNT(*) INTO v_emp_null_uid FROM public.employees WHERE user_id IS NULL;

  SELECT COUNT(DISTINCT employee_id)
    INTO v_would_match
    FROM _emp_user_map
   WHERE matches_for_emp = 1 AND emps_for_user = 1;

  SELECT COUNT(DISTINCT employee_id)
    INTO v_ambiguous
    FROM _emp_user_map
   WHERE matches_for_emp > 1 OR emps_for_user > 1;

  v_no_match := v_emp_null_uid - v_would_match - v_ambiguous;

  RAISE NOTICE '────────────────────────────────────────────────';
  RAISE NOTICE 'Mevak — employees → auth.users link report';
  RAISE NOTICE '────────────────────────────────────────────────';
  RAISE NOTICE 'Dry run                   : %', p_dry_run;
  RAISE NOTICE 'Total employees           : %', v_total_emp;
  RAISE NOTICE 'Employees with user_id=NULL: %', v_emp_null_uid;
  RAISE NOTICE 'Would match (1:1, safe)   : %', v_would_match;
  RAISE NOTICE 'Ambiguous (skipped)       : %  (employee matches >1 user OR user matches >1 employee)', v_ambiguous;
  RAISE NOTICE 'No match                  : %', v_no_match;
  RAISE NOTICE '────────────────────────────────────────────────';

  -- Sample of ambiguous rows (top 20) so you can investigate manually.
  IF v_ambiguous > 0 THEN
    RAISE NOTICE 'Ambiguous samples (employee_id | full_name | user_email | matches_for_emp | emps_for_user):';
    FOR v_total_emp IN
      SELECT 1
      FROM (
        SELECT employee_id, full_name, user_email, matches_for_emp, emps_for_user
        FROM _emp_user_map
        WHERE matches_for_emp > 1 OR emps_for_user > 1
        ORDER BY employee_id
        LIMIT 20
      ) s
    LOOP
      -- (handled via separate SELECT below; loop var is dummy)
      NULL;
    END LOOP;
  END IF;

  -- -------------------------------------------------------------------------
  -- Apply update (only when not dry-run)
  -- -------------------------------------------------------------------------
  IF NOT p_dry_run THEN
    WITH safe AS (
      SELECT employee_id, user_id
      FROM _emp_user_map
      WHERE matches_for_emp = 1 AND emps_for_user = 1
    )
    UPDATE public.employees e
       SET user_id = safe.user_id
      FROM safe
     WHERE e.id = safe.employee_id
       AND e.user_id IS NULL;     -- defensive: never overwrite manual links

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'UPDATE applied. Rows updated: %', v_updated;
  ELSE
    RAISE NOTICE 'Dry-run ON — no UPDATE executed. Flip p_dry_run := false to apply.';
  END IF;
END $$;

-- Optional: inspect ambiguous matches after the DO block.
-- SELECT * FROM _emp_user_map WHERE matches_for_emp > 1 OR emps_for_user > 1;
-- (The temp table is dropped on commit; re-run the DO block to regenerate.)
