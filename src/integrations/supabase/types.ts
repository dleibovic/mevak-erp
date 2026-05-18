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
            foreignKeyName: "client_executive_commission_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
          address: string | null
          assigned_executive_id: string | null
          billing_frequency: Database["public"]["Enums"]["billing_frequency"]
          billing_user_id: string | null
          branches_count: number
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
          payment_channel: Database["public"]["Enums"]["payment_channel"] | null
          payment_method_id: string | null
          province_id: string | null
          reports_email: string | null
          status: Database["public"]["Enums"]["client_status"]
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_executive_id?: string | null
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          billing_user_id?: string | null
          branches_count?: number
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
          address?: string | null
          assigned_executive_id?: string | null
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          billing_user_id?: string | null
          branches_count?: number
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
        ]
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
      [_ in never]: never
    }
    Functions: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      refresh_invoice_statuses: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "executive"
      billing_frequency: "weekly" | "biweekly" | "monthly"
      client_status: "active" | "inactive" | "suspended" | "pending_setup"
      collector: "dario" | "maria"
      discount_duration: "30_days" | "60_days" | "90_days" | "custom"
      expense_assignee: "dario" | "maria" | "company"
      invoice_status: "pending" | "overdue" | "paid"
      invoice_type: "formal" | "cash"
      monthly_invoice_status: "pending" | "invoiced" | "paid" | "overdue"
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
      client_status: ["active", "inactive", "suspended", "pending_setup"],
      collector: ["dario", "maria"],
      discount_duration: ["30_days", "60_days", "90_days", "custom"],
      expense_assignee: ["dario", "maria", "company"],
      invoice_status: ["pending", "overdue", "paid"],
      invoice_type: ["formal", "cash"],
      monthly_invoice_status: ["pending", "invoiced", "paid", "overdue"],
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
