// GENERADO POR scripts/gen-tipos-db.ts — no editar a mano.
// Para regenerar, ver el encabezado de ese script.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      foods: {
        Row: {
          id: string;
          slug: string;
          nombre: string;
          categoria: string;
          kcal100: number;
          p100: number;
          c100: number;
          g100: number;
          porcion_g: number | null;
          porcion_nota: string | null;
          publico: boolean;
          creado_por: string | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          slug: string;
          nombre: string;
          categoria: string;
          kcal100: number;
          p100: number;
          c100: number;
          g100: number;
          porcion_g?: number | null;
          porcion_nota?: string | null;
          publico?: boolean;
          creado_por?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          nombre?: string;
          categoria?: string;
          kcal100?: number;
          p100?: number;
          c100?: number;
          g100?: number;
          porcion_g?: number | null;
          porcion_nota?: string | null;
          publico?: boolean;
          creado_por?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
      };
      meal_log_items: {
        Row: {
          id: string;
          meal_log_id: string;
          user_id: string;
          food_id: string | null;
          alimento: string;
          porcion_g: number | null;
          porcion_ml: number | null;
          kcal: number;
          proteina_g: number;
          carbs_g: number;
          grasa_g: number;
          nota_correccion: string | null;
          orden: number;
          creado_en: string;
        };
        Insert: {
          id?: string;
          meal_log_id: string;
          user_id: string;
          food_id?: string | null;
          alimento: string;
          porcion_g?: number | null;
          porcion_ml?: number | null;
          kcal: number;
          proteina_g?: number;
          carbs_g?: number;
          grasa_g?: number;
          nota_correccion?: string | null;
          orden?: number;
          creado_en?: string;
        };
        Update: {
          id?: string;
          meal_log_id?: string;
          user_id?: string;
          food_id?: string | null;
          alimento?: string;
          porcion_g?: number | null;
          porcion_ml?: number | null;
          kcal?: number;
          proteina_g?: number;
          carbs_g?: number;
          grasa_g?: number;
          nota_correccion?: string | null;
          orden?: number;
          creado_en?: string;
        };
      };
      meal_logs: {
        Row: {
          id: string;
          user_id: string;
          fecha: string;
          momento: string;
          hora: string | null;
          confianza: string | null;
          origen: string;
          corregido: boolean;
          nota: string | null;
          scan_session_id: string | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          fecha: string;
          momento: string;
          hora?: string | null;
          confianza?: string | null;
          origen?: string;
          corregido?: boolean;
          nota?: string | null;
          scan_session_id?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          fecha?: string;
          momento?: string;
          hora?: string | null;
          confianza?: string | null;
          origen?: string;
          corregido?: boolean;
          nota?: string | null;
          scan_session_id?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          nombre: string | null;
          edad: number | null;
          sexo: string | null;
          estatura_cm: number | null;
          fecha_dia_1: string | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id: string;
          nombre?: string | null;
          edad?: number | null;
          sexo?: string | null;
          estatura_cm?: number | null;
          fecha_dia_1?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          nombre?: string | null;
          edad?: number | null;
          sexo?: string | null;
          estatura_cm?: number | null;
          fecha_dia_1?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
      };
      scan_sessions: {
        Row: {
          id: string;
          user_id: string;
          foto_path: string | null;
          estado: string;
          turnos: number;
          fuera_de_tema_count: number;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          foto_path?: string | null;
          estado?: string;
          turnos?: number;
          fuera_de_tema_count?: number;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          foto_path?: string | null;
          estado?: string;
          turnos?: number;
          fuera_de_tema_count?: number;
          creado_en?: string;
          actualizado_en?: string;
        };
      };
      scan_turns: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          indice: number;
          entrada_texto: string | null;
          tuvo_foto: boolean;
          respuesta_ia_json: Json | null;
          fuera_de_tema: boolean;
          latencia_ms: number | null;
          tokens_in: number;
          tokens_cache_read: number;
          tokens_out: number;
          costo_usd: number;
          modelo: string | null;
          creado_en: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          indice: number;
          entrada_texto?: string | null;
          tuvo_foto?: boolean;
          respuesta_ia_json?: Json | null;
          fuera_de_tema?: boolean;
          latencia_ms?: number | null;
          tokens_in?: number;
          tokens_cache_read?: number;
          tokens_out?: number;
          costo_usd?: number;
          modelo?: string | null;
          creado_en?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          indice?: number;
          entrada_texto?: string | null;
          tuvo_foto?: boolean;
          respuesta_ia_json?: Json | null;
          fuera_de_tema?: boolean;
          latencia_ms?: number | null;
          tokens_in?: number;
          tokens_cache_read?: number;
          tokens_out?: number;
          costo_usd?: number;
          modelo?: string | null;
          creado_en?: string;
        };
      };
      user_goals: {
        Row: {
          id: string;
          user_id: string;
          objetivo: string;
          peso_meta_kg: number | null;
          factor_actividad: number;
          deficit_pct: number;
          kcal: number;
          proteina_g: number;
          carbs_g: number;
          grasa_g: number;
          activo: boolean;
          motivo: string | null;
          creado_en: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          objetivo?: string;
          peso_meta_kg?: number | null;
          factor_actividad: number;
          deficit_pct: number;
          kcal: number;
          proteina_g: number;
          carbs_g: number;
          grasa_g: number;
          activo?: boolean;
          motivo?: string | null;
          creado_en?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          objetivo?: string;
          peso_meta_kg?: number | null;
          factor_actividad?: number;
          deficit_pct?: number;
          kcal?: number;
          proteina_g?: number;
          carbs_g?: number;
          grasa_g?: number;
          activo?: boolean;
          motivo?: string | null;
          creado_en?: string;
        };
      };
      weight_logs: {
        Row: {
          id: string;
          user_id: string;
          fecha: string;
          peso_kg: number;
          condiciones: string | null;
          nota: string | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          fecha: string;
          peso_kg: number;
          condiciones?: string | null;
          nota?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          fecha?: string;
          peso_kg?: number;
          condiciones?: string | null;
          nota?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
