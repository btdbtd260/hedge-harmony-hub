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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          google_signin_enabled: boolean
          id: string
          require_login: boolean
          updated_at: string
        }
        Insert: {
          google_signin_enabled?: boolean
          id?: string
          require_login?: boolean
          updated_at?: string
        }
        Update: {
          google_signin_enabled?: boolean
          id?: string
          require_login?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      approved_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
        }
        Relationships: []
      }
      approved_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          is_admin: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_admin?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_admin?: boolean
        }
        Relationships: []
      }
      blocked_numbers: {
        Row: {
          created_at: string
          id: string
          phone: string
          phone_normalized: string
          reason: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone: string
          phone_normalized: string
          reason?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string
          phone_normalized?: string
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          active_year: number
          address: string
          created_at: string
          email: string
          hidden: boolean
          id: string
          name: string
          phone: string
          status: string
        }
        Insert: {
          active_year?: number
          address?: string
          created_at?: string
          email?: string
          hidden?: boolean
          id?: string
          name: string
          phone?: string
          status?: string
        }
        Update: {
          active_year?: number
          address?: string
          created_at?: string
          email?: string
          hidden?: boolean
          id?: string
          name?: string
          phone?: string
          status?: string
        }
        Relationships: []
      }
      employee_jobs: {
        Row: {
          calculated_pay: number
          employee_id: string
          hours_worked: number
          id: string
          job_id: string
        }
        Insert: {
          calculated_pay?: number
          employee_id: string
          hours_worked?: number
          id?: string
          job_id: string
        }
        Update: {
          calculated_pay?: number
          employee_id?: string
          hours_worked?: number
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_jobs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          hourly_rate: number
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          hourly_rate?: number
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          hourly_rate?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      estimation_requests: {
        Row: {
          client_address: string
          client_email: string
          client_name: string
          client_phone: string
          created_at: string
          external_ref: string | null
          hidden: boolean
          id: string
          notes: string
          photos: string[]
          raw_payload: Json
          requested_date: string
          requested_time: string | null
          seen_at: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          client_address?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          external_ref?: string | null
          hidden?: boolean
          id?: string
          notes?: string
          photos?: string[]
          raw_payload?: Json
          requested_date: string
          requested_time?: string | null
          seen_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_address?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          external_ref?: string | null
          hidden?: boolean
          id?: string
          notes?: string
          photos?: string[]
          raw_payload?: Json
          requested_date?: string
          requested_time?: string | null
          seen_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      estimations: {
        Row: {
          back_left_length: number
          back_length: number
          back_right_length: number
          bushes_count: number
          client_id: string
          created_at: string
          cut_type: string
          extras: Json
          facade_length: number
          height_back: number
          height_back_left: number
          height_back_right: number
          height_facade: number
          height_global: number
          height_left: number
          height_mode: string
          height_right: number
          id: string
          left_length: number
          pdf_url: string | null
          right_length: number
          total_price: number
          width: number
        }
        Insert: {
          back_left_length?: number
          back_length?: number
          back_right_length?: number
          bushes_count?: number
          client_id: string
          created_at?: string
          cut_type?: string
          extras?: Json
          facade_length?: number
          height_back?: number
          height_back_left?: number
          height_back_right?: number
          height_facade?: number
          height_global?: number
          height_left?: number
          height_mode?: string
          height_right?: number
          id?: string
          left_length?: number
          pdf_url?: string | null
          right_length?: number
          total_price?: number
          width?: number
        }
        Update: {
          back_left_length?: number
          back_length?: number
          back_right_length?: number
          bushes_count?: number
          client_id?: string
          created_at?: string
          cut_type?: string
          extras?: Json
          facade_length?: number
          height_back?: number
          height_back_left?: number
          height_back_right?: number
          height_facade?: number
          height_global?: number
          height_left?: number
          height_mode?: string
          height_right?: number
          id?: string
          left_length?: number
          pdf_url?: string | null
          right_length?: number
          total_price?: number
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          receipt_photo_url: string | null
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          receipt_photo_url?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          receipt_photo_url?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          id: string
          issued_at: string
          job_id: string
          paid_at: string | null
          pdf_url: string | null
          status: string
        }
        Insert: {
          amount?: number
          client_id: string
          id?: string
          issued_at?: string
          job_id: string
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
        }
        Update: {
          amount?: number
          client_id?: string
          id?: string
          issued_at?: string
          job_id?: string
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          after_photos: string[]
          before_photos: string[]
          client_id: string
          created_at: string
          cut_type: string
          duration_variance_minutes: number | null
          end_time: string | null
          estimated_duration_minutes: number | null
          estimated_profit: number
          estimation_id: string | null
          id: string
          measurement_snapshot: Json
          real_profit: number | null
          scheduled_date: string | null
          start_time: string | null
          status: string
          total_duration_minutes: number | null
        }
        Insert: {
          after_photos?: string[]
          before_photos?: string[]
          client_id: string
          created_at?: string
          cut_type?: string
          duration_variance_minutes?: number | null
          end_time?: string | null
          estimated_duration_minutes?: number | null
          estimated_profit?: number
          estimation_id?: string | null
          id?: string
          measurement_snapshot?: Json
          real_profit?: number | null
          scheduled_date?: string | null
          start_time?: string | null
          status?: string
          total_duration_minutes?: number | null
        }
        Update: {
          after_photos?: string[]
          before_photos?: string[]
          client_id?: string
          created_at?: string
          cut_type?: string
          duration_variance_minutes?: number | null
          end_time?: string | null
          estimated_duration_minutes?: number | null
          estimated_profit?: number
          estimation_id?: string | null
          id?: string
          measurement_snapshot?: Json
          real_profit?: number | null
          scheduled_date?: string | null
          start_time?: string | null
          status?: string
          total_duration_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_estimation_id_fkey"
            columns: ["estimation_id"]
            isOneToOne: false
            referencedRelation: "estimations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          client_id: string
          created_at: string
          direction: string
          error_message: string | null
          from_number: string
          id: string
          media_urls: string[]
          read: boolean
          status: string
          to_number: string
          twilio_sid: string | null
        }
        Insert: {
          body?: string
          client_id: string
          created_at?: string
          direction: string
          error_message?: string | null
          from_number?: string
          id?: string
          media_urls?: string[]
          read?: boolean
          status?: string
          to_number?: string
          twilio_sid?: string | null
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          from_number?: string
          id?: string
          media_urls?: string[]
          read?: boolean
          status?: string
          to_number?: string
          twilio_sid?: string | null
        }
        Relationships: []
      }
      parameters: {
        Row: {
          bush_price: number
          company_address: string
          company_email: string
          company_logo_url: string | null
          company_name: string
          company_phone: string
          company_website: string
          height_multiplier: number
          height_multiplier_threshold: number
          id: string
          maintenance_interval_days: number
          price_per_foot_levelling: number
          price_per_foot_restoration: number
          price_per_foot_trim: number
          reminder_notification_time: string
          rounding_enabled: boolean
          rounding_multiple: number
          social_links: Json
          split_rule_profit_expense: number
          two_sides_multiplier: number
          updated_at: string
          width_multiplier: number
          width_multiplier_threshold: number
        }
        Insert: {
          bush_price?: number
          company_address?: string
          company_email?: string
          company_logo_url?: string | null
          company_name?: string
          company_phone?: string
          company_website?: string
          height_multiplier?: number
          height_multiplier_threshold?: number
          id?: string
          maintenance_interval_days?: number
          price_per_foot_levelling?: number
          price_per_foot_restoration?: number
          price_per_foot_trim?: number
          reminder_notification_time?: string
          rounding_enabled?: boolean
          rounding_multiple?: number
          social_links?: Json
          split_rule_profit_expense?: number
          two_sides_multiplier?: number
          updated_at?: string
          width_multiplier?: number
          width_multiplier_threshold?: number
        }
        Update: {
          bush_price?: number
          company_address?: string
          company_email?: string
          company_logo_url?: string | null
          company_name?: string
          company_phone?: string
          company_website?: string
          height_multiplier?: number
          height_multiplier_threshold?: number
          id?: string
          maintenance_interval_days?: number
          price_per_foot_levelling?: number
          price_per_foot_restoration?: number
          price_per_foot_trim?: number
          reminder_notification_time?: string
          rounding_enabled?: boolean
          rounding_multiple?: number
          social_links?: Json
          split_rule_profit_expense?: number
          two_sides_multiplier?: number
          updated_at?: string
          width_multiplier?: number
          width_multiplier_threshold?: number
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          description: string
          due_date: string
          id: string
          is_completed: boolean
          notification_sent: boolean
          reference_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string
          due_date: string
          id?: string
          is_completed?: boolean
          notification_sent?: boolean
          reference_id?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          is_completed?: boolean
          notification_sent?: boolean
          reference_id?: string | null
          type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_approved: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_email_approved: { Args: { _email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "member"
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
      app_role: ["admin", "member"],
    },
  },
} as const
