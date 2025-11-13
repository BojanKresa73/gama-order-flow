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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_activity_log: {
        Row: {
          checklist_item_id: string
          created_at: string
          created_by: string
          id: string
          new_status: Database["public"]["Enums"]["checklist_item_status"]
          note: string | null
          old_status:
            | Database["public"]["Enums"]["checklist_item_status"]
            | null
        }
        Insert: {
          checklist_item_id: string
          created_at?: string
          created_by: string
          id?: string
          new_status: Database["public"]["Enums"]["checklist_item_status"]
          note?: string | null
          old_status?:
            | Database["public"]["Enums"]["checklist_item_status"]
            | null
        }
        Update: {
          checklist_item_id?: string
          created_at?: string
          created_by?: string
          id?: string
          new_status?: Database["public"]["Enums"]["checklist_item_status"]
          note?: string | null
          old_status?:
            | Database["public"]["Enums"]["checklist_item_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_activity_log_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          created_at: string
          default_assignee_role: string | null
          display_order: number
          id: string
          is_per_file: boolean
          is_required: boolean
          sla_hours: number | null
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string
          default_assignee_role?: string | null
          display_order?: number
          id?: string
          is_per_file?: boolean
          is_required?: boolean
          sla_hours?: number | null
          template_id: string
          title: string
        }
        Update: {
          created_at?: string
          default_assignee_role?: string | null
          display_order?: number
          id?: string
          is_per_file?: boolean
          is_required?: boolean
          sla_hours?: number | null
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          order_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          order_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          order_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_activities: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          type: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          type: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          adresa: string | null
          created_at: string
          drzava: string | null
          email: string | null
          grad: string | null
          id: string
          is_blocked: boolean
          is_vip: boolean
          kontakt_osoba: string | null
          last_activity_at: string | null
          last_contacted_at: string | null
          maticni_broj: string | null
          name: string
          napomena: string | null
          next_follow_up_at: string | null
          notification_email: string | null
          owner_user_id: string | null
          pib: string | null
          postanski_broj: string | null
          rabat_procenat: number | null
          rok_placanja_dana: number | null
          segment: string
          telefon: string | null
          updated_at: string
        }
        Insert: {
          adresa?: string | null
          created_at?: string
          drzava?: string | null
          email?: string | null
          grad?: string | null
          id?: string
          is_blocked?: boolean
          is_vip?: boolean
          kontakt_osoba?: string | null
          last_activity_at?: string | null
          last_contacted_at?: string | null
          maticni_broj?: string | null
          name: string
          napomena?: string | null
          next_follow_up_at?: string | null
          notification_email?: string | null
          owner_user_id?: string | null
          pib?: string | null
          postanski_broj?: string | null
          rabat_procenat?: number | null
          rok_placanja_dana?: number | null
          segment?: string
          telefon?: string | null
          updated_at?: string
        }
        Update: {
          adresa?: string | null
          created_at?: string
          drzava?: string | null
          email?: string | null
          grad?: string | null
          id?: string
          is_blocked?: boolean
          is_vip?: boolean
          kontakt_osoba?: string | null
          last_activity_at?: string | null
          last_contacted_at?: string | null
          maticni_broj?: string | null
          name?: string
          napomena?: string | null
          next_follow_up_at?: string | null
          notification_email?: string | null
          owner_user_id?: string | null
          pib?: string | null
          postanski_broj?: string | null
          rabat_procenat?: number | null
          rok_placanja_dana?: number | null
          segment?: string
          telefon?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_notes: {
        Row: {
          client_name: string
          client_pib: string | null
          closed_at: string
          created_at: string
          delivery_number: string
          id: string
          items: Json
          opened_at: string
          pdf_path: string | null
          sent_at: string | null
          sent_to_email: string | null
          work_order_id: string
        }
        Insert: {
          client_name: string
          client_pib?: string | null
          closed_at: string
          created_at?: string
          delivery_number: string
          id?: string
          items: Json
          opened_at: string
          pdf_path?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          work_order_id: string
        }
        Update: {
          client_name?: string
          client_pib?: string | null
          closed_at?: string
          created_at?: string
          delivery_number?: string
          id?: string
          items?: Json
          opened_at?: string
          pdf_path?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          error_message: string | null
          id: string
          recipient_email: string
          sent_at: string
          status: string
          subject: string
          work_order_id: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          recipient_email: string
          sent_at?: string
          status: string
          subject: string
          work_order_id: string
        }
        Update: {
          error_message?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string
          status?: string
          subject?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      file_entries: {
        Row: {
          created_at: string
          file_type: string
          filename: string
          id: string
          notes: string | null
          plate_format_id: string | null
          quantity: number | null
          status: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          file_type: string
          filename: string
          id?: string
          notes?: string | null
          plate_format_id?: string | null
          quantity?: number | null
          status?: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          file_type?: string
          filename?: string
          id?: string
          notes?: string | null
          plate_format_id?: string | null
          quantity?: number | null
          status?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_entries_plate_format_id_fkey"
            columns: ["plate_format_id"]
            isOneToOne: false
            referencedRelation: "plate_formats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_history: {
        Row: {
          change_amount: number
          created_at: string
          created_by: string
          id: string
          plate_format_id: string
          reason: string | null
          work_order_id: string | null
        }
        Insert: {
          change_amount: number
          created_at?: string
          created_by: string
          id?: string
          plate_format_id: string
          reason?: string | null
          work_order_id?: string | null
        }
        Update: {
          change_amount?: number
          created_at?: string
          created_by?: string
          id?: string
          plate_format_id?: string
          reason?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_plate_format_id_fkey"
            columns: ["plate_format_id"]
            isOneToOne: false
            referencedRelation: "plate_formats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      plate_formats: {
        Row: {
          created_at: string
          current_stock: number
          format_name: string
          id: string
          low_stock_threshold: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stock?: number
          format_name: string
          id?: string
          low_stock_threshold?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stock?: number
          format_name?: string
          id?: string
          low_stock_threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_checklist_items: {
        Row: {
          assignee_user_id: string | null
          blocker_reason: string | null
          checklist_id: string
          comment: string | null
          completed_at: string | null
          created_at: string
          due_at: string | null
          file_entry_id: string | null
          id: string
          is_required: boolean
          started_at: string | null
          status: Database["public"]["Enums"]["checklist_item_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignee_user_id?: string | null
          blocker_reason?: string | null
          checklist_id: string
          comment?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          file_entry_id?: string | null
          id?: string
          is_required?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["checklist_item_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignee_user_id?: string | null
          blocker_reason?: string | null
          checklist_id?: string
          comment?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          file_entry_id?: string | null
          id?: string
          is_required?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["checklist_item_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_order_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "work_order_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_checklist_items_file_entry_id_fkey"
            columns: ["file_entry_id"]
            isOneToOne: false
            referencedRelation: "file_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_checklists: {
        Row: {
          created_at: string
          id: string
          progress_pct: number
          template_id: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          progress_pct?: number
          template_id: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          progress_pct?: number
          template_id?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_checklists_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_checklists_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_items: {
        Row: {
          created_at: string
          file_name: string
          id: string
          plate_format_id: string | null
          quantity: number
          work_order_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          plate_format_id?: string | null
          quantity?: number
          work_order_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          plate_format_id?: string | null
          quantity?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_items_plate_format_id_fkey"
            columns: ["plate_format_id"]
            isOneToOne: false
            referencedRelation: "plate_formats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          binding: string | null
          clicks_count: number | null
          client_id: string
          closed_at: string | null
          created_at: string
          created_by: string
          id: string
          job_name: string | null
          lamination: string | null
          notes: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["work_order_type"]
          pages: number | null
          paper_gsm_cover: number | null
          paper_gsm_text: number | null
          print_format: string | null
          print_spec: string | null
          run_quantity: number | null
          sheets_used: number | null
          status: Database["public"]["Enums"]["work_order_status"]
          test_clicks: number | null
          trial_print: boolean | null
          trial_sheets: number | null
          updated_at: string
        }
        Insert: {
          binding?: string | null
          clicks_count?: number | null
          client_id: string
          closed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          job_name?: string | null
          lamination?: string | null
          notes?: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["work_order_type"]
          pages?: number | null
          paper_gsm_cover?: number | null
          paper_gsm_text?: number | null
          print_format?: string | null
          print_spec?: string | null
          run_quantity?: number | null
          sheets_used?: number | null
          status?: Database["public"]["Enums"]["work_order_status"]
          test_clicks?: number | null
          trial_print?: boolean | null
          trial_sheets?: number | null
          updated_at?: string
        }
        Update: {
          binding?: string | null
          clicks_count?: number | null
          client_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          job_name?: string | null
          lamination?: string | null
          notes?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["work_order_type"]
          pages?: number | null
          paper_gsm_cover?: number | null
          paper_gsm_text?: number | null
          print_format?: string | null
          print_spec?: string | null
          run_quantity?: number | null
          sheets_used?: number | null
          status?: Database["public"]["Enums"]["work_order_status"]
          test_clicks?: number | null
          trial_print?: boolean | null
          trial_sheets?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_created_by_fkey"
            columns: ["created_by"]
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
      generate_order_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "accounting" | "operator"
      checklist_item_status:
        | "Pending"
        | "InProgress"
        | "Blocked"
        | "Done"
        | "NA"
      work_order_status: "open" | "closed"
      work_order_type: "ctp" | "digital" | "other"
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
      app_role: ["admin", "accounting", "operator"],
      checklist_item_status: ["Pending", "InProgress", "Blocked", "Done", "NA"],
      work_order_status: ["open", "closed"],
      work_order_type: ["ctp", "digital", "other"],
    },
  },
} as const
