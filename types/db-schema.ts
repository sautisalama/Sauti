export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["admin_action_type"]
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
        }
        Insert: {
          action_type: Database["public"]["Enums"]["admin_action_type"]
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
        }
        Update: {
          action_type?: Database["public"]["Enums"]["admin_action_type"]
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_statistics: {
        Row: {
          id: string
          stat_data: Json
          stat_type: Database["public"]["Enums"]["stat_type"]
          updated_at: string | null
        }
        Insert: {
          id?: string
          stat_data: Json
          stat_type: Database["public"]["Enums"]["stat_type"]
          updated_at?: string | null
        }
        Update: {
          id?: string
          stat_data?: Json
          stat_type?: Database["public"]["Enums"]["stat_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string | null
          appointment_id: string
          appointment_type: string | null
          calendar_sync_status: string | null
          created_at: string | null
          created_via: string | null
          duration_minutes: number | null
          emergency_contact: string | null
          google_calendar_event_id: string | null
          matched_services: string | null
          notes: string | null
          professional_id: string | null
          status: Database["public"]["Enums"]["appointment_status_type"] | null
          survivor_id: string | null
        }
        Insert: {
          appointment_date?: string | null
          appointment_id?: string
          appointment_type?: string | null
          calendar_sync_status?: string | null
          created_at?: string | null
          created_via?: string | null
          duration_minutes?: number | null
          emergency_contact?: string | null
          google_calendar_event_id?: string | null
          matched_services?: string | null
          notes?: string | null
          professional_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status_type"] | null
          survivor_id?: string | null
        }
        Update: {
          appointment_date?: string | null
          appointment_id?: string
          appointment_type?: string | null
          calendar_sync_status?: string | null
          created_at?: string | null
          created_via?: string | null
          duration_minutes?: number | null
          emergency_contact?: string | null
          google_calendar_event_id?: string | null
          matched_services?: string | null
          notes?: string | null
          professional_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status_type"] | null
          survivor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_matched_services_fkey"
            columns: ["matched_services"]
            isOneToOne: false
            referencedRelation: "matched_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_survivor_id_fkey"
            columns: ["survivor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blogs: {
        Row: {
          admin_notes: string | null
          author_id: string | null
          category: string | null
          content: string
          cover_image_url: string | null
          created_at: string | null
          event_details: Json | null
          id: string
          is_event: boolean | null
          published_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          status: Database["public"]["Enums"]["blog_status_type"] | null
          tags: Json | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          admin_notes?: string | null
          author_id?: string | null
          category?: string | null
          content: string
          cover_image_url?: string | null
          created_at?: string | null
          event_details?: Json | null
          id?: string
          is_event?: boolean | null
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["blog_status_type"] | null
          tags?: Json | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          admin_notes?: string | null
          author_id?: string | null
          category?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string | null
          event_details?: Json | null
          id?: string
          is_event?: boolean | null
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["blog_status_type"] | null
          tags?: Json | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blogs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blogs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_recommendations: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_shared_with_survivor: boolean | null
          match_id: string | null
          professional_id: string | null
          shared_at: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_shared_with_survivor?: boolean | null
          match_id?: string | null
          professional_id?: string | null
          shared_at?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_shared_with_survivor?: boolean | null
          match_id?: string | null
          professional_id?: string | null
          shared_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_recommendations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matched_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_recommendations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_shares: {
        Row: {
          created_at: string | null
          from_professional_id: string | null
          id: string
          include_notes: boolean | null
          include_recommendations: boolean | null
          match_id: string | null
          original_match_date: string | null
          reason: string | null
          required_services: Json | null
          responded_at: string | null
          status: Database["public"]["Enums"]["case_share_status_type"] | null
          support_history: Json | null
          to_professional_id: string | null
          to_service_pool: boolean | null
        }
        Insert: {
          created_at?: string | null
          from_professional_id?: string | null
          id?: string
          include_notes?: boolean | null
          include_recommendations?: boolean | null
          match_id?: string | null
          original_match_date?: string | null
          reason?: string | null
          required_services?: Json | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["case_share_status_type"] | null
          support_history?: Json | null
          to_professional_id?: string | null
          to_service_pool?: boolean | null
        }
        Update: {
          created_at?: string | null
          from_professional_id?: string | null
          id?: string
          include_notes?: boolean | null
          include_recommendations?: boolean | null
          match_id?: string | null
          original_match_date?: string | null
          reason?: string | null
          required_services?: Json | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["case_share_status_type"] | null
          support_history?: Json | null
          to_professional_id?: string | null
          to_service_pool?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "case_shares_from_professional_id_fkey"
            columns: ["from_professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_shares_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matched_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_shares_to_professional_id_fkey"
            columns: ["to_professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          chat_id: string
          joined_at: string | null
          status: Json | null
          user_id: string
        }
        Insert: {
          chat_id: string
          joined_at?: string | null
          status?: Json | null
          user_id: string
        }
        Update: {
          chat_id?: string
          joined_at?: string | null
          status?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          last_message_at: string | null
          metadata: Json | null
          type: Database["public"]["Enums"]["chat_type"]
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          type?: Database["public"]["Enums"]["chat_type"]
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          type?: Database["public"]["Enums"]["chat_type"]
        }
        Relationships: [
          {
            foreignKeyName: "chats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          creator_id: string | null
          description: string | null
          id: string
          is_public: boolean | null
          member_count: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          member_count?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          member_count?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communities_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_invitations: {
        Row: {
          community_id: string | null
          created_at: string | null
          id: string
          invitee_id: string | null
          inviter_id: string | null
          message: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["invitation_status_type"] | null
        }
        Insert: {
          community_id?: string | null
          created_at?: string | null
          id?: string
          invitee_id?: string | null
          inviter_id?: string | null
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status_type"] | null
        }
        Update: {
          community_id?: string | null
          created_at?: string | null
          id?: string
          invitee_id?: string | null
          inviter_id?: string | null
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "community_invitations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string | null
          id: string
          joined_at: string | null
          role: Database["public"]["Enums"]["community_role_type"] | null
          user_id: string | null
        }
        Insert: {
          community_id?: string | null
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["community_role_type"] | null
          user_id?: string | null
        }
        Update: {
          community_id?: string | null
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["community_role_type"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matched_services: {
        Row: {
          description: string | null
          feedback: string | null
          id: string
          match_date: string | null
          match_score: number | null
          match_status_type:
            | Database["public"]["Enums"]["match_status_type"]
            | null
          notes: string | null
          recommendations: Json | null
          report_id: string | null
          service_id: string | null
          shared_from_match_id: string | null
          support_service:
            | Database["public"]["Enums"]["support_service_type"]
            | null
          survivor_id: string | null
          updated_at: string | null
        }
        Insert: {
          description?: string | null
          feedback?: string | null
          id?: string
          match_date?: string | null
          match_score?: number | null
          match_status_type?:
            | Database["public"]["Enums"]["match_status_type"]
            | null
          notes?: string | null
          recommendations?: Json | null
          report_id?: string | null
          service_id?: string | null
          shared_from_match_id?: string | null
          support_service?:
            | Database["public"]["Enums"]["support_service_type"]
            | null
          survivor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          description?: string | null
          feedback?: string | null
          id?: string
          match_date?: string | null
          match_score?: number | null
          match_status_type?:
            | Database["public"]["Enums"]["match_status_type"]
            | null
          notes?: string | null
          recommendations?: Json | null
          report_id?: string | null
          service_id?: string | null
          shared_from_match_id?: string | null
          support_service?:
            | Database["public"]["Enums"]["support_service_type"]
            | null
          survivor_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matched_services_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "matched_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "support_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matched_services_shared_from_match_id_fkey"
            columns: ["shared_from_match_id"]
            isOneToOne: false
            referencedRelation: "matched_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matched_services_survivor_id_fkey"
            columns: ["survivor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json[] | null
          chat_id: string | null
          content: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          sender_id: string | null
          type: Database["public"]["Enums"]["message_type"]
          updated_at: string | null
        }
        Insert: {
          attachments?: Json[] | null
          chat_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          sender_id?: string | null
          type?: Database["public"]["Enums"]["message_type"]
          updated_at?: string | null
        }
        Update: {
          attachments?: Json[] | null
          chat_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          sender_id?: string | null
          type?: Database["public"]["Enums"]["message_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          message: string | null
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accreditation_files: Json | null
          accreditation_files_metadata: Json | null
          accreditation_member_number: Json | null
          admin_verified_at: string | null
          admin_verified_by: string | null
          anon_username: string | null
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          banned_by: string | null
          bio: string | null
          cal_link: string | null
          calendar_sync_enabled: boolean | null
          calendar_sync_settings: Json | null
          created_at: string | null
          email: string | null
          first_name: string | null
          google_calendar_refresh_token: string | null
          google_calendar_token: string | null
          google_calendar_token_expiry: number | null
          id: string
          is_admin: boolean | null
          is_anonymous: boolean | null
          is_banned: boolean | null
          is_public_booking: boolean | null
          isVerified: boolean | null
          last_name: string | null
          last_verification_check: string | null
          phone: string | null
          professional_title: string | null
          profile_image_metadata: Json | null
          profile_image_url: string | null
          reviewed_by: Json | null
          settings: Json | null
          updated_at: string | null
          user_type: Database["public"]["Enums"]["user_type"] | null
          verification_notes: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status_type"]
            | null
          verification_updated_at: string | null
        }
        Insert: {
          accreditation_files?: Json | null
          accreditation_files_metadata?: Json | null
          accreditation_member_number?: Json | null
          admin_verified_at?: string | null
          admin_verified_by?: string | null
          anon_username?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          bio?: string | null
          cal_link?: string | null
          calendar_sync_enabled?: boolean | null
          calendar_sync_settings?: Json | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          google_calendar_refresh_token?: string | null
          google_calendar_token?: string | null
          google_calendar_token_expiry?: number | null
          id: string
          is_admin?: boolean | null
          is_anonymous?: boolean | null
          is_banned?: boolean | null
          is_public_booking?: boolean | null
          isVerified?: boolean | null
          last_name?: string | null
          last_verification_check?: string | null
          phone?: string | null
          professional_title?: string | null
          profile_image_metadata?: Json | null
          profile_image_url?: string | null
          reviewed_by?: Json | null
          settings?: Json | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"] | null
          verification_notes?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status_type"]
            | null
          verification_updated_at?: string | null
        }
        Update: {
          accreditation_files?: Json | null
          accreditation_files_metadata?: Json | null
          accreditation_member_number?: Json | null
          admin_verified_at?: string | null
          admin_verified_by?: string | null
          anon_username?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          bio?: string | null
          cal_link?: string | null
          calendar_sync_enabled?: boolean | null
          calendar_sync_settings?: Json | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          google_calendar_refresh_token?: string | null
          google_calendar_token?: string | null
          google_calendar_token_expiry?: number | null
          id?: string
          is_admin?: boolean | null
          is_anonymous?: boolean | null
          is_banned?: boolean | null
          is_public_booking?: boolean | null
          isVerified?: boolean | null
          last_name?: string | null
          last_verification_check?: string | null
          phone?: string | null
          professional_title?: string | null
          profile_image_metadata?: Json | null
          profile_image_url?: string | null
          reviewed_by?: Json | null
          settings?: Json | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"] | null
          verification_notes?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status_type"]
            | null
          verification_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_admin_verified_by_fkey"
            columns: ["admin_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          additional_info: string | null
          administrative: Json | null
          city: string | null
          consent: Database["public"]["Enums"]["consent_type"] | null
          contact_preference:
            | Database["public"]["Enums"]["contact_preference_type"]
            | null
          continent: string | null
          continent_code: string | null
          country: string | null
          country_code: string | null
          dob: string | null
          email: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          incident_description: string | null
          is_onBehalf: boolean | null
          ismatched: boolean | null
          last_name: string | null
          latitude: number | null
          locality: string | null
          location: string | null
          longitude: number | null
          match_status: Database["public"]["Enums"]["match_status_type"] | null
          media: Json | null
          notes: string | null
          phone: string | null
          plus_code: string | null
          postcode: string | null
          preferred_language:
            | Database["public"]["Enums"]["language_type"]
            | null
          principal_subdivision: string | null
          principal_subdivision_code: string | null
          record_only: boolean | null
          report_id: string
          required_services: Json | null
          state: string | null
          submission_timestamp: string | null
          support_services:
            | Database["public"]["Enums"]["support_service_type"]
            | null
          type_of_incident: Database["public"]["Enums"]["incident_type"] | null
          urgency: Database["public"]["Enums"]["urgency_type"] | null
          user_id: string | null
        }
        Insert: {
          additional_info?: string | null
          administrative?: Json | null
          city?: string | null
          consent?: Database["public"]["Enums"]["consent_type"] | null
          contact_preference?:
            | Database["public"]["Enums"]["contact_preference_type"]
            | null
          continent?: string | null
          continent_code?: string | null
          country?: string | null
          country_code?: string | null
          dob?: string | null
          email?: string | null
          first_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          incident_description?: string | null
          is_onBehalf?: boolean | null
          ismatched?: boolean | null
          last_name?: string | null
          latitude?: number | null
          locality?: string | null
          location?: string | null
          longitude?: number | null
          match_status?: Database["public"]["Enums"]["match_status_type"] | null
          media?: Json | null
          notes?: string | null
          phone?: string | null
          plus_code?: string | null
          postcode?: string | null
          preferred_language?:
            | Database["public"]["Enums"]["language_type"]
            | null
          principal_subdivision?: string | null
          principal_subdivision_code?: string | null
          record_only?: boolean | null
          report_id?: string
          required_services?: Json | null
          state?: string | null
          submission_timestamp?: string | null
          support_services?:
            | Database["public"]["Enums"]["support_service_type"]
            | null
          type_of_incident?: Database["public"]["Enums"]["incident_type"] | null
          urgency?: Database["public"]["Enums"]["urgency_type"] | null
          user_id?: string | null
        }
        Update: {
          additional_info?: string | null
          administrative?: Json | null
          city?: string | null
          consent?: Database["public"]["Enums"]["consent_type"] | null
          contact_preference?:
            | Database["public"]["Enums"]["contact_preference_type"]
            | null
          continent?: string | null
          continent_code?: string | null
          country?: string | null
          country_code?: string | null
          dob?: string | null
          email?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          incident_description?: string | null
          is_onBehalf?: boolean | null
          ismatched?: boolean | null
          last_name?: string | null
          latitude?: number | null
          locality?: string | null
          location?: string | null
          longitude?: number | null
          match_status?: Database["public"]["Enums"]["match_status_type"] | null
          media?: Json | null
          notes?: string | null
          phone?: string | null
          plus_code?: string | null
          postcode?: string | null
          preferred_language?:
            | Database["public"]["Enums"]["language_type"]
            | null
          principal_subdivision?: string | null
          principal_subdivision_code?: string | null
          record_only?: boolean | null
          report_id?: string
          required_services?: Json | null
          state?: string | null
          submission_timestamp?: string | null
          support_services?:
            | Database["public"]["Enums"]["support_service_type"]
            | null
          type_of_incident?: Database["public"]["Enums"]["incident_type"] | null
          urgency?: Database["public"]["Enums"]["urgency_type"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_shares: {
        Row: {
          created_at: string | null
          from_user_id: string | null
          id: string
          service_id: string | null
          status: string | null
          to_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          service_id?: string | null
          status?: string | null
          to_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          service_id?: string | null
          status?: string | null
          to_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_shares_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_shares_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "support_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_shares_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_services: {
        Row: {
          accreditation_files_metadata: Json | null
          availability: string | null
          ban_reason: string | null
          banned_at: string | null
          banned_by: string | null
          coverage_area_radius: number | null
          created_at: string | null
          email: string | null
          helpline: string | null
          id: string
          is_active: boolean | null
          is_banned: boolean | null
          is_permanently_suspended: boolean | null
          last_verification_check: string | null
          latitude: number | null
          longitude: number | null
          name: string
          phone_number: string | null
          priority: number | null
          reviewed_by: Json | null
          service_types: Database["public"]["Enums"]["support_service_type"]
          suspension_end_date: string | null
          suspension_reason: string | null
          user_id: string | null
          verification_notes: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status_type"]
            | null
          verification_updated_at: string | null
          verified_at: string | null
          verified_by: string | null
          website: string | null
        }
        Insert: {
          accreditation_files_metadata?: Json | null
          availability?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          coverage_area_radius?: number | null
          created_at?: string | null
          email?: string | null
          helpline?: string | null
          id?: string
          is_active?: boolean | null
          is_banned?: boolean | null
          is_permanently_suspended?: boolean | null
          last_verification_check?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone_number?: string | null
          priority?: number | null
          reviewed_by?: Json | null
          service_types: Database["public"]["Enums"]["support_service_type"]
          suspension_end_date?: string | null
          suspension_reason?: string | null
          user_id?: string | null
          verification_notes?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status_type"]
            | null
          verification_updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Update: {
          accreditation_files_metadata?: Json | null
          availability?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          coverage_area_radius?: number | null
          created_at?: string | null
          email?: string | null
          helpline?: string | null
          id?: string
          is_active?: boolean | null
          is_banned?: boolean | null
          is_permanently_suspended?: boolean | null
          last_verification_check?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone_number?: string | null
          priority?: number | null
          reviewed_by?: Json | null
          service_types?: Database["public"]["Enums"]["support_service_type"]
          suspension_end_date?: string | null
          suspension_reason?: string | null
          user_id?: string | null
          verification_notes?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status_type"]
            | null
          verification_updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_services_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_services_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_services_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_dashboard_stats: {
        Row: {
          active_services: number | null
          banned_services: number | null
          banned_users: number | null
          pending_service_verifications: number | null
          pending_verifications: number | null
          rejected_services: number | null
          rejected_users: number | null
          total_admins: number | null
          total_ngos: number | null
          total_professionals: number | null
          total_survivors: number | null
          verified_users: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_calendar_tokens: { Args: never; Returns: undefined }
      cleanup_orphaned_files: { Args: never; Returns: number }
      get_coverage_map_data: {
        Args: never
        Returns: {
          coverage_radius: number
          is_active: boolean
          latitude: number
          longitude: number
          service_id: string
          service_name: string
          service_type: string
          verification_status: Database["public"]["Enums"]["verification_status_type"]
        }[]
      }
      get_user_file_stats: { Args: { user_uuid: string }; Returns: Json }
      get_user_role_context: {
        Args: { target_user_id?: string }
        Returns: {
          can_switch_to_admin: boolean
          is_admin: boolean
          primary_role: Database["public"]["Enums"]["user_type"]
          user_id: string
        }[]
      }
      is_admin: { Args: { user_id?: string }; Returns: boolean }
    }
    Enums: {
      admin_action_type:
        | "verify_user"
        | "ban_user"
        | "verify_service"
        | "ban_service"
        | "unban_user"
        | "unban_service"
        | "reject_user"
        | "reject_service"
      appointment_status_type: "pending" | "confirmed" | "requested"
      blog_status_type:
        | "draft"
        | "pending_review"
        | "approved"
        | "rejected"
        | "published"
      case_share_status_type: "pending" | "accepted" | "declined"
      chat_role: "admin" | "member"
      chat_type: "dm" | "group" | "support_match" | "community"
      community_role_type: "admin" | "moderator" | "member"
      consent_type: "yes" | "no"
      contact_preference_type: "phone_call" | "sms" | "email" | "do_not_contact"
      gender_type: "female" | "male" | "non_binary" | "prefer_not_to_say"
      incident_type:
        | "physical"
        | "emotional"
        | "sexual"
        | "financial"
        | "child_abuse"
        | "other"
      invitation_status_type: "pending" | "accepted" | "declined" | "expired"
      language_type: "english" | "swahili" | "other"
      match_status_type:
        | "pending"
        | "accepted"
        | "declined"
        | "completed"
        | "cancelled"
      message_type:
        | "text"
        | "image"
        | "video"
        | "file"
        | "audio"
        | "location"
        | "system"
        | "mixed"
      stat_type:
        | "user_counts"
        | "service_counts"
        | "verification_stats"
        | "coverage_map"
        | "initial_setup"
      support_service_type:
        | "legal"
        | "medical"
        | "mental_health"
        | "shelter"
        | "financial_assistance"
        | "other"
      target_type: "user" | "service"
      urgency_type: "high" | "medium" | "low"
      user_type: "ngo" | "professional" | "survivor"
      verification_status_type:
        | "pending"
        | "verified"
        | "rejected"
        | "under_review"
        | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_action_type: [
        "verify_user",
        "ban_user",
        "verify_service",
        "ban_service",
        "unban_user",
        "unban_service",
        "reject_user",
        "reject_service",
      ],
      appointment_status_type: ["pending", "confirmed", "requested"],
      blog_status_type: [
        "draft",
        "pending_review",
        "approved",
        "rejected",
        "published",
      ],
      case_share_status_type: ["pending", "accepted", "declined"],
      chat_role: ["admin", "member"],
      chat_type: ["dm", "group", "support_match", "community"],
      community_role_type: ["admin", "moderator", "member"],
      consent_type: ["yes", "no"],
      contact_preference_type: ["phone_call", "sms", "email", "do_not_contact"],
      gender_type: ["female", "male", "non_binary", "prefer_not_to_say"],
      incident_type: [
        "physical",
        "emotional",
        "sexual",
        "financial",
        "child_abuse",
        "other",
      ],
      invitation_status_type: ["pending", "accepted", "declined", "expired"],
      language_type: ["english", "swahili", "other"],
      match_status_type: [
        "pending",
        "accepted",
        "declined",
        "completed",
        "cancelled",
      ],
      message_type: [
        "text",
        "image",
        "video",
        "file",
        "audio",
        "location",
        "system",
        "mixed",
      ],
      stat_type: [
        "user_counts",
        "service_counts",
        "verification_stats",
        "coverage_map",
        "initial_setup",
      ],
      support_service_type: [
        "legal",
        "medical",
        "mental_health",
        "shelter",
        "financial_assistance",
        "other",
      ],
      target_type: ["user", "service"],
      urgency_type: ["high", "medium", "low"],
      user_type: ["ngo", "professional", "survivor"],
      verification_status_type: [
        "pending",
        "verified",
        "rejected",
        "under_review",
        "suspended",
      ],
    },
  },
} as const
