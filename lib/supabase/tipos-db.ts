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
      daily_metrics: {
        Row: {
          user_id: string;
          fecha: string;
          pasos: number | null;
          pasos_objetivo: number | null;
          sueno_horas: number | null;
          sueno_calidad: string | null;
          sueno_puntuacion: number | null;
          fc_reposo: number | null;
          body_battery: number | null;
          kcal_activas: number | null;
          kcal_totales: number | null;
          fuente: string;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          user_id: string;
          fecha: string;
          pasos?: number | null;
          pasos_objetivo?: number | null;
          sueno_horas?: number | null;
          sueno_calidad?: string | null;
          sueno_puntuacion?: number | null;
          fc_reposo?: number | null;
          body_battery?: number | null;
          kcal_activas?: number | null;
          kcal_totales?: number | null;
          fuente?: string;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          user_id?: string;
          fecha?: string;
          pasos?: number | null;
          pasos_objetivo?: number | null;
          sueno_horas?: number | null;
          sueno_calidad?: string | null;
          sueno_puntuacion?: number | null;
          fc_reposo?: number | null;
          body_battery?: number | null;
          kcal_activas?: number | null;
          kcal_totales?: number | null;
          fuente?: string;
          creado_en?: string;
          actualizado_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_metrics_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
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
        Relationships: [
          {
            foreignKeyName: "foods_creado_por_fkey";
            columns: ["creado_por"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
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
          nota: string | null;
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
          nota?: string | null;
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
          nota?: string | null;
          orden?: number;
          creado_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_log_items_food_id_fkey";
            columns: ["food_id"];
            isOneToOne: false;
            referencedRelation: "foods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_log_items_meal_log_id_fkey";
            columns: ["meal_log_id"];
            isOneToOne: false;
            referencedRelation: "meal_logs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_log_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "meal_logs_scan_session_id_fkey";
            columns: ["scan_session_id"];
            isOneToOne: false;
            referencedRelation: "scan_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "scan_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "scan_turns_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "scan_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scan_turns_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "user_goals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      weight_logs: {
        Row: {
          id: string;
          user_id: string;
          fecha: string;
          peso_kg: number;
          cintura_cm: number | null;
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
          cintura_cm?: number | null;
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
          cintura_cm?: number | null;
          condiciones?: string | null;
          nota?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weight_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
