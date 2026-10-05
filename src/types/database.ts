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
      read_aloud_items: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          difficulty: string
          id: number
          passage: string
          slug: string
          source_ref: string | null
          source_type: string
          title: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          difficulty: string
          id?: never
          passage: string
          slug: string
          source_ref?: string | null
          source_type: string
          title: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          difficulty?: string
          id?: never
          passage?: string
          slug?: string
          source_ref?: string | null
          source_type?: string
          title?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      reading_fill_in_blanks_items: {
        Row: {
          active: boolean
          blanks: Json
          created_at: string
          created_by: string
          difficulty: string
          id: number
          passage_template: string
          slug: string
          source_ref: string | null
          source_type: string
          title: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          active?: boolean
          blanks: Json
          created_at?: string
          created_by: string
          difficulty: string
          id?: never
          passage_template: string
          slug: string
          source_ref?: string | null
          source_type: string
          title: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          active?: boolean
          blanks?: Json
          created_at?: string
          created_by?: string
          difficulty?: string
          id?: never
          passage_template?: string
          slug?: string
          source_ref?: string | null
          source_type?: string
          title?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      repeat_sentence_items: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          difficulty: string
          id: number
          sentence: string
          slug: string
          source_ref: string | null
          source_type: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          difficulty: string
          id?: never
          sentence: string
          slug: string
          source_ref?: string | null
          source_type: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          difficulty?: string
          id?: never
          sentence?: string
          slug?: string
          source_ref?: string | null
          source_type?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      skill_subskills: {
        Row: {
          skill_code: string
          subskill_code: string
        }
        Insert: {
          skill_code: string
          subskill_code: string
        }
        Update: {
          skill_code?: string
          subskill_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_subskills_skill_code_fkey"
            columns: ["skill_code"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "skill_subskills_subskill_code_fkey"
            columns: ["subskill_code"]
            isOneToOne: false
            referencedRelation: "subskills"
            referencedColumns: ["code"]
          },
        ]
      }
      skills: {
        Row: {
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          sort_order: number
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      study_content: {
        Row: {
          active: boolean
          body_markdown: string
          created_at: string
          created_by: string
          difficulty: string | null
          id: number
          skill_code: string | null
          slug: string
          source_ref: string | null
          source_type: string
          target_score: number | null
          task_type: string | null
          title: string
          type: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          active?: boolean
          body_markdown: string
          created_at?: string
          created_by: string
          difficulty?: string | null
          id?: never
          skill_code?: string | null
          slug: string
          source_ref?: string | null
          source_type: string
          target_score?: number | null
          task_type?: string | null
          title: string
          type: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          active?: boolean
          body_markdown?: string
          created_at?: string
          created_by?: string
          difficulty?: string | null
          id?: never
          skill_code?: string | null
          slug?: string
          source_ref?: string | null
          source_type?: string
          target_score?: number | null
          task_type?: string | null
          title?: string
          type?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_content_skill_code_fkey"
            columns: ["skill_code"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["code"]
          },
        ]
      }
      study_content_subskills: {
        Row: {
          study_content_id: number
          subskill_code: string
        }
        Insert: {
          study_content_id: number
          subskill_code: string
        }
        Update: {
          study_content_id?: number
          subskill_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_content_subskills_study_content_id_fkey"
            columns: ["study_content_id"]
            isOneToOne: false
            referencedRelation: "study_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_content_subskills_subskill_code_fkey"
            columns: ["subskill_code"]
            isOneToOne: false
            referencedRelation: "subskills"
            referencedColumns: ["code"]
          },
        ]
      }
      subskills: {
        Row: {
          code: string
          description: string | null
          label: string
        }
        Insert: {
          code: string
          description?: string | null
          label: string
        }
        Update: {
          code?: string
          description?: string | null
          label?: string
        }
        Relationships: []
      }
      summarize_written_text_items: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          difficulty: string
          id: number
          key_points: Json
          passage: string
          slug: string
          source_ref: string | null
          source_type: string
          title: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          difficulty: string
          id?: never
          key_points: Json
          passage: string
          slug: string
          source_ref?: string | null
          source_type: string
          title: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          difficulty?: string
          id?: never
          key_points?: Json
          passage?: string
          slug?: string
          source_ref?: string | null
          source_type?: string
          title?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      write_essay_items: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          difficulty: string
          id: number
          planning_points: Json
          prompt: string
          slug: string
          source_ref: string | null
          source_type: string
          title: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          difficulty: string
          id?: never
          planning_points: Json
          prompt: string
          slug: string
          source_ref?: string | null
          source_type: string
          title: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          difficulty?: string
          id?: never
          planning_points?: Json
          prompt?: string
          slug?: string
          source_ref?: string | null
          source_type?: string
          title?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      write_from_dictation_items: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          difficulty: string
          id: number
          sentence: string
          slug: string
          source_ref: string | null
          source_type: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          difficulty: string
          id?: never
          sentence: string
          slug: string
          source_ref?: string | null
          source_type: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          difficulty?: string
          id?: never
          sentence?: string
          slug?: string
          source_ref?: string | null
          source_type?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
