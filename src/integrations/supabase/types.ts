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
      antibiotics: {
        Row: {
          active: boolean
          created_at: string
          d0_or_d1: string | null
          dose: string | null
          end_date: string | null
          frequency: string | null
          id: string
          name: string
          patient_id: string
          planned_duration_days: number | null
          route: string | null
          start_date: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          d0_or_d1?: string | null
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          name: string
          patient_id: string
          planned_duration_days?: number | null
          route?: string | null
          start_date?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          d0_or_d1?: string | null
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          name?: string
          patient_id?: string
          planned_duration_days?: number | null
          route?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "antibiotics_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      evolutions: {
        Row: {
          created_at: string
          evolution_text: string
          generated_by: string | null
          id: string
          patient_id: string
          shift_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          evolution_text: string
          generated_by?: string | null
          id?: string
          patient_id: string
          shift_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          evolution_text?: string
          generated_by?: string | null
          id?: string
          patient_id?: string
          shift_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolutions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_exams: {
        Row: {
          alerts_json: Json | null
          bands_percent: number | null
          created_at: string
          creatinine: number | null
          crp: number | null
          eas_formatted: string | null
          eas_nitrite: string | null
          eas_piocitos: string | null
          exam_date: string | null
          formatted_text: string | null
          hb: number | null
          ht: number | null
          id: string
          leukocytes: number | null
          patient_id: string
          platelets: number | null
          potassium: number | null
          raw_ai_response_json: Json | null
          segmented_percent: number | null
          sodium: number | null
          source: string | null
          urea: number | null
        }
        Insert: {
          alerts_json?: Json | null
          bands_percent?: number | null
          created_at?: string
          creatinine?: number | null
          crp?: number | null
          eas_formatted?: string | null
          eas_nitrite?: string | null
          eas_piocitos?: string | null
          exam_date?: string | null
          formatted_text?: string | null
          hb?: number | null
          ht?: number | null
          id?: string
          leukocytes?: number | null
          patient_id: string
          platelets?: number | null
          potassium?: number | null
          raw_ai_response_json?: Json | null
          segmented_percent?: number | null
          sodium?: number | null
          source?: string | null
          urea?: number | null
        }
        Update: {
          alerts_json?: Json | null
          bands_percent?: number | null
          created_at?: string
          creatinine?: number | null
          crp?: number | null
          eas_formatted?: string | null
          eas_nitrite?: string | null
          eas_piocitos?: string | null
          exam_date?: string | null
          formatted_text?: string | null
          hb?: number | null
          ht?: number | null
          id?: string
          leukocytes?: number | null
          patient_id?: string
          platelets?: number | null
          potassium?: number | null
          raw_ai_response_json?: Json | null
          segmented_percent?: number | null
          sodium?: number | null
          source?: string | null
          urea?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_exams_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          admission_date: string | null
          age: number | null
          allergy: string | null
          antecedentes: string | null
          bed: string | null
          created_at: string
          data_json: Json | null
          diagnoses_json: Json | null
          hda: string | null
          id: string
          name: string
          sex: string | null
          shift_id: string | null
          status: string | null
          unit: string | null
          updated_at: string
          ward: string | null
        }
        Insert: {
          admission_date?: string | null
          age?: number | null
          allergy?: string | null
          antecedentes?: string | null
          bed?: string | null
          created_at?: string
          data_json?: Json | null
          diagnoses_json?: Json | null
          hda?: string | null
          id?: string
          name: string
          sex?: string | null
          shift_id?: string | null
          status?: string | null
          unit?: string | null
          updated_at?: string
          ward?: string | null
        }
        Update: {
          admission_date?: string | null
          age?: number | null
          allergy?: string | null
          antecedentes?: string | null
          bed?: string | null
          created_at?: string
          data_json?: Json | null
          diagnoses_json?: Json | null
          hda?: string | null
          id?: string
          name?: string
          sex?: string | null
          shift_id?: string | null
          status?: string | null
          unit?: string | null
          updated_at?: string
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          active: boolean
          created_at: string
          date: string
          ended_at: string | null
          id: string
          sector: string | null
          workplace: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          date?: string
          ended_at?: string | null
          id?: string
          sector?: string | null
          workplace?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          date?: string
          ended_at?: string | null
          id?: string
          sector?: string | null
          workplace?: string | null
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
    Enums: {},
  },
} as const
