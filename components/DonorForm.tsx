"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { saveDonor } from "@/lib/actions";

type Donor = { id: string; name: string; contact_name: string | null; contact_email: string | null; notes: string | null };

export function DonorForm({ donor }: { donor?: Donor }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(saveDonor.bind(null, donor?.id ?? null), { status: "idle" } as { status: "idle" | "ok" | "error" });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok" && !donor) ref.current?.reset();
  }, [state, donor]);
  return (
    <form ref={ref} action={action} className="grid gap-2 sm:grid-cols-2">
      <label className="space-y-1"><span className="text-xs font-medium">{t("donors.name")}</span><input name="name" required defaultValue={donor?.name} className="input" /></label>
      <label className="space-y-1"><span className="text-xs font-medium">{t("donors.contactName")}</span><input name="contact_name" defaultValue={donor?.contact_name ?? ""} className="input" /></label>
      <label className="space-y-1"><span className="text-xs font-medium">{t("donors.contactEmail")}</span><input name="contact_email" type="email" dir="ltr" defaultValue={donor?.contact_email ?? ""} className="input text-start" /></label>
      <label className="space-y-1"><span className="text-xs font-medium">{t("donors.notes")}</span><input name="notes" defaultValue={donor?.notes ?? ""} className="input" /></label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{t("donors.save")}</button>
        {state.status === "ok" && <span role="status" className="text-sm text-brand-600">{t("donors.saved")}</span>}
        {state.status === "error" && <span role="alert" className="text-sm text-rose-600">{t("errors.generic")}</span>}
      </div>
    </form>
  );
}
