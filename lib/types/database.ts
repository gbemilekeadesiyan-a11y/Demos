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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number | null
          requires_verification: boolean
          session_id: string | null
          uses_count: number
          workspace_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          requires_verification?: boolean
          session_id?: string | null
          uses_count?: number
          workspace_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          requires_verification?: boolean
          session_id?: string | null
          uses_count?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          first_name: string
          has_ff: boolean
          has_workspaces: boolean
          id: string
          last_name: string
          username: string
        }
        Insert: {
          created_at?: string | null
          first_name: string
          has_ff?: boolean
          has_workspaces?: boolean
          id: string
          last_name: string
          username: string
        }
        Update: {
          created_at?: string | null
          first_name?: string
          has_ff?: boolean
          has_workspaces?: boolean
          id?: string
          last_name?: string
          username?: string
        }
        Relationships: []
      }
      session_access_grants: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_access_grants_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "workspace_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_access_grants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "voting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_options: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          label: string
          session_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          label: string
          session_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          label?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_options_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "voting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      vote_selections: {
        Row: {
          created_at: string
          id: string
          option_id: string
          rank: number | null
          session_id: string
          vote_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          rank?: number | null
          session_id: string
          vote_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          rank?: number | null
          session_id?: string
          vote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vote_selections_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "session_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vote_selections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "voting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vote_selections_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          guest_email: string | null
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          guest_email?: string | null
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          guest_email?: string | null
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "voting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      voting_sessions: {
        Row: {
          allow_anonymous_vote: boolean
          ballot_secrecy: string
          created_at: string
          created_by: string
          description: string | null
          end_time: string | null
          id: string
          results_style: string | null
          results_visibility: string
          start_time: string | null
          status: string
          title: string
          visibility: string
          vote_format: string
          who_can_vote: string
          workspace_id: string
        }
        Insert: {
          allow_anonymous_vote?: boolean
          ballot_secrecy?: string
          created_at?: string
          created_by: string
          description?: string | null
          end_time?: string | null
          id?: string
          results_style?: string | null
          results_visibility: string
          start_time?: string | null
          status?: string
          title: string
          visibility: string
          vote_format: string
          who_can_vote: string
          workspace_id: string
        }
        Update: {
          allow_anonymous_vote?: boolean
          ballot_secrecy?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string | null
          id?: string
          results_style?: string | null
          results_visibility?: string
          start_time?: string | null
          status?: string
          title?: string
          visibility?: string
          vote_format?: string
          who_can_vote?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voting_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_group_members: {
        Row: {
          created_at: string
          group_id: string
          membership_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          membership_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "workspace_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_group_members_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "workspace_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_memberships: {
        Row: {
          created_at: string
          id: string
          initiated_by: string
          role: string
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          initiated_by?: string
          role?: string
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          initiated_by?: string
          role?: string
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          settings: Json
          type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          settings?: Json
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          settings?: Json
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_session: {
        Args: { target_session_id: string }
        Returns: boolean
      }
      can_view_ballot_linkage: {
        Args: { target_session_id: string }
        Returns: boolean
      }
      can_view_session_results: {
        Args: { target_session_id: string }
        Returns: boolean
      }
      cast_vote: {
        Args: { p_selections: Json; p_session_id: string }
        Returns: Json
      }
      create_workspace: {
        Args: { p_name: string; p_type: string }
        Returns: Json
      }
      get_session_selections_for_tally: {
        Args: { target_session_id: string }
        Returns: {
          ballot_ref: number
          option_id: string
          rank: number
        }[]
      }
      get_workspace_session_summaries: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      get_workspace_stats: { Args: { p_workspace_id: string }; Returns: Json }
      invite_by_identifier: {
        Args: { p_identifier: string; p_role: string; p_workspace_id: string }
        Returns: Json
      }
      is_active_workspace_member: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      is_workspace_admin: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { target_user_id?: string; target_workspace_id: string }
        Returns: boolean
      }
      join_workspace_by_code: { Args: { p_code: string }; Returns: Json }
      peek_workspace_invite_code: { Args: { p_code: string }; Returns: Json }
      redeem_session_invite_code: { Args: { p_code: string }; Returns: Json }
      respond_to_invite: {
        Args: { p_accept: boolean; p_membership_id: string }
        Returns: Json
      }
      set_vote_guest_email: {
        Args: { p_email: string; p_session_id: string }
        Returns: Json
      }
      transfer_workspace_ownership: {
        Args: { p_new_owner_user_id: string; p_workspace_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
