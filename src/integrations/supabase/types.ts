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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_settings: {
        Row: {
          created_at: string
          default_notify_emails: string[]
          id: number
          inactivity_threshold_days: number
          is_inactivity_alert_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_notify_emails?: string[]
          id?: number
          inactivity_threshold_days?: number
          is_inactivity_alert_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_notify_emails?: string[]
          id?: number
          inactivity_threshold_days?: number
          is_inactivity_alert_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          cac_default_usd: number
          created_at: string
          gross_margin_default_pct: number
          id: number
          mrr_base_currency: string
          paused_to_churned_days: number
          updated_at: string
        }
        Insert: {
          cac_default_usd?: number
          created_at?: string
          gross_margin_default_pct?: number
          id?: number
          mrr_base_currency?: string
          paused_to_churned_days?: number
          updated_at?: string
        }
        Update: {
          cac_default_usd?: number
          created_at?: string
          gross_margin_default_pct?: number
          id?: number
          mrr_base_currency?: string
          paused_to_churned_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          entity: string
          entity_id: string | null
          field: string | null
          id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
        }
        Insert: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          entity: string
          entity_id?: string | null
          field?: string | null
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          entity?: string
          entity_id?: string | null
          field?: string | null
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      churn_events: {
        Row: {
          churned_at: string
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          mrr_lost: number
          mrr_lost_usd: number | null
          reason_code: Database["public"]["Enums"]["churn_reason_code"]
          reason_detail: string | null
        }
        Insert: {
          churned_at?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          id?: string
          mrr_lost?: number
          mrr_lost_usd?: number | null
          reason_code?: Database["public"]["Enums"]["churn_reason_code"]
          reason_detail?: string | null
        }
        Update: {
          churned_at?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          mrr_lost?: number
          mrr_lost_usd?: number | null
          reason_code?: Database["public"]["Enums"]["churn_reason_code"]
          reason_detail?: string | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string
          id: string
          name: string
          province_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          province_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          province_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_executive_commission: {
        Row: {
          client_id: string
          commission_value: number
          currency: string
          employee_id: string
          id: string
        }
        Insert: {
          client_id: string
          commission_value?: number
          currency?: string
          employee_id: string
          id?: string
        }
        Update: {
          client_id?: string
          commission_value?: number
          currency?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_executive_commission_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_executive_commission_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_executive_commission_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      client_mrr_history: {
        Row: {
          client_id: string
          created_at: string
          currency: string
          delta: number | null
          id: string
          is_estimated: boolean
          movement_type: Database["public"]["Enums"]["mrr_movement_type"]
          mrr_amount: number
          mrr_amount_usd: number | null
          notes: string | null
          previous_mrr: number | null
          snapshot_month: string
        }
        Insert: {
          client_id: string
          created_at?: string
          currency: string
          delta?: number | null
          id?: string
          is_estimated?: boolean
          movement_type: Database["public"]["Enums"]["mrr_movement_type"]
          mrr_amount?: number
          mrr_amount_usd?: number | null
          notes?: string | null
          previous_mrr?: number | null
          snapshot_month: string
        }
        Update: {
          client_id?: string
          created_at?: string
          currency?: string
          delta?: number | null
          id?: string
          is_estimated?: boolean
          movement_type?: Database["public"]["Enums"]["mrr_movement_type"]
          mrr_amount?: number
          mrr_amount_usd?: number | null
          notes?: string | null
          previous_mrr?: number | null
          snapshot_month?: string
        }
        Relationships: []
      }
      client_platforms: {
        Row: {
          client_id: string
          commission_rate: number
          id: string
          platform_id: string
        }
        Insert: {
          client_id: string
          commission_rate?: number
          id?: string
          platform_id: string
        }
        Update: {
          client_id?: string
          commission_rate?: number
          id?: string
          platform_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_platforms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_platforms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_platforms_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      client_price_history: {
        Row: {
          change_type: Database["public"]["Enums"]["price_change_type"]
          client_id: string
          created_at: string
          created_by: string | null
          currency: string | null
          discount_duration:
            | Database["public"]["Enums"]["discount_duration"]
            | null
          discount_ends_at: string | null
          effective_date: string
          id: string
          new_amount: number | null
          percentage_change: number | null
          previous_amount: number | null
          reason: string | null
        }
        Insert: {
          change_type: Database["public"]["Enums"]["price_change_type"]
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          discount_duration?:
            | Database["public"]["Enums"]["discount_duration"]
            | null
          discount_ends_at?: string | null
          effective_date?: string
          id?: string
          new_amount?: number | null
          percentage_change?: number | null
          previous_amount?: number | null
          reason?: string | null
        }
        Update: {
          change_type?: Database["public"]["Enums"]["price_change_type"]
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          discount_duration?:
            | Database["public"]["Enums"]["discount_duration"]
            | null
          discount_ends_at?: string | null
          effective_date?: string
          id?: string
          new_amount?: number | null
          percentage_change?: number | null
          previous_amount?: number | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_price_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_price_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_sub_brands: {
        Row: {
          address: string | null
          billing_frequency: Database["public"]["Enums"]["billing_frequency"]
          branches_count: number
          city_id: string | null
          client_id: string
          cmv_cost: number
          cmv_currency: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country_id: string
          created_at: string
          fee_currency: string
          food_category_id: string | null
          id: string
          monthly_fee: number
          name: string
          notes: string | null
          province_id: string | null
          reports_email: string | null
          status: Database["public"]["Enums"]["client_status"]
        }
        Insert: {
          address?: string | null
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          branches_count?: number
          city_id?: string | null
          client_id: string
          cmv_cost?: number
          cmv_currency?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_id: string
          created_at?: string
          fee_currency?: string
          food_category_id?: string | null
          id?: string
          monthly_fee?: number
          name: string
          notes?: string | null
          province_id?: string | null
          reports_email?: string | null
          status?: Database["public"]["Enums"]["client_status"]
        }
        Update: {
          address?: string | null
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          branches_count?: number
          city_id?: string | null
          client_id?: string
          cmv_cost?: number
          cmv_currency?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_id?: string
          created_at?: string
          fee_currency?: string
          food_category_id?: string | null
          id?: string
          monthly_fee?: number
          name?: string
          notes?: string | null
          province_id?: string | null
          reports_email?: string | null
          status?: Database["public"]["Enums"]["client_status"]
        }
        Relationships: [
          {
            foreignKeyName: "client_sub_brands_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sub_brands_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sub_brands_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_sub_brands_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sub_brands_food_category_id_fkey"
            columns: ["food_category_id"]
            isOneToOne: false
            referencedRelation: "food_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sub_brands_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          activated_at: string | null
          address: string | null
          assigned_executive_id: string | null
          billing_frequency: Database["public"]["Enums"]["billing_frequency"]
          billing_user_id: string | null
          branches_count: number
          churned_at: string | null
          city_id: string | null
          cmv_cost: number
          cmv_currency: string
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country_id: string
          created_at: string
          discount_active: boolean
          discount_duration:
            | Database["public"]["Enums"]["discount_duration"]
            | null
          discount_ends_at: string | null
          discount_percentage: number | null
          discount_starts_at: string | null
          fee_currency: string
          food_category_id: string | null
          id: string
          legal_name: string | null
          monthly_fee: number
          notes: string | null
          paused_at: string | null
          payment_channel: Database["public"]["Enums"]["payment_channel"] | null
          payment_method_id: string | null
          province_id: string | null
          reports_email: string | null
          status: Database["public"]["Enums"]["client_status"]
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          address?: string | null
          assigned_executive_id?: string | null
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          billing_user_id?: string | null
          branches_count?: number
          churned_at?: string | null
          city_id?: string | null
          cmv_cost?: number
          cmv_currency?: string
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_id: string
          created_at?: string
          discount_active?: boolean
          discount_duration?:
            | Database["public"]["Enums"]["discount_duration"]
            | null
          discount_ends_at?: string | null
          discount_percentage?: number | null
          discount_starts_at?: string | null
          fee_currency?: string
          food_category_id?: string | null
          id?: string
          legal_name?: string | null
          monthly_fee?: number
          notes?: string | null
          paused_at?: string | null
          payment_channel?:
            | Database["public"]["Enums"]["payment_channel"]
            | null
          payment_method_id?: string | null
          province_id?: string | null
          reports_email?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          address?: string | null
          assigned_executive_id?: string | null
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          billing_user_id?: string | null
          branches_count?: number
          churned_at?: string | null
          city_id?: string | null
          cmv_cost?: number
          cmv_currency?: string
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_id?: string
          created_at?: string
          discount_active?: boolean
          discount_duration?:
            | Database["public"]["Enums"]["discount_duration"]
            | null
          discount_ends_at?: string | null
          discount_percentage?: number | null
          discount_starts_at?: string | null
          fee_currency?: string
          food_category_id?: string | null
          id?: string
          legal_name?: string | null
          monthly_fee?: number
          notes?: string | null
          paused_at?: string | null
          payment_channel?:
            | Database["public"]["Enums"]["payment_channel"]
            | null
          payment_method_id?: string | null
          province_id?: string | null
          reports_email?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_executive_id_fkey"
            columns: ["assigned_executive_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_food_category_id_fkey"
            columns: ["food_category_id"]
            isOneToOne: false
            referencedRelation: "food_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_channels: {
        Row: {
          country_scope: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: string
        }
        Insert: {
          country_scope?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type: string
        }
        Update: {
          country_scope?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          created_at: string
          currency_code: string
          currency_symbol: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          currency_code: string
          currency_symbol: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          address: string | null
          base_salary: number | null
          birth_date: string | null
          company_email: string | null
          country_id: string | null
          created_at: string
          dni: string | null
          end_date: string | null
          full_name: string
          id: string
          is_active: boolean
          mobile_phone: string | null
          personal_email: string | null
          role: string
          salary_currency: string
          start_date: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          base_salary?: number | null
          birth_date?: string | null
          company_email?: string | null
          country_id?: string | null
          created_at?: string
          dni?: string | null
          end_date?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          mobile_phone?: string | null
          personal_email?: string | null
          role: string
          salary_currency?: string
          start_date?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          base_salary?: number | null
          birth_date?: string | null
          company_email?: string | null
          country_id?: string | null
          created_at?: string
          dni?: string | null
          end_date?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          mobile_phone?: string | null
          personal_email?: string | null
          role?: string
          salary_currency?: string
          start_date?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rate_overrides: {
        Row: {
          base_currency: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          period_month: string
          prefer_manual: boolean
          quote_currency: string
          rate: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_currency: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period_month: string
          prefer_manual?: boolean
          quote_currency?: string
          rate: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period_month?: string
          prefer_manual?: boolean
          quote_currency?: string
          rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      exchange_rate_validation_ranges: {
        Row: {
          currency: string
          max_rate: number
          min_rate: number
          updated_at: string
        }
        Insert: {
          currency: string
          max_rate: number
          min_rate: number
          updated_at?: string
        }
        Update: {
          currency?: string
          max_rate?: number
          min_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          base_currency: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          quote_currency: string
          rate: number
          rate_date: string
          source: Database["public"]["Enums"]["exchange_rate_source"]
          updated_at: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          quote_currency?: string
          rate: number
          rate_date: string
          source?: Database["public"]["Enums"]["exchange_rate_source"]
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          quote_currency?: string
          rate?: number
          rate_date?: string
          source?: Database["public"]["Enums"]["exchange_rate_source"]
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          assigned_to: Database["public"]["Enums"]["expense_assignee"]
          category_id: string | null
          country_id: string | null
          created_at: string
          currency: string
          date: string
          description: string
          id: string
          paid_by: Database["public"]["Enums"]["collector"] | null
          recurrence_frequency:
            | Database["public"]["Enums"]["recurrence_frequency"]
            | null
          recurring: boolean
        }
        Insert: {
          amount: number
          assigned_to?: Database["public"]["Enums"]["expense_assignee"]
          category_id?: string | null
          country_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          description: string
          id?: string
          paid_by?: Database["public"]["Enums"]["collector"] | null
          recurrence_frequency?:
            | Database["public"]["Enums"]["recurrence_frequency"]
            | null
          recurring?: boolean
        }
        Update: {
          amount?: number
          assigned_to?: Database["public"]["Enums"]["expense_assignee"]
          category_id?: string | null
          country_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          description?: string
          id?: string
          paid_by?: Database["public"]["Enums"]["collector"] | null
          recurrence_frequency?:
            | Database["public"]["Enums"]["recurrence_frequency"]
            | null
          recurring?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      food_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      funnel_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          stage_order: number
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          stage_order: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          stage_order?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          collected_at: string | null
          collected_by: Database["public"]["Enums"]["collector"] | null
          created_at: string
          currency: string
          due_date: string
          id: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          notes: string | null
          status: Database["public"]["Enums"]["invoice_status"]
        }
        Insert: {
          amount: number
          client_id: string
          collected_at?: string | null
          collected_by?: Database["public"]["Enums"]["collector"] | null
          created_at?: string
          currency: string
          due_date: string
          id?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Update: {
          amount?: number
          client_id?: string
          collected_at?: string | null
          collected_by?: Database["public"]["Enums"]["collector"] | null
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      lost_reasons: {
        Row: {
          created_at: string
          id: string
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      mevak_ai_config_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_value: Json
          previous_value: Json | null
          setting_key: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_value: Json
          previous_value?: Json | null
          setting_key: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_value?: Json
          previous_value?: Json | null
          setting_key?: string
        }
        Relationships: []
      }
      mevak_ai_conversations: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          metadata: Json
          titulo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          titulo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          titulo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_ai_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_ai_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_ai_message_feedback: {
        Row: {
          comment: string | null
          created_at: string
          feedback: Database["public"]["Enums"]["mevak_ai_feedback"]
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          feedback: Database["public"]["Enums"]["mevak_ai_feedback"]
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          feedback?: Database["public"]["Enums"]["mevak_ai_feedback"]
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_ai_message_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mevak_ai_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_ai_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          model: string | null
          role: Database["public"]["Enums"]["mevak_ai_message_role"]
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          role: Database["public"]["Enums"]["mevak_ai_message_role"]
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          role?: Database["public"]["Enums"]["mevak_ai_message_role"]
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mevak_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "mevak_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_ai_tool_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          payload: Json
          tool_name: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          id?: string
          payload: Json
          tool_name: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          tool_name?: string
        }
        Relationships: []
      }
      mevak_ai_tool_calls: {
        Row: {
          arguments: Json
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          message_id: string
          result: Json | null
          tool_name: string
        }
        Insert: {
          arguments?: Json
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          message_id: string
          result?: Json | null
          tool_name: string
        }
        Update: {
          arguments?: Json
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          message_id?: string
          result?: Json | null
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_ai_tool_calls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mevak_ai_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_alertas: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          client_id: string
          created_at: string
          detalle: string | null
          id: string
          payload: Json
          resolved_at: string | null
          severity: Database["public"]["Enums"]["mevak_alerta_severity"]
          status: Database["public"]["Enums"]["mevak_alerta_status"]
          tipo: string
          titulo: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          client_id: string
          created_at?: string
          detalle?: string | null
          id?: string
          payload?: Json
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["mevak_alerta_severity"]
          status?: Database["public"]["Enums"]["mevak_alerta_status"]
          tipo: string
          titulo: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          client_id?: string
          created_at?: string
          detalle?: string | null
          id?: string
          payload?: Json
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["mevak_alerta_severity"]
          status?: Database["public"]["Enums"]["mevak_alerta_status"]
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_alertas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_alertas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_app_settings: {
        Row: {
          description: string | null
          key: string
          tipo: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          tipo: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      mevak_cliente_usuarios: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["mevak_cliente_user_role"]
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["mevak_cliente_user_role"]
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["mevak_cliente_user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_cliente_usuarios_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_cliente_usuarios_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_documentos: {
        Row: {
          client_id: string
          created_at: string
          id: string
          mime_type: string | null
          nombre: string
          size_bytes: number | null
          storage_path: string
          tipo: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nombre: string
          size_bytes?: number | null
          storage_path: string
          tipo?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nombre?: string
          size_bytes?: number | null
          storage_path?: string
          tipo?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mevak_documentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_documentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_interacciones_whatsapp: {
        Row: {
          client_id: string
          created_at: string
          direction: Database["public"]["Enums"]["mevak_wa_direction"]
          from_number: string | null
          id: string
          media_url: string | null
          message: string | null
          metadata: Json
          occurred_at: string
          to_number: string | null
          wa_message_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["mevak_wa_direction"]
          from_number?: string | null
          id?: string
          media_url?: string | null
          message?: string | null
          metadata?: Json
          occurred_at?: string
          to_number?: string | null
          wa_message_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["mevak_wa_direction"]
          from_number?: string | null
          id?: string
          media_url?: string | null
          message?: string | null
          metadata?: Json
          occurred_at?: string
          to_number?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mevak_interacciones_whatsapp_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_interacciones_whatsapp_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_kpis_mensuales: {
        Row: {
          client_id: string
          created_at: string
          id: string
          metrics: Json
          month_start: string
          platform_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          metrics?: Json
          month_start: string
          platform_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          metrics?: Json
          month_start?: string
          platform_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mevak_kpis_mensuales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_kpis_mensuales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "mevak_kpis_mensuales_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_kpis_semanales: {
        Row: {
          client_id: string
          created_at: string
          id: string
          metrics: Json
          platform_id: string | null
          week_start: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          metrics?: Json
          platform_id?: string | null
          week_start: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          metrics?: Json
          platform_id?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_kpis_semanales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_kpis_semanales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "mevak_kpis_semanales_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_onboarding_items: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          order_index: number
          required: boolean
          template_id: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          order_index?: number
          required?: boolean
          template_id: string
          titulo: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          order_index?: number
          required?: boolean
          template_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_onboarding_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "mevak_onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_onboarding_status: {
        Row: {
          client_id: string
          completed_at: string | null
          completed_by: string | null
          id: string
          item_id: string
          notas: string | null
          status: Database["public"]["Enums"]["mevak_onboarding_item_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          item_id: string
          notas?: string | null
          status?: Database["public"]["Enums"]["mevak_onboarding_item_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          item_id?: string
          notas?: string | null
          status?: Database["public"]["Enums"]["mevak_onboarding_item_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_onboarding_status_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_onboarding_status_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "mevak_onboarding_status_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mevak_onboarding_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_onboarding_templates: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          is_default: boolean
          nombre: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          is_default?: boolean
          nombre: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          is_default?: boolean
          nombre?: string
        }
        Relationships: []
      }
      mevak_promociones: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          ends_at: string | null
          id: string
          metadata: Json
          nombre: string
          platform_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["mevak_promocion_status"]
          sub_brand_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          ends_at?: string | null
          id?: string
          metadata?: Json
          nombre: string
          platform_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["mevak_promocion_status"]
          sub_brand_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          ends_at?: string | null
          id?: string
          metadata?: Json
          nombre?: string
          platform_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["mevak_promocion_status"]
          sub_brand_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_promociones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_promociones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "mevak_promociones_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_promociones_sub_brand_id_fkey"
            columns: ["sub_brand_id"]
            isOneToOne: false
            referencedRelation: "client_sub_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_reportes_mensuales: {
        Row: {
          client_id: string
          content: Json
          created_at: string
          created_by: string | null
          id: string
          month_start: string
          pdf_url: string | null
          seen_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["mevak_reporte_status"]
          summary: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          month_start: string
          pdf_url?: string | null
          seen_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["mevak_reporte_status"]
          summary?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          month_start?: string
          pdf_url?: string | null
          seen_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["mevak_reporte_status"]
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_reportes_mensuales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_reportes_mensuales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_reportes_semanales: {
        Row: {
          client_id: string
          content: Json
          created_at: string
          created_by: string | null
          id: string
          pdf_url: string | null
          seen_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["mevak_reporte_status"]
          summary: string | null
          updated_at: string
          week_start: string
        }
        Insert: {
          client_id: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          pdf_url?: string | null
          seen_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["mevak_reporte_status"]
          summary?: string | null
          updated_at?: string
          week_start: string
        }
        Update: {
          client_id?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          pdf_url?: string | null
          seen_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["mevak_reporte_status"]
          summary?: string | null
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_reportes_semanales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_reportes_semanales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_reuniones: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          duration_min: number | null
          id: string
          meeting_url: string | null
          notas: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["mevak_reunion_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          duration_min?: number | null
          id?: string
          meeting_url?: string | null
          notas?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["mevak_reunion_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          duration_min?: number | null
          id?: string
          meeting_url?: string | null
          notas?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["mevak_reunion_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_reuniones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_reuniones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_roadmap_items: {
        Row: {
          client_id: string
          created_at: string
          descripcion: string | null
          due_date: string | null
          id: string
          order_index: number
          roadmap_id: string
          status: Database["public"]["Enums"]["mevak_roadmap_item_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          descripcion?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          roadmap_id: string
          status?: Database["public"]["Enums"]["mevak_roadmap_item_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          descripcion?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          roadmap_id?: string
          status?: Database["public"]["Enums"]["mevak_roadmap_item_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_roadmap_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_roadmap_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "mevak_roadmap_items_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "mevak_roadmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_roadmaps: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          quarter: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          quarter?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          quarter?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_roadmaps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_roadmaps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_tareas: {
        Row: {
          assigned_to: string | null
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["mevak_tarea_priority"]
          status: Database["public"]["Enums"]["mevak_tarea_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["mevak_tarea_priority"]
          status?: Database["public"]["Enums"]["mevak_tarea_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["mevak_tarea_priority"]
          status?: Database["public"]["Enums"]["mevak_tarea_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_tareas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_tareas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["mevak_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["mevak_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["mevak_role"]
          user_id?: string
        }
        Relationships: []
      }
      monthly_invoices: {
        Row: {
          amount: number
          billing_user_id: string | null
          client_id: string
          created_at: string
          currency: string
          id: string
          invoiced_at: string | null
          invoiced_by: string | null
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment_channel: Database["public"]["Enums"]["payment_channel"] | null
          period_month: string
          status: Database["public"]["Enums"]["monthly_invoice_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_user_id?: string | null
          client_id: string
          created_at?: string
          currency?: string
          id?: string
          invoiced_at?: string | null
          invoiced_by?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_channel?:
            | Database["public"]["Enums"]["payment_channel"]
            | null
          period_month: string
          status?: Database["public"]["Enums"]["monthly_invoice_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_user_id?: string | null
          client_id?: string
          created_at?: string
          currency?: string
          id?: string
          invoiced_at?: string | null
          invoiced_by?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_channel?:
            | Database["public"]["Enums"]["payment_channel"]
            | null
          period_month?: string
          status?: Database["public"]["Enums"]["monthly_invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mrr_recompute_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          months_processed: number
          months_total: number
          per_month_results: Json
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          months_processed?: number
          months_total?: number
          per_month_results?: Json
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          months_processed?: number
          months_total?: number
          per_month_results?: Json
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      mrr_snapshots: {
        Row: {
          active_clients_count: number
          churn_mrr: number
          computed_at: string
          contraction_mrr: number
          currency: string
          expansion_mrr: number
          id: string
          is_consolidated: boolean
          is_estimated: boolean
          mrr_amount: number
          needs_recompute: boolean
          net_new_mrr: number | null
          new_mrr: number
          reactivation_mrr: number
          snapshot_month: string
        }
        Insert: {
          active_clients_count?: number
          churn_mrr?: number
          computed_at?: string
          contraction_mrr?: number
          currency: string
          expansion_mrr?: number
          id?: string
          is_consolidated?: boolean
          is_estimated?: boolean
          mrr_amount?: number
          needs_recompute?: boolean
          net_new_mrr?: number | null
          new_mrr?: number
          reactivation_mrr?: number
          snapshot_month: string
        }
        Update: {
          active_clients_count?: number
          churn_mrr?: number
          computed_at?: string
          contraction_mrr?: number
          currency?: string
          expansion_mrr?: number
          id?: string
          is_consolidated?: boolean
          is_estimated?: boolean
          mrr_amount?: number
          needs_recompute?: boolean
          net_new_mrr?: number | null
          new_mrr?: number
          reactivation_mrr?: number
          snapshot_month?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      platforms: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      prospect_alerts: {
        Row: {
          alert_date: string
          alert_type: Database["public"]["Enums"]["prospect_alert_type"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_dismissed: boolean
          is_sent: boolean
          notify_emails: string[]
          prospect_id: string
          relative_days: number | null
          sent_at: string | null
          snoozed_until: string | null
          title: string
        }
        Insert: {
          alert_date: string
          alert_type: Database["public"]["Enums"]["prospect_alert_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_dismissed?: boolean
          is_sent?: boolean
          notify_emails?: string[]
          prospect_id: string
          relative_days?: number | null
          sent_at?: string | null
          snoozed_until?: string | null
          title: string
        }
        Update: {
          alert_date?: string
          alert_type?: Database["public"]["Enums"]["prospect_alert_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_dismissed?: boolean
          is_sent?: boolean
          notify_emails?: string[]
          prospect_id?: string
          relative_days?: number | null
          sent_at?: string | null
          snoozed_until?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_alerts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_interactions: {
        Row: {
          channel_id: string | null
          created_at: string
          created_by: string | null
          id: string
          interaction_date: string
          notes: string | null
          prospect_id: string
          stage_at_interaction_id: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_date?: string
          notes?: string | null
          prospect_id: string
          stage_at_interaction_id?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_date?: string
          notes?: string | null
          prospect_id?: string
          stage_at_interaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_interactions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "contact_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_interactions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_interactions_stage_at_interaction_id_fkey"
            columns: ["stage_at_interaction_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_platforms: {
        Row: {
          created_at: string
          id: string
          platform_id: string
          prospect_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform_id: string
          prospect_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform_id?: string
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_platforms_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_platforms_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_stage_history: {
        Row: {
          changed_by_employee_id: string | null
          created_at: string
          entered_at: string
          exited_at: string | null
          id: string
          prospect_id: string
          stage_id: string
        }
        Insert: {
          changed_by_employee_id?: string | null
          created_at?: string
          entered_at?: string
          exited_at?: string | null
          id?: string
          prospect_id: string
          stage_id: string
        }
        Update: {
          changed_by_employee_id?: string | null
          created_at?: string
          entered_at?: string
          exited_at?: string | null
          id?: string
          prospect_id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_stage_history_changed_by_employee_id_fkey"
            columns: ["changed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_stage_history_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_stage_history_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          assigned_executive_id: string | null
          business_name: string
          city: string | null
          contact_name: string | null
          converted_to_client_id: string | null
          country_id: string
          created_at: string
          created_by_employee_id: string | null
          currency: string
          current_stage_id: string
          discount_duration:
            | Database["public"]["Enums"]["discount_duration"]
            | null
          discount_ends_at: string | null
          discount_percentage: number | null
          discount_starts_at: string | null
          email: string | null
          estimated_monthly_revenue: number
          first_contact_channel_id: string | null
          first_contact_date: string
          id: string
          last_interaction_at: string | null
          legal_name: string | null
          lost_reason_id: string | null
          notes: string | null
          phone: string | null
          stage_entered_at: string
          status: Database["public"]["Enums"]["prospect_status"]
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_executive_id?: string | null
          business_name: string
          city?: string | null
          contact_name?: string | null
          converted_to_client_id?: string | null
          country_id: string
          created_at?: string
          created_by_employee_id?: string | null
          currency?: string
          current_stage_id: string
          discount_duration?:
            | Database["public"]["Enums"]["discount_duration"]
            | null
          discount_ends_at?: string | null
          discount_percentage?: number | null
          discount_starts_at?: string | null
          email?: string | null
          estimated_monthly_revenue?: number
          first_contact_channel_id?: string | null
          first_contact_date?: string
          id?: string
          last_interaction_at?: string | null
          legal_name?: string | null
          lost_reason_id?: string | null
          notes?: string | null
          phone?: string | null
          stage_entered_at?: string
          status?: Database["public"]["Enums"]["prospect_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_executive_id?: string | null
          business_name?: string
          city?: string | null
          contact_name?: string | null
          converted_to_client_id?: string | null
          country_id?: string
          created_at?: string
          created_by_employee_id?: string | null
          currency?: string
          current_stage_id?: string
          discount_duration?:
            | Database["public"]["Enums"]["discount_duration"]
            | null
          discount_ends_at?: string | null
          discount_percentage?: number | null
          discount_starts_at?: string | null
          email?: string | null
          estimated_monthly_revenue?: number
          first_contact_channel_id?: string | null
          first_contact_date?: string
          id?: string
          last_interaction_at?: string | null
          legal_name?: string | null
          lost_reason_id?: string | null
          notes?: string | null
          phone?: string | null
          stage_entered_at?: string
          status?: Database["public"]["Enums"]["prospect_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_assigned_executive_id_fkey"
            columns: ["assigned_executive_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_converted_to_client_id_fkey"
            columns: ["converted_to_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_converted_to_client_id_fkey"
            columns: ["converted_to_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "prospects_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_created_by_employee_id_fkey"
            columns: ["created_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_first_contact_channel_id_fkey"
            columns: ["first_contact_channel_id"]
            isOneToOne: false
            referencedRelation: "contact_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_lost_reason_id_fkey"
            columns: ["lost_reason_id"]
            isOneToOne: false
            referencedRelation: "lost_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      provinces: {
        Row: {
          country_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "provinces_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          date: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          date?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          date?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_churn_summary_monthly: {
        Row: {
          churn_count: number | null
          currency: string | null
          month: string | null
          mrr_lost: number | null
          mrr_lost_usd: number | null
          reason_code: Database["public"]["Enums"]["churn_reason_code"] | null
        }
        Relationships: []
      }
      v_client_metrics: {
        Row: {
          activated_at: string | null
          assigned_executive_id: string | null
          churned_at: string | null
          client_id: string | null
          company_name: string | null
          country_id: string | null
          currency: string | null
          current_mrr: number | null
          current_mrr_usd: number | null
          lifetime_months: number | null
          status: Database["public"]["Enums"]["client_status"] | null
          total_revenue_client_currency: number | null
        }
        Insert: {
          activated_at?: string | null
          assigned_executive_id?: string | null
          churned_at?: string | null
          client_id?: string | null
          company_name?: string | null
          country_id?: string | null
          currency?: string | null
          current_mrr?: never
          current_mrr_usd?: never
          lifetime_months?: never
          status?: Database["public"]["Enums"]["client_status"] | null
          total_revenue_client_currency?: never
        }
        Update: {
          activated_at?: string | null
          assigned_executive_id?: string | null
          churned_at?: string | null
          client_id?: string | null
          company_name?: string | null
          country_id?: string | null
          currency?: string | null
          current_mrr?: never
          current_mrr_usd?: never
          lifetime_months?: never
          status?: Database["public"]["Enums"]["client_status"] | null
          total_revenue_client_currency?: never
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_executive_id_fkey"
            columns: ["assigned_executive_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      v_mrr_actual: {
        Row: {
          active_clients_count: number | null
          churn_mrr: number | null
          computed_at: string | null
          contraction_mrr: number | null
          currency: string | null
          expansion_mrr: number | null
          is_consolidated: boolean | null
          is_estimated: boolean | null
          mrr_amount: number | null
          net_new_mrr: number | null
          new_mrr: number | null
          reactivation_mrr: number | null
          snapshot_month: string | null
        }
        Insert: {
          active_clients_count?: number | null
          churn_mrr?: number | null
          computed_at?: string | null
          contraction_mrr?: number | null
          currency?: string | null
          expansion_mrr?: number | null
          is_consolidated?: boolean | null
          is_estimated?: boolean | null
          mrr_amount?: number | null
          net_new_mrr?: number | null
          new_mrr?: number | null
          reactivation_mrr?: number | null
          snapshot_month?: string | null
        }
        Update: {
          active_clients_count?: number | null
          churn_mrr?: number | null
          computed_at?: string | null
          contraction_mrr?: number | null
          currency?: string | null
          expansion_mrr?: number | null
          is_consolidated?: boolean | null
          is_estimated?: boolean | null
          mrr_amount?: number | null
          net_new_mrr?: number | null
          new_mrr?: number | null
          reactivation_mrr?: number | null
          snapshot_month?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_churn_paused_clients: { Args: never; Returns: number }
      backfill_mrr_snapshots: { Args: { _months?: number }; Returns: number }
      effective_monthly_fee: { Args: { _client_id: string }; Returns: number }
      expire_discounts: {
        Args: never
        Returns: {
          billing_user_id: string
          client_id: string
          company_name: string
          currency: string
          new_amount: number
          previous_amount: number
        }[]
      }
      generate_monthly_invoices: { Args: { _period?: string }; Returns: number }
      get_exchange_rate: {
        Args: { _currency: string; _period_month: string }
        Returns: number
      }
      get_mevak_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["mevak_role"]
      }
      has_mevak_role: {
        Args: {
          _role: Database["public"]["Enums"]["mevak_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      mevak_can_access_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      mevak_can_write_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      mevak_my_client_ids: { Args: { _user_id: string }; Returns: string[] }
      prorated_mrr: {
        Args: {
          _activated_at: string
          _churned_at: string
          _fee: number
          _period_month: string
        }
        Returns: number
      }
      recompute_mrr_for_month: { Args: { _period: string }; Returns: undefined }
      refresh_invoice_statuses: { Args: never; Returns: undefined }
      start_mrr_recompute: { Args: { _months?: number }; Returns: string }
      to_usd: {
        Args: { _amount: number; _currency: string; _period_month: string }
        Returns: number
      }
      upsert_exchange_rate_override: {
        Args: {
          _currency: string
          _month: string
          _notes?: string
          _prefer_manual?: boolean
          _rate: number
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "executive"
      billing_frequency: "weekly" | "biweekly" | "monthly"
      churn_reason_code:
        | "manual"
        | "paused_timeout"
        | "non_payment"
        | "dissatisfied"
        | "price"
        | "competitor"
        | "closed_business"
        | "other"
      client_status: "onboarding" | "active" | "paused" | "churned"
      collector: "dario" | "maria"
      discount_duration: "30_days" | "60_days" | "90_days" | "custom"
      exchange_rate_source: "api" | "manual"
      expense_assignee: "dario" | "maria" | "company"
      invoice_status: "pending" | "overdue" | "paid"
      invoice_type: "formal" | "cash"
      mevak_ai_feedback: "up" | "down"
      mevak_ai_message_role: "system" | "user" | "assistant" | "tool"
      mevak_alerta_severity: "info" | "warning" | "critical"
      mevak_alerta_status: "abierta" | "reconocida" | "resuelta" | "descartada"
      mevak_cliente_user_role: "cliente_user" | "ejecutivo_asignado"
      mevak_kpi_period: "semanal" | "mensual"
      mevak_onboarding_item_status:
        | "pendiente"
        | "en_progreso"
        | "completado"
        | "no_aplica"
      mevak_promocion_status:
        | "planificada"
        | "activa"
        | "finalizada"
        | "cancelada"
      mevak_reporte_status: "borrador" | "enviado" | "visto" | "archivado"
      mevak_reunion_status:
        | "agendada"
        | "realizada"
        | "cancelada"
        | "reprogramada"
      mevak_roadmap_item_status:
        | "backlog"
        | "en_progreso"
        | "bloqueado"
        | "completado"
        | "descartado"
      mevak_role: "direccion" | "ejecutivo" | "cliente"
      mevak_tarea_priority: "baja" | "media" | "alta" | "urgente"
      mevak_tarea_status:
        | "pendiente"
        | "en_progreso"
        | "completada"
        | "cancelada"
      mevak_wa_direction: "inbound" | "outbound"
      monthly_invoice_status: "pending" | "invoiced" | "paid" | "overdue"
      mrr_movement_type:
        | "new"
        | "expansion"
        | "contraction"
        | "churn"
        | "reactivation"
        | "currency_switch"
      payment_channel:
        | "stripe_dario"
        | "us_dario"
        | "maria_transferencia"
        | "maria_efectivo"
        | "dario_transferencia"
        | "dario_efectivo"
      price_change_type:
        | "increase"
        | "decrease"
        | "discount_applied"
        | "discount_expired"
        | "manual_adjustment"
      prospect_alert_type: "fixed_date" | "relative_days" | "inactivity_auto"
      prospect_status: "active" | "converted" | "lost"
      recurrence_frequency: "weekly" | "monthly" | "annual"
      transaction_type: "income" | "expense"
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
      app_role: ["admin", "executive"],
      billing_frequency: ["weekly", "biweekly", "monthly"],
      churn_reason_code: [
        "manual",
        "paused_timeout",
        "non_payment",
        "dissatisfied",
        "price",
        "competitor",
        "closed_business",
        "other",
      ],
      client_status: ["onboarding", "active", "paused", "churned"],
      collector: ["dario", "maria"],
      discount_duration: ["30_days", "60_days", "90_days", "custom"],
      exchange_rate_source: ["api", "manual"],
      expense_assignee: ["dario", "maria", "company"],
      invoice_status: ["pending", "overdue", "paid"],
      invoice_type: ["formal", "cash"],
      mevak_ai_feedback: ["up", "down"],
      mevak_ai_message_role: ["system", "user", "assistant", "tool"],
      mevak_alerta_severity: ["info", "warning", "critical"],
      mevak_alerta_status: ["abierta", "reconocida", "resuelta", "descartada"],
      mevak_cliente_user_role: ["cliente_user", "ejecutivo_asignado"],
      mevak_kpi_period: ["semanal", "mensual"],
      mevak_onboarding_item_status: [
        "pendiente",
        "en_progreso",
        "completado",
        "no_aplica",
      ],
      mevak_promocion_status: [
        "planificada",
        "activa",
        "finalizada",
        "cancelada",
      ],
      mevak_reporte_status: ["borrador", "enviado", "visto", "archivado"],
      mevak_reunion_status: [
        "agendada",
        "realizada",
        "cancelada",
        "reprogramada",
      ],
      mevak_roadmap_item_status: [
        "backlog",
        "en_progreso",
        "bloqueado",
        "completado",
        "descartado",
      ],
      mevak_role: ["direccion", "ejecutivo", "cliente"],
      mevak_tarea_priority: ["baja", "media", "alta", "urgente"],
      mevak_tarea_status: [
        "pendiente",
        "en_progreso",
        "completada",
        "cancelada",
      ],
      mevak_wa_direction: ["inbound", "outbound"],
      monthly_invoice_status: ["pending", "invoiced", "paid", "overdue"],
      mrr_movement_type: [
        "new",
        "expansion",
        "contraction",
        "churn",
        "reactivation",
        "currency_switch",
      ],
      payment_channel: [
        "stripe_dario",
        "us_dario",
        "maria_transferencia",
        "maria_efectivo",
        "dario_transferencia",
        "dario_efectivo",
      ],
      price_change_type: [
        "increase",
        "decrease",
        "discount_applied",
        "discount_expired",
        "manual_adjustment",
      ],
      prospect_alert_type: ["fixed_date", "relative_days", "inactivity_auto"],
      prospect_status: ["active", "converted", "lost"],
      recurrence_frequency: ["weekly", "monthly", "annual"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
