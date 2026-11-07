import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { ProfileForm } from "@/components/ProfileForm";

export default async function MePage() {
  const session = (await getSession())!;
  const t = await getTranslations("profile");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name, locale, notify_email").eq("id", session.userId).single();
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <ProfileForm name={data?.full_name ?? ""} locale={data?.locale ?? "ar"} email={session.email} notify={data?.notify_email ?? true} />
    </main>
  );
}
