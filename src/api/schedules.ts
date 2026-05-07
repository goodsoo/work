import { supabase } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../lib/database.types";

export type Schedule = Tables<"schedules">;
export type ScheduleInsert = Omit<TablesInsert<"schedules">, "user_id">;
export type ScheduleUpdate = TablesUpdate<"schedules">;

export async function listSchedules(): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSchedule(input: ScheduleInsert): Promise<Schedule> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요");
  const { data, error } = await supabase
    .from("schedules")
    .insert({ ...input, user_id: user.id })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSchedule(
  id: string,
  patch: ScheduleUpdate,
): Promise<Schedule> {
  const { data, error } = await supabase
    .from("schedules")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from("schedules").delete().eq("id", id);
  if (error) throw error;
}
