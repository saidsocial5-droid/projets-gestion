"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the project page when someone else changes it. Listens to activity
 * inserts for this project (every meaningful change, deletions included, writes one).
 * Realtime checks the subscriber's RLS, so nobody receives rows they cannot see.
 */
export function LiveRefresh({ projectId }: { projectId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 300);
    };
    (async () => {
      // join with the user's token, not the anonymous key, so RLS lets this user's rows through
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`project:${projectId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "activities", filter: `project_id=eq.${projectId}` }, refresh)
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [projectId, router]);

  return null;
}
