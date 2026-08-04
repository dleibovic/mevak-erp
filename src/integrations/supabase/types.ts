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
          fee_billing_mode: string
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
          fee_billing_mode?: string
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
          fee_billing_mode?: string
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
          fee_billing_mode: string
          fee_currency: string
          food_category_id: string | null
          id: string
          invoice_letter: string | null
          legal_name: string | null
          monthly_fee: number
          notes: string | null
          paused_at: string | null
          payment_channel: Database["public"]["Enums"]["payment_channel"] | null
          payment_method_id: string | null
          payment_term_days: number
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
          fee_billing_mode?: string
          fee_currency?: string
          food_category_id?: string | null
          id?: string
          invoice_letter?: string | null
          legal_name?: string | null
          monthly_fee?: number
          notes?: string | null
          paused_at?: string | null
          payment_channel?:
            | Database["public"]["Enums"]["payment_channel"]
            | null
          payment_method_id?: string | null
          payment_term_days?: number
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
          fee_billing_mode?: string
          fee_currency?: string
          food_category_id?: string | null
          id?: string
          invoice_letter?: string | null
          legal_name?: string | null
          monthly_fee?: number
          notes?: string | null
          paused_at?: string | null
          payment_channel?:
            | Database["public"]["Enums"]["payment_channel"]
            | null
          payment_method_id?: string | null
          payment_term_days?: number
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
      commission_snapshots: {
        Row: {
          billed_amount: number | null
          billed_currency: string | null
          client_id: string | null
          client_name: string
          commission_currency: string
          commission_value: number
          created_at: string
          employee_id: string | null
          employee_name: string
          id: string
          period_month: string
          was_billed: boolean
        }
        Insert: {
          billed_amount?: number | null
          billed_currency?: string | null
          client_id?: string | null
          client_name: string
          commission_currency: string
          commission_value?: number
          created_at?: string
          employee_id?: string | null
          employee_name: string
          id?: string
          period_month: string
          was_billed?: boolean
        }
        Update: {
          billed_amount?: number | null
          billed_currency?: string | null
          client_id?: string | null
          client_name?: string
          commission_currency?: string
          commission_value?: number
          created_at?: string
          employee_id?: string | null
          employee_name?: string
          id?: string
          period_month?: string
          was_billed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "commission_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "commission_snapshots_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
          iso2: string | null
          name: string
        }
        Insert: {
          created_at?: string
          currency_code: string
          currency_symbol: string
          id?: string
          iso2?: string | null
          name: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          id?: string
          iso2?: string | null
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
      invoice_documents: {
        Row: {
          file_name: string
          file_path: string
          id: string
          invoice_id: string
          kind: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          id?: string
          invoice_id: string
          kind?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          id?: string
          invoice_id?: string
          kind?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "monthly_invoices"
            referencedColumns: ["id"]
          },
        ]
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
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
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
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
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
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
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
      mevak_comentarios_internos: {
        Row: {
          autor_id: string | null
          client_id: string
          contenido_md: string
          created_at: string
          id: string
        }
        Insert: {
          autor_id?: string | null
          client_id: string
          contenido_md: string
          created_at?: string
          id?: string
        }
        Update: {
          autor_id?: string | null
          client_id?: string
          contenido_md?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_comentarios_internos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_comentarios_internos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_contactos: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          nombre: string
          notas: string | null
          platform_id: string | null
          rol: string | null
          telefono: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          platform_id?: string | null
          rol?: string | null
          telefono?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          platform_id?: string | null
          rol?: string | null
          telefono?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_contactos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_contactos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "mevak_contactos_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
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
      mevak_fotos: {
        Row: {
          client_id: string
          created_at: string
          drive_url: string | null
          filename: string | null
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          tags: string[]
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          drive_url?: string | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          tags?: string[]
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          drive_url?: string | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          tags?: string[]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mevak_fotos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_fotos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_health_scores: {
        Row: {
          client_id: string
          computed_at: string
          details: Json
          dim_activity: number
          dim_facturacion: number
          dim_meetings: number
          dim_reports: number
          dim_roadmap: number
          dim_tasks: number
          id: string
          score: number
        }
        Insert: {
          client_id: string
          computed_at?: string
          details?: Json
          dim_activity: number
          dim_facturacion: number
          dim_meetings: number
          dim_reports: number
          dim_roadmap: number
          dim_tasks: number
          id?: string
          score: number
        }
        Update: {
          client_id?: string
          computed_at?: string
          details?: Json
          dim_activity?: number
          dim_facturacion?: number
          dim_meetings?: number
          dim_reports?: number
          dim_roadmap?: number
          dim_tasks?: number
          id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "mevak_health_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_health_scores_client_id_fkey"
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
      mevak_kpi_definiciones: {
        Row: {
          activo: boolean
          created_at: string
          formula: string | null
          id: string
          label: string
          orden: number
          ponderador_col: string | null
          scope: string
          tipo_agregacion: Database["public"]["Enums"]["mevak_tipo_agregacion"]
          unit: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          formula?: string | null
          id: string
          label: string
          orden?: number
          ponderador_col?: string | null
          scope?: string
          tipo_agregacion?: Database["public"]["Enums"]["mevak_tipo_agregacion"]
          unit?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          formula?: string | null
          id?: string
          label?: string
          orden?: number
          ponderador_col?: string | null
          scope?: string
          tipo_agregacion?: Database["public"]["Enums"]["mevak_tipo_agregacion"]
          unit?: string | null
        }
        Relationships: []
      }
      mevak_kpi_override_audit: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          client_id: string
          id: string
          kpi_id: string
          month_start: string
          reason: string | null
          valor_anterior: number | null
          valor_autocalc: number | null
          valor_manual: number | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          client_id: string
          id?: string
          kpi_id: string
          month_start: string
          reason?: string | null
          valor_anterior?: number | null
          valor_autocalc?: number | null
          valor_manual?: number | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          client_id?: string
          id?: string
          kpi_id?: string
          month_start?: string
          reason?: string | null
          valor_anterior?: number | null
          valor_autocalc?: number | null
          valor_manual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mevak_kpi_override_audit_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_kpi_override_audit_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_kpis_mensuales: {
        Row: {
          ads_revenue: number | null
          ads_spend: number | null
          cancelaciones: number | null
          client_id: string
          conversion_pct: number | null
          created_at: string
          created_by: string | null
          ctr_pct: number | null
          demoras_min_prom: number | null
          facturacion: number | null
          food_is_ready_min: number | null
          id: string
          metrics: Json
          month_start: string
          notas: string | null
          open_time_pct: number | null
          ordenes: number | null
          overrides: Json
          platform_id: string | null
          rechazos: number | null
          reviews_cantidad: number | null
          reviews_puntaje: number | null
          roas: number | null
          sesiones: number | null
          source: string | null
          sucursal_id: string | null
          ticket_promedio: number | null
          top_productos: Json
        }
        Insert: {
          ads_revenue?: number | null
          ads_spend?: number | null
          cancelaciones?: number | null
          client_id: string
          conversion_pct?: number | null
          created_at?: string
          created_by?: string | null
          ctr_pct?: number | null
          demoras_min_prom?: number | null
          facturacion?: number | null
          food_is_ready_min?: number | null
          id?: string
          metrics?: Json
          month_start: string
          notas?: string | null
          open_time_pct?: number | null
          ordenes?: number | null
          overrides?: Json
          platform_id?: string | null
          rechazos?: number | null
          reviews_cantidad?: number | null
          reviews_puntaje?: number | null
          roas?: number | null
          sesiones?: number | null
          source?: string | null
          sucursal_id?: string | null
          ticket_promedio?: number | null
          top_productos?: Json
        }
        Update: {
          ads_revenue?: number | null
          ads_spend?: number | null
          cancelaciones?: number | null
          client_id?: string
          conversion_pct?: number | null
          created_at?: string
          created_by?: string | null
          ctr_pct?: number | null
          demoras_min_prom?: number | null
          facturacion?: number | null
          food_is_ready_min?: number | null
          id?: string
          metrics?: Json
          month_start?: string
          notas?: string | null
          open_time_pct?: number | null
          ordenes?: number | null
          overrides?: Json
          platform_id?: string | null
          rechazos?: number | null
          reviews_cantidad?: number | null
          reviews_puntaje?: number | null
          roas?: number | null
          sesiones?: number | null
          source?: string | null
          sucursal_id?: string | null
          ticket_promedio?: number | null
          top_productos?: Json
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
          {
            foreignKeyName: "mevak_kpis_mensuales_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "mevak_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_kpis_semanales: {
        Row: {
          cancelaciones: number | null
          client_id: string
          created_at: string
          created_by: string | null
          demoras_min_prom: number | null
          facturacion: number | null
          food_is_ready_min: number | null
          id: string
          metrics: Json
          notas: string | null
          open_time_pct: number | null
          ordenes: number | null
          platform_id: string | null
          rechazos: number | null
          reviews_cantidad: number | null
          reviews_puntaje: number | null
          source: string | null
          sucursal_id: string | null
          ticket_promedio: number | null
          week_start: string
        }
        Insert: {
          cancelaciones?: number | null
          client_id: string
          created_at?: string
          created_by?: string | null
          demoras_min_prom?: number | null
          facturacion?: number | null
          food_is_ready_min?: number | null
          id?: string
          metrics?: Json
          notas?: string | null
          open_time_pct?: number | null
          ordenes?: number | null
          platform_id?: string | null
          rechazos?: number | null
          reviews_cantidad?: number | null
          reviews_puntaje?: number | null
          source?: string | null
          sucursal_id?: string | null
          ticket_promedio?: number | null
          week_start: string
        }
        Update: {
          cancelaciones?: number | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          demoras_min_prom?: number | null
          facturacion?: number | null
          food_is_ready_min?: number | null
          id?: string
          metrics?: Json
          notas?: string | null
          open_time_pct?: number | null
          ordenes?: number | null
          platform_id?: string | null
          rechazos?: number | null
          reviews_cantidad?: number | null
          reviews_puntaje?: number | null
          source?: string | null
          sucursal_id?: string | null
          ticket_promedio?: number | null
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
          {
            foreignKeyName: "mevak_kpis_semanales_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "mevak_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_menu_items: {
        Row: {
          client_id: string
          client_sub_brand_id: string | null
          combos: Json
          costo: number | null
          created_at: string
          descripcion: string | null
          foto_url: string | null
          id: string
          metadata: Json
          nombre: string
          opcionales: Json
          precio: number | null
          promo_vinculada: string | null
          seccion: string | null
          stock_estado: string | null
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          client_id: string
          client_sub_brand_id?: string | null
          combos?: Json
          costo?: number | null
          created_at?: string
          descripcion?: string | null
          foto_url?: string | null
          id?: string
          metadata?: Json
          nombre: string
          opcionales?: Json
          precio?: number | null
          promo_vinculada?: string | null
          seccion?: string | null
          stock_estado?: string | null
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          client_id?: string
          client_sub_brand_id?: string | null
          combos?: Json
          costo?: number | null
          created_at?: string
          descripcion?: string | null
          foto_url?: string | null
          id?: string
          metadata?: Json
          nombre?: string
          opcionales?: Json
          precio?: number | null
          promo_vinculada?: string | null
          seccion?: string | null
          stock_estado?: string | null
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mevak_menu_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_menu_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "mevak_menu_items_client_sub_brand_id_fkey"
            columns: ["client_sub_brand_id"]
            isOneToOne: false
            referencedRelation: "client_sub_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_menu_items_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "mevak_menu_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_menu_uploads: {
        Row: {
          client_id: string
          client_sub_brand_id: string | null
          created_at: string
          filename: string | null
          id: string
          notas: string | null
          row_count: number
          storage_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          client_sub_brand_id?: string | null
          created_at?: string
          filename?: string | null
          id?: string
          notas?: string | null
          row_count?: number
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          client_sub_brand_id?: string | null
          created_at?: string
          filename?: string | null
          id?: string
          notas?: string | null
          row_count?: number
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mevak_menu_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_menu_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "mevak_menu_uploads_client_sub_brand_id_fkey"
            columns: ["client_sub_brand_id"]
            isOneToOne: false
            referencedRelation: "client_sub_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_objetivos: {
        Row: {
          client_id: string
          descripcion_md: string | null
          kpi_1: Json | null
          kpi_2: Json | null
          kpi_3: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id: string
          descripcion_md?: string | null
          kpi_1?: Json | null
          kpi_2?: Json | null
          kpi_3?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string
          descripcion_md?: string | null
          kpi_1?: Json | null
          kpi_2?: Json | null
          kpi_3?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mevak_objetivos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_objetivos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mevak_onboarding_audit: {
        Row: {
          actor: string | null
          client_id: string
          created_at: string
          detalle: string | null
          evento: string
          id: string
          item_id: string | null
          payload: Json
        }
        Insert: {
          actor?: string | null
          client_id: string
          created_at?: string
          detalle?: string | null
          evento: string
          id?: string
          item_id?: string | null
          payload?: Json
        }
        Update: {
          actor?: string | null
          client_id?: string
          created_at?: string
          detalle?: string | null
          evento?: string
          id?: string
          item_id?: string | null
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "mevak_onboarding_audit_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_onboarding_audit_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "mevak_onboarding_audit_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mevak_onboarding_items"
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
          responsable: string | null
          template_id: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          order_index?: number
          required?: boolean
          responsable?: string | null
          template_id: string
          titulo: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          order_index?: number
          required?: boolean
          responsable?: string | null
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
          aprobada_at: string | null
          aprobada_by: string | null
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
          sucursal_id: string | null
          updated_at: string
        }
        Insert: {
          aprobada_at?: string | null
          aprobada_by?: string | null
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
          sucursal_id?: string | null
          updated_at?: string
        }
        Update: {
          aprobada_at?: string | null
          aprobada_by?: string | null
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
          sucursal_id?: string | null
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
          {
            foreignKeyName: "mevak_promociones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "mevak_sucursales"
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
          asistentes: Json
          cancelled_at: string | null
          cancelled_reason: string | null
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          decisiones: Json
          descripcion: string | null
          duration_min: number | null
          id: string
          meeting_url: string | null
          minuta_md: string | null
          notas: string | null
          participants_user_ids: string[]
          proxima_fecha: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["mevak_reunion_status"]
          tipo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          asistentes?: Json
          cancelled_at?: string | null
          cancelled_reason?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          decisiones?: Json
          descripcion?: string | null
          duration_min?: number | null
          id?: string
          meeting_url?: string | null
          minuta_md?: string | null
          notas?: string | null
          participants_user_ids?: string[]
          proxima_fecha?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["mevak_reunion_status"]
          tipo?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          asistentes?: Json
          cancelled_at?: string | null
          cancelled_reason?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          decisiones?: Json
          descripcion?: string | null
          duration_min?: number | null
          id?: string
          meeting_url?: string | null
          minuta_md?: string | null
          notas?: string | null
          participants_user_ids?: string[]
          proxima_fecha?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["mevak_reunion_status"]
          tipo?: string | null
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
      mevak_roadmap_item_comments: {
        Row: {
          body: string
          client_id: string
          created_at: string
          id: string
          item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          id?: string
          item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_roadmap_item_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mevak_roadmap_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_roadmap_items: {
        Row: {
          assignee_user_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          due_date: string | null
          id: string
          order_index: number
          roadmap_id: string
          status: Database["public"]["Enums"]["mevak_roadmap_item_status"]
          tags: string[]
          titulo: string
          updated_at: string
        }
        Insert: {
          assignee_user_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          roadmap_id: string
          status?: Database["public"]["Enums"]["mevak_roadmap_item_status"]
          tags?: string[]
          titulo: string
          updated_at?: string
        }
        Update: {
          assignee_user_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          roadmap_id?: string
          status?: Database["public"]["Enums"]["mevak_roadmap_item_status"]
          tags?: string[]
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
      mevak_sucursal_plataforma: {
        Row: {
          branch_id_external: string | null
          client_id: string
          comision_pct: number | null
          created_at: string
          horarios: Json
          id: string
          notas: string | null
          platform_id: string
          sucursal_id: string
          updated_at: string
        }
        Insert: {
          branch_id_external?: string | null
          client_id: string
          comision_pct?: number | null
          created_at?: string
          horarios?: Json
          id?: string
          notas?: string | null
          platform_id: string
          sucursal_id: string
          updated_at?: string
        }
        Update: {
          branch_id_external?: string | null
          client_id?: string
          comision_pct?: number | null
          created_at?: string
          horarios?: Json
          id?: string
          notas?: string | null
          platform_id?: string
          sucursal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_sucursal_plataforma_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_sucursal_plataforma_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "mevak_sucursal_plataforma_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_sucursal_plataforma_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "mevak_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_sucursales: {
        Row: {
          activa: boolean
          ciudad: string | null
          client_id: string
          client_sub_brand_id: string | null
          country_code: string | null
          created_at: string
          direccion: string | null
          id: string
          metadata: Json
          nombre: string
          tipo: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          ciudad?: string | null
          client_id: string
          client_sub_brand_id?: string | null
          country_code?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          metadata?: Json
          nombre: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          ciudad?: string | null
          client_id?: string
          client_sub_brand_id?: string | null
          country_code?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          metadata?: Json
          nombre?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_sucursales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_sucursales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_metrics"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "mevak_sucursales_client_sub_brand_id_fkey"
            columns: ["client_sub_brand_id"]
            isOneToOne: false
            referencedRelation: "client_sub_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_tareas: {
        Row: {
          assigned_to: string | null
          client_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["mevak_tarea_priority"]
          reunion_id: string | null
          status: Database["public"]["Enums"]["mevak_tarea_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["mevak_tarea_priority"]
          reunion_id?: string | null
          status?: Database["public"]["Enums"]["mevak_tarea_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["mevak_tarea_priority"]
          reunion_id?: string | null
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
          {
            foreignKeyName: "mevak_tareas_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "mevak_reuniones"
            referencedColumns: ["id"]
          },
        ]
      }
      mevak_timeline_eventos: {
        Row: {
          actor_id: string | null
          client_id: string
          created_at: string
          detalle: string | null
          id: string
          payload: Json
          source_id: string | null
          source_table: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          actor_id?: string | null
          client_id: string
          created_at?: string
          detalle?: string | null
          id?: string
          payload?: Json
          source_id?: string | null
          source_table?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          actor_id?: string | null
          client_id?: string
          created_at?: string
          detalle?: string | null
          id?: string
          payload?: Json
          source_id?: string | null
          source_table?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mevak_timeline_eventos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mevak_timeline_eventos_client_id_fkey"
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
      mevak_user_tour_state: {
        Row: {
          completed_at: string | null
          skipped_at: string | null
          tour_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          skipped_at?: string | null
          tour_key?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          skipped_at?: string | null
          tour_key?: string
          updated_at?: string | null
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
          due_date: string | null
          id: string
          invoice_date: string | null
          invoiced_at: string | null
          invoiced_by: string | null
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment_assigned_at: string | null
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
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoiced_at?: string | null
          invoiced_by?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_assigned_at?: string | null
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
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoiced_at?: string | null
          invoiced_by?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_assigned_at?: string | null
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
      _mevak_upsert_alerta: {
        Args: {
          _client_id: string
          _detalle: string
          _payload: Json
          _sev: Database["public"]["Enums"]["mevak_alerta_severity"]
          _tipo: string
          _titulo: string
        }
        Returns: string
      }
      admin_list_user_status: {
        Args: never
        Returns: {
          banned: boolean
          user_id: string
        }[]
      }
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
      is_admin_or_administracion: {
        Args: { _user_id: string }
        Returns: boolean
      }
      mevak_activate_client_manual: {
        Args: { _client_id: string }
        Returns: Database["public"]["Enums"]["client_status"]
      }
      mevak_can_access_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      mevak_can_write_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      mevak_cancel_reunion: {
        Args: { _reason: string; _reunion_id: string }
        Returns: undefined
      }
      mevak_cancel_tarea: { Args: { _tarea_id: string }; Returns: undefined }
      mevak_clear_kpi_mensual_override: {
        Args: { _client_id: string; _kpi_id: string; _month_start: string }
        Returns: undefined
      }
      mevak_complete_reunion: {
        Args: { _reunion_id: string }
        Returns: undefined
      }
      mevak_complete_tarea: { Args: { _tarea_id: string }; Returns: undefined }
      mevak_compute_client_health: {
        Args: { _client_id: string }
        Returns: {
          client_id: string
          computed_at: string
          details: Json
          dim_activity: number
          dim_facturacion: number
          dim_meetings: number
          dim_reports: number
          dim_roadmap: number
          dim_tasks: number
          id: string
          score: number
        }
        SetofOptions: {
          from: "*"
          to: "mevak_health_scores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mevak_compute_health_batch: {
        Args: never
        Returns: {
          client_id: string
          error_msg: string
          ok: boolean
        }[]
      }
      mevak_create_item_comment: {
        Args: { _body: string; _item_id: string }
        Returns: string
      }
      mevak_create_reporte_mensual: {
        Args: {
          _client_id: string
          _content: Json
          _month_start: string
          _summary: string
        }
        Returns: string
      }
      mevak_create_reporte_semanal: {
        Args: {
          _client_id: string
          _content: Json
          _summary: string
          _week_start: string
        }
        Returns: string
      }
      mevak_create_reunion: {
        Args: {
          _client_id: string
          _descripcion: string
          _duration_minutes: number
          _participants_user_ids: string[]
          _scheduled_at: string
          _titulo: string
        }
        Returns: string
      }
      mevak_create_roadmap_item: {
        Args: {
          _assignee_user_id?: string
          _client_id: string
          _descripcion?: string
          _due_date?: string
          _status?: Database["public"]["Enums"]["mevak_roadmap_item_status"]
          _tags?: string[]
          _titulo: string
        }
        Returns: string
      }
      mevak_create_tarea: {
        Args: {
          _assigned_to: string
          _client_id: string
          _descripcion: string
          _due_date: string
          _priority?: Database["public"]["Enums"]["mevak_tarea_priority"]
          _reunion_id?: string
          _titulo: string
        }
        Returns: string
      }
      mevak_delete_item_comment: {
        Args: { _comment_id: string }
        Returns: undefined
      }
      mevak_delete_roadmap_item: {
        Args: { _item_id: string }
        Returns: undefined
      }
      mevak_descartar_alerta: {
        Args: { _id: string; _note?: string }
        Returns: undefined
      }
      mevak_evaluate_alertas_batch: {
        Args: never
        Returns: {
          alertas_activas: number
          client_id: string
          error_msg: string
          ok: boolean
        }[]
      }
      mevak_evaluate_alertas_for_client: {
        Args: { _client_id: string }
        Returns: {
          action: string
          alerta_id: string
          severity: Database["public"]["Enums"]["mevak_alerta_severity"]
          tipo: string
        }[]
      }
      mevak_get_alertas_for_client: {
        Args: { _client_id: string }
        Returns: {
          created_at: string
          detalle: string
          id: string
          payload: Json
          resolution_note: string
          resolved_at: string
          severity: Database["public"]["Enums"]["mevak_alerta_severity"]
          status: Database["public"]["Enums"]["mevak_alerta_status"]
          tipo: string
          titulo: string
        }[]
      }
      mevak_get_client_360: {
        Args: { _client_id: string }
        Returns: {
          activated_at: string
          comentarios_count: number
          contactos_count: number
          country_code: string
          created_at: string
          ejecutivo_email: string
          id: string
          meeting_frequency: string
          name: string
          promos_count: number
          reuniones_count: number
          status: string
          sucursales_count: number
          timeline_count: number
        }[]
      }
      mevak_get_client_health: {
        Args: { _client_id: string }
        Returns: {
          client_id: string
          computed_at: string
          details: Json
          dim_activity: number
          dim_facturacion: number
          dim_meetings: number
          dim_reports: number
          dim_roadmap: number
          dim_tasks: number
          id: string
          score: number
        }
        SetofOptions: {
          from: "*"
          to: "mevak_health_scores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mevak_get_client_health_history: {
        Args: { _client_id: string; _days?: number }
        Returns: {
          computed_at: string
          dim_activity: number
          dim_facturacion: number
          dim_meetings: number
          dim_reports: number
          dim_roadmap: number
          dim_tasks: number
          score: number
        }[]
      }
      mevak_get_mensual_autocalc: {
        Args: { _client_id: string; _month_start: string }
        Returns: Json
      }
      mevak_get_menu_score: {
        Args: { _client_id: string }
        Returns: {
          last_upload_at: string
          last_upload_by: string
          pct_costo: number
          pct_descripcion: number
          pct_foto: number
          pct_precio: number
          score: number
          total_items: number
        }[]
      }
      mevak_get_objetivos: {
        Args: { _client_id: string }
        Returns: {
          client_id: string
          descripcion_md: string | null
          kpi_1: Json | null
          kpi_2: Json | null
          kpi_3: Json | null
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mevak_objetivos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mevak_get_onboarding_for_client: {
        Args: { _client_id: string }
        Returns: {
          completed_at: string
          completed_by: string
          days_since_update: number
          descripcion: string
          item_id: string
          notas: string
          order_index: number
          required: boolean
          responsable: string
          status: Database["public"]["Enums"]["mevak_onboarding_item_status"]
          status_id: string
          titulo: string
          updated_at: string
        }[]
      }
      mevak_get_reporte_mensual_data: {
        Args: { _client_id: string; _month_start: string }
        Returns: Json
      }
      mevak_get_reporte_semanal_data: {
        Args: { _client_id: string; _week_start: string }
        Returns: Json
      }
      mevak_get_reportes_settings: { Args: never; Returns: Json }
      mevak_get_reunion_detail: {
        Args: { _reunion_id: string }
        Returns: {
          cancelled_at: string
          cancelled_reason: string
          client_id: string
          completed_at: string
          created_at: string
          created_by: string
          descripcion: string
          duration_min: number
          id: string
          minuta_md: string
          participants: Json
          participants_user_ids: string[]
          scheduled_at: string
          status: Database["public"]["Enums"]["mevak_reunion_status"]
          titulo: string
          updated_at: string
        }[]
      }
      mevak_get_roadmap_item_detail: {
        Args: { _item_id: string }
        Returns: {
          assignee_email: string
          assignee_user_id: string
          client_id: string
          created_at: string
          descripcion: string
          due_date: string
          id: string
          order_index: number
          roadmap_id: string
          status: string
          tags: string[]
          titulo: string
          updated_at: string
        }[]
      }
      mevak_instantiate_onboarding: {
        Args: { _client_id: string }
        Returns: number
      }
      mevak_kpis_mes_agg: {
        Args: { _client_id: string; _month_start: string }
        Returns: Json
      }
      mevak_kpis_semana_agg: {
        Args: { _client_id: string; _week_start: string }
        Returns: {
          cancelaciones: number
          demoras_min_prom: number
          facturacion: number
          food_is_ready_min: number
          open_time_pct: number
          ordenes: number
          por_plataforma: Json
          rechazos: number
          reviews_cantidad: number
          reviews_puntaje: number
          ticket_promedio: number
        }[]
      }
      mevak_list_alertas: {
        Args: {
          _client_id?: string
          _severity?: Database["public"]["Enums"]["mevak_alerta_severity"]
          _status?: Database["public"]["Enums"]["mevak_alerta_status"]
        }
        Returns: {
          client_id: string
          company_name: string
          created_at: string
          detalle: string
          id: string
          payload: Json
          resolved_at: string
          severity: Database["public"]["Enums"]["mevak_alerta_severity"]
          status: Database["public"]["Enums"]["mevak_alerta_status"]
          tipo: string
          titulo: string
        }[]
      }
      mevak_list_assignable_users_for_client:
        | {
            Args: { _client_id: string }
            Returns: {
              email: string
              role: string
              user_id: string
            }[]
          }
        | {
            Args: { _client_id: string; _include_clientes?: boolean }
            Returns: {
              email: string
              role: string
              user_id: string
            }[]
          }
      mevak_list_client_sub_brands: {
        Args: { _client_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      mevak_list_clients_for_mevak: {
        Args: never
        Returns: {
          country_code: string
          created_at: string
          ejecutivo_email: string
          ejecutivo_id: string
          id: string
          name: string
          onboarding_completed: number
          onboarding_pct: number
          onboarding_total: number
          status: Database["public"]["Enums"]["client_status"]
        }[]
      }
      mevak_list_clients_with_health: {
        Args: never
        Returns: {
          client_id: string
          company_name: string
          computed_at: string
          dim_activity: number
          dim_facturacion: number
          dim_meetings: number
          dim_reports: number
          dim_roadmap: number
          dim_tasks: number
          score: number
          status: string
        }[]
      }
      mevak_list_comentarios: {
        Args: { _client_id: string }
        Returns: {
          autor_email: string
          contenido_md: string
          created_at: string
          id: string
        }[]
      }
      mevak_list_contactos: {
        Args: { _client_id: string }
        Returns: {
          email: string
          id: string
          nombre: string
          notas: string
          platform_id: string
          platform_name: string
          rol: string
          telefono: string
          tipo: string
        }[]
      }
      mevak_list_fotos: {
        Args: { _client_id: string }
        Returns: {
          created_at: string
          drive_url: string
          filename: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          tags: string[]
          uploaded_by_email: string
        }[]
      }
      mevak_list_item_comments: {
        Args: { _item_id: string }
        Returns: {
          body: string
          created_at: string
          id: string
          is_own: boolean
          item_id: string
          updated_at: string
          user_email: string
          user_id: string
        }[]
      }
      mevak_list_menu_items: {
        Args: { _client_id: string }
        Returns: {
          client_sub_brand_id: string
          combos: Json
          costo: number
          created_at: string
          descripcion: string
          foto_url: string
          id: string
          nombre: string
          opcionales: Json
          precio: number
          promo_vinculada: string
          seccion: string
          stock_estado: string
          sub_brand_name: string
          upload_id: string
        }[]
      }
      mevak_list_menu_uploads: {
        Args: { _client_id: string }
        Returns: {
          created_at: string
          filename: string
          id: string
          notas: string
          row_count: number
          storage_path: string
          sub_brand_name: string
          uploaded_by_email: string
        }[]
      }
      mevak_list_onboarding_pipeline: {
        Args: never
        Returns: {
          country_code: string
          created_at: string
          days_open: number
          done: number
          ejecutivo_email: string
          id: string
          name: string
          pct: number
          total: number
        }[]
      }
      mevak_list_promociones: {
        Args: { _client_id: string }
        Returns: {
          aprobada_at: string
          created_at: string
          descripcion: string
          ends_at: string
          id: string
          nombre: string
          platform_id: string
          platform_name: string
          starts_at: string
          status: Database["public"]["Enums"]["mevak_promocion_status"]
          sub_brand_id: string
          sub_brand_name: string
          sucursal_id: string
          sucursal_nombre: string
        }[]
      }
      mevak_list_reportes_mensuales: {
        Args: { _client_id: string }
        Returns: {
          created_at: string
          created_by_email: string
          id: string
          month_start: string
          pdf_url: string
          seen_at: string
          sent_at: string
          status: Database["public"]["Enums"]["mevak_reporte_status"]
          summary: string
        }[]
      }
      mevak_list_reportes_semanales: {
        Args: { _client_id: string }
        Returns: {
          created_at: string
          created_by_email: string
          id: string
          pdf_url: string
          seen_at: string
          sent_at: string
          status: Database["public"]["Enums"]["mevak_reporte_status"]
          summary: string
          week_start: string
        }[]
      }
      mevak_list_reuniones: {
        Args: { _client_id: string }
        Returns: {
          asistentes: Json
          cancelled_at: string | null
          cancelled_reason: string | null
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          decisiones: Json
          descripcion: string | null
          duration_min: number | null
          id: string
          meeting_url: string | null
          minuta_md: string | null
          notas: string | null
          participants_user_ids: string[]
          proxima_fecha: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["mevak_reunion_status"]
          tipo: string | null
          titulo: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "mevak_reuniones"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mevak_list_reuniones_for_client: {
        Args: { _client_id: string; _include_cancelled?: boolean }
        Returns: {
          cancelled_at: string
          cancelled_reason: string
          completed_at: string
          created_at: string
          descripcion: string
          duration_min: number
          id: string
          participants_user_ids: string[]
          scheduled_at: string
          status: Database["public"]["Enums"]["mevak_reunion_status"]
          titulo: string
        }[]
      }
      mevak_list_roadmap_items: {
        Args: { _client_id: string }
        Returns: {
          assignee_user_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          due_date: string | null
          id: string
          order_index: number
          roadmap_id: string
          status: Database["public"]["Enums"]["mevak_roadmap_item_status"]
          tags: string[]
          titulo: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "mevak_roadmap_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mevak_list_roadmap_items_for_client: {
        Args: { _client_id: string; _include_descartado?: boolean }
        Returns: {
          assignee_email: string
          assignee_user_id: string
          client_id: string
          created_at: string
          descripcion: string
          due_date: string
          id: string
          order_index: number
          roadmap_id: string
          status: Database["public"]["Enums"]["mevak_roadmap_item_status"]
          tags: string[]
          titulo: string
          updated_at: string
        }[]
      }
      mevak_list_sucursal_plataforma: {
        Args: { _client_id: string }
        Returns: {
          branch_id_external: string
          comision_pct: number
          horarios: Json
          id: string
          notas: string
          platform_id: string
          platform_name: string
          sucursal_id: string
          sucursal_nombre: string
        }[]
      }
      mevak_list_sucursales: {
        Args: { _client_id: string }
        Returns: {
          activa: boolean
          ciudad: string
          client_id: string
          client_sub_brand_id: string
          country_code: string
          created_at: string
          direccion: string
          id: string
          metadata: Json
          nombre: string
          sub_brand_name: string
          tipo: string
          updated_at: string
        }[]
      }
      mevak_list_tareas_for_client: {
        Args: {
          _client_id: string
          _include_completadas?: boolean
          _priority?: string[]
          _status?: string[]
        }
        Returns: {
          assigned_to: string
          assignee_email: string
          client_id: string
          completed_at: string
          completed_by: string
          created_at: string
          created_by: string
          descripcion: string
          due_date: string
          id: string
          priority: Database["public"]["Enums"]["mevak_tarea_priority"]
          reunion_id: string
          reunion_titulo: string
          status: Database["public"]["Enums"]["mevak_tarea_status"]
          titulo: string
          updated_at: string
        }[]
      }
      mevak_list_tareas_for_reunion: {
        Args: { _reunion_id: string }
        Returns: {
          assigned_to: string
          assignee_email: string
          client_id: string
          completed_at: string
          completed_by: string
          created_at: string
          created_by: string
          descripcion: string
          due_date: string
          id: string
          priority: Database["public"]["Enums"]["mevak_tarea_priority"]
          reunion_id: string
          reunion_titulo: string
          status: Database["public"]["Enums"]["mevak_tarea_status"]
          titulo: string
          updated_at: string
        }[]
      }
      mevak_list_timeline: {
        Args: { _client_id: string; _limit?: number }
        Returns: {
          actor_id: string | null
          client_id: string
          created_at: string
          detalle: string | null
          id: string
          payload: Json
          source_id: string | null
          source_table: string | null
          tipo: string
          titulo: string
        }[]
        SetofOptions: {
          from: "*"
          to: "mevak_timeline_eventos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mevak_list_timeline_actors: {
        Args: { _client_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      mevak_list_timeline_for_client: {
        Args: {
          _actors?: string[]
          _client_id: string
          _from_date?: string
          _limit?: number
          _offset?: number
          _tipos?: string[]
          _to_date?: string
        }
        Returns: {
          actor_email: string
          actor_id: string
          client_id: string
          created_at: string
          detalle: string
          id: string
          payload: Json
          source_id: string
          source_table: string
          tipo: string
          titulo: string
        }[]
      }
      mevak_my_client_ids: { Args: { _user_id: string }; Returns: string[] }
      mevak_onboarding_is_complete: {
        Args: { _client_id: string }
        Returns: boolean
      }
      mevak_reopen_tarea: { Args: { _tarea_id: string }; Returns: undefined }
      mevak_resolve_alerta: {
        Args: { _id: string; _note?: string }
        Returns: undefined
      }
      mevak_set_item_status: {
        Args: {
          _client_id: string
          _item_id: string
          _notas?: string
          _status: Database["public"]["Enums"]["mevak_onboarding_item_status"]
        }
        Returns: {
          client_id: string
          completed_at: string | null
          completed_by: string | null
          id: string
          item_id: string
          notas: string | null
          status: Database["public"]["Enums"]["mevak_onboarding_item_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "mevak_onboarding_status"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mevak_set_kpi_mensual_override: {
        Args: {
          _client_id: string
          _kpi_id: string
          _month_start: string
          _reason: string
          _value: number
        }
        Returns: undefined
      }
      mevak_set_reporte_mensual_status: {
        Args: {
          _id: string
          _pdf_url: string
          _status: Database["public"]["Enums"]["mevak_reporte_status"]
        }
        Returns: undefined
      }
      mevak_set_reporte_semanal_status: {
        Args: {
          _id: string
          _pdf_url: string
          _status: Database["public"]["Enums"]["mevak_reporte_status"]
        }
        Returns: undefined
      }
      mevak_set_tarea_status: {
        Args: {
          _status: Database["public"]["Enums"]["mevak_tarea_status"]
          _tarea_id: string
        }
        Returns: undefined
      }
      mevak_update_item_comment: {
        Args: { _body: string; _comment_id: string }
        Returns: undefined
      }
      mevak_update_minuta: {
        Args: { _minuta: string; _reunion_id: string }
        Returns: undefined
      }
      mevak_update_reunion: {
        Args: {
          _descripcion: string
          _duration_minutes: number
          _participants_user_ids: string[]
          _reunion_id: string
          _scheduled_at: string
          _titulo: string
        }
        Returns: undefined
      }
      mevak_update_roadmap_item: {
        Args: {
          _assignee_user_id: string
          _descripcion: string
          _due_date: string
          _item_id: string
          _tags: string[]
          _titulo: string
        }
        Returns: undefined
      }
      mevak_update_roadmap_item_status: {
        Args: {
          _item_id: string
          _new_position: number
          _new_status: Database["public"]["Enums"]["mevak_roadmap_item_status"]
        }
        Returns: undefined
      }
      mevak_update_tarea: {
        Args: {
          _assigned_to: string
          _descripcion: string
          _due_date: string
          _priority?: Database["public"]["Enums"]["mevak_tarea_priority"]
          _tarea_id: string
          _titulo: string
        }
        Returns: undefined
      }
      mevak_upsert_kpi_mensual: {
        Args: {
          _ads_revenue: number
          _ads_spend: number
          _cancelaciones: number
          _client_id: string
          _conversion_pct: number
          _ctr_pct: number
          _demoras_min_prom: number
          _facturacion: number
          _food_is_ready_min: number
          _month_start: string
          _notas: string
          _open_time_pct: number
          _ordenes: number
          _platform_id: string
          _rechazos: number
          _reviews_cantidad: number
          _reviews_puntaje: number
          _sesiones: number
          _source: string
          _sucursal_id: string
          _top_productos: Json
        }
        Returns: string
      }
      mevak_upsert_kpi_mensual_solo_mensual: {
        Args: {
          _ads_revenue: number
          _ads_spend: number
          _client_id: string
          _conversion_pct: number
          _ctr_pct: number
          _month_start: string
          _notas: string
          _platform_id: string
          _sesiones: number
          _sucursal_id: string
          _top_productos: Json
        }
        Returns: string
      }
      mevak_upsert_kpi_semanal: {
        Args: {
          _cancelaciones: number
          _client_id: string
          _demoras_min_prom: number
          _facturacion: number
          _food_is_ready_min: number
          _notas: string
          _open_time_pct: number
          _ordenes: number
          _platform_id: string
          _rechazos: number
          _reviews_cantidad: number
          _reviews_puntaje: number
          _source: string
          _sucursal_id: string
          _week_start: string
        }
        Returns: string
      }
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
      snapshot_commissions_for_month: {
        Args: { _period?: string }
        Returns: number
      }
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
      app_role: "admin" | "executive" | "administracion"
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
      mevak_alerta_severity: "baja" | "media" | "alta" | "critica"
      mevak_alerta_status:
        | "abierta"
        | "reconocida"
        | "resuelta"
        | "descartada"
        | "activa"
      mevak_cliente_user_role: "cliente_user" | "ejecutivo_asignado"
      mevak_kpi_period: "semanal" | "mensual"
      mevak_onboarding_item_status:
        | "pendiente"
        | "en_progreso"
        | "completado"
        | "no_aplica"
      mevak_promocion_status:
        | "propuesta"
        | "planificada"
        | "aprobada_offline"
        | "cargada_en_plataformas"
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
      mevak_tipo_agregacion:
        | "suma"
        | "promedio"
        | "promedio_ponderado"
        | "solo_mensual"
        | "calculado"
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
      app_role: ["admin", "executive", "administracion"],
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
      mevak_alerta_severity: ["baja", "media", "alta", "critica"],
      mevak_alerta_status: [
        "abierta",
        "reconocida",
        "resuelta",
        "descartada",
        "activa",
      ],
      mevak_cliente_user_role: ["cliente_user", "ejecutivo_asignado"],
      mevak_kpi_period: ["semanal", "mensual"],
      mevak_onboarding_item_status: [
        "pendiente",
        "en_progreso",
        "completado",
        "no_aplica",
      ],
      mevak_promocion_status: [
        "propuesta",
        "planificada",
        "aprobada_offline",
        "cargada_en_plataformas",
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
      mevak_tipo_agregacion: [
        "suma",
        "promedio",
        "promedio_ponderado",
        "solo_mensual",
        "calculado",
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
