export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          date: string
          id: string
          professional_id: string | null
          status: Database["public"]["Enums"]["appointment_status_type"] | null
          survivor_id: string | null
        }
        Insert: {
          date: string
          id?: string
          professional_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status_type"] | null
          survivor_id?: string | null
        }
        Update: {
          date?: string
          id?: string
          professional_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status_type"] | null
          survivor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matched_services: {
        Row: {
          id: string
          match_date: string | null
          report_id: string | null
          service_id: string | null
        }
        Insert: {
          id?: string
          match_date?: string | null
          report_id?: string | null
          service_id?: string | null
        }
        Update: {
          id?: string
          match_date?: string | null
          report_id?: string | null
          service_id?: string | null
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
        ]
      }
      ngo_profiles: {
        Row: {
          id: string
          organization_name: string
          service_models: string
          user_id: string | null
        }
        Insert: {
          id?: string
          organization_name: string
          service_models: string
          user_id?: string | null
        }
        Update: {
          id?: string
          organization_name?: string
          service_models?: string
          user_id?: string | null
        }
        Relationships: []
      }
      professional_profiles: {
        Row: {
          availability: string
          bio: string
          id: string
          profession: string
          tokens: number | null
          user_id: string | null
        }
        Insert: {
          availability: string
          bio: string
          id?: string
          profession: string
          tokens?: number | null
          user_id?: string | null
        }
        Update: {
          availability?: string
          bio?: string
          id?: string
          profession?: string
          tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          created_at?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: []
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
          first_name: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          incident_description: string | null
          last_name: string | null
          latitude: number | null
          locality: string | null
          location: string | null
          longitude: number | null
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
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          incident_description?: string | null
          last_name?: string | null
          latitude?: number | null
          locality?: string | null
          location?: string | null
          longitude?: number | null
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
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          incident_description?: string | null
          last_name?: string | null
          latitude?: number | null
          locality?: string | null
          location?: string | null
          longitude?: number | null
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
          availability: string | null
          coverage_area_radius: number | null
          email: string | null
          helpline: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          phone_number: string | null
          priority: number | null
          service_types: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          availability?: string | null
          coverage_area_radius?: number | null
          email?: string | null
          helpline?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          phone_number?: string | null
          priority?: number | null
          service_types: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          availability?: string | null
          coverage_area_radius?: number | null
          email?: string | null
          helpline?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone_number?: string | null
          priority?: number | null
          service_types?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_services_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      appointment_status_type: "pending" | "confirmed"
      consent_type: "yes" | "no"
      contact_preference_type: "phone_call" | "sms" | "email" | "do_not_contact"
      gender_type: "female" | "male" | "non_binary" | "prefer_not_to_say"
      incident_type: "physical" | "emotional" | "sexual" | "financial" | "other"
      language_type: "english" | "swahili" | "other"
      support_service_type:
        | "legal"
        | "medical"
        | "mental_health"
        | "shelter"
        | "financial_assistance"
        | "other"
      urgency_type: "high" | "medium" | "low"
      user_type: "ngo" | "professional" | "survivor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
