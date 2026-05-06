import { supabase } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../lib/database.types";

type Row = Tables<"meetings">;

export type Meeting = Omit<Row, "discussion_items" | "decisions" | "action_items"> & {
  discussion_items: string[] | null;
  decisions: string[] | null;
  action_items: string[] | null;
};

export type MeetingInsert = Omit<
  TablesInsert<"meetings">,
  "discussion_items" | "decisions" | "action_items"
> & {
  discussion_items?: string[] | null;
  decisions?: string[] | null;
  action_items?: string[] | null;
};

export type MeetingUpdate = Omit<
  TablesUpdate<"meetings">,
  "discussion_items" | "decisions" | "action_items"
> & {
  discussion_items?: string[] | null;
  decisions?: string[] | null;
  action_items?: string[] | null;
};

function fromRow(row: Row): Meeting {
  return {
    ...row,
    discussion_items: row.discussion_items as string[] | null,
    decisions: row.decisions as string[] | null,
    action_items: row.action_items as string[] | null,
  };
}

export async function listMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : null;
}

export async function createMeeting(
  input: Omit<MeetingInsert, "user_id">
): Promise<Meeting> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요");
  const { data, error } = await supabase
    .from("meetings")
    .insert({ ...input, user_id: user.id })
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateMeeting(
  id: string,
  patch: MeetingUpdate
): Promise<Meeting> {
  const { data, error } = await supabase
    .from("meetings")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) throw error;
}
