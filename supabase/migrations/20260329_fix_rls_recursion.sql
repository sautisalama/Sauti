-- CONSOLIDATED RLS FIX: Resolve infinite recursion in chat_participants
-- Created: 2026-03-29 11:26

-- 1. Helper function to check participation without triggering RLS recursion
-- SECURITY DEFINER allows this function to bypass RLS checks for the tables it queries internally.
CREATE OR REPLACE FUNCTION public.check_user_is_chat_participant(_chat_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = _chat_id AND user_id = _user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. REFRESH CHATS POLICIES
DROP POLICY IF EXISTS "Users can view chats they are participants of" ON public.chats;
CREATE POLICY "Users can view chats they are participants of"
ON public.chats FOR SELECT
USING (
  auth.uid() = created_by OR 
  public.check_user_is_chat_participant(id)
);

DROP POLICY IF EXISTS "Users can update chats they are participants of" ON public.chats;
CREATE POLICY "Users can update chats they are participants of"
ON public.chats FOR UPDATE
USING (
  auth.uid() = created_by OR 
  public.check_user_is_chat_participant(id)
);

-- 3. REFRESH CHAT_PARTICIPANTS POLICIES (THE RECURSION SOURCE)
DROP POLICY IF EXISTS "Users can view participants in their chats" ON public.chat_participants;
CREATE POLICY "Users can view participants in their chats"
ON public.chat_participants FOR SELECT
USING (
  auth.uid() = user_id OR -- Always allow seeing your own participation
  public.check_user_is_chat_participant(chat_id) -- Use function to see others in the same chat
);

-- 4. REFRESH MESSAGES POLICIES
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;
CREATE POLICY "Users can view messages in their chats"
ON public.messages FOR SELECT
USING (public.check_user_is_chat_participant(chat_id));

DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.messages;
CREATE POLICY "Users can insert messages in their chats"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  public.check_user_is_chat_participant(chat_id)
);
