export type ChatType = 'dm' | 'group' | 'support_match' | 'community';
export type MessageType = 'text' | 'image' | 'video' | 'file' | 'audio' | 'location' | 'system' | 'mixed';
export type ChatRole = 'admin' | 'member';
export type MatchStatusType = 'pending' | 'proposed' | 'pending_survivor' | 'accepted' | 'declined' | 'reschedule_requested' | 'completed' | 'cancelled';

// Read receipt structure
export interface ReadReceipt {
  user_id: string;
  read_at: string;
}

// Reaction structure: { user_id: emoji }
export type MessageReactions = Record<string, string>;

export interface ChatMetadata {
  name?: string;
  image_url?: string;
  description?: string;
  is_official?: boolean;
  appointment_id?: string;
  case_id?: string;
  match_id?: string;
  support_service_id?: string;
  pinned_message_ids?: string[];
  report_id?: string;
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

export interface Attachment {
  id?: string;
  url: string;
  type: 'image' | 'video' | 'file' | 'audio';
  name?: string;
  size?: number;
  path?: string; // storage path
}

export interface MessageMetadata {
  is_edited?: boolean;
  reply_to_id?: string;
  attachment_urls?: string[]; // Deprecated in favor of attachments column
  link_preview?: {
    title?: string;
    description?: string;
    image?: string;
    url: string;
    site_name?: string;
    favicon?: string;
  };
}

export interface Chat {
  id: string;
  type: ChatType;
  last_message_at: string;
  created_by: string;
  created_at: string;
  metadata: ChatMetadata;
  match_id?: string;
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
  attachments?: Attachment[] | null;
  metadata: MessageMetadata;
  // New fields for enhanced chat
  reactions?: MessageReactions;
  read_by?: ReadReceipt[];
  delivered_at?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  reply_to_id?: string;
  // Joined fields
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string;
  };
  reply_to?: Message; // For thread display
}

// Availability block type
export interface AvailabilityBlock {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  reason?: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
  created_at?: string;
  updated_at?: string;
}

// Time slot for scheduling
export interface TimeSlot {
  slot_start: string;
  slot_end: string;
}

// Match with extended fields
export interface MatchedService {
  id: string;
  survivor_id?: string;
  report_id?: string;
  service_id?: string;
  support_service?: string;
  match_score?: number;
  match_status_type?: MatchStatusType;
  match_date?: string;
  description?: string;
  notes?: string;
  feedback?: string;
  professional_accepted_at?: string;
  survivor_accepted_at?: string;
  proposed_meeting_times?: TimeSlot[];
  chat_id?: string;
  decline_reason?: string;
  // Joined
  support_services?: {
    id: string;
    name: string;
    service_types: string;
    user_id?: string;
    email?: string;
    phone_number?: string;
  };
  profiles?: {
    id: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}
// Transformation utilities for Supabase JSONB fields
export function transformChat(data: any): Chat {
  return {
    ...data,
    metadata: (data.metadata || {}) as ChatMetadata,
    participants: data.participants?.map((p: any) => ({
      ...p,
      status: (p.status || {}) as ParticipantStatus,
      user: p.user ? {
        id: p.user.id,
        first_name: p.user.first_name || '',
        last_name: p.user.last_name || '',
        avatar_url: p.user.avatar_url || '',
        isVerified: p.user.isVerified
      } : undefined
    }))
  };
}

export function transformMessage(data: any): Message {
  return {
    ...data,
    metadata: (data.metadata || {}) as MessageMetadata,
    attachments: (data.attachments as unknown as Attachment[]) || null,
    reactions: (data.reactions || {}) as MessageReactions,
    read_by: (data.read_by as unknown as ReadReceipt[]) || undefined
  };
}
