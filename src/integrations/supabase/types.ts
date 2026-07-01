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
      client_plate_prices: {
        Row: {
          client_id: string
          created_at: string
          id: string
          plate_format_id: string
          price_eur: number
          price_eur_mono: number | null
          updated_at: string
          valid_from: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          plate_format_id: string
          price_eur?: number
          price_eur_mono?: number | null
          updated_at?: string
          valid_from?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          plate_format_id?: string
          price_eur?: number
          price_eur_mono?: number | null
          updated_at?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_plate_prices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_plate_prices_plate_format_id_fkey"
            columns: ["plate_format_id"]
            isOneToOne: false
            referencedRelation: "plate_formats"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_users: {
        Row: {
          client_id: string
          created_at: string
          email_notifications_enabled: boolean
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email_notifications_enabled?: boolean
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email_notifications_enabled?: boolean
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_users_client_id_fkey"
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
          has_mono_pricing: boolean
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
          notification_email_2: string | null
          notification_email_3: string | null
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
          has_mono_pricing?: boolean
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
          notification_email_2?: string | null
          notification_email_3?: string | null
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
          has_mono_pricing?: boolean
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
          notification_email_2?: string | null
          notification_email_3?: string | null
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
      ctp_job_sessions: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          paused_at: string | null
          started_at: string
          status: string
          total_active_seconds: number
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          paused_at?: string | null
          started_at?: string
          status?: string
          total_active_seconds?: number
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          paused_at?: string | null
          started_at?: string
          status?: string
          total_active_seconds?: number
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctp_job_sessions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "ctp_job_sessions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctp_job_sessions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctp_job_sessions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctp_job_sessions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctp_job_sessions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      ctp_job_timing_log: {
        Row: {
          actual_seconds_per_plate: number | null
          completed_at: string | null
          created_at: string
          format_group: string
          id: string
          machine_id: string
          plate_operator: string | null
          reception_operator: string | null
          started_at: string
          total_plates: number
          work_order_id: string
        }
        Insert: {
          actual_seconds_per_plate?: number | null
          completed_at?: string | null
          created_at?: string
          format_group: string
          id?: string
          machine_id: string
          plate_operator?: string | null
          reception_operator?: string | null
          started_at: string
          total_plates: number
          work_order_id: string
        }
        Update: {
          actual_seconds_per_plate?: number | null
          completed_at?: string | null
          created_at?: string
          format_group?: string
          id?: string
          machine_id?: string
          plate_operator?: string | null
          reception_operator?: string | null
          started_at?: string
          total_plates?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctp_job_timing_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "ctp_job_timing_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctp_job_timing_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctp_job_timing_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctp_job_timing_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctp_job_timing_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      ctp_machine_speeds: {
        Row: {
          avg_seconds_per_plate: number | null
          base_seconds_per_plate: number
          created_at: string
          format_group: string
          id: string
          machine_id: string
          machine_name: string
          sample_count: number
          updated_at: string
        }
        Insert: {
          avg_seconds_per_plate?: number | null
          base_seconds_per_plate: number
          created_at?: string
          format_group: string
          id?: string
          machine_id: string
          machine_name: string
          sample_count?: number
          updated_at?: string
        }
        Update: {
          avg_seconds_per_plate?: number | null
          base_seconds_per_plate?: number
          created_at?: string
          format_group?: string
          id?: string
          machine_id?: string
          machine_name?: string
          sample_count?: number
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
          work_order_number: string | null
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
          work_order_number?: string | null
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
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "delivery_notes_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_finishing_prices: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          finishing_code: string
          fixed_cost: number
          id: string
          max_qty: number | null
          min_qty: number
          notes: string | null
          unit_price: number
          updated_at: string
          variant: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          finishing_code: string
          fixed_cost?: number
          id?: string
          max_qty?: number | null
          min_qty?: number
          notes?: string | null
          unit_price?: number
          updated_at?: string
          variant?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          finishing_code?: string
          fixed_cost?: number
          id?: string
          max_qty?: number | null
          min_qty?: number
          notes?: string | null
          unit_price?: number
          updated_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_finishing_prices_finishing_code_fkey"
            columns: ["finishing_code"]
            isOneToOne: false
            referencedRelation: "digital_finishing_types"
            referencedColumns: ["code"]
          },
        ]
      }
      digital_finishing_types: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          description: string | null
          display_order: number
          has_variants: boolean
          name: string
          pricing_model: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          has_variants?: boolean
          name: string
          pricing_model?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          has_variants?: boolean
          name?: string
          pricing_model?: string
          updated_at?: string
        }
        Relationships: []
      }
      digital_jobs: {
        Row: {
          binding: string | null
          binding_code: string | null
          computed_color_clicks: number | null
          computed_line_total: number | null
          computed_mono_clicks: number | null
          computed_nup: number | null
          computed_price_per_sheet: number | null
          computed_sheets_per_copy: number | null
          computed_total_sheets: number | null
          cover_gsm: number | null
          cover_lamination: string | null
          cover_paper: string | null
          cover_print_sides: string | null
          cover_sheets: number | null
          created_at: string
          file_name: string
          finished_h_mm: number
          finished_w_mm: number
          finishing: string | null
          finishings: Json
          finishings_total: number
          folds: number | null
          has_cover: boolean
          id: string
          include_test_in_clicks: boolean
          is_external_service: boolean
          is_test_print: boolean
          item_status: string
          lamination: string | null
          lamination_sheets: number | null
          lamination_type: string | null
          machine_sheet_format: string
          name: string | null
          obim: number
          order_index: number | null
          page_count: number | null
          page_format: string | null
          page_height_mm: number | null
          page_width_mm: number | null
          pages: number
          paper_gsm: number | null
          paper_type: string | null
          pieces_count: number | null
          pieces_per_sheet: number | null
          pieces_per_sheet_override: number | null
          print_sides: string
          product_code: string | null
          qty: number
          test_sheets: number
          updated_at: string
          work_order_id: string
        }
        Insert: {
          binding?: string | null
          binding_code?: string | null
          computed_color_clicks?: number | null
          computed_line_total?: number | null
          computed_mono_clicks?: number | null
          computed_nup?: number | null
          computed_price_per_sheet?: number | null
          computed_sheets_per_copy?: number | null
          computed_total_sheets?: number | null
          cover_gsm?: number | null
          cover_lamination?: string | null
          cover_paper?: string | null
          cover_print_sides?: string | null
          cover_sheets?: number | null
          created_at?: string
          file_name: string
          finished_h_mm: number
          finished_w_mm: number
          finishing?: string | null
          finishings?: Json
          finishings_total?: number
          folds?: number | null
          has_cover?: boolean
          id?: string
          include_test_in_clicks?: boolean
          is_external_service?: boolean
          is_test_print?: boolean
          item_status?: string
          lamination?: string | null
          lamination_sheets?: number | null
          lamination_type?: string | null
          machine_sheet_format?: string
          name?: string | null
          obim?: number
          order_index?: number | null
          page_count?: number | null
          page_format?: string | null
          page_height_mm?: number | null
          page_width_mm?: number | null
          pages?: number
          paper_gsm?: number | null
          paper_type?: string | null
          pieces_count?: number | null
          pieces_per_sheet?: number | null
          pieces_per_sheet_override?: number | null
          print_sides: string
          product_code?: string | null
          qty: number
          test_sheets?: number
          updated_at?: string
          work_order_id: string
        }
        Update: {
          binding?: string | null
          binding_code?: string | null
          computed_color_clicks?: number | null
          computed_line_total?: number | null
          computed_mono_clicks?: number | null
          computed_nup?: number | null
          computed_price_per_sheet?: number | null
          computed_sheets_per_copy?: number | null
          computed_total_sheets?: number | null
          cover_gsm?: number | null
          cover_lamination?: string | null
          cover_paper?: string | null
          cover_print_sides?: string | null
          cover_sheets?: number | null
          created_at?: string
          file_name?: string
          finished_h_mm?: number
          finished_w_mm?: number
          finishing?: string | null
          finishings?: Json
          finishings_total?: number
          folds?: number | null
          has_cover?: boolean
          id?: string
          include_test_in_clicks?: boolean
          is_external_service?: boolean
          is_test_print?: boolean
          item_status?: string
          lamination?: string | null
          lamination_sheets?: number | null
          lamination_type?: string | null
          machine_sheet_format?: string
          name?: string | null
          obim?: number
          order_index?: number | null
          page_count?: number | null
          page_format?: string | null
          page_height_mm?: number | null
          page_width_mm?: number | null
          pages?: number
          paper_gsm?: number | null
          paper_type?: string | null
          pieces_count?: number | null
          pieces_per_sheet?: number | null
          pieces_per_sheet_override?: number | null
          print_sides?: string
          product_code?: string | null
          qty?: number
          test_sheets?: number
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "digital_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_paper_types: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      digital_product_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          default_machine_sheet_format: string | null
          default_paper: string | null
          default_print_sides: string | null
          description: string | null
          display_order: number
          name: string
          supports_cover: boolean
          supports_pages: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          default_machine_sheet_format?: string | null
          default_paper?: string | null
          default_print_sides?: string | null
          description?: string | null
          display_order?: number
          name: string
          supports_cover?: boolean
          supports_pages?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          default_machine_sheet_format?: string | null
          default_paper?: string | null
          default_print_sides?: string | null
          description?: string | null
          display_order?: number
          name?: string
          supports_cover?: boolean
          supports_pages?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      digital_settings: {
        Row: {
          available_sheet_formats: Json
          created_at: string
          id: string
          sheet_height_mm: number
          sheet_width_mm: number
          updated_at: string
          waste_percent: number
        }
        Insert: {
          available_sheet_formats?: Json
          created_at?: string
          id?: string
          sheet_height_mm?: number
          sheet_width_mm?: number
          updated_at?: string
          waste_percent?: number
        }
        Update: {
          available_sheet_formats?: Json
          created_at?: string
          id?: string
          sheet_height_mm?: number
          sheet_width_mm?: number
          updated_at?: string
          waste_percent?: number
        }
        Relationships: []
      }
      email_jobs: {
        Row: {
          attachment_url: string | null
          client_email: string
          created_at: string
          error_msg: string | null
          html_body: string
          id: number
          sent_at: string | null
          status: string
          subject: string
          work_order_id: string
        }
        Insert: {
          attachment_url?: string | null
          client_email: string
          created_at?: string
          error_msg?: string | null
          html_body: string
          id?: number
          sent_at?: string | null
          status?: string
          subject: string
          work_order_id: string
        }
        Update: {
          attachment_url?: string | null
          client_email?: string
          created_at?: string
          error_msg?: string | null
          html_body?: string
          id?: number
          sent_at?: string | null
          status?: string
          subject?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "email_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
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
          type: string | null
          work_order_id: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          recipient_email: string
          sent_at?: string
          status: string
          subject: string
          type?: string | null
          work_order_id: string
        }
        Update: {
          error_message?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string
          status?: string
          subject?: string
          type?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "email_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          created_at: string
          email_type: string
          id: string
          last_error: string | null
          max_tries: number
          next_retry_at: string
          pdf_bucket: string
          pdf_path: string
          recipient_emails: string[]
          sent_at: string | null
          subject: string
          try_count: number
          work_order_id: string
        }
        Insert: {
          created_at?: string
          email_type?: string
          id?: string
          last_error?: string | null
          max_tries?: number
          next_retry_at?: string
          pdf_bucket: string
          pdf_path: string
          recipient_emails: string[]
          sent_at?: string | null
          subject: string
          try_count?: number
          work_order_id: string
        }
        Update: {
          created_at?: string
          email_type?: string
          id?: string
          last_error?: string | null
          max_tries?: number
          next_retry_at?: string
          pdf_bucket?: string
          pdf_path?: string
          recipient_emails?: string[]
          sent_at?: string | null
          subject?: string
          try_count?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "email_outbox_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      file_entries: {
        Row: {
          closed_at: string | null
          closed_by: string | null
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
          closed_at?: string | null
          closed_by?: string | null
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
          closed_at?: string | null
          closed_by?: string | null
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
            foreignKeyName: "file_entries_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "file_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      film_cuts: {
        Row: {
          copies_per_row: number
          created_at: string | null
          film_job_id: string
          id: string
          length_m: number
          rotation_deg: number
          rows_needed: number
        }
        Insert: {
          copies_per_row: number
          created_at?: string | null
          film_job_id: string
          id?: string
          length_m: number
          rotation_deg: number
          rows_needed: number
        }
        Update: {
          copies_per_row?: number
          created_at?: string | null
          film_job_id?: string
          id?: string
          length_m?: number
          rotation_deg?: number
          rows_needed?: number
        }
        Relationships: [
          {
            foreignKeyName: "film_cuts_film_job_id_fkey"
            columns: ["film_job_id"]
            isOneToOne: false
            referencedRelation: "film_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      film_jobs: {
        Row: {
          across_count: number | null
          allow_rotate_90: boolean
          computed_m_per_piece: number | null
          computed_rotation_deg: number | null
          computed_total_m: number | null
          created_at: string | null
          file_name: string
          height_mm: number
          id: string
          margin_mm: number
          note: string | null
          qty: number
          rows_needed: number | null
          updated_at: string | null
          width_mm: number
          work_order_id: string
        }
        Insert: {
          across_count?: number | null
          allow_rotate_90?: boolean
          computed_m_per_piece?: number | null
          computed_rotation_deg?: number | null
          computed_total_m?: number | null
          created_at?: string | null
          file_name: string
          height_mm: number
          id?: string
          margin_mm?: number
          note?: string | null
          qty: number
          rows_needed?: number | null
          updated_at?: string | null
          width_mm: number
          work_order_id: string
        }
        Update: {
          across_count?: number | null
          allow_rotate_90?: boolean
          computed_m_per_piece?: number | null
          computed_rotation_deg?: number | null
          computed_total_m?: number | null
          created_at?: string | null
          file_name?: string
          height_mm?: number
          id?: string
          margin_mm?: number
          note?: string | null
          qty?: number
          rows_needed?: number | null
          updated_at?: string | null
          width_mm?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "film_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "film_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      film_price_versions: {
        Row: {
          cost_eur_per_m: number
          created_at: string
          id: string
          note: string | null
          price_eur_per_m: number
          valid_from: string
        }
        Insert: {
          cost_eur_per_m: number
          created_at?: string
          id?: string
          note?: string | null
          price_eur_per_m: number
          valid_from: string
        }
        Update: {
          cost_eur_per_m?: number
          created_at?: string
          id?: string
          note?: string | null
          price_eur_per_m?: number
          valid_from?: string
        }
        Relationships: []
      }
      film_settings: {
        Row: {
          cost_eur_per_m: number
          created_at: string | null
          gap_mm: number
          id: string
          lead_trim_mm: number
          price_eur_per_m: number
          roll_width_mm: number
          side_margin_mm: number
          tail_trim_mm: number
          updated_at: string | null
          waste_percent: number
        }
        Insert: {
          cost_eur_per_m?: number
          created_at?: string | null
          gap_mm?: number
          id?: string
          lead_trim_mm?: number
          price_eur_per_m?: number
          roll_width_mm?: number
          side_margin_mm?: number
          tail_trim_mm?: number
          updated_at?: string | null
          waste_percent?: number
        }
        Update: {
          cost_eur_per_m?: number
          created_at?: string | null
          gap_mm?: number
          id?: string
          lead_trim_mm?: number
          price_eur_per_m?: number
          roll_width_mm?: number
          side_margin_mm?: number
          tail_trim_mm?: number
          updated_at?: string | null
          waste_percent?: number
        }
        Relationships: []
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
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "inventory_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      large_format_jobs: {
        Row: {
          area_m2: number | null
          created_at: string
          file_name: string
          height_mm: number
          id: string
          large_format_order_id: string
          note: string | null
          order_index: number | null
          qty: number
          rotated: boolean | null
          updated_at: string
          width_mm: number
        }
        Insert: {
          area_m2?: number | null
          created_at?: string
          file_name: string
          height_mm: number
          id?: string
          large_format_order_id: string
          note?: string | null
          order_index?: number | null
          qty?: number
          rotated?: boolean | null
          updated_at?: string
          width_mm: number
        }
        Update: {
          area_m2?: number | null
          created_at?: string
          file_name?: string
          height_mm?: number
          id?: string
          large_format_order_id?: string
          note?: string | null
          order_index?: number | null
          qty?: number
          rotated?: boolean | null
          updated_at?: string
          width_mm?: number
        }
        Relationships: [
          {
            foreignKeyName: "large_format_jobs_large_format_order_id_fkey"
            columns: ["large_format_order_id"]
            isOneToOne: false
            referencedRelation: "large_format_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      large_format_orders: {
        Row: {
          add_grommets: boolean | null
          cnc_cut: boolean | null
          created_at: string
          format_type: Database["public"]["Enums"]["large_format_type"]
          grommet_spacing_cm: number | null
          id: string
          lamination_type: string | null
          marker_margin_cm: number | null
          rigid_material:
            | Database["public"]["Enums"]["rigid_material_type"]
            | null
          roll_material:
            | Database["public"]["Enums"]["roll_material_type"]
            | null
          roll_width_mm: number | null
          sheet_height_mm: number | null
          sheet_width_mm: number | null
          total_area_m2: number | null
          updated_at: string
          weld_edges: boolean | null
          work_order_id: string
        }
        Insert: {
          add_grommets?: boolean | null
          cnc_cut?: boolean | null
          created_at?: string
          format_type: Database["public"]["Enums"]["large_format_type"]
          grommet_spacing_cm?: number | null
          id?: string
          lamination_type?: string | null
          marker_margin_cm?: number | null
          rigid_material?:
            | Database["public"]["Enums"]["rigid_material_type"]
            | null
          roll_material?:
            | Database["public"]["Enums"]["roll_material_type"]
            | null
          roll_width_mm?: number | null
          sheet_height_mm?: number | null
          sheet_width_mm?: number | null
          total_area_m2?: number | null
          updated_at?: string
          weld_edges?: boolean | null
          work_order_id: string
        }
        Update: {
          add_grommets?: boolean | null
          cnc_cut?: boolean | null
          created_at?: string
          format_type?: Database["public"]["Enums"]["large_format_type"]
          grommet_spacing_cm?: number | null
          id?: string
          lamination_type?: string | null
          marker_margin_cm?: number | null
          rigid_material?:
            | Database["public"]["Enums"]["rigid_material_type"]
            | null
          roll_material?:
            | Database["public"]["Enums"]["roll_material_type"]
            | null
          roll_width_mm?: number | null
          sheet_height_mm?: number | null
          sheet_width_mm?: number | null
          total_area_m2?: number | null
          updated_at?: string
          weld_edges?: boolean | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "large_format_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "large_format_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "large_format_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "large_format_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "large_format_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "large_format_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      nbs_exchange_rates: {
        Row: {
          currency_code: string
          fetched_at: string
          id: string
          list_date: string
          list_number: number | null
          middle_rate: number
          source: string | null
          valid_from: string
          valid_to: string
        }
        Insert: {
          currency_code: string
          fetched_at?: string
          id?: string
          list_date: string
          list_number?: number | null
          middle_rate: number
          source?: string | null
          valid_from: string
          valid_to: string
        }
        Update: {
          currency_code?: string
          fetched_at?: string
          id?: string
          list_date?: string
          list_number?: number | null
          middle_rate?: number
          source?: string | null
          valid_from?: string
          valid_to?: string
        }
        Relationships: []
      }
      newsletter_campaigns: {
        Row: {
          created_at: string
          failed_count: number
          html_body: string
          id: string
          sent_at: string | null
          sent_by: string | null
          sent_count: number
          status: string
          subject: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          failed_count?: number
          html_body: string
          id?: string
          sent_at?: string | null
          sent_by?: string | null
          sent_count?: number
          status?: string
          subject: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          failed_count?: number
          html_body?: string
          id?: string
          sent_at?: string | null
          sent_by?: string | null
          sent_count?: number
          status?: string
          subject?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_drafts: {
        Row: {
          blocks: Json
          created_at: string
          id: string
          name: string
          subject: string
          theme_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          id?: string
          name: string
          subject?: string
          theme_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          id?: string
          name?: string
          subject?: string
          theme_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      newsletter_recipients: {
        Row: {
          city: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          list_name: string | null
          notes: string | null
          phone: string | null
          unsubscribe_token: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          list_name?: string | null
          notes?: string | null
          phone?: string | null
          unsubscribe_token?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          list_name?: string | null
          notes?: string | null
          phone?: string | null
          unsubscribe_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_sends: {
        Row: {
          campaign_id: string
          created_at: string
          error_msg: string | null
          id: string
          recipient_email: string
          recipient_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error_msg?: string | null
          id?: string
          recipient_email: string
          recipient_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error_msg?: string | null
          id?: string
          recipient_email?: string
          recipient_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "newsletter_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_sends_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "newsletter_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      plate_formats: {
        Row: {
          created_at: string
          current_stock: number
          format_group: string | null
          format_name: string
          id: string
          low_stock: boolean | null
          low_stock_threshold: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stock?: number
          format_group?: string | null
          format_name: string
          id?: string
          low_stock?: boolean | null
          low_stock_threshold?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stock?: number
          format_group?: string | null
          format_name?: string
          id?: string
          low_stock?: boolean | null
          low_stock_threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      plate_usage_stats: {
        Row: {
          client_id: string
          created_at: string
          plate_format: string
          plates_used: number
          usage_date: string
        }
        Insert: {
          client_id: string
          created_at?: string
          plate_format: string
          plates_used?: number
          usage_date: string
        }
        Update: {
          client_id?: string
          created_at?: string
          plate_format?: string
          plates_used?: number
          usage_date?: string
        }
        Relationships: []
      }
      portal_notifications: {
        Row: {
          client_id: string
          created_at: string
          event_type: string
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          read_by: string | null
          title: string
          work_order_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          event_type: string
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          read_by?: string | null
          title: string
          work_order_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          event_type?: string
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          read_by?: string | null
          title?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "portal_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_digital: {
        Row: {
          break_qty: number
          created_at: string
          id: string
          price_per_sheet: number
          updated_at: string
        }
        Insert: {
          break_qty: number
          created_at?: string
          id?: string
          price_per_sheet: number
          updated_at?: string
        }
        Update: {
          break_qty?: number
          created_at?: string
          id?: string
          price_per_sheet?: number
          updated_at?: string
        }
        Relationships: []
      }
      priority_change_log: {
        Row: {
          changed_by: string
          changed_by_type: string
          created_at: string
          id: string
          new_priority: number
          note: string | null
          old_priority: number | null
          work_order_id: string
        }
        Insert: {
          changed_by: string
          changed_by_type: string
          created_at?: string
          id?: string
          new_priority: number
          note?: string | null
          old_priority?: number | null
          work_order_id: string
        }
        Update: {
          changed_by?: string
          changed_by_type?: string
          created_at?: string
          id?: string
          new_priority?: number
          note?: string | null
          old_priority?: number | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "priority_change_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "priority_change_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_change_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_change_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_change_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_change_log_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      priority_notifications: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          id: string
          is_read: boolean
          priority_change_log_id: string
          work_order_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          priority_change_log_id: string
          work_order_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          priority_change_log_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "priority_notifications_priority_change_log_id_fkey"
            columns: ["priority_change_log_id"]
            isOneToOne: false
            referencedRelation: "priority_change_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "priority_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_order_items: {
        Row: {
          created_at: string
          height_mm: number
          id: string
          plate_format_id: string
          price_per_m2: number
          procurement_order_id: string
          quantity: number
          width_mm: number
        }
        Insert: {
          created_at?: string
          height_mm: number
          id?: string
          plate_format_id: string
          price_per_m2: number
          procurement_order_id: string
          quantity: number
          width_mm: number
        }
        Update: {
          created_at?: string
          height_mm?: number
          id?: string
          plate_format_id?: string
          price_per_m2?: number
          procurement_order_id?: string
          quantity?: number
          width_mm?: number
        }
        Relationships: [
          {
            foreignKeyName: "procurement_order_items_plate_format_id_fkey"
            columns: ["plate_format_id"]
            isOneToOne: false
            referencedRelation: "plate_formats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_order_items_procurement_order_id_fkey"
            columns: ["procurement_order_id"]
            isOneToOne: false
            referencedRelation: "procurement_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_orders: {
        Row: {
          actual_arrival_date: string | null
          created_at: string
          created_by: string | null
          expected_arrival_date: string | null
          id: string
          notes: string | null
          order_date: string
          other_costs: number | null
          status: string
          supplier_name: string
          transport_cost: number | null
          updated_at: string
        }
        Insert: {
          actual_arrival_date?: string | null
          created_at?: string
          created_by?: string | null
          expected_arrival_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          other_costs?: number | null
          status?: string
          supplier_name: string
          transport_cost?: number | null
          updated_at?: string
        }
        Update: {
          actual_arrival_date?: string | null
          created_at?: string
          created_by?: string | null
          expected_arrival_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          other_costs?: number | null
          status?: string
          supplier_name?: string
          transport_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_reports: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_public: boolean
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters: Json
          id?: string
          is_public?: boolean
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_public?: boolean
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
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
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_balances: {
        Row: {
          allocated: number
          carried_over: number
          carryover_expires_on: string | null
          updated_at: string
          used: number
          user_id: string
          year: number
        }
        Insert: {
          allocated?: number
          carried_over?: number
          carryover_expires_on?: string | null
          updated_at?: string
          used?: number
          user_id: string
          year: number
        }
        Update: {
          allocated?: number
          carried_over?: number
          carryover_expires_on?: string | null
          updated_at?: string
          used?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vacation_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      vacation_requests: {
        Row: {
          created_at: string
          days_count: number
          end_date: string
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          start_date: string
          status: Database["public"]["Enums"]["vacation_status"]
          updated_at: string
          used_from_current: number
          used_from_previous: number
          user_id: string
        }
        Insert: {
          created_at?: string
          days_count: number
          end_date: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["vacation_status"]
          updated_at?: string
          used_from_current?: number
          used_from_previous?: number
          user_id: string
        }
        Update: {
          created_at?: string
          days_count?: number
          end_date?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["vacation_status"]
          updated_at?: string
          used_from_current?: number
          used_from_previous?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_settings: {
        Row: {
          annual_days: number
          carryover_deadline_day: number
          carryover_deadline_month: number
          id: boolean
          min_notice_days: number
          updated_at: string
        }
        Insert: {
          annual_days?: number
          carryover_deadline_day?: number
          carryover_deadline_month?: number
          id?: boolean
          min_notice_days?: number
          updated_at?: string
        }
        Update: {
          annual_days?: number
          carryover_deadline_day?: number
          carryover_deadline_month?: number
          id?: boolean
          min_notice_days?: number
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "work_order_checklists_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_checklists_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_checklists_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_checklists_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_checklists_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_counters: {
        Row: {
          last_serial: number
          type: string
          year: number
        }
        Insert: {
          last_serial?: number
          type: string
          year: number
        }
        Update: {
          last_serial?: number
          type?: string
          year?: number
        }
        Relationships: []
      }
      work_order_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: number
          payload: Json | null
          work_order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: number
          payload?: Json | null
          work_order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: number
          payload?: Json | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "work_order_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
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
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
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
          closed_by: string | null
          created_at: string
          created_by: string
          ctp_machine_id: string | null
          deleted_at: string | null
          display_order_number: string | null
          film_note: string | null
          film_price_override_eur_per_m: number | null
          id: string
          invalid_reason: string | null
          invalidated_at: string | null
          invalidated_by: string | null
          invoice_number: string | null
          invoiced_at: string | null
          job_name: string | null
          kind: Database["public"]["Enums"]["work_order_kind"]
          lamination: string | null
          machine_id: string | null
          notes: string | null
          order_code: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["work_order_type"]
          pages: number | null
          paper_gsm_cover: number | null
          paper_gsm_text: number | null
          prep_hours: number | null
          print_format: string | null
          print_spec: string | null
          priority: number
          run_quantity: number | null
          serial: number | null
          sheets_used: number | null
          status: Database["public"]["Enums"]["work_order_status"]
          test_clicks: number | null
          trial_print: boolean | null
          trial_sheets: number | null
          type: Database["public"]["Enums"]["wo_type"]
          updated_at: string
          year: number | null
        }
        Insert: {
          binding?: string | null
          clicks_count?: number | null
          client_id: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by: string
          ctp_machine_id?: string | null
          deleted_at?: string | null
          display_order_number?: string | null
          film_note?: string | null
          film_price_override_eur_per_m?: number | null
          id?: string
          invalid_reason?: string | null
          invalidated_at?: string | null
          invalidated_by?: string | null
          invoice_number?: string | null
          invoiced_at?: string | null
          job_name?: string | null
          kind?: Database["public"]["Enums"]["work_order_kind"]
          lamination?: string | null
          machine_id?: string | null
          notes?: string | null
          order_code?: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["work_order_type"]
          pages?: number | null
          paper_gsm_cover?: number | null
          paper_gsm_text?: number | null
          prep_hours?: number | null
          print_format?: string | null
          print_spec?: string | null
          priority?: number
          run_quantity?: number | null
          serial?: number | null
          sheets_used?: number | null
          status?: Database["public"]["Enums"]["work_order_status"]
          test_clicks?: number | null
          trial_print?: boolean | null
          trial_sheets?: number | null
          type?: Database["public"]["Enums"]["wo_type"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          binding?: string | null
          clicks_count?: number | null
          client_id?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          ctp_machine_id?: string | null
          deleted_at?: string | null
          display_order_number?: string | null
          film_note?: string | null
          film_price_override_eur_per_m?: number | null
          id?: string
          invalid_reason?: string | null
          invalidated_at?: string | null
          invalidated_by?: string | null
          invoice_number?: string | null
          invoiced_at?: string | null
          job_name?: string | null
          kind?: Database["public"]["Enums"]["work_order_kind"]
          lamination?: string | null
          machine_id?: string | null
          notes?: string | null
          order_code?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["work_order_type"]
          pages?: number | null
          paper_gsm_cover?: number | null
          paper_gsm_text?: number | null
          prep_hours?: number | null
          print_format?: string | null
          print_spec?: string | null
          priority?: number
          run_quantity?: number | null
          serial?: number | null
          sheets_used?: number | null
          status?: Database["public"]["Enums"]["work_order_status"]
          test_clicks?: number | null
          trial_print?: boolean | null
          trial_sheets?: number | null
          type?: Database["public"]["Enums"]["wo_type"]
          updated_at?: string
          year?: number | null
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
      email_job_latest_status: {
        Row: {
          created_at: string | null
          error_msg: string | null
          sent_at: string | null
          status: string | null
          work_order_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_ctp_items"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "email_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_ctp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_digitala"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_filmovanje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_razno"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ctp_daily: {
        Row: {
          by_format: Json | null
          closed_on: string | null
          orders_cnt: number | null
          total_plates: number | null
        }
        Relationships: []
      }
      v_ctp_items: {
        Row: {
          client_id: string | null
          client_name: string | null
          closed_on: string | null
          plate_format_id: string | null
          plate_format_name: string | null
          plates_qty: number | null
          work_order_id: string | null
          work_order_number: string | null
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
            foreignKeyName: "work_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ctp_top_clients: {
        Row: {
          client_id: string | null
          client_name: string | null
          orders_cnt: number | null
          total_plates: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_current_user_role: {
        Row: {
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }
        Insert: {
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Update: {
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_plate_usage_monthly: {
        Row: {
          client_id: string | null
          month: string | null
          plate_format: string | null
          plates_used: number | null
        }
        Relationships: []
      }
      work_orders_ctp: {
        Row: {
          binding: string | null
          clicks_count: number | null
          client_id: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          created_by: string | null
          film_note: string | null
          film_price_override_eur_per_m: number | null
          id: string | null
          job_name: string | null
          kind: Database["public"]["Enums"]["work_order_kind"] | null
          lamination: string | null
          notes: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["work_order_type"] | null
          pages: number | null
          paper_gsm_cover: number | null
          paper_gsm_text: number | null
          print_format: string | null
          print_spec: string | null
          run_quantity: number | null
          sheets_used: number | null
          status: Database["public"]["Enums"]["work_order_status"] | null
          test_clicks: number | null
          trial_print: boolean | null
          trial_sheets: number | null
          updated_at: string | null
        }
        Insert: {
          binding?: string | null
          clicks_count?: number | null
          client_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          film_note?: string | null
          film_price_override_eur_per_m?: number | null
          id?: string | null
          job_name?: string | null
          kind?: Database["public"]["Enums"]["work_order_kind"] | null
          lamination?: string | null
          notes?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["work_order_type"] | null
          pages?: number | null
          paper_gsm_cover?: number | null
          paper_gsm_text?: number | null
          print_format?: string | null
          print_spec?: string | null
          run_quantity?: number | null
          sheets_used?: number | null
          status?: Database["public"]["Enums"]["work_order_status"] | null
          test_clicks?: number | null
          trial_print?: boolean | null
          trial_sheets?: number | null
          updated_at?: string | null
        }
        Update: {
          binding?: string | null
          clicks_count?: number | null
          client_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          film_note?: string | null
          film_price_override_eur_per_m?: number | null
          id?: string | null
          job_name?: string | null
          kind?: Database["public"]["Enums"]["work_order_kind"] | null
          lamination?: string | null
          notes?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["work_order_type"] | null
          pages?: number | null
          paper_gsm_cover?: number | null
          paper_gsm_text?: number | null
          print_format?: string | null
          print_spec?: string | null
          run_quantity?: number | null
          sheets_used?: number | null
          status?: Database["public"]["Enums"]["work_order_status"] | null
          test_clicks?: number | null
          trial_print?: boolean | null
          trial_sheets?: number | null
          updated_at?: string | null
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
      work_orders_digitala: {
        Row: {
          binding: string | null
          clicks_count: number | null
          client_id: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          created_by: string | null
          film_note: string | null
          film_price_override_eur_per_m: number | null
          id: string | null
          job_name: string | null
          kind: Database["public"]["Enums"]["work_order_kind"] | null
          lamination: string | null
          notes: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["work_order_type"] | null
          pages: number | null
          paper_gsm_cover: number | null
          paper_gsm_text: number | null
          print_format: string | null
          print_spec: string | null
          run_quantity: number | null
          sheets_used: number | null
          status: Database["public"]["Enums"]["work_order_status"] | null
          test_clicks: number | null
          trial_print: boolean | null
          trial_sheets: number | null
          updated_at: string | null
        }
        Insert: {
          binding?: string | null
          clicks_count?: number | null
          client_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          film_note?: string | null
          film_price_override_eur_per_m?: number | null
          id?: string | null
          job_name?: string | null
          kind?: Database["public"]["Enums"]["work_order_kind"] | null
          lamination?: string | null
          notes?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["work_order_type"] | null
          pages?: number | null
          paper_gsm_cover?: number | null
          paper_gsm_text?: number | null
          print_format?: string | null
          print_spec?: string | null
          run_quantity?: number | null
          sheets_used?: number | null
          status?: Database["public"]["Enums"]["work_order_status"] | null
          test_clicks?: number | null
          trial_print?: boolean | null
          trial_sheets?: number | null
          updated_at?: string | null
        }
        Update: {
          binding?: string | null
          clicks_count?: number | null
          client_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          film_note?: string | null
          film_price_override_eur_per_m?: number | null
          id?: string | null
          job_name?: string | null
          kind?: Database["public"]["Enums"]["work_order_kind"] | null
          lamination?: string | null
          notes?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["work_order_type"] | null
          pages?: number | null
          paper_gsm_cover?: number | null
          paper_gsm_text?: number | null
          print_format?: string | null
          print_spec?: string | null
          run_quantity?: number | null
          sheets_used?: number | null
          status?: Database["public"]["Enums"]["work_order_status"] | null
          test_clicks?: number | null
          trial_print?: boolean | null
          trial_sheets?: number | null
          updated_at?: string | null
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
      work_orders_filmovanje: {
        Row: {
          binding: string | null
          clicks_count: number | null
          client_id: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          created_by: string | null
          film_note: string | null
          film_price_override_eur_per_m: number | null
          id: string | null
          job_name: string | null
          kind: Database["public"]["Enums"]["work_order_kind"] | null
          lamination: string | null
          notes: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["work_order_type"] | null
          pages: number | null
          paper_gsm_cover: number | null
          paper_gsm_text: number | null
          print_format: string | null
          print_spec: string | null
          run_quantity: number | null
          sheets_used: number | null
          status: Database["public"]["Enums"]["work_order_status"] | null
          test_clicks: number | null
          trial_print: boolean | null
          trial_sheets: number | null
          updated_at: string | null
        }
        Insert: {
          binding?: string | null
          clicks_count?: number | null
          client_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          film_note?: string | null
          film_price_override_eur_per_m?: number | null
          id?: string | null
          job_name?: string | null
          kind?: Database["public"]["Enums"]["work_order_kind"] | null
          lamination?: string | null
          notes?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["work_order_type"] | null
          pages?: number | null
          paper_gsm_cover?: number | null
          paper_gsm_text?: number | null
          print_format?: string | null
          print_spec?: string | null
          run_quantity?: number | null
          sheets_used?: number | null
          status?: Database["public"]["Enums"]["work_order_status"] | null
          test_clicks?: number | null
          trial_print?: boolean | null
          trial_sheets?: number | null
          updated_at?: string | null
        }
        Update: {
          binding?: string | null
          clicks_count?: number | null
          client_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          film_note?: string | null
          film_price_override_eur_per_m?: number | null
          id?: string | null
          job_name?: string | null
          kind?: Database["public"]["Enums"]["work_order_kind"] | null
          lamination?: string | null
          notes?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["work_order_type"] | null
          pages?: number | null
          paper_gsm_cover?: number | null
          paper_gsm_text?: number | null
          print_format?: string | null
          print_spec?: string | null
          run_quantity?: number | null
          sheets_used?: number | null
          status?: Database["public"]["Enums"]["work_order_status"] | null
          test_clicks?: number | null
          trial_print?: boolean | null
          trial_sheets?: number | null
          updated_at?: string | null
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
      work_orders_razno: {
        Row: {
          binding: string | null
          clicks_count: number | null
          client_id: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          created_by: string | null
          film_note: string | null
          film_price_override_eur_per_m: number | null
          id: string | null
          job_name: string | null
          kind: Database["public"]["Enums"]["work_order_kind"] | null
          lamination: string | null
          notes: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["work_order_type"] | null
          pages: number | null
          paper_gsm_cover: number | null
          paper_gsm_text: number | null
          print_format: string | null
          print_spec: string | null
          run_quantity: number | null
          sheets_used: number | null
          status: Database["public"]["Enums"]["work_order_status"] | null
          test_clicks: number | null
          trial_print: boolean | null
          trial_sheets: number | null
          updated_at: string | null
        }
        Insert: {
          binding?: string | null
          clicks_count?: number | null
          client_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          film_note?: string | null
          film_price_override_eur_per_m?: number | null
          id?: string | null
          job_name?: string | null
          kind?: Database["public"]["Enums"]["work_order_kind"] | null
          lamination?: string | null
          notes?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["work_order_type"] | null
          pages?: number | null
          paper_gsm_cover?: number | null
          paper_gsm_text?: number | null
          print_format?: string | null
          print_spec?: string | null
          run_quantity?: number | null
          sheets_used?: number | null
          status?: Database["public"]["Enums"]["work_order_status"] | null
          test_clicks?: number | null
          trial_print?: boolean | null
          trial_sheets?: number | null
          updated_at?: string | null
        }
        Update: {
          binding?: string | null
          clicks_count?: number | null
          client_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          film_note?: string | null
          film_price_override_eur_per_m?: number | null
          id?: string | null
          job_name?: string | null
          kind?: Database["public"]["Enums"]["work_order_kind"] | null
          lamination?: string | null
          notes?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["work_order_type"] | null
          pages?: number | null
          paper_gsm_cover?: number | null
          paper_gsm_text?: number | null
          print_format?: string | null
          print_spec?: string | null
          run_quantity?: number | null
          sheets_used?: number | null
          status?: Database["public"]["Enums"]["work_order_status"] | null
          test_clicks?: number | null
          trial_print?: boolean | null
          trial_sheets?: number | null
          updated_at?: string | null
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
    Functions: {
      acknowledge_priority_notification: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      admin_list_users: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      admin_reset_user_password: { Args: { p_user_id: string }; Returns: Json }
      admin_set_user_active: {
        Args: { p_active: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      close_digital_work_order: {
        Args: { p_user_id: string; p_work_order_id: string }
        Returns: Json
      }
      close_film_work_order: {
        Args: { p_user_id: string; p_work_order_id: string }
        Returns: Json
      }
      close_work_order_atomic: {
        Args: { p_user_id: string; p_work_order_id: string }
        Returns: Json
      }
      current_user_client_id: { Args: never; Returns: string }
      current_user_is_active: { Args: never; Returns: boolean }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      enqueue_email_for_work_order: {
        Args: { _work_order_id: string }
        Returns: undefined
      }
      generate_order_number: { Args: never; Returns: string }
      get_ctp_area_m2: {
        Args: {
          p_client_ids?: string[]
          p_format_ids?: string[]
          p_from: string
          p_to: string
        }
        Returns: {
          total_area_m2: number
        }[]
      }
      get_ctp_consumption_by_format: {
        Args: {
          p_client_ids?: string[]
          p_from: string
          p_plate_format_ids?: string[]
          p_to: string
        }
        Returns: {
          area_m2: number
          format_name: string
          plates_consumed: number
          revenue_eur: number
        }[]
      }
      get_ctp_cost: {
        Args: {
          p_client_ids?: string[]
          p_format_ids?: string[]
          p_from: string
          p_to: string
        }
        Returns: {
          total_cost_eur: number
        }[]
      }
      get_ctp_daily: {
        Args: {
          p_client_ids?: string[]
          p_from: string
          p_plate_format_ids?: string[]
          p_to: string
        }
        Returns: Json
      }
      get_ctp_export_data: {
        Args: {
          p_client_ids?: string[]
          p_from: string
          p_plate_format_ids?: string[]
          p_to: string
        }
        Returns: Json
      }
      get_ctp_formats: {
        Args: {
          p_client_ids?: string[]
          p_from: string
          p_plate_format_ids?: string[]
          p_to: string
        }
        Returns: Json
      }
      get_ctp_revenue: {
        Args: {
          p_client_ids?: string[]
          p_from: string
          p_plate_format_ids?: string[]
          p_to: string
        }
        Returns: {
          total_revenue_eur: number
        }[]
      }
      get_ctp_stats: {
        Args: {
          p_client_ids?: string[]
          p_from: string
          p_plate_format_ids?: string[]
          p_to: string
        }
        Returns: Json
      }
      get_ctp_top_clients: {
        Args: {
          p_client_ids?: string[]
          p_from: string
          p_plate_format_ids?: string[]
          p_to: string
        }
        Returns: Json
      }
      get_ctp_top_formats: {
        Args: {
          p_client_ids?: string[]
          p_from: string
          p_plate_format_ids?: string[]
          p_to: string
        }
        Returns: Json
      }
      get_current_nbs_rate: { Args: { p_currency?: string }; Returns: number }
      get_film_price_for_date: {
        Args: { p_date: string }
        Returns: {
          cost_eur_per_m: number
          price_eur_per_m: number
          valid_from: string
        }[]
      }
      get_format_monthly_consumption: { Args: never; Returns: Json }
      get_monthly_plate_usage: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_orders_by_type: {
        Args: never
        Returns: {
          count: number
          order_type: string
        }[]
      }
      get_unread_priority_notifications_count: { Args: never; Returns: number }
      get_work_order_full: { Args: { p_identifier: string }; Returns: Json }
      has_admin_access: { Args: { _user_id: string }; Returns: boolean }
      has_admin_plus_access: { Args: { _user_id: string }; Returns: boolean }
      has_any_role: {
        Args: { p_roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_work_order_counter: {
        Args: { p_type: string; p_year: number }
        Returns: number
      }
      is_client_portal_user: { Args: never; Returns: boolean }
      is_superuser: { Args: { p_uid: string }; Returns: boolean }
      refresh_plate_usage_stats: { Args: never; Returns: undefined }
      update_work_order_priority: {
        Args: {
          p_new_priority: number
          p_note?: string
          p_work_order_id: string
        }
        Returns: Json
      }
      vacation_count_days: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      vacation_ensure_balance: {
        Args: { p_user: string; p_year: number }
        Returns: undefined
      }
      vacation_review: {
        Args: { p_decision: string; p_id: string; p_note?: string }
        Returns: undefined
      }
      vacation_submit: {
        Args: { p_end: string; p_reason: string; p_start: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "accounting"
        | "operator"
        | "superuser"
        | "operator_ctp"
        | "admin_plus"
        | "client_user"
      checklist_item_status:
        | "Pending"
        | "InProgress"
        | "Blocked"
        | "Done"
        | "NA"
      large_format_type: "roll" | "rigid"
      rigid_material_type:
        | "forex"
        | "dibond"
        | "plexiglass"
        | "cardboard"
        | "wood"
        | "other"
      roll_material_type:
        | "self_adhesive_matte"
        | "self_adhesive_glossy"
        | "cut_vinyl"
        | "tarpaulin"
        | "mesh_banner"
        | "other"
      vacation_status: "pending" | "approved" | "rejected" | "cancelled"
      wo_type: "CTP" | "DIGITAL" | "FILM" | "OSTALO"
      work_order_kind:
        | "CTP"
        | "DIGITALA"
        | "FILMOVANJE"
        | "RAZNO"
        | "ROLNA"
        | "PLOCA"
      work_order_status: "open" | "closed"
      work_order_type: "ctp" | "digital" | "other" | "film" | "large_format"
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
      app_role: [
        "admin",
        "accounting",
        "operator",
        "superuser",
        "operator_ctp",
        "admin_plus",
        "client_user",
      ],
      checklist_item_status: ["Pending", "InProgress", "Blocked", "Done", "NA"],
      large_format_type: ["roll", "rigid"],
      rigid_material_type: [
        "forex",
        "dibond",
        "plexiglass",
        "cardboard",
        "wood",
        "other",
      ],
      roll_material_type: [
        "self_adhesive_matte",
        "self_adhesive_glossy",
        "cut_vinyl",
        "tarpaulin",
        "mesh_banner",
        "other",
      ],
      vacation_status: ["pending", "approved", "rejected", "cancelled"],
      wo_type: ["CTP", "DIGITAL", "FILM", "OSTALO"],
      work_order_kind: [
        "CTP",
        "DIGITALA",
        "FILMOVANJE",
        "RAZNO",
        "ROLNA",
        "PLOCA",
      ],
      work_order_status: ["open", "closed"],
      work_order_type: ["ctp", "digital", "other", "film", "large_format"],
    },
  },
} as const
