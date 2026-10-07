-- Publishing (blogs, publications, resources, learn articles) and coursework.
-- Idempotent: safe to run on both the dev and production databases.
-- Depends on: public.profiles(is_admin), public.is_admin(uuid), update_updated_at_column().

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Harden the existing admin check (SECURITY DEFINER without a pinned search_path
-- can be hijacked by objects in a caller-controlled schema).
ALTER FUNCTION public.is_admin(uuid) SET search_path = public;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Type/DB drift fix: the app and generated types reference these blogs columns.
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS excerpt text;
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS rejection_reason text;

-- ---------------------------------------------------------------------------
-- publications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.publications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  kind             text NOT NULL DEFAULT 'publication'
                   CHECK (kind IN ('blog', 'publication', 'resource', 'learn')),
  title            text NOT NULL CHECK (char_length(btrim(title)) >= 3),
  summary          text,
  body             text NOT NULL DEFAULT '',          -- sanitised HTML
  cover_image_url  text,
  cover_image_alt  text,
  category         text,
  tags             text[] NOT NULL DEFAULT '{}',
  read_minutes     integer,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  featured         boolean NOT NULL DEFAULT false,
  author_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at     timestamptz,
  source_file_url  text,                              -- original upload (docx/pdf)
  source_file_name text,
  source_file_type text,
  external_links   jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ "label": "...", "url": "https://..." }]
  preview_token    uuid NOT NULL DEFAULT gen_random_uuid(),
  emailed_at       timestamptz,
  email_status     text,
  view_count       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT publications_external_links_is_array CHECK (jsonb_typeof(external_links) = 'array'),
  CONSTRAINT publications_published_has_date CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS publications_feed_idx
  ON public.publications (status, published_at DESC);
CREATE INDEX IF NOT EXISTS publications_kind_idx
  ON public.publications (kind, status, published_at DESC);

CREATE OR REPLACE FUNCTION public.publications_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  -- Moving back to draft/review keeps the original publish date so a
  -- re-publish does not reorder the feed; archived content is simply hidden.
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_publications_before_write ON public.publications;
CREATE TRIGGER trg_publications_before_write
  BEFORE INSERT OR UPDATE ON public.publications
  FOR EACH ROW EXECUTE FUNCTION public.publications_before_write();

ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS publications_public_read ON public.publications;
CREATE POLICY publications_public_read ON public.publications
  FOR SELECT USING (status = 'published' OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS publications_admin_write ON public.publications;
CREATE POLICY publications_admin_write ON public.publications
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Audit trail of status changes.
CREATE TABLE IF NOT EXISTS public.publication_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  actor_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action         text NOT NULL,
  detail         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS publication_events_pub_idx
  ON public.publication_events (publication_id, created_at DESC);
ALTER TABLE public.publication_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS publication_events_admin ON public.publication_events;
CREATE POLICY publication_events_admin ON public.publication_events
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Atomic view counter that does not need write access on the table.
CREATE OR REPLACE FUNCTION public.increment_publication_views(p_slug text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.publications SET view_count = view_count + 1
  WHERE slug = p_slug AND status = 'published';
$$;
GRANT EXECUTE ON FUNCTION public.increment_publication_views(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.courses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  title             text NOT NULL CHECK (char_length(btrim(title)) >= 3),
  summary           text,
  description       text,                              -- sanitised HTML
  cover_image_url   text,
  level             text NOT NULL DEFAULT 'beginner'
                    CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  estimated_minutes integer,
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'archived')),
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_modules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title      text NOT NULL,
  summary    text,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_modules_course_idx
  ON public.course_modules (course_id, position);

CREATE TABLE IF NOT EXISTS public.course_lessons (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id         uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  course_id         uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title             text NOT NULL,
  content           text NOT NULL DEFAULT '',          -- sanitised HTML
  video_url         text,
  estimated_minutes integer,
  position          integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_lessons_module_idx
  ON public.course_lessons (module_id, position);
CREATE INDEX IF NOT EXISTS course_lessons_course_idx
  ON public.course_lessons (course_id);

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id      uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at    timestamptz NOT NULL DEFAULT now(),
  last_lesson_id uuid REFERENCES public.course_lessons(id) ON DELETE SET NULL,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  UNIQUE (course_id, user_id)
);
CREATE INDEX IF NOT EXISTS course_enrollments_user_idx
  ON public.course_enrollments (user_id);

CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id    uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id    uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS lesson_progress_user_course_idx
  ON public.lesson_progress (user_id, course_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['courses', 'course_modules', 'course_lessons'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_touch ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_touch BEFORE UPDATE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.courses_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_courses_before_write ON public.courses;
CREATE TRIGGER trg_courses_before_write
  BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.courses_before_write();

-- A lesson row must belong to the same course as its module.
CREATE OR REPLACE FUNCTION public.course_lessons_check_course()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.course_modules m
                 WHERE m.id = NEW.module_id AND m.course_id = NEW.course_id) THEN
    RAISE EXCEPTION 'lesson.course_id must match its module''s course';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_course_lessons_check_course ON public.course_lessons;
CREATE TRIGGER trg_course_lessons_check_course
  BEFORE INSERT OR UPDATE OF module_id, course_id ON public.course_lessons
  FOR EACH ROW EXECUTE FUNCTION public.course_lessons_check_course();

ALTER TABLE public.courses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress    ENABLE ROW LEVEL SECURITY;

-- Catalogue (courses + outline) is public; lesson bodies require sign-in.
DROP POLICY IF EXISTS courses_read ON public.courses;
CREATE POLICY courses_read ON public.courses FOR SELECT
  USING (status = 'published' OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS courses_admin ON public.courses;
CREATE POLICY courses_admin ON public.courses FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS course_modules_read ON public.course_modules;
CREATE POLICY course_modules_read ON public.course_modules FOR SELECT
  USING (public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.status = 'published'));
DROP POLICY IF EXISTS course_modules_admin ON public.course_modules;
CREATE POLICY course_modules_admin ON public.course_modules FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS course_lessons_read ON public.course_lessons;
CREATE POLICY course_lessons_read ON public.course_lessons FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.status = 'published'));
DROP POLICY IF EXISTS course_lessons_admin ON public.course_lessons;
CREATE POLICY course_lessons_admin ON public.course_lessons FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Enrollment + progress: learners own their rows; admins can read everything.
DROP POLICY IF EXISTS enrollments_own ON public.course_enrollments;
CREATE POLICY enrollments_own ON public.course_enrollments FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS enrollments_admin_read ON public.course_enrollments;
CREATE POLICY enrollments_admin_read ON public.course_enrollments FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS progress_own ON public.lesson_progress;
CREATE POLICY progress_own ON public.lesson_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS progress_admin_read ON public.lesson_progress;
CREATE POLICY progress_admin_read ON public.lesson_progress FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: public bucket for covers, imported documents and inline images.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('publications', 'publications', true, 26214400, NULL)  -- 25 MB
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 26214400;

DROP POLICY IF EXISTS "publications public read" ON storage.objects;
CREATE POLICY "publications public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'publications');

DROP POLICY IF EXISTS "publications admin insert" ON storage.objects;
CREATE POLICY "publications admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'publications' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "publications admin update" ON storage.objects;
CREATE POLICY "publications admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'publications' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'publications' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "publications admin delete" ON storage.objects;
CREATE POLICY "publications admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'publications' AND public.is_admin(auth.uid()));
