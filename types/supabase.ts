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
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          role?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          role?: string | null
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