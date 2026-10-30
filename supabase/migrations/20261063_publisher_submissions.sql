-- Professionals and NGOs can write blogs / publications. Admins publish directly;
-- everyone else submits for an admin to approve. Idempotent (dev + prod).

ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'content';
ALTER TABLE public.publications DROP CONSTRAINT IF EXISTS publications_display_mode_check;
ALTER TABLE public.publications ADD CONSTRAINT publications_display_mode_check CHECK (display_mode IN ('content', 'pdf'));
ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS publications_author_idx ON public.publications (author_id, updated_at DESC);

-- A professional or NGO account in good standing.
CREATE OR REPLACE FUNCTION public.is_publisher(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND COALESCE(p.is_banned, false) = false
      AND (COALESCE(p.is_admin, false) OR p.user_type IN ('professional', 'ngo'))
  );
$$;
REVOKE ALL ON FUNCTION public.is_publisher(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_publisher(uuid) TO authenticated;

-- Authors see their own items in any status.
DROP POLICY IF EXISTS publications_author_read ON public.publications;
CREATE POLICY publications_author_read ON public.publications
  FOR SELECT TO authenticated USING (author_id = auth.uid());

-- Authors create drafts or submissions only: never published/archived, never featured.
DROP POLICY IF EXISTS publications_author_insert ON public.publications;
CREATE POLICY publications_author_insert ON public.publications
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_publisher(auth.uid())
              AND status IN ('draft', 'in_review') AND featured = false);

-- Authors edit their own item while it is a draft or awaiting review.
DROP POLICY IF EXISTS publications_author_update ON public.publications;
CREATE POLICY publications_author_update ON public.publications
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND public.is_publisher(auth.uid()) AND status IN ('draft', 'in_review'))
  WITH CHECK (author_id = auth.uid() AND public.is_publisher(auth.uid())
              AND status IN ('draft', 'in_review') AND featured = false);

DROP POLICY IF EXISTS publications_author_delete ON public.publications;
CREATE POLICY publications_author_delete ON public.publications
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND status = 'draft');

-- Authors may upload covers, images, imported documents and PDFs.
DROP POLICY IF EXISTS "publications publisher insert" ON storage.objects;
CREATE POLICY "publications publisher insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'publications' AND public.is_publisher(auth.uid()));
