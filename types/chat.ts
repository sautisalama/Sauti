export type ChatType = 'dm' | 'group' | 'support_match';
export type MessageType = 'text' | 'image' | 'video' | 'file' | 'audio' | 'location' | 'system' | 'mixed';
export type ChatRole = 'admin' | 'member';

export interface ChatMetadata {
  name?: string;
  image_url?: string;
  description?: string;
  is_official?: boolean;
  appointment_id?: string;
  case_id?: string;
  support_service_id?: string;
  pinned_message_ids?: string[];
  // Community-related fields
  is_community?: boolean;
  community_id?: string;
  member_count?: number;
  last_message_preview?: {
    content: string;
    sender_id: string;
    type: MessageType;
    created_at: string;
  };
}

export interface ParticipantStatus {
  role: ChatRole;
  last_read_at?: string;
  is_pinned?: boolean;
  is_muted?: boolean;
  starred_message_ids?: string[];
  draft_message?: string;
}

export interface MessageMetadata {
  is_edited?: boolean;
  reply_to_id?: string;
  attachment_urls?: string[];
  link_preview?: {
    title?: string;
    description?: string;
    image?: string;
    url: string;
  };
  reactions?: Record<string, string[]>; // emoji -> user_ids[]
}

export interface Chat {
  id: string;
  type: ChatType;
  last_message_at: string;
  created_by: string;
  created_at: string;
  metadata: ChatMetadata;
  // Joined fields
  participants?: ChatParticipant[];
  unread_count?: number;
}

export interface ChatParticipant {
  chat_id: string;
  user_id: string;
  joined_at: string;
  status: ParticipantStatus;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string;
    isVerified?: boolean;
  };
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
  created_at: string;
  updated_at?: string;
  metadata: MessageMetadata;
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string;
  };
}
