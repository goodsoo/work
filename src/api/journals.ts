import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

export type Journal = Tables<"journals">;

export async function listJournals(): Promise<Journal[]> {
  const { data, error } = await supabase
    .from("journals")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getJournalByDate(date: string): Promise<Journal | null> {
  const { data, error } = await supabase
    .from("journals")
    .select("*")
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertJournal(
  date: string,
  content: string,
): Promise<Journal> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요");
  const { data, error } = await supabase
    .from("journals")
    .upsert(
      { user_id: user.id, date, content },
      { onConflict: "user_id,date" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteJournal(id: string): Promise<void> {
  const { error } = await supabase.from("journals").delete().eq("id", id);
  if (error) throw error;
}
