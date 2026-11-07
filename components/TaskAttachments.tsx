"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { deleteAttachment, recordAttachment } from "@/lib/actions";
import type { AttachmentRow } from "@/lib/task-detail";

const MAX = 25 * 1024 * 1024;

function size(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function TaskAttachments({ projectId, taskId, files, canUpload, userId, canAdmin }: { projectId: string; taskId: string; files: AttachmentRow[]; canUpload: boolean; userId: string; canAdmin: boolean }) {
  const t = useTranslations();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const upload = (file: File) =>
    start(async () => {
      setError(null);
      if (file.size > MAX) return setError(t("task.fileTooBig"));
      const ext = file.name.includes(".") ? file.name.split(".").pop()!.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) : "";
      const path = `${projectId}/${taskId}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type || undefined });
      if (upErr) return setError(t("errors.generic"));
      const res = await recordAttachment(taskId, path, file.name, file.type, file.size);
      if (!res.ok) setError(t(`errors.${res.error}`));
      if (input.current) input.current.value = "";
    });

  return (
    <section className="space-y-2">
      <h3 className="flex items-center justify-between text-sm font-semibold">
        <span>{t("task.attachments")}</span>
        {canUpload && (
          <label className="btn-ghost cursor-pointer text-xs font-normal">
            {pending ? t("task.uploading") : `📎 ${t("task.upload")}`}
            <input ref={input} type="file" className="sr-only" disabled={pending} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        )}
      </h3>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      <ul className="space-y-1">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 rounded border border-line px-2 py-1.5 text-sm">
            {f.url ? <a href={f.url} target="_blank" rel="noreferrer" dir="auto" className="truncate text-brand-700 underline-offset-2 hover:underline dark:text-brand-100">{f.file_name}</a> : <span dir="auto" className="truncate">{f.file_name}</span>}
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
              {size(f.size_bytes)}
              {(f.uploader_id === userId || canAdmin) && (
                <button type="button" aria-label={t("task.deleteFile")} className="hover:text-rose-600" onClick={() => start(async () => { await deleteAttachment(f.id); })}>✕</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
