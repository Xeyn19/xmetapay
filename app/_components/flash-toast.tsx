"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { AuthFlashToast } from "@/lib/auth/session";

export function FlashToast({ toast: flashToast }: { toast: AuthFlashToast | null }) {
  const shownToast = useRef("");
  const toastKey = flashToast ? `${flashToast.role}:${flashToast.title}:${flashToast.description}` : "";

  useEffect(() => {
    if (!flashToast || shownToast.current === toastKey) {
      return;
    }

    const timeout = window.setTimeout(() => {
      shownToast.current = toastKey;
      toast.success(flashToast.title, {
        description: flashToast.description,
      });
      void fetch("/auth/flash-toast", { method: "DELETE" });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [flashToast, toastKey]);

  return null;
}
