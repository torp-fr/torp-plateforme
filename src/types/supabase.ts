/**
 * Supabase Database Types
 * Generated from database schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          user_type: 'B2C' | 'B2B' | 'admin'
          company: string | null
          phone: string | null
          address: Json | null
          subscription_plan: string | null
          subscription_status: string | null
          subscription_started_at: string | null
          subscription_ends_at: string | null
          avatar_url: string | null
          onboarding_completed: boolean | null
          email_verified: boolean | null
          preferences: Json | null
          created_at: string | null
          updated_at: string | null
          last_login_at: string | null
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          user_type?: 'B2C' | 'B2B' | 'admin'
          company?: string | null
          phone?: string | null
          address?: Json | null
          subscription_plan?: string | null
          subscription_status?: string | null
          subscription_started_at?: string | null
          subscription_ends_at?: string | null
          avatar_url?: string | null
          onboarding_completed?: boolean | null
          email_verified?: boolean | null
          preferences?: Json | null
          created_at?: string | null
          updated_at?: string | null
          last_login_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          user_type?: 'B2C' | 'B2B' | 'admin'
          company?: string | null
          phone?: string | null
          address?: Json | null
          subscription_plan?: string | null
          subscription_status?: string | null
          subscription_started_at?: string | null
          subscription_ends_at?: string | null
          avatar_url?: string | null
          onboarding_completed?: boolean | null
          email_verified?: boolean | null
          preferences?: Json | null
          created_at?: string | null
          updated_at?: string | null
          last_login_at?: string | null
        }
      }
      companies: {
        Row: {
          id: string
          siret: string
          name: string
          legal_name: string | null
          address: Json | null
          activity_code: string | null
          creation_date: string | null
          employees_count: number | null
          annual_revenue: number | null
          certifications: string[] | null
          rge_certified: boolean | null
          qualibat_number: string | null
          insurance_decennale: boolean | null
          insurance_rc_pro: boolean | null
          insurance_validity_date: string | null
          insurance_documents: Json | null
          torp_score: number | null
          torp_grade: string | null
          review_count: number | null
          average_rating: number | null
          litigation_count: number | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          siret: string
          name: string
          legal_name?: string | null
          address?: Json | null
          activity_code?: string | null
          creation_date?: string | null
          employees_count?: number | null
          annual_revenue?: number | null
          certifications?: string[] | null
          rge_certified?: boolean | null
          qualibat_number?: string | null
          insurance_decennale?: boolean | null
          insurance_rc_pro?: boolean | null
          insurance_validity_date?: string | null
          insurance_documents?: Json | null
          torp_score?: number | null
          torp_grade?: string | null
          review_count?: number | null
          average_rating?: number | null
          litigation_count?: number | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          siret?: string
          name?: string
          legal_name?: string | null
          address?: Json | null
          activity_code?: string | null
          creation_date?: string | null
          employees_count?: number | null
          annual_revenue?: number | null
          certifications?: string[] | null
          rge_certified?: boolean | null
          qualibat_number?: string | null
          insurance_decennale?: boolean | null
          insurance_rc_pro?: boolean | null
          insurance_validity_date?: string | null
          insurance_documents?: Json | null
          torp_score?: number | null
          torp_grade?: string | null
          review_count?: number | null
          average_rating?: number | null
          litigation_count?: number | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          name: string
          description: string | null
          project_type: string
          status: 'draft' | 'analyzing' | 'completed' | 'accepted' | 'rejected' | 'in_progress' | 'finished'
          estimated_amount: number | null
          final_amount: number | null
          currency: string | null
          score: number | null
          grade: string | null
          address: Json | null
          parcel_data: Json | null
          start_date: string | null
          end_date: string | null
          actual_start_date: string | null
          actual_end_date: string | null
          analysis_result: Json | null
          recommendations: Json | null
          tags: string[] | null
          archived: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          name: string
          description?: string | null
          project_type: string
          status?: 'draft' | 'analyzing' | 'completed' | 'accepted' | 'rejected' | 'in_progress' | 'finished'
          estimated_amount?: number | null
          final_amount?: number | null
          currency?: string | null
          score?: number | null
          grade?: string | null
          address?: Json | null
          parcel_data?: Json | null
          start_date?: string | null
          end_date?: string | null
          actual_start_date?: string | null
          actual_end_date?: string | null
          analysis_result?: Json | null
          recommendations?: Json | null
          tags?: string[] | null
          archived?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          name?: string
          description?: string | null
          project_type?: string
          status?: 'draft' | 'analyzing' | 'completed' | 'accepted' | 'rejected' | 'in_progress' | 'finished'
          estimated_amount?: number | null
          final_amount?: number | null
          currency?: string | null
          score?: number | null
          grade?: string | null
          address?: Json | null
          parcel_data?: Json | null
          start_date?: string | null
          end_date?: string | null
          actual_start_date?: string | null
          actual_end_date?: string | null
          analysis_result?: Json | null
          recommendations?: Json | null
          tags?: string[] | null
          archived?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      devis: {
        Row: {
          id: string
          project_id: string
          company_id: string | null
          devis_number: string | null
          status: 'uploaded' | 'analyzing' | 'analyzed' | 'accepted' | 'rejected'
          amount: number
          currency: string | null
          file_url: string
          file_name: string
          file_size: number | null
          file_type: string | null
          extracted_data: Json | null
          line_items: Json | null
          analyzed_at: string | null
          analysis_duration: number | null
          analysis_result: Json | null
          score_total: number | null
          score_entreprise: Json | null
          score_prix: Json | null
          score_completude: Json | null
          score_conformite: Json | null
          score_delais: Json | null
          grade: string | null
          recommendations: Json | null
          detected_overcosts: number | null
          potential_savings: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          company_id?: string | null
          devis_number?: string | null
          status?: 'uploaded' | 'analyzing' | 'analyzed' | 'accepted' | 'rejected'
          amount: number
          currency?: string | null
          file_url: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          extracted_data?: Json | null
          line_items?: Json | null
          analyzed_at?: string | null
          analysis_duration?: number | null
          analysis_result?: Json | null
          score_total?: number | null
          score_entreprise?: Json | null
          score_prix?: Json | null
          score_completude?: Json | null
          score_conformite?: Json | null
          score_delais?: Json | null
          grade?: string | null
          recommendations?: Json | null
          detected_overcosts?: number | null
          potential_savings?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          company_id?: string | null
          devis_number?: string | null
          status?: 'uploaded' | 'analyzing' | 'analyzed' | 'accepted' | 'rejected'
          amount?: number
          currency?: string | null
          file_url?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          extracted_data?: Json | null
          line_items?: Json | null
          analyzed_at?: string | null
          analysis_duration?: number | null
          analysis_result?: Json | null
          score_total?: number | null
          score_entreprise?: Json | null
          score_prix?: Json | null
          score_completude?: Json | null
          score_conformite?: Json | null
          score_delais?: Json | null
          grade?: string | null
          recommendations?: Json | null
          detected_overcosts?: number | null
          potential_savings?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      payments: {
        Row: {
          id: string
          project_id: string
          user_id: string
          amount: number
          currency: string | null
          status: 'pending' | 'paid' | 'validated' | 'dispute' | 'refunded'
          payment_method: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          escrow_enabled: boolean | null
          escrow_released_at: string | null
          escrow_conditions: Json | null
          stage_name: string | null
          stage_percentage: number | null
          validation_proof: Json | null
          validated_at: string | null
          validated_by: string | null
          due_date: string | null
          paid_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          amount: number
          currency?: string | null
          status?: 'pending' | 'paid' | 'validated' | 'dispute' | 'refunded'
          payment_method?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          escrow_enabled?: boolean | null
          escrow_released_at?: string | null
          escrow_conditions?: Json | null
          stage_name?: string | null
          stage_percentage?: number | null
          validation_proof?: Json | null
          validated_at?: string | null
          validated_by?: string | null
          due_date?: string | null
          paid_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          amount?: number
          currency?: string | null
          status?: 'pending' | 'paid' | 'validated' | 'dispute' | 'refunded'
          payment_method?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          escrow_enabled?: boolean | null
          escrow_released_at?: string | null
          escrow_conditions?: Json | null
          stage_name?: string | null
          stage_percentage?: number | null
          validation_proof?: Json | null
          validated_at?: string | null
          validated_by?: string | null
          due_date?: string | null
          paid_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'info' | 'warning' | 'success' | 'error'
          title: string
          message: string
          link_url: string | null
          link_type: string | null
          link_id: string | null
          read: boolean | null
          read_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type?: 'info' | 'warning' | 'success' | 'error'
          title: string
          message: string
          link_url?: string | null
          link_type?: string | null
          link_id?: string | null
          read?: boolean | null
          read_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'info' | 'warning' | 'success' | 'error'
          title?: string
          message?: string
          link_url?: string | null
          link_type?: string | null
          link_id?: string | null
          read?: boolean | null
          read_at?: string | null
          created_at?: string | null
        }
      }
      market_data: {
        Row: {
          id: string
          category: string
          subcategory: string | null
          work_type: string
          unit: string | null
          price_low: number | null
          price_avg: number | null
          price_high: number | null
          region: string | null
          department: string | null
          valid_from: string
          valid_until: string | null
          data_source: string | null
          confidence_score: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          category: string
          subcategory?: string | null
          work_type: string
          unit?: string | null
          price_low?: number | null
          price_avg?: number | null
          price_high?: number | null
          region?: string | null
          department?: string | null
          valid_from: string
          valid_until?: string | null
          data_source?: string | null
          confidence_score?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          category?: string
          subcategory?: string | null
          work_type?: string
          unit?: string | null
          price_low?: number | null
          price_avg?: number | null
          price_high?: number | null
          region?: string | null
          department?: string | null
          valid_from?: string
          valid_until?: string | null
          data_source?: string | null
          confidence_score?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          ip_address: string | null
          user_agent: string | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_torp_score: {
        Args: { devis_id: string }
        Returns: number
      }
      assign_grade: {
        Args: { score: number }
        Returns: string
      }
    }
    Enums: {
      user_type: 'B2C' | 'B2B' | 'admin'
      project_status: 'draft' | 'analyzing' | 'completed' | 'accepted' | 'rejected' | 'in_progress' | 'finished'
      devis_status: 'uploaded' | 'analyzing' | 'analyzed' | 'accepted' | 'rejected'
      payment_status: 'pending' | 'paid' | 'validated' | 'dispute' | 'refunded'
      notification_type: 'info' | 'warning' | 'success' | 'error'
    }
  }
}
