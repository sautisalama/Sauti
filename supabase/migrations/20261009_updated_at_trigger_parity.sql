-- Dev has `updated_at` auto-update triggers that production never received, so on
-- production `matched_services.updated_at` (used to detect inactive cases), profiles,
-- communities, blogs and case_recommendations only changed when app code remembered to set it.
-- Idempotent: safe on both databases.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('matched_services',    'update_matched_services_updated_at'),
    ('profiles',            'update_profiles_updated_at'),
    ('communities',         'update_communities_updated_at'),
    ('blogs',               'update_blogs_updated_at'),
    ('case_recommendations','update_case_recommendations_updated_at')
  ) AS t(tbl, trg) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.trg, r.tbl);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', r.trg, r.tbl);
  END LOOP;
END $$;
