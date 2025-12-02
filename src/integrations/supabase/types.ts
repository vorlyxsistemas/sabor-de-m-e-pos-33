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
      ai_sessions: {
        Row: {
          cart: Json | null
          context: Json | null
          last_intent: string | null
          phone: string | null
          session_id: string
          updated_at: string | null
        }
        Insert: {
          cart?: Json | null
          context?: Json | null
          last_intent?: string | null
          phone?: string | null
          session_id: string
          updated_at?: string | null
        }
        Update: {
          cart?: Json | null
          context?: Json | null
          last_intent?: string | null
          phone?: string | null
          session_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          bairro: string
          dist_km: number | null
          id: string
          taxa: number
        }
        Insert: {
          bairro: string
          dist_km?: number | null
          id?: string
          taxa?: number
        }
        Update: {
          bairro?: string
          dist_km?: number | null
          id?: string
          taxa?: number
        }
        Relationships: []
      }
      extras: {
        Row: {
          id: string
          item_id: string | null
          name: string
          price: number
        }
        Insert: {
          id?: string
          item_id?: string | null
          name: string
          price?: number
        }
        Update: {
          id?: string
          item_id?: string | null
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "extras_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          allow_extras: boolean | null
          allow_quantity: boolean | null
          allow_tapioca_molhada: boolean | null
          available: boolean | null
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          price: number
        }
        Insert: {
          allow_extras?: boolean | null
          allow_quantity?: boolean | null
          allow_tapioca_molhada?: boolean | null
          available?: boolean | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          price?: number
        }
        Update: {
          allow_extras?: boolean | null
          allow_quantity?: boolean | null
          allow_tapioca_molhada?: boolean | null
          available?: boolean | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      lunch_menu: {
        Row: {
          id: string
          meat_name: string
          meat_price: number
          weekday: number
        }
        Insert: {
          id?: string
          meat_name: string
          meat_price?: number
          weekday: number
        }
        Update: {
          id?: string
          meat_name?: string
          meat_price?: number
          weekday?: number
        }
        Relationships: []
      }
      messages_log: {
        Row: {
          created_at: string | null
          id: string
          inbound_text: string | null
          metadata: Json | null
          outbound_text: string | null
          phone: string | null
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inbound_text?: string | null
          metadata?: Json | null
          outbound_text?: string | null
          phone?: string | null
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inbound_text?: string | null
          metadata?: Json | null
          outbound_text?: string | null
          phone?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          extras: Json | null
          id: string
          item_id: string | null
          order_id: string
          price: number
          quantity: number
          tapioca_molhada: boolean | null
        }
        Insert: {
          extras?: Json | null
          id?: string
          item_id?: string | null
          order_id: string
          price?: number
          quantity?: number
          tapioca_molhada?: boolean | null
        }
        Update: {
          extras?: Json | null
          id?: string
          item_id?: string | null
          order_id?: string
          price?: number
          quantity?: number
          tapioca_molhada?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          cep: string | null
          created_at: string | null
          customer_name: string
          customer_phone: string | null
          delivery_tax: number | null
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          reference: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
        }
        Insert: {
          address?: string | null
          cep?: string | null
          created_at?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_tax?: number | null
          id?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          reference?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
        }
        Update: {
          address?: string | null
          cep?: string | null
          created_at?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_tax?: number | null
          id?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          reference?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          name?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          phone?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "customer"
      order_status:
        | "pending"
        | "preparing"
        | "ready"
        | "delivered"
        | "cancelled"
      order_type: "local" | "retirada" | "entrega"
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
      app_role: ["admin", "staff", "customer"],
      order_status: ["pending", "preparing", "ready", "delivered", "cancelled"],
      order_type: ["local", "retirada", "entrega"],
    },
  },
} as const
