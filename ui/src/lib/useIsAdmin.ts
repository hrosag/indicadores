"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

let cachedUserId: string | null = null;
let cachedIsAdmin: boolean | null = null;
let inflight: Promise<boolean | null> | null = null;

const resetCache = () => {
  cachedUserId = null;
  cachedIsAdmin = null;
  inflight = null;
};

const fetchIsAdmin = async (userId?: string) => {
  if (!userId) {
    resetCache();
    return false;
  }

  if (cachedUserId && cachedUserId !== userId) {
    resetCache();
  }

  if (cachedUserId === userId && cachedIsAdmin !== null) {
    return cachedIsAdmin;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("is_active")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.warn("Falha ao validar admin_users:", error);
        return null;
      }

      return Boolean(data?.is_active);
    } catch (error) {
      console.warn("Falha ao validar admin_users:", error);
      return null;
    } finally {
      inflight = null;
    }
  })();

  const result = await inflight;
  if (result !== null) {
    cachedUserId = userId;
    cachedIsAdmin = result;
  }

  return result ?? false;
};

export default function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let lastUserId: string | null = null;

    const refreshStatus = async (userId?: string) => {
      const nextIsAdmin = await fetchIsAdmin(userId);
      if (active) {
        setIsAdmin(nextIsAdmin);
        setLoading(false);
      }
      lastUserId = userId ?? null;
    };

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      await refreshStatus(data.session?.user.id);
    };

    initSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (nextUserId !== lastUserId) {
        resetCache();
      }
      void refreshStatus(nextSession?.user.id);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, loading };
}
