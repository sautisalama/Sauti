-- Communities had no working messaging: the UI wrote messages with chat_id = 'community-<uuid>',
-- but messages.chat_id is a real UUID reference to chats. Each community now owns a real chat
-- (type 'community'); membership drives chat participation, so existing chat RLS (participants only)
-- keeps non-members out and members in.
--
-- Also closes a hole: the chat_participants INSERT policy let ANY user add THEMSELVES to ANY chat
-- (and then read it). Participants may now only be added by the chat's creator, or by the
-- community triggers below (SECURITY DEFINER).

ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS chat_id uuid REFERENCES public.chats(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.create_community_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  INSERT INTO public.chats (type, created_by, metadata)
  VALUES ('community', NEW.creator_id, jsonb_build_object('name', NEW.name, 'community_id', NEW.id, 'is_community', true, 'image_url', NEW.avatar_url))
  RETURNING id INTO cid;
  UPDATE public.communities SET chat_id = cid WHERE id = NEW.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_communities_create_chat ON public.communities;
CREATE TRIGGER trg_communities_create_chat AFTER INSERT ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.create_community_chat();

CREATE OR REPLACE FUNCTION public.sync_community_chat_participant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT chat_id INTO cid FROM public.communities WHERE id = NEW.community_id;
    IF cid IS NOT NULL AND NEW.user_id IS NOT NULL THEN
      INSERT INTO public.chat_participants (chat_id, user_id, status)
      VALUES (cid, NEW.user_id, jsonb_build_object('role', CASE WHEN NEW.role::text = 'member' THEN 'member' ELSE 'admin' END))
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT chat_id INTO cid FROM public.communities WHERE id = OLD.community_id;
    IF cid IS NOT NULL THEN
      DELETE FROM public.chat_participants WHERE chat_id = cid AND user_id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_community_members_sync_chat ON public.community_members;
CREATE TRIGGER trg_community_members_sync_chat AFTER INSERT OR DELETE ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_community_chat_participant();

REVOKE ALL ON FUNCTION public.create_community_chat(), public.sync_community_chat_participant() FROM PUBLIC, anon, authenticated;

-- Backfill communities that already exist.
DO $$
DECLARE c record; cid uuid;
BEGIN
  FOR c IN SELECT * FROM public.communities WHERE chat_id IS NULL LOOP
    INSERT INTO public.chats (type, created_by, metadata)
    VALUES ('community', c.creator_id, jsonb_build_object('name', c.name, 'community_id', c.id, 'is_community', true, 'image_url', c.avatar_url))
    RETURNING id INTO cid;
    UPDATE public.communities SET chat_id = cid WHERE id = c.id;
    INSERT INTO public.chat_participants (chat_id, user_id, status)
    SELECT cid, m.user_id, jsonb_build_object('role', CASE WHEN m.role::text = 'member' THEN 'member' ELSE 'admin' END)
    FROM public.community_members m WHERE m.community_id = c.id AND m.user_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Only a chat's creator may add participants (previously: any user could add themselves anywhere).
DROP POLICY IF EXISTS "Users can manage participants" ON public.chat_participants;
CREATE POLICY "Chat creators add participants" ON public.chat_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_participants.chat_id AND c.created_by = auth.uid()));
