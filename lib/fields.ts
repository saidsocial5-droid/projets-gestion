import "server-only";
import { createClient } from "./supabase/server";
import type { CustomField } from "./types";

export async function workspaceFields(): Promise<CustomField[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("custom_fields").select("id, name, type, options:custom_field_options(id, label, color, rank)").order("created_at");
  return ((data ?? []) as unknown as CustomField[]).map((f) => ({ ...f, options: [...f.options].sort((a, b) => (a.rank < b.rank ? -1 : 1)) }));
}
