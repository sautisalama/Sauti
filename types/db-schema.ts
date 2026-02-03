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
          report_id: string | null
          service_id: string | null
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
          report_id?: string | null
          service_id?: string | null
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
          report_id?: string | null
          service_id?: string | null
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
            foreignKeyName: "matched_services_survivor_id_fkey"
            columns: ["survivor_id"]
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
          settings: Json | null
          updated_at: string | null
          user_type: Database["public"]["Enums"]["user_type"] | null
          verification_notes: string | null
          verification_status: string | null
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
          settings?: Json | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"] | null
          verification_notes?: string | null
          verification_status?: string | null
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
          settings?: Json | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"] | null
          verification_notes?: string | null
          verification_status?: string | null
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
          last_verification_check: string | null
          latitude: number | null
          longitude: number | null
          name: string
          phone_number: string | null
          priority: number | null
          service_types: Database["public"]["Enums"]["support_service_type"]
          user_id: string | null
          verification_notes: string | null
          verification_status: string | null
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
          last_verification_check?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone_number?: string | null
          priority?: number | null
          service_types: Database["public"]["Enums"]["support_service_type"]
          user_id?: string | null
          verification_notes?: string | null
          verification_status?: string | null
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
          last_verification_check?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone_number?: string | null
          priority?: number | null
          service_types?: Database["public"]["Enums"]["support_service_type"]
          user_id?: string | null
          verification_notes?: string | null
          verification_status?: string | null
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
      language_type: "english" | "swahili" | "other"
      match_status_type:
        | "pending"
        | "accepted"
        | "declined"
        | "completed"
        | "cancelled"
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
      language_type: ["english", "swahili", "other"],
      match_status_type: [
        "pending",
        "accepted",
        "declined",
        "completed",
        "cancelled",
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
      ],
    },
  },
} as const
