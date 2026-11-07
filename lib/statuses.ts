import "server-only";
import { createClient } from "./supabase/server";

/** id → localized name for every status the user can see. */
export async function statusNames(locale: string): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("workflow_statuses").select("id, name_ar, name_fr");
  return new Map((data ?? []).map((s) => [s.id, locale === "ar" ? s.name_ar : s.name_fr]));
}

/** id → display name for every profile the user can see. */
export async function peopleNames(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name");
  return new Map((data ?? []).map((p) => [p.id, p.full_name]));
}
