-- Certificates for completed courses. Issued by the server when the last lesson is completed (service
-- role), so nobody can mint their own; learners can read their own, admins can read all, and anyone
-- holding a certificate number can verify it through the public page (server-side lookup).
CREATE TABLE IF NOT EXISTS public.course_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number text NOT NULL UNIQUE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  learner_name text NOT NULL,
  course_title text NOT NULL,
  lessons_completed integer NOT NULL DEFAULT 0,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);
CREATE INDEX IF NOT EXISTS course_certificates_user_idx ON public.course_certificates (user_id);
ALTER TABLE public.course_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Learners read own certificates" ON public.course_certificates;
CREATE POLICY "Learners read own certificates" ON public.course_certificates FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
