"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { AuthFormState } from "@/app/auth/actions";

type Portal = "admin" | "parent";

export function AuthToastListener({
  state,
  mode,
  portal,
}: {
  state: AuthFormState;
  mode: "login" | "register";
  portal: Portal;
}) {
  const lastMessage = useRef("");

  useEffect(() => {
    if (!state.message || lastMessage.current === state.message) {
      return;
    }

    lastMessage.current = state.message;
    const options = { description: `${portal === "admin" ? "Admin" : "Parent"} portal: ${state.message}` };
    if (state.tone === "info") {
      toast.info("Registration pending", options);
    } else if (state.tone === "warning") {
      toast.warning("Account unavailable", options);
    } else {
      toast.error(mode === "login" ? "Sign in failed" : "Registration needs attention", options);
    }
  }, [mode, portal, state.message, state.tone]);

  return null;
}
