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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      battle_monsters: {
        Row: {
          attack: number
          battle_id: string
          cha: number
          con: number
          created_at: string
          current_hp: number
          current_mp: number
          defense: number
          dex: number
          hp: number
          id: string
          image_url: string
          int: number
          killed_by: string | null
          level: number
          monster_id: string | null
          mp: number
          name: string
          special: string
          str: number
          user_id: string
          xp_reward: number
        }
        Insert: {
          attack?: number
          battle_id?: string
          cha?: number
          con?: number
          created_at?: string
          current_hp?: number
          current_mp?: number
          defense?: number
          dex?: number
          hp?: number
          id?: string
          image_url?: string
          int?: number
          killed_by?: string | null
          level?: number
          monster_id?: string | null
          mp?: number
          name: string
          special?: string
          str?: number
          user_id: string
          xp_reward?: number
        }
        Update: {
          attack?: number
          battle_id?: string
          cha?: number
          con?: number
          created_at?: string
          current_hp?: number
          current_mp?: number
          defense?: number
          dex?: number
          hp?: number
          id?: string
          image_url?: string
          int?: number
          killed_by?: string | null
          level?: number
          monster_id?: string | null
          mp?: number
          name?: string
          special?: string
          str?: number
          user_id?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "battle_monsters_monster_id_fkey"
            columns: ["monster_id"]
            isOneToOne: false
            referencedRelation: "monsters"
            referencedColumns: ["id"]
          },
        ]
      }
      heroes: {
        Row: {
          bad_trait: number | null
          created_at: string
          experience: number
          good_trait: number | null
          id: string
          kills: number
          name: string
          profession: string
          race: string
          specialization: string
          total_damage: number
          user_id: string
        }
        Insert: {
          bad_trait?: number | null
          created_at?: string
          experience?: number
          good_trait?: number | null
          id?: string
          kills?: number
          name: string
          profession?: string
          race: string
          specialization?: string
          total_damage?: number
          user_id: string
        }
        Update: {
          bad_trait?: number | null
          created_at?: string
          experience?: number
          good_trait?: number | null
          id?: string
          kills?: number
          name?: string
          profession?: string
          race?: string
          specialization?: string
          total_damage?: number
          user_id?: string
        }
        Relationships: []
      }
      map_beasts: {
        Row: {
          battle_id: string | null
          color: string
          created_at: string
          created_by: string
          current_hp: number
          hp: number
          id: string
          level: number
          map_id: string
          monster_id: string | null
          name: string
          notes: string
          reveal_radius: number
          revealed: boolean
          short_code: string
          stealth_mode: string
          token_size: number
          x: number
          y: number
        }
        Insert: {
          battle_id?: string | null
          color?: string
          created_at?: string
          created_by: string
          current_hp?: number
          hp?: number
          id?: string
          level?: number
          map_id: string
          monster_id?: string | null
          name?: string
          notes?: string
          reveal_radius?: number
          revealed?: boolean
          short_code?: string
          stealth_mode?: string
          token_size?: number
          x?: number
          y?: number
        }
        Update: {
          battle_id?: string | null
          color?: string
          created_at?: string
          created_by?: string
          current_hp?: number
          hp?: number
          id?: string
          level?: number
          map_id?: string
          monster_id?: string | null
          name?: string
          notes?: string
          reveal_radius?: number
          revealed?: boolean
          short_code?: string
          stealth_mode?: string
          token_size?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_beasts_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_beasts_monster_id_fkey"
            columns: ["monster_id"]
            isOneToOne: false
            referencedRelation: "monsters"
            referencedColumns: ["id"]
          },
        ]
      }
      map_fog_reveals: {
        Row: {
          created_at: string
          id: string
          map_id: string
          radius: number
          user_id: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          id?: string
          map_id: string
          radius?: number
          user_id: string
          x: number
          y: number
        }
        Update: {
          created_at?: string
          id?: string
          map_id?: string
          radius?: number
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_fog_reveals_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      map_points: {
        Row: {
          created_at: string
          description: string
          id: string
          label: string
          point_type: string
          route_id: string
          sort_order: number
          user_id: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          label?: string
          point_type?: string
          route_id: string
          sort_order?: number
          user_id: string
          x: number
          y: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          label?: string
          point_type?: string
          route_id?: string
          sort_order?: number
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_points_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "map_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      map_routes: {
        Row: {
          color: string
          created_at: string
          id: string
          map_id: string | null
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          map_id?: string | null
          name?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          map_id?: string | null
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_routes_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      map_settings: {
        Row: {
          created_at: string
          id: string
          map_id: string | null
          pixels_per_km: number
          speed_broom: number
          speed_horse: number
          speed_walk: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          map_id?: string | null
          pixels_per_km?: number
          speed_broom?: number
          speed_horse?: number
          speed_walk?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          map_id?: string | null
          pixels_per_km?: number
          speed_broom?: number
          speed_horse?: number
          speed_walk?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_settings_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      map_tokens: {
        Row: {
          color: string
          created_at: string
          created_by: string
          icon: string
          id: string
          light_source: string
          map_id: string
          name: string
          notes: string
          owner_user_id: string | null
          reveal_radius: number
          x: number
          y: number
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          icon?: string
          id?: string
          light_source?: string
          map_id: string
          name?: string
          notes?: string
          owner_user_id?: string | null
          reveal_radius?: number
          x?: number
          y?: number
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          icon?: string
          id?: string
          light_source?: string
          map_id?: string
          name?: string
          notes?: string
          owner_user_id?: string | null
          reveal_radius?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_tokens_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      maps: {
        Row: {
          created_at: string
          default_reveal_radius: number
          fog_enabled: boolean
          id: string
          image_url: string
          is_active: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_reveal_radius?: number
          fog_enabled?: boolean
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_reveal_radius?: number
          fog_enabled?: boolean
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      monster_kills: {
        Row: {
          count: number
          id: string
          monster_name: string
          user_id: string
        }
        Insert: {
          count?: number
          id?: string
          monster_name: string
          user_id: string
        }
        Update: {
          count?: number
          id?: string
          monster_name?: string
          user_id?: string
        }
        Relationships: []
      }
      monsters: {
        Row: {
          attack: number
          cha: number
          cha_max: number
          cha_min: number
          con: number
          con_max: number
          con_min: number
          created_at: string
          defense: number
          dex: number
          dex_max: number
          dex_min: number
          hp: number
          hp_multiplier: number
          id: string
          image_url: string
          int: number
          int_max: number
          int_min: number
          is_unique: boolean
          mp: number
          name: string
          special: string
          str: number
          str_max: number
          str_min: number
          user_id: string
          xp_reward: number
        }
        Insert: {
          attack?: number
          cha?: number
          cha_max?: number
          cha_min?: number
          con?: number
          con_max?: number
          con_min?: number
          created_at?: string
          defense?: number
          dex?: number
          dex_max?: number
          dex_min?: number
          hp?: number
          hp_multiplier?: number
          id?: string
          image_url?: string
          int?: number
          int_max?: number
          int_min?: number
          is_unique?: boolean
          mp?: number
          name: string
          special?: string
          str?: number
          str_max?: number
          str_min?: number
          user_id: string
          xp_reward?: number
        }
        Update: {
          attack?: number
          cha?: number
          cha_max?: number
          cha_min?: number
          con?: number
          con_max?: number
          con_min?: number
          created_at?: string
          defense?: number
          dex?: number
          dex_max?: number
          dex_min?: number
          hp?: number
          hp_multiplier?: number
          id?: string
          image_url?: string
          int?: number
          int_max?: number
          int_min?: number
          is_unique?: boolean
          mp?: number
          name?: string
          special?: string
          str?: number
          str_max?: number
          str_min?: number
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      npcs: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string
          location: string
          name: string
          relationship: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          location?: string
          name: string
          relationship?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          location?: string
          name?: string
          relationship?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          id: string
          page: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          page: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          page?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      special_map_points: {
        Row: {
          created_at: string
          description: string
          id: string
          map_id: string | null
          name: string
          user_id: string
          visible_to_viewers: boolean
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          map_id?: string | null
          name?: string
          user_id: string
          visible_to_viewers?: boolean
          x: number
          y: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          map_id?: string | null
          name?: string
          user_id?: string
          visible_to_viewers?: boolean
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "special_map_points_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      traits: {
        Row: {
          created_at: string
          description: string
          id: string
          kind: string
          name: string
          number: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          kind: string
          name?: string
          number: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          kind?: string
          name?: string
          number?: number
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
      xp_archive: {
        Row: {
          amount: number
          created_at: string
          hero_id: string
          id: string
          note: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          hero_id: string
          id?: string
          note?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          hero_id?: string
          id?: string
          note?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_archive_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_default_role: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      can_write_data: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
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
      app_role: ["admin", "editor", "viewer"],
    },
  },
} as const
