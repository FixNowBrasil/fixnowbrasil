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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string
          neighborhood: string | null
          number: string | null
          state: string | null
          street: string
          updated_at: string
          user_id: string
          zip: string | null
        }
        Insert: {
          city?: string
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          neighborhood?: string | null
          number?: string | null
          state?: string | null
          street?: string
          updated_at?: string
          user_id: string
          zip?: string | null
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          neighborhood?: string | null
          number?: string | null
          state?: string | null
          street?: string
          updated_at?: string
          user_id?: string
          zip?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          description: string | null
          emoji: string
          icon: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          emoji?: string
          icon?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          emoji?: string
          icon?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          provider_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          request_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          request_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          request_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          external_reference: string | null
          failure_reason: string | null
          id: string
          method: string | null
          paid_at: string | null
          provider_id: string
          quote_id: string
          refunded_at: string | null
          released_at: string | null
          request_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          external_reference?: string | null
          failure_reason?: string | null
          id?: string
          method?: string | null
          paid_at?: string | null
          provider_id: string
          quote_id: string
          refunded_at?: string | null
          released_at?: string | null
          request_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          external_reference?: string | null
          failure_reason?: string | null
          id?: string
          method?: string | null
          paid_at?: string | null
          provider_id?: string
          quote_id?: string
          refunded_at?: string | null
          released_at?: string | null
          request_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          blocked: boolean
          city: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          blocked?: boolean
          city?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          blocked?: boolean
          city?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_services: {
        Row: {
          id: string
          price_from: number
          provider_id: string
          service_id: string
        }
        Insert: {
          id?: string
          price_from?: number
          provider_id: string
          service_id: string
        }
        Update: {
          id?: string
          price_from?: number
          provider_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_verifications: {
        Row: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          address_proof_path: string | null
          availability: string | null
          birth_date: string | null
          city: string | null
          cpf: string | null
          created_at: string
          current_step: Database["public"]["Enums"]["verification_step"]
          email: string | null
          experience_years: number
          full_name: string | null
          id: string
          identity_document_back_path: string | null
          identity_document_front_path: string | null
          identity_document_type: string | null
          liveness_status: Database["public"]["Enums"]["liveness_status"]
          neighborhood: string | null
          phone: string | null
          privacy_accepted_at: string | null
          professional_category: string | null
          professional_description: string | null
          provider_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string | null
          service_radius: number
          service_region: string | null
          services: string[]
          state: string | null
          status: Database["public"]["Enums"]["verification_status"]
          stripe_account_id: string | null
          stripe_verification_status: string | null
          submitted_at: string | null
          terms_accepted_at: string | null
          updated_at: string
          verification_email: boolean
          verification_phone: boolean
          work_photos: string[]
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          address_proof_path?: string | null
          availability?: string | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          current_step?: Database["public"]["Enums"]["verification_step"]
          email?: string | null
          experience_years?: number
          full_name?: string | null
          id?: string
          identity_document_back_path?: string | null
          identity_document_front_path?: string | null
          identity_document_type?: string | null
          liveness_status?: Database["public"]["Enums"]["liveness_status"]
          neighborhood?: string | null
          phone?: string | null
          privacy_accepted_at?: string | null
          professional_category?: string | null
          professional_description?: string | null
          provider_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          service_radius?: number
          service_region?: string | null
          services?: string[]
          state?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          stripe_account_id?: string | null
          stripe_verification_status?: string | null
          submitted_at?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          verification_email?: boolean
          verification_phone?: boolean
          work_photos?: string[]
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          address_proof_path?: string | null
          availability?: string | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          current_step?: Database["public"]["Enums"]["verification_step"]
          email?: string | null
          experience_years?: number
          full_name?: string | null
          id?: string
          identity_document_back_path?: string | null
          identity_document_front_path?: string | null
          identity_document_type?: string | null
          liveness_status?: Database["public"]["Enums"]["liveness_status"]
          neighborhood?: string | null
          phone?: string | null
          privacy_accepted_at?: string | null
          professional_category?: string | null
          professional_description?: string | null
          provider_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          service_radius?: number
          service_region?: string | null
          services?: string[]
          state?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          stripe_account_id?: string | null
          stripe_verification_status?: string | null
          submitted_at?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          verification_email?: boolean
          verification_phone?: boolean
          work_photos?: string[]
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_verifications_professional_category_fkey"
            columns: ["professional_category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_verifications_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          approved: boolean
          availability: string
          available_now: boolean
          avatar_url: string | null
          bio: string | null
          category_id: string | null
          city: string
          created_at: string
          distance_km: number
          headline: string | null
          id: string
          jobs_done: number
          name: string
          neighborhood: string | null
          price_from: number
          radius_km: number
          rating: number
          reviews_count: number
          user_id: string | null
          verified: boolean
          work_photos: string[]
          years_experience: number
        }
        Insert: {
          approved?: boolean
          availability?: string
          available_now?: boolean
          avatar_url?: string | null
          bio?: string | null
          category_id?: string | null
          city?: string
          created_at?: string
          distance_km?: number
          headline?: string | null
          id?: string
          jobs_done?: number
          name: string
          neighborhood?: string | null
          price_from?: number
          radius_km?: number
          rating?: number
          reviews_count?: number
          user_id?: string | null
          verified?: boolean
          work_photos?: string[]
          years_experience?: number
        }
        Update: {
          approved?: boolean
          availability?: string
          available_now?: boolean
          avatar_url?: string | null
          bio?: string | null
          category_id?: string | null
          city?: string
          created_at?: string
          distance_km?: number
          headline?: string | null
          id?: string
          jobs_done?: number
          name?: string
          neighborhood?: string | null
          price_from?: number
          radius_km?: number
          rating?: number
          reviews_count?: number
          user_id?: string | null
          verified?: boolean
          work_photos?: string[]
          years_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "providers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          amount: number
          created_at: string
          estimated_time: string | null
          id: string
          message: string | null
          provider_id: string
          request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          estimated_time?: string | null
          id?: string
          message?: string | null
          provider_id: string
          request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          estimated_time?: string | null
          id?: string
          message?: string | null
          provider_id?: string
          request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_invites: {
        Row: {
          created_at: string
          id: string
          provider_id: string
          rank: number
          request_id: string
          score: number
        }
        Insert: {
          created_at?: string
          id?: string
          provider_id: string
          rank?: number
          request_id: string
          score?: number
        }
        Update: {
          created_at?: string
          id?: string
          provider_id?: string
          rank?: number
          request_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "request_invites_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_invites_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          heading: number | null
          lat: number
          lng: number
          provider_id: string
          request_id: string
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          heading?: number | null
          lat: number
          lng: number
          provider_id: string
          request_id: string
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          heading?: number | null
          lat?: number
          lng?: number
          provider_id?: string
          request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_locations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_locations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          client_id: string | null
          comment: string | null
          created_at: string
          id: string
          provider_id: string
          punctuality: number
          quality: number
          rating: number
          request_id: string | null
          service: number
        }
        Insert: {
          author_name?: string
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          provider_id: string
          punctuality?: number
          quality?: number
          rating?: number
          request_id?: string | null
          service?: number
        }
        Update: {
          author_name?: string
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          provider_id?: string
          punctuality?: number
          quality?: number
          rating?: number
          request_id?: string | null
          service?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          address: string
          category_id: string | null
          client_id: string
          created_at: string
          description: string
          dest_lat: number | null
          dest_lng: number | null
          id: string
          need: string | null
          photos: string[]
          price_estimate: number | null
          provider_id: string | null
          scheduled_at: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          when_option: string
        }
        Insert: {
          address?: string
          category_id?: string | null
          client_id: string
          created_at?: string
          description?: string
          dest_lat?: number | null
          dest_lng?: number | null
          id?: string
          need?: string | null
          photos?: string[]
          price_estimate?: number | null
          provider_id?: string | null
          scheduled_at?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          when_option?: string
        }
        Update: {
          address?: string
          category_id?: string | null
          client_id?: string
          created_at?: string
          description?: string
          dest_lat?: number | null
          dest_lng?: number | null
          id?: string
          need?: string | null
          photos?: string[]
          price_estimate?: number | null
          provider_id?: string | null
          scheduled_at?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          when_option?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category_id: string
          description: string | null
          id: string
          name: string
          popular: boolean
          price_from: number
          slug: string
        }
        Insert: {
          category_id: string
          description?: string | null
          id?: string
          name: string
          popular?: boolean
          price_from?: number
          slug: string
        }
        Update: {
          category_id?: string
          description?: string | null
          id?: string
          name?: string
          popular?: boolean
          price_from?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["verification_status"] | null
          previous_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          provider_id: string
          reason: string | null
          verification_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["verification_status"] | null
          previous_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          provider_id: string
          reason?: string | null
          verification_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["verification_status"] | null
          previous_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          provider_id?: string
          reason?: string | null
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_audit_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_audit_logs_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "provider_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_quote: {
        Args: { p_quote_id: string }
        Returns: {
          amount: number
          created_at: string
          estimated_time: string | null
          id: string
          message: string | null
          provider_id: string
          request_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_payment: {
        Args: { p_external_reference?: string; p_payment_id: string }
        Returns: {
          amount: number
          client_id: string
          created_at: string
          external_reference: string | null
          failure_reason: string | null
          id: string
          method: string | null
          paid_at: string | null
          provider_id: string
          quote_id: string
          refunded_at: string | null
          released_at: string | null
          request_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_payment_for_quote: {
        Args: { p_method?: string; p_quote_id: string }
        Returns: {
          amount: number
          client_id: string
          created_at: string
          external_reference: string | null
          failure_reason: string | null
          id: string
          method: string | null
          paid_at: string | null
          provider_id: string
          quote_id: string
          refunded_at: string | null
          released_at: string | null
          request_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_request_with_matching: {
        Args: {
          p_address: string
          p_category_id?: string
          p_city?: string
          p_description: string
          p_need?: string
          p_photos?: string[]
          p_request_id: string
          p_scheduled_at?: string
          p_service_id?: string
          p_when_option: string
        }
        Returns: Json
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      is_blocked: { Args: { _user_id: string }; Returns: boolean }
      is_invited_provider: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
      is_request_client: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
      provider_is_verified: { Args: { _provider_id: string }; Returns: boolean }
      review_verification: {
        Args: { p_action: string; p_reason?: string; p_verification_id: string }
        Returns: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          address_proof_path: string | null
          availability: string | null
          birth_date: string | null
          city: string | null
          cpf: string | null
          created_at: string
          current_step: Database["public"]["Enums"]["verification_step"]
          email: string | null
          experience_years: number
          full_name: string | null
          id: string
          identity_document_back_path: string | null
          identity_document_front_path: string | null
          identity_document_type: string | null
          liveness_status: Database["public"]["Enums"]["liveness_status"]
          neighborhood: string | null
          phone: string | null
          privacy_accepted_at: string | null
          professional_category: string | null
          professional_description: string | null
          provider_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string | null
          service_radius: number
          service_region: string | null
          services: string[]
          state: string | null
          status: Database["public"]["Enums"]["verification_status"]
          stripe_account_id: string | null
          stripe_verification_status: string | null
          submitted_at: string | null
          terms_accepted_at: string | null
          updated_at: string
          verification_email: boolean
          verification_phone: boolean
          work_photos: string[]
          zip_code: string | null
        }
        SetofOptions: {
          from: "*"
          to: "provider_verifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_review: {
        Args: {
          p_author_name?: string
          p_comment?: string
          p_punctuality: number
          p_quality: number
          p_rating: number
          p_request_id: string
          p_service: number
        }
        Returns: {
          author_name: string
          client_id: string | null
          comment: string | null
          created_at: string
          id: string
          provider_id: string
          punctuality: number
          quality: number
          rating: number
          request_id: string | null
          service: number
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_verification: {
        Args: never
        Returns: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          address_proof_path: string | null
          availability: string | null
          birth_date: string | null
          city: string | null
          cpf: string | null
          created_at: string
          current_step: Database["public"]["Enums"]["verification_step"]
          email: string | null
          experience_years: number
          full_name: string | null
          id: string
          identity_document_back_path: string | null
          identity_document_front_path: string | null
          identity_document_type: string | null
          liveness_status: Database["public"]["Enums"]["liveness_status"]
          neighborhood: string | null
          phone: string | null
          privacy_accepted_at: string | null
          professional_category: string | null
          professional_description: string | null
          provider_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string | null
          service_radius: number
          service_region: string | null
          services: string[]
          state: string | null
          status: Database["public"]["Enums"]["verification_status"]
          stripe_account_id: string | null
          stripe_verification_status: string | null
          submitted_at: string | null
          terms_accepted_at: string | null
          updated_at: string
          verification_email: boolean
          verification_phone: boolean
          work_photos: string[]
          zip_code: string | null
        }
        SetofOptions: {
          from: "*"
          to: "provider_verifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unaccent_stub: { Args: { _text: string }; Returns: string }
    }
    Enums: {
      app_role: "client" | "provider" | "admin"
      liveness_status: "not_started" | "pending" | "passed" | "failed"
      payment_status: "pending" | "paid" | "released" | "refunded" | "failed"
      request_status:
        | "sent"
        | "analyzing"
        | "confirmed"
        | "on_the_way"
        | "in_progress"
        | "completed"
        | "rated"
        | "cancelled"
      verification_status:
        | "draft"
        | "pending"
        | "under_review"
        | "approved"
        | "rejected"
        | "suspended"
      verification_step:
        | "personal"
        | "identity"
        | "selfie"
        | "address"
        | "professional"
        | "financial"
        | "review"
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
      app_role: ["client", "provider", "admin"],
      liveness_status: ["not_started", "pending", "passed", "failed"],
      payment_status: ["pending", "paid", "released", "refunded", "failed"],
      request_status: [
        "sent",
        "analyzing",
        "confirmed",
        "on_the_way",
        "in_progress",
        "completed",
        "rated",
        "cancelled",
      ],
      verification_status: [
        "draft",
        "pending",
        "under_review",
        "approved",
        "rejected",
        "suspended",
      ],
      verification_step: [
        "personal",
        "identity",
        "selfie",
        "address",
        "professional",
        "financial",
        "review",
      ],
    },
  },
} as const
