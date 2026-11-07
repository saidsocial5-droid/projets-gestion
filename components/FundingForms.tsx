"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { addExpense, addIndicator, deleteExpense, setIndicatorCurrent } from "@/lib/actions";
import { EXPENSE_CATEGORIES } from "@/lib/money";
import { todayInMorocco } from "@/lib/dates";

type FormResult = { status: "idle" | "ok" | "error"; message?: string };

function useResetOnOk(state: FormResult) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok") ref.current?.reset();
  }, [state]);
  return ref;
}

export function ExpenseForm({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(addExpense.bind(null, projectId), { status: "idle" } as FormResult);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="grid gap-2 sm:grid-cols-[9rem_1fr_9rem_8rem_auto] sm:items-end">
      <label className="space-y-1"><span className="text-xs font-medium">{t("funding.date")}</span><input name="spent_on" type="date" required defaultValue={todayInMorocco()} className="input" /></label>
      <label className="space-y-1"><span className="text-xs font-medium">{t("funding.label")}</span><input name="label" required maxLength={300} className="input" /></label>
      <label className="space-y-1">
        <span className="text-xs font-medium">{t("funding.category")}</span>
        <select name="category" defaultValue="other" className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}</select>
      </label>
      <label className="space-y-1"><span className="text-xs font-medium">{t("funding.amount")}</span><input name="amount" required inputMode="decimal" dir="ltr" className="input text-start" /></label>
      <button className="btn-primary" disabled={pending}>{t("funding.add")}</button>
      {state.status === "error" && <p role="alert" className="text-sm text-rose-600 sm:col-span-5">{state.message === "invalid_amount" ? t("funding.invalidAmount") : t("errors.generic")}</p>}
    </form>
  );
}

export function DeleteExpense({ id }: { id: string }) {
  const t = useTranslations("funding");
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} aria-label={t("delete")} className="text-muted hover:text-rose-600" onClick={() => start(async () => { await deleteExpense(id); })}>✕</button>;
}

export function IndicatorForm({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(addIndicator.bind(null, projectId), { status: "idle" } as FormResult);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_6rem_6rem_auto] sm:items-end">
      <label className="space-y-1"><span className="text-xs font-medium">{t("funding.nameAr")}</span><input name="name_ar" dir="rtl" className="input" /></label>
      <label className="space-y-1"><span className="text-xs font-medium">{t("funding.nameFr")}</span><input name="name_fr" dir="ltr" className="input" /></label>
      <label className="space-y-1"><span className="text-xs font-medium">{t("funding.unit")}</span><input name="unit" className="input" /></label>
      <label className="space-y-1"><span className="text-xs font-medium">{t("funding.baseline")}</span><input name="baseline" inputMode="decimal" dir="ltr" className="input" /></label>
      <label className="space-y-1"><span className="text-xs font-medium">{t("funding.target")}</span><input name="target" required inputMode="decimal" dir="ltr" className="input" /></label>
      <button className="btn-primary" disabled={pending}>{t("funding.add")}</button>
      {state.status === "error" && <p role="alert" className="text-sm text-rose-600 sm:col-span-6">{t("errors.generic")}</p>}
    </form>
  );
}

export function IndicatorCurrent({ id, current, label }: { id: string; current: number; label: string }) {
  const t = useTranslations("funding");
  const [value, setValue] = useState(String(current));
  const [pending, start] = useTransition();
  const changed = Number(value.replace(",", ".")) !== current;
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => { await setIndicatorCurrent(id, Number(value.replace(",", "."))); });
      }}
    >
      <input aria-label={label} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" dir="ltr" className="input w-24 py-1" />
      {changed && <button className="btn-primary py-1 text-xs" disabled={pending}>{t("update")}</button>}
    </form>
  );
}
