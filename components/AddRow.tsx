"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

/** One-line input that submits on Enter and clears itself. */
export function AddRow({ placeholder, onAdd, className = "" }: { placeholder: string; onAdd: (value: string) => Promise<{ ok: boolean; error?: string }>; className?: string }) {
  const t = useTranslations("errors");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        start(async () => {
          const res = await onAdd(value);
          if (res.ok) { setValue(""); setError(null); } else setError(t(res.error ?? "generic"));
        });
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={pending}
        className="w-full rounded-md bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted focus:bg-black/5 dark:focus:bg-white/5"
      />
      {error && <p role="alert" className="px-3 text-xs text-rose-600">{error}</p>}
    </form>
  );
}
