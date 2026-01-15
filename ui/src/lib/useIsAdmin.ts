"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const fetchIsAdmin = async (userId?: string) => {
  if (!userId) {
    return false;
  }

  const { data } = await supabase
    .from("admin_users")
    .select("is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return Boolean(data?.is_active);
};

export default function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    const refreshStatus = async (userId?: string) => {
      const nextIsAdmin = await fetchIsAdmin(userId);
      if (active) {
        setIsAdmin(nextIsAdmin);
      }
    };

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      await refreshStatus(data.session?.user.id);
    };

    initSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void refreshStatus(nextSession?.user.id);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { isAdmin };
}
