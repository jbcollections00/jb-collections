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
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          thumbnail_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          thumbnail_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          thumbnail_url?: string | null
          created_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          subject: string | null
          status: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          subject?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      conversation_messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string | null
          sender_role: "user" | "admin"
          body: string | null
          attachment_url: string | null
          created_at: string
          read_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id?: string | null
          sender_role: "user" | "admin"
          body?: string | null
          attachment_url?: string | null
          created_at?: string
          read_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string | null
          sender_role?: "user" | "admin"
          body?: string | null
          attachment_url?: string | null
          created_at?: string
          read_at?: string | null
          deleted_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          role: string | null
          coins: number
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          role?: string | null
          coins?: number
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          role?: string | null
          coins?: number
        }
      }
      coin_purchase_orders: {
        Row: {
          id: string
          user_id: string
          payer_name: string | null
          payer_email: string | null
          amount: number | null
          coins: number | null
          label: string | null
          payment_method: string | null
          reference_number: string | null
          status: string
          receipt_url: string | null
          created_at: string
          approved_at: string | null
          approved_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          payer_name?: string | null
          payer_email?: string | null
          amount?: number | null
          coins?: number | null
          label?: string | null
          payment_method?: string | null
          reference_number?: string | null
          status?: string
          receipt_url?: string | null
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          payer_name?: string | null
          payer_email?: string | null
          amount?: number | null
          coins?: number | null
          label?: string | null
          payment_method?: string | null
          reference_number?: string | null
          status?: string
          receipt_url?: string | null
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
      }
      coin_history: {
        Row: {
          id: string
          user_id: string
          coins: number
          type: string
          label: string | null
          reference_id: string | null
          amount_php: number | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          coins: number
          type: string
          label?: string | null
          reference_id?: string | null
          amount_php?: number | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          coins?: number
          type?: string
          label?: string | null
          reference_id?: string | null
          amount_php?: number | null
          created_at?: string
          created_by?: string | null
        }
      }
      files: {
        Row: {
          id: string
          category_id: string | null
        }
        Insert: {
          id?: string
          category_id?: string | null
        }
        Update: {
          id?: string
          category_id?: string | null
        }
      }
    }
  }
}