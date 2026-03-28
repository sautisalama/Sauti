-- Fix RLS policies for chat creation and participant management
-- Created: 2026-03-28

-- 1. Allow chat creators to view their own chats (for INSERT ... RETURNING to work correctly)
DROP POLICY IF EXISTS "Users can view chats they are participants of" ON public.chats;
CREATE POLICY "Users can view chats they are participants of"
ON public.chats FOR SELECT
USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.chat_id = id AND cp.user_id = auth.uid()
  )
);

-- 4. Allow participants to see other participants in the same chat
DROP POLICY IF EXISTS "Users can view their own chat participations" ON public.chat_participants;
CREATE POLICY "Users can view participants in their chats"
ON public.chat_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.chat_id = chat_id AND cp.user_id = auth.uid()
  )
);

-- 2. Allow chat creators to manage participants (essential for system-initiated chats)
DROP POLICY IF EXISTS "Users can join chats" ON public.chat_participants;
CREATE POLICY "Users can manage participants"
ON public.chat_participants FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id AND c.created_by = auth.uid()
  )
);

-- 3. Ensure professionals can update their own chats
DROP POLICY IF EXISTS "Users can update chats they are participants of" ON public.chats;
CREATE POLICY "Users can update chats they are participants of"
ON public.chats FOR UPDATE
USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.chat_id = id AND cp.user_id = auth.uid()
  )
);
