export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_events: {
        Row: { created_at: string; event_type: string; id: string; input_tokens: number | null; metadata: Json; model: string | null; output_tokens: number | null; patient_id: string | null; status: string; user_id: string | null }
        Insert: { created_at?: string; event_type: string; id?: string; input_tokens?: number | null; metadata?: Json; model?: string | null; output_tokens?: number | null; patient_id?: string | null; status?: string; user_id?: string | null }
        Update: { created_at?: string; event_type?: string; id?: string; input_tokens?: number | null; metadata?: Json; model?: string | null; output_tokens?: number | null; patient_id?: string | null; status?: string; user_id?: string | null }
        Relationships: [{ foreignKeyName: "ai_events_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] }]
      }
      documents: {
        Row: { confidence: number | null; created_at: string; document_category: string; extracted_json: Json; file_name: string; file_path: string | null; file_type: string | null; id: string; markdown: string | null; patient_id: string | null; raw_text: string | null; shift_id: string | null; user_id: string }
        Insert: { confidence?: number | null; created_at?: string; document_category?: string; extracted_json?: Json; file_name: string; file_path?: string | null; file_type?: string | null; id?: string; markdown?: string | null; patient_id?: string | null; raw_text?: string | null; shift_id?: string | null; user_id: string }
        Update: { confidence?: number | null; created_at?: string; document_category?: string; extracted_json?: Json; file_name?: string; file_path?: string | null; file_type?: string | null; id?: string; markdown?: string | null; patient_id?: string | null; raw_text?: string | null; shift_id?: string | null; user_id?: string }
        Relationships: [
          { foreignKeyName: "documents_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },
          { foreignKeyName: "documents_shift_id_fkey"; columns: ["shift_id"]; isOneToOne: false; referencedRelation: "shifts"; referencedColumns: ["id"] }
        ]
      }
      evolutions: {
        Row: { content: string; created_at: string; evolution_date: string; generated_by_ai: boolean; id: string; json_data: Json; patient_id: string; reviewed_by_physician: boolean; shift_id: string | null; updated_at: string; user_id: string }
        Insert: { content: string; created_at?: string; evolution_date?: string; generated_by_ai?: boolean; id?: string; json_data?: Json; patient_id: string; reviewed_by_physician?: boolean; shift_id?: string | null; updated_at?: string; user_id: string }
        Update: { content?: string; created_at?: string; evolution_date?: string; generated_by_ai?: boolean; id?: string; json_data?: Json; patient_id?: string; reviewed_by_physician?: boolean; shift_id?: string | null; updated_at?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "evolutions_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },
          { foreignKeyName: "evolutions_shift_id_fkey"; columns: ["shift_id"]; isOneToOne: false; referencedRelation: "shifts"; referencedColumns: ["id"] }
        ]
      }
      handoff_maps: {
        Row: { content_html: string | null; content_markdown: string | null; created_at: string; generated_by_ai: boolean; id: string; reviewed_by_physician: boolean; rows_json: Json; shift_id: string | null; title: string; user_id: string }
        Insert: { content_html?: string | null; content_markdown?: string | null; created_at?: string; generated_by_ai?: boolean; id?: string; reviewed_by_physician?: boolean; rows_json?: Json; shift_id?: string | null; title?: string; user_id: string }
        Update: { content_html?: string | null; content_markdown?: string | null; created_at?: string; generated_by_ai?: boolean; id?: string; reviewed_by_physician?: boolean; rows_json?: Json; shift_id?: string | null; title?: string; user_id?: string }
        Relationships: [{ foreignKeyName: "handoff_maps_shift_id_fkey"; columns: ["shift_id"]; isOneToOne: false; referencedRelation: "shifts"; referencedColumns: ["id"] }]
      }
      lab_exams: {
        Row: { alerts_json: Json | null; bands_percent: number | null; created_at: string; creatinine: number | null; crp: number | null; eas_formatted: string | null; eas_nitrite: string | null; eas_piocitos: string | null; exam_date: string | null; formatted_text: string | null; hb: number | null; ht: number | null; id: string; leukocytes: number | null; patient_id: string | null; platelets: number | null; potassium: number | null; raw_ai_response_json: Json | null; segmented_percent: number | null; sodium: number | null; source: string | null; urea: number | null; user_id: string | null }
        Insert: { alerts_json?: Json | null; bands_percent?: number | null; created_at?: string; creatinine?: number | null; crp?: number | null; eas_formatted?: string | null; eas_nitrite?: string | null; eas_piocitos?: string | null; exam_date?: string | null; formatted_text?: string | null; hb?: number | null; ht?: number | null; id?: string; leukocytes?: number | null; patient_id?: string | null; platelets?: number | null; potassium?: number | null; raw_ai_response_json?: Json | null; segmented_percent?: number | null; sodium?: number | null; source?: string | null; urea?: number | null; user_id?: string | null }
        Update: { alerts_json?: Json | null; bands_percent?: number | null; created_at?: string; creatinine?: number | null; crp?: number | null; eas_formatted?: string | null; eas_nitrite?: string | null; eas_piocitos?: string | null; exam_date?: string | null; formatted_text?: string | null; hb?: number | null; ht?: number | null; id?: string; leukocytes?: number | null; patient_id?: string | null; platelets?: number | null; potassium?: number | null; raw_ai_response_json?: Json | null; segmented_percent?: number | null; sodium?: number | null; source?: string | null; urea?: number | null; user_id?: string | null }
        Relationships: [{ foreignKeyName: "lab_exams_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] }]
      }
      patients: {
        Row: { admission_date: string | null; age: string | null; bed: string | null; birth_date: string | null; created_at: string; data_json: Json; hda: string | null; hospital_unit: string | null; id: string; main_diagnosis: string | null; medical_record: string | null; mother_name: string | null; name: string; priority: string; sex: string | null; shift_id: string | null; status: string; updated_at: string; user_id: string; ward: string | null }
        Insert: { admission_date?: string | null; age?: string | null; bed?: string | null; birth_date?: string | null; created_at?: string; data_json?: Json; hda?: string | null; hospital_unit?: string | null; id?: string; main_diagnosis?: string | null; medical_record?: string | null; mother_name?: string | null; name: string; priority?: string; sex?: string | null; shift_id?: string | null; status?: string; updated_at?: string; user_id: string; ward?: string | null }
        Update: { admission_date?: string | null; age?: string | null; bed?: string | null; birth_date?: string | null; created_at?: string; data_json?: Json; hda?: string | null; hospital_unit?: string | null; id?: string; main_diagnosis?: string | null; medical_record?: string | null; mother_name?: string | null; name?: string; priority?: string; sex?: string | null; shift_id?: string | null; status?: string; updated_at?: string; user_id?: string; ward?: string | null }
        Relationships: [{ foreignKeyName: "patients_shift_id_fkey"; columns: ["shift_id"]; isOneToOne: false; referencedRelation: "shifts"; referencedColumns: ["id"] }]
      }
      prescriptions: {
        Row: { content: string; created_at: string; generated_by_ai: boolean; id: string; json_data: Json; patient_id: string; prescription_date: string; reviewed_by_physician: boolean; shift_id: string | null; updated_at: string; user_id: string }
        Insert: { content: string; created_at?: string; generated_by_ai?: boolean; id?: string; json_data?: Json; patient_id: string; prescription_date?: string; reviewed_by_physician?: boolean; shift_id?: string | null; updated_at?: string; user_id: string }
        Update: { content?: string; created_at?: string; generated_by_ai?: boolean; id?: string; json_data?: Json; patient_id?: string; prescription_date?: string; reviewed_by_physician?: boolean; shift_id?: string | null; updated_at?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "prescriptions_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },
          { foreignKeyName: "prescriptions_shift_id_fkey"; columns: ["shift_id"]; isOneToOne: false; referencedRelation: "shifts"; referencedColumns: ["id"] }
        ]
      }
      profiles: {
        Row: { created_at: string; crm: string | null; default_hospital: string | null; full_name: string | null; id: string; specialty: string | null; updated_at: string }
        Insert: { created_at?: string; crm?: string | null; default_hospital?: string | null; full_name?: string | null; id: string; specialty?: string | null; updated_at?: string }
        Update: { created_at?: string; crm?: string | null; default_hospital?: string | null; full_name?: string | null; id?: string; specialty?: string | null; updated_at?: string }
        Relationships: []
      }
      referrals: {
        Row: { content: string; created_at: string; destination: string; generated_by_ai: boolean; id: string; patient_id: string | null; reason: string | null; reviewed_by_physician: boolean; user_id: string }
        Insert: { content: string; created_at?: string; destination: string; generated_by_ai?: boolean; id?: string; patient_id?: string | null; reason?: string | null; reviewed_by_physician?: boolean; user_id: string }
        Update: { content?: string; created_at?: string; destination?: string; generated_by_ai?: boolean; id?: string; patient_id?: string | null; reason?: string | null; reviewed_by_physician?: boolean; user_id?: string }
        Relationships: [{ foreignKeyName: "referrals_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] }]
      }
      shifts: {
        Row: { created_at: string; hospital: string; id: string; notes: string | null; shift_date: string; status: string; unit: string; updated_at: string; user_id: string; ward: string }
        Insert: { created_at?: string; hospital?: string; id?: string; notes?: string | null; shift_date?: string; status?: string; unit?: string; updated_at?: string; user_id: string; ward?: string }
        Update: { created_at?: string; hospital?: string; id?: string; notes?: string | null; shift_date?: string; status?: string; unit?: string; updated_at?: string; user_id?: string; ward?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]
export type Tables<DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals }, TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R } ? R : never : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R } ? R : never : never
export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals }, TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I } ? I : never : never
export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals }, TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U } ? U : never : never
export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals }, EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals }, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals } ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never

export const Constants = { public: { Enums: {} } } as const
