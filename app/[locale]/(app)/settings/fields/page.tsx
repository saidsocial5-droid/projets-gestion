import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import { workspaceFields } from "@/lib/fields";
import { FieldCard, NewFieldForm } from "@/components/FieldsAdmin";

export default async function FieldsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = (await getSession())!;
  if (session.role !== "admin") redirect({ href: "/home", locale });
  const t = await getTranslations("fields");
  const fields = await workspaceFields();
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted">{t("hint")}</p>
      <section className="surface space-y-2 rounded-xl p-4">
        <h2 className="font-medium">{t("new")}</h2>
        <NewFieldForm />
      </section>
      {fields.length === 0 ? <p className="surface rounded-xl p-8 text-center text-muted">{t("empty")}</p> : (
        <ul className="space-y-3">{fields.map((f) => <FieldCard key={f.id} field={f} />)}</ul>
      )}
    </main>
  );
}
