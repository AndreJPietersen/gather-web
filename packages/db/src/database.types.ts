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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          detail: Json | null
          id: string
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          detail?: Json | null
          id?: string
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          detail?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_profiles_id_fk"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_email_recipients: {
        Row: {
          email: string
          email_id: string
          error: string | null
          id: string
          status: Database["public"]["Enums"]["email_recipient_status"]
          user_id: string | null
        }
        Insert: {
          email: string
          email_id: string
          error?: string | null
          id?: string
          status: Database["public"]["Enums"]["email_recipient_status"]
          user_id?: string | null
        }
        Update: {
          email?: string
          email_id?: string
          error?: string | null
          id?: string
          status?: Database["public"]["Enums"]["email_recipient_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_email_recipients_email_id_admin_emails_id_fk"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "admin_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_email_recipients_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_emails: {
        Row: {
          audience: Json
          category: Database["public"]["Enums"]["email_category"]
          created_at: string
          failed_count: number
          id: string
          recipient_count: number
          sent_by: string
          sent_count: number
          skipped_count: number
          subject: string
          template_id: string | null
        }
        Insert: {
          audience: Json
          category: Database["public"]["Enums"]["email_category"]
          created_at?: string
          failed_count?: number
          id?: string
          recipient_count?: number
          sent_by: string
          sent_count?: number
          skipped_count?: number
          subject: string
          template_id?: string | null
        }
        Update: {
          audience?: Json
          category?: Database["public"]["Enums"]["email_category"]
          created_at?: string
          failed_count?: number
          id?: string
          recipient_count?: number
          sent_by?: string
          sent_count?: number
          skipped_count?: number
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_emails_sent_by_profiles_id_fk"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_emails_template_id_email_templates_id_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_watchlist_dismissals: {
        Row: {
          created_at: string
          dismissed_by: string
          hits_at_dismissal: number
          id: string
          note: string | null
          signal: string
          subject_key: string
        }
        Insert: {
          created_at?: string
          dismissed_by: string
          hits_at_dismissal: number
          id?: string
          note?: string | null
          signal: string
          subject_key: string
        }
        Update: {
          created_at?: string
          dismissed_by?: string
          hits_at_dismissal?: number
          id?: string
          note?: string | null
          signal?: string
          subject_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_watchlist_dismissals_dismissed_by_profiles_id_fk"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          featured_enabled: boolean
          id: boolean
          listing_daily_limit: number
          max_email_recipients: number
          max_owned_businesses: number
          registration_enabled: boolean
          storage_cleanup_min_age_minutes: number
          updated_at: string
          watch_claim_days: number
          watch_claim_min: number
          watch_contact_min: number
          watch_invite_days: number
          watch_invite_min: number
          watch_listing_days: number
          watch_listing_min: number
          watch_team_min: number
        }
        Insert: {
          featured_enabled?: boolean
          id?: boolean
          listing_daily_limit?: number
          max_email_recipients?: number
          max_owned_businesses?: number
          registration_enabled?: boolean
          storage_cleanup_min_age_minutes?: number
          updated_at?: string
          watch_claim_days?: number
          watch_claim_min?: number
          watch_contact_min?: number
          watch_invite_days?: number
          watch_invite_min?: number
          watch_listing_days?: number
          watch_listing_min?: number
          watch_team_min?: number
        }
        Update: {
          featured_enabled?: boolean
          id?: boolean
          listing_daily_limit?: number
          max_email_recipients?: number
          max_owned_businesses?: number
          registration_enabled?: boolean
          storage_cleanup_min_age_minutes?: number
          updated_at?: string
          watch_claim_days?: number
          watch_claim_min?: number
          watch_contact_min?: number
          watch_invite_days?: number
          watch_invite_min?: number
          watch_listing_days?: number
          watch_listing_min?: number
          watch_team_min?: number
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          budgeted_amount: number
          category_id: string | null
          created_at: string
          event_id: string
          event_vendor_id: string | null
          id: string
          label: string
        }
        Insert: {
          budgeted_amount: number
          category_id?: string | null
          created_at?: string
          event_id: string
          event_vendor_id?: string | null
          id?: string
          label: string
        }
        Update: {
          budgeted_amount?: number
          category_id?: string | null
          created_at?: string
          event_id?: string
          event_vendor_id?: string | null
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_category_id_service_categories_id_fk"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_event_vendor_id_event_vendors_id_fk"
            columns: ["event_vendor_id"]
            isOneToOne: false
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          reason?: string
        }
        Update: {
          created_at?: string
          email?: string
          reason?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string | null
          button_label: string | null
          button_url: string | null
          category: Database["public"]["Enums"]["email_category"]
          created_at: string
          heading: string | null
          id: string
          key: string | null
          kind: Database["public"]["Enums"]["email_template_kind"]
          name: string
          preheader: string | null
          raw_html: string | null
          subject: string
          updated_at: string
          updated_by: string | null
          use_raw_html: boolean
        }
        Insert: {
          body?: string | null
          button_label?: string | null
          button_url?: string | null
          category?: Database["public"]["Enums"]["email_category"]
          created_at?: string
          heading?: string | null
          id?: string
          key?: string | null
          kind?: Database["public"]["Enums"]["email_template_kind"]
          name: string
          preheader?: string | null
          raw_html?: string | null
          subject: string
          updated_at?: string
          updated_by?: string | null
          use_raw_html?: boolean
        }
        Update: {
          body?: string | null
          button_label?: string | null
          button_url?: string | null
          category?: Database["public"]["Enums"]["email_category"]
          created_at?: string
          heading?: string | null
          id?: string
          key?: string | null
          kind?: Database["public"]["Enums"]["email_template_kind"]
          name?: string
          preheader?: string | null
          raw_html?: string | null
          subject?: string
          updated_at?: string
          updated_by?: string | null
          use_raw_html?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_updated_by_profiles_id_fk"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          contact_user_id: string | null
          created_at: string
          email: string | null
          event_id: string
          guest_count: number
          id: string
          name: string | null
          phone: string | null
          role: string | null
          rsvp_status: Database["public"]["Enums"]["rsvp_status"]
        }
        Insert: {
          contact_user_id?: string | null
          created_at?: string
          email?: string | null
          event_id: string
          guest_count?: number
          id?: string
          name?: string | null
          phone?: string | null
          role?: string | null
          rsvp_status?: Database["public"]["Enums"]["rsvp_status"]
        }
        Update: {
          contact_user_id?: string | null
          created_at?: string
          email?: string | null
          event_id?: string
          guest_count?: number
          id?: string
          name?: string | null
          phone?: string | null
          role?: string | null
          rsvp_status?: Database["public"]["Enums"]["rsvp_status"]
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_contact_user_id_profiles_id_fk"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_collaborators: {
        Row: {
          created_at: string
          event_id: string
          id: string
          invited_by: string
          permission_level: Database["public"]["Enums"]["collaborator_permission"]
          status: Database["public"]["Enums"]["invitation_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          invited_by: string
          permission_level?: Database["public"]["Enums"]["collaborator_permission"]
          status?: Database["public"]["Enums"]["invitation_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          invited_by?: string
          permission_level?: Database["public"]["Enums"]["collaborator_permission"]
          status?: Database["public"]["Enums"]["invitation_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_collaborators_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_collaborators_invited_by_profiles_id_fk"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_collaborators_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_gallery_images: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string
          event_id: string
          id: string
          storage_path: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          storage_path: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_gallery_images_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_gallery_images_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_mood_board_photos: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          featured_at: string | null
          id: string
          is_featured: boolean
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          featured_at?: string | null
          id?: string
          is_featured?: boolean
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          featured_at?: string | null
          id?: string
          is_featured?: boolean
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_mood_board_photos_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_mood_board_photos_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_mood_boards: {
        Row: {
          event_id: string
          id: string
          palette: Json
          tagline: string | null
          tags: Json
          updated_at: string
        }
        Insert: {
          event_id: string
          id?: string
          palette?: Json
          tagline?: string | null
          tags?: Json
          updated_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          palette?: Json
          tagline?: string | null
          tags?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_mood_boards_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tasks: {
        Row: {
          assigned_to: string | null
          completed: boolean
          created_at: string
          due_date: string | null
          event_id: string
          id: string
          priority: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean
          created_at?: string
          due_date?: string | null
          event_id: string
          id?: string
          priority?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean
          created_at?: string
          due_date?: string | null
          event_id?: string
          id?: string
          priority?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tasks_assigned_to_profiles_id_fk"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tasks_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_type_service_categories: {
        Row: {
          created_at: string
          event_type_id: string
          service_category_id: string
        }
        Insert: {
          created_at?: string
          event_type_id: string
          service_category_id: string
        }
        Update: {
          created_at?: string
          event_type_id?: string
          service_category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_type_service_categories_event_type_id_event_types_id_fk"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_type_service_categories_service_category_id_service_categ"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      event_vendor_chat_reads: {
        Row: {
          event_vendor_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          event_vendor_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          event_vendor_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_vendor_chat_reads_event_vendor_id_event_vendors_id_fk"
            columns: ["event_vendor_id"]
            isOneToOne: false
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vendor_chat_reads_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_vendor_messages: {
        Row: {
          body: string | null
          created_at: string
          event_vendor_id: string
          id: string
          sender_id: string
          storage_path: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          event_vendor_id: string
          id?: string
          sender_id: string
          storage_path?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          event_vendor_id?: string
          id?: string
          sender_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_vendor_messages_event_vendor_id_event_vendors_id_fk"
            columns: ["event_vendor_id"]
            isOneToOne: false
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vendor_messages_sender_id_profiles_id_fk"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_vendors: {
        Row: {
          amount: number | null
          confirmed: boolean
          created_at: string
          event_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["event_vendor_status"]
          vendor_id: string
          vendor_type: string | null
        }
        Insert: {
          amount?: number | null
          confirmed?: boolean
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["event_vendor_status"]
          vendor_id: string
          vendor_type?: string | null
        }
        Update: {
          amount?: number | null
          confirmed?: boolean
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["event_vendor_status"]
          vendor_id?: string
          vendor_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_vendors_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vendors_vendor_id_vendors_id_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          budget_total: number | null
          budget_warning_percent: number | null
          capacity: number | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          end_at: string | null
          event_type: string | null
          event_type_id: string | null
          id: string
          location: string | null
          name: string
          owner_id: string
          rsvp_date: string | null
          start_at: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
          visibility: Database["public"]["Enums"]["event_visibility"]
        }
        Insert: {
          budget_total?: number | null
          budget_warning_percent?: number | null
          capacity?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_type?: string | null
          event_type_id?: string | null
          id?: string
          location?: string | null
          name: string
          owner_id: string
          rsvp_date?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Update: {
          budget_total?: number | null
          budget_warning_percent?: number | null
          capacity?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_type?: string | null
          event_type_id?: string | null
          id?: string
          location?: string | null
          name?: string
          owner_id?: string
          rsvp_date?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "events_event_type_id_event_types_id_fk"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_owner_id_profiles_id_fk"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_prices: {
        Row: {
          amount: number | null
          duration: Database["public"]["Enums"]["feature_duration"]
          id: string
          spot: Database["public"]["Enums"]["feature_spot"]
          updated_at: string
        }
        Insert: {
          amount?: number | null
          duration: Database["public"]["Enums"]["feature_duration"]
          id?: string
          spot: Database["public"]["Enums"]["feature_spot"]
          updated_at?: string
        }
        Update: {
          amount?: number | null
          duration?: Database["public"]["Enums"]["feature_duration"]
          id?: string
          spot?: Database["public"]["Enums"]["feature_spot"]
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          email_reminders: boolean
          profile_id: string
          push_reminders: boolean
          sms_reminders: boolean
          upcoming_window: Database["public"]["Enums"]["upcoming_window"]
          updated_at: string
        }
        Insert: {
          email_reminders?: boolean
          profile_id: string
          push_reminders?: boolean
          sms_reminders?: boolean
          upcoming_window?: Database["public"]["Enums"]["upcoming_window"]
          updated_at?: string
        }
        Update: {
          email_reminders?: boolean
          profile_id?: string
          push_reminders?: boolean
          sms_reminders?: boolean
          upcoming_window?: Database["public"]["Enums"]["upcoming_window"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_profiles_id_fk"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          gateway_status: string | null
          gateway_transaction_id: string | null
          id: string
          installment_number: number
          paid_on: string | null
          payment_gateway: string | null
          payment_plan_id: string
          proof_of_payment_path: string | null
          status: Database["public"]["Enums"]["installment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          gateway_status?: string | null
          gateway_transaction_id?: string | null
          id?: string
          installment_number: number
          paid_on?: string | null
          payment_gateway?: string | null
          payment_plan_id: string
          proof_of_payment_path?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          gateway_status?: string | null
          gateway_transaction_id?: string | null
          id?: string
          installment_number?: number
          paid_on?: string | null
          payment_gateway?: string | null
          payment_plan_id?: string
          proof_of_payment_path?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_installments_payment_plan_id_payment_plans_id_fk"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          budget_item_id: string | null
          created_at: string
          deposit_amount: number | null
          deposit_due_date: string | null
          event_vendor_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["payment_plan_status"]
          total_amount: number
        }
        Insert: {
          budget_item_id?: string | null
          created_at?: string
          deposit_amount?: number | null
          deposit_due_date?: string | null
          event_vendor_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["payment_plan_status"]
          total_amount: number
        }
        Update: {
          budget_item_id?: string | null
          created_at?: string
          deposit_amount?: number | null
          deposit_due_date?: string | null
          event_vendor_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["payment_plan_status"]
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_budget_item_id_budget_items_id_fk"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_event_vendor_id_event_vendors_id_fk"
            columns: ["event_vendor_id"]
            isOneToOne: false
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          contact_user_id: string | null
          created_at: string
          id: string
          method: Database["public"]["Enums"]["reminder_method"]
          payment_installment_id: string
          remind_at: string
          sent: boolean
        }
        Insert: {
          contact_user_id?: string | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["reminder_method"]
          payment_installment_id: string
          remind_at: string
          sent?: boolean
        }
        Update: {
          contact_user_id?: string | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["reminder_method"]
          payment_installment_id?: string
          remind_at?: string
          sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_contact_user_id_profiles_id_fk"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_payment_installment_id_payment_installments_i"
            columns: ["payment_installment_id"]
            isOneToOne: false
            referencedRelation: "payment_installments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
          phone: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_admin?: boolean
          phone?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          phone?: string | null
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      support_case_comments: {
        Row: {
          author_id: string
          body: string
          case_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          case_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          case_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_case_comments_author_id_profiles_id_fk"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_case_comments_case_id_support_cases_id_fk"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          assigned_admin_id: string | null
          attachment_path: string | null
          category: Database["public"]["Enums"]["support_case_category"] | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["support_case_priority"]
          related_event_id: string | null
          related_vendor_id: string | null
          requester_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_case_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_admin_id?: string | null
          attachment_path?: string | null
          category?: Database["public"]["Enums"]["support_case_category"] | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["support_case_priority"]
          related_event_id?: string | null
          related_vendor_id?: string | null
          requester_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_case_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_admin_id?: string | null
          attachment_path?: string | null
          category?: Database["public"]["Enums"]["support_case_category"] | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["support_case_priority"]
          related_event_id?: string | null
          related_vendor_id?: string | null
          requester_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_case_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_assigned_admin_id_profiles_id_fk"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_related_event_id_events_id_fk"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_related_vendor_id_vendors_id_fk"
            columns: ["related_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_requester_id_profiles_id_fk"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reminders: {
        Row: {
          contact_user_id: string | null
          created_at: string
          event_task_id: string
          id: string
          method: Database["public"]["Enums"]["reminder_method"]
          remind_at: string
          sent: boolean
        }
        Insert: {
          contact_user_id?: string | null
          created_at?: string
          event_task_id: string
          id?: string
          method?: Database["public"]["Enums"]["reminder_method"]
          remind_at: string
          sent?: boolean
        }
        Update: {
          contact_user_id?: string | null
          created_at?: string
          event_task_id?: string
          id?: string
          method?: Database["public"]["Enums"]["reminder_method"]
          remind_at?: string
          sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "task_reminders_contact_user_id_profiles_id_fk"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reminders_event_task_id_event_tasks_id_fk"
            columns: ["event_task_id"]
            isOneToOne: false
            referencedRelation: "event_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_suspensions: {
        Row: {
          created_at: string
          reason: string | null
          suspended_by: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reason?: string | null
          suspended_by: string
          user_id: string
        }
        Update: {
          created_at?: string
          reason?: string | null
          suspended_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_suspensions_suspended_by_profiles_id_fk"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_suspensions_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_write_log: {
        Row: {
          created_at: string
          id: string
          table_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          table_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      vendor_booking_notes: {
        Row: {
          body: string
          event_vendor_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          body: string
          event_vendor_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          body?: string
          event_vendor_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_booking_notes_event_vendor_id_event_vendors_id_fk"
            columns: ["event_vendor_id"]
            isOneToOne: true
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_booking_notes_updated_by_profiles_id_fk"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_business_requests: {
        Row: {
          business_name: string
          created_at: string
          id: string
          needs_duplicate_category: boolean
          needs_extra_slot: boolean
          primary_category: string | null
          reason: string | null
          rejection_reason: string | null
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["vendor_business_request_status"]
          used_vendor_id: string | null
        }
        Insert: {
          business_name: string
          created_at?: string
          id?: string
          needs_duplicate_category?: boolean
          needs_extra_slot?: boolean
          primary_category?: string | null
          reason?: string | null
          rejection_reason?: string | null
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["vendor_business_request_status"]
          used_vendor_id?: string | null
        }
        Update: {
          business_name?: string
          created_at?: string
          id?: string
          needs_duplicate_category?: boolean
          needs_extra_slot?: boolean
          primary_category?: string | null
          reason?: string | null
          rejection_reason?: string | null
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["vendor_business_request_status"]
          used_vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_business_requests_requester_id_profiles_id_fk"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_business_requests_reviewed_by_profiles_id_fk"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_business_requests_used_vendor_id_vendors_id_fk"
            columns: ["used_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_claim_requests: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["claim_request_status"]
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["claim_request_status"]
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["claim_request_status"]
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_claim_requests_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_claim_requests_reviewed_by_profiles_id_fk"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_claim_requests_vendor_id_vendors_id_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_feature_placements: {
        Row: {
          created_at: string
          created_by: string
          ends_on: string
          fee_amount: number | null
          id: string
          note: string | null
          position: number | null
          requested_by: string | null
          requested_duration:
            | Database["public"]["Enums"]["feature_duration"]
            | null
          requested_spot: Database["public"]["Enums"]["feature_spot"] | null
          starts_on: string
          status: Database["public"]["Enums"]["feature_placement_status"]
          updated_at: string
          vendor_id: string
          vendor_note: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_on: string
          fee_amount?: number | null
          id?: string
          note?: string | null
          position?: number | null
          requested_by?: string | null
          requested_duration?:
            | Database["public"]["Enums"]["feature_duration"]
            | null
          requested_spot?: Database["public"]["Enums"]["feature_spot"] | null
          starts_on: string
          status?: Database["public"]["Enums"]["feature_placement_status"]
          updated_at?: string
          vendor_id: string
          vendor_note?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_on?: string
          fee_amount?: number | null
          id?: string
          note?: string | null
          position?: number | null
          requested_by?: string | null
          requested_duration?:
            | Database["public"]["Enums"]["feature_duration"]
            | null
          requested_spot?: Database["public"]["Enums"]["feature_spot"] | null
          starts_on?: string
          status?: Database["public"]["Enums"]["feature_placement_status"]
          updated_at?: string
          vendor_id?: string
          vendor_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_feature_placements_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_feature_placements_requested_by_profiles_id_fk"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_feature_placements_vendor_id_vendors_id_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_gallery_images: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string
          id: string
          storage_path: string
          vendor_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by: string
          id?: string
          storage_path: string
          vendor_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string
          id?: string
          storage_path?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_gallery_images_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_gallery_images_vendor_id_vendors_id_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_quotes: {
        Row: {
          amount: number
          created_at: string
          created_by_vendor: boolean
          description: string | null
          document_url: string | null
          event_vendor_id: string
          id: string
          quote_number: string | null
          status: Database["public"]["Enums"]["vendor_quote_status"]
          suggested_by: string | null
          valid_until: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by_vendor?: boolean
          description?: string | null
          document_url?: string | null
          event_vendor_id: string
          id?: string
          quote_number?: string | null
          status?: Database["public"]["Enums"]["vendor_quote_status"]
          suggested_by?: string | null
          valid_until?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by_vendor?: boolean
          description?: string | null
          document_url?: string | null
          event_vendor_id?: string
          id?: string
          quote_number?: string | null
          status?: Database["public"]["Enums"]["vendor_quote_status"]
          suggested_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_quotes_event_vendor_id_event_vendors_id_fk"
            columns: ["event_vendor_id"]
            isOneToOne: false
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quotes_suggested_by_profiles_id_fk"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_review_replies: {
        Row: {
          created_at: string
          id: string
          replied_by: string
          reply_text: string
          updated_at: string
          vendor_review_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          replied_by: string
          reply_text: string
          updated_at?: string
          vendor_review_id: string
        }
        Update: {
          created_at?: string
          id?: string
          replied_by?: string
          reply_text?: string
          updated_at?: string
          vendor_review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_review_replies_replied_by_profiles_id_fk"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_review_replies_vendor_review_id_vendor_reviews_id_fk"
            columns: ["vendor_review_id"]
            isOneToOne: true
            referencedRelation: "vendor_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_reviews: {
        Row: {
          created_at: string
          event_vendor_id: string | null
          id: string
          rating: number
          review_text: string | null
          reviewer_id: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          event_vendor_id?: string | null
          id?: string
          rating: number
          review_text?: string | null
          reviewer_id: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          event_vendor_id?: string | null
          id?: string
          rating?: number
          review_text?: string | null
          reviewer_id?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_reviews_event_vendor_id_event_vendors_id_fk"
            columns: ["event_vendor_id"]
            isOneToOne: false
            referencedRelation: "event_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_reviewer_id_profiles_id_fk"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_vendor_id_vendors_id_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_services: {
        Row: {
          category_id: string | null
          description: string | null
          id: string
          name: string
          vendor_id: string
        }
        Insert: {
          category_id?: string | null
          description?: string | null
          id?: string
          name: string
          vendor_id: string
        }
        Update: {
          category_id?: string | null
          description?: string | null
          id?: string
          name?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_services_category_id_service_categories_id_fk"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_services_vendor_id_vendors_id_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_social_links: {
        Row: {
          created_at: string
          id: string
          platform: string
          url: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          url: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          url?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_social_links_vendor_id_vendors_id_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_team_invites: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          invited_email: string
          role: Database["public"]["Enums"]["vendor_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          invited_email: string
          role?: Database["public"]["Enums"]["vendor_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          invited_email?: string
          role?: Database["public"]["Enums"]["vendor_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_team_invites_invited_by_profiles_id_fk"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_team_invites_vendor_id_vendors_id_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_team_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["vendor_role"]
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["vendor_role"]
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["vendor_role"]
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_team_members_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_team_members_vendor_id_vendors_id_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          hidden_at: string | null
          id: string
          logo_path: string | null
          name: string
          phone: string | null
          primary_category: string | null
          verification_status: Database["public"]["Enums"]["vendor_verification_status"]
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          hidden_at?: string | null
          id?: string
          logo_path?: string | null
          name: string
          phone?: string | null
          primary_category?: string | null
          verification_status?: Database["public"]["Enums"]["vendor_verification_status"]
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          hidden_at?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          phone?: string | null
          primary_category?: string | null
          verification_status?: Database["public"]["Enums"]["vendor_verification_status"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      write_rate_limits: {
        Row: {
          label: string
          max_per_hour: number
          table_name: string
          updated_at: string
        }
        Insert: {
          label: string
          max_per_hour: number
          table_name: string
          updated_at?: string
        }
        Update: {
          label?: string
          max_per_hour?: number
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_email_audience: {
        Args: { p_days?: number; p_segment: string; p_target_id?: string }
        Returns: {
          display_name: string
          email: string
          user_id: string
        }[]
      }
      admin_watchlist: {
        Args: {
          p_claim_days: number
          p_claim_min: number
          p_contact_min: number
          p_invite_days: number
          p_invite_min: number
          p_listing_days: number
          p_listing_min: number
          p_team_min: number
        }
        Returns: {
          detail: string
          hits: number
          signal: string
          subject_id: string
          subject_key: string
          subject_label: string
          vendor_ids: string[]
        }[]
      }
      delete_account: { Args: { p_user: string }; Returns: undefined }
      featured_rank: {
        Args: { v: Database["public"]["Tables"]["vendors"]["Row"] }
        Returns: number
      }
      invite_email_matches_current_user: {
        Args: { p_invited_email: string; p_user_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_event_collaborator: {
        Args: {
          p_event_id: string
          p_min_permission?: string
          p_user_id: string
        }
        Returns: boolean
      }
      is_event_owner: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      is_event_pending_invitee: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      is_featured: {
        Args: { v: Database["public"]["Tables"]["vendors"]["Row"] }
        Returns: boolean
      }
      is_vendor_creator: {
        Args: { p_user_id: string; p_vendor_id: string }
        Returns: boolean
      }
      is_vendor_team_member: {
        Args: { p_roles?: string[]; p_user_id: string; p_vendor_id: string }
        Returns: boolean
      }
      is_vendor_verified: { Args: { p_vendor_id: string }; Returns: boolean }
      orphaned_storage_objects: {
        Args: { p_min_age_minutes: number }
        Returns: {
          bucket_id: string
          name: string
        }[]
      }
    }
    Enums: {
      claim_request_status: "pending" | "approved" | "rejected"
      collaborator_permission: "editor" | "viewer"
      email_category: "transactional" | "announcement"
      email_recipient_status: "sent" | "failed" | "skipped_unsubscribed"
      email_template_kind: "system" | "custom"
      event_status: "draft" | "published" | "cancelled"
      event_vendor_status:
        | "interested"
        | "shortlisted"
        | "contracted"
        | "rejected"
      event_visibility: "public" | "private" | "invite_only"
      feature_duration: "1_week" | "1_month" | "3_months"
      feature_placement_status: "pending" | "activated" | "cancelled"
      feature_spot: "top" | "rotating"
      installment_status: "pending" | "paid" | "late" | "cancelled" | "refunded"
      invitation_status: "invited" | "accepted" | "declined"
      payment_plan_status: "draft" | "active" | "completed" | "cancelled"
      reminder_method: "email" | "sms" | "push"
      rsvp_status: "attending" | "declined" | "maybe" | "no_response"
      support_case_category:
        | "payments_billing"
        | "vendor_booking"
        | "event_setup"
        | "account_verification"
        | "app_bug"
        | "other"
      support_case_priority: "low" | "normal" | "high" | "urgent"
      support_case_status: "open" | "pending" | "resolved" | "closed"
      upcoming_window: "on_day" | "one_day_before" | "one_week_before"
      vendor_business_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "used"
      vendor_quote_status:
        | "draft"
        | "sent"
        | "accepted"
        | "declined"
        | "expired"
      vendor_role: "owner" | "manager" | "staff"
      vendor_verification_status: "unclaimed" | "claim_pending" | "verified"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      claim_request_status: ["pending", "approved", "rejected"],
      collaborator_permission: ["editor", "viewer"],
      email_category: ["transactional", "announcement"],
      email_recipient_status: ["sent", "failed", "skipped_unsubscribed"],
      email_template_kind: ["system", "custom"],
      event_status: ["draft", "published", "cancelled"],
      event_vendor_status: [
        "interested",
        "shortlisted",
        "contracted",
        "rejected",
      ],
      event_visibility: ["public", "private", "invite_only"],
      feature_duration: ["1_week", "1_month", "3_months"],
      feature_placement_status: ["pending", "activated", "cancelled"],
      feature_spot: ["top", "rotating"],
      installment_status: ["pending", "paid", "late", "cancelled", "refunded"],
      invitation_status: ["invited", "accepted", "declined"],
      payment_plan_status: ["draft", "active", "completed", "cancelled"],
      reminder_method: ["email", "sms", "push"],
      rsvp_status: ["attending", "declined", "maybe", "no_response"],
      support_case_category: [
        "payments_billing",
        "vendor_booking",
        "event_setup",
        "account_verification",
        "app_bug",
        "other",
      ],
      support_case_priority: ["low", "normal", "high", "urgent"],
      support_case_status: ["open", "pending", "resolved", "closed"],
      upcoming_window: ["on_day", "one_day_before", "one_week_before"],
      vendor_business_request_status: [
        "pending",
        "approved",
        "rejected",
        "used",
      ],
      vendor_quote_status: ["draft", "sent", "accepted", "declined", "expired"],
      vendor_role: ["owner", "manager", "staff"],
      vendor_verification_status: ["unclaimed", "claim_pending", "verified"],
    },
  },
} as const

