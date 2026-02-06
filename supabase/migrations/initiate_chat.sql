-- Create Chat Types
CREATE TYPE public.chat_type AS ENUM ('dm', 'group', 'support_match');
CREATE TYPE public.chat_role AS ENUM ('admin', 'member');
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'video', 'file', 'audio', 'location', 'system', 'mixed');

-- 1. CHATS Table
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.chat_type NOT NULL DEFAULT 'dm',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. CHAT PARTICIPANTS Table
CREATE TABLE public.chat_participants (
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status JSONB DEFAULT '{"role": "member", "is_pinned": false, "is_muted": false, "last_read_at": null}'::jsonb,
  PRIMARY KEY (chat_id, user_id)
);

-- 3. MESSAGES Table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT,
  type public.message_type NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX idx_chats_last_message_at ON public.chats(last_message_at DESC);
CREATE INDEX idx_participants_user ON public.chat_participants(user_id);
CREATE INDEX idx_participants_chat ON public.chat_participants(chat_id);
CREATE INDEX idx_messages_chat_created ON public.messages(chat_id, created_at DESC);
CREATE INDEX idx_messages_type ON public.messages(chat_id, type);
CREATE INDEX idx_messages_metadata ON public.messages USING GIN (metadata);

-- RLS POLICIES
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: Chat Participants (Users can see records where they are participating)
CREATE POLICY "Users can view their own chat participations"
  ON public.chat_participants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can join chats"
  ON public.chat_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id); 
  -- Note: tighter control might be needed for group creation logic in app functions

CREATE POLICY "Users can update their own participant status"
  ON public.chat_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Chats (Visible if you are a participant)
CREATE POLICY "Users can view chats they are participants of"
  ON public.chats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create chats"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update chats they are participants of"
  ON public.chats FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = id AND cp.user_id = auth.uid()
    )
  );


-- Policy: Messages (Visible if you are a participant of the chat)
CREATE POLICY "Users can view messages in their chats"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = chat_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their chats"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = chat_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- FUNCTIONS & TRIGGERS

-- Function to update chat's last_message_at on new message
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chats
  SET last_message_at = NEW.created_at,
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb), 
        '{last_message_preview}', 
        jsonb_build_object(
          'content', LEFT(NEW.content, 50),
          'sender_id', NEW.sender_id,
          'type', NEW.type,
          'created_at', NEW.created_at
        )
      )
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_message();

-- Storage Bucket for Chat Media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Chat media Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'chat-media' AND auth.role() = 'authenticated' );

CREATE POLICY "Chat media Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'chat-media' AND auth.role() = 'authenticated' );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;

