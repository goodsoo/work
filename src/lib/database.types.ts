// Auto-regenerate with: bunx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
// V0.0: stub. V0.1: add `meetings`. V0.2: + `journals`. V0.3: + `todos` + `schedules`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
