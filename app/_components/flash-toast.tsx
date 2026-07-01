"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import type { AuthFlashToast } from "@/lib/auth/session";

export function FlashToast({ toast: flashToast }: { toast: AuthFlashToast | null }) {
  useEffect(() => {
    if (!flashToast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      toast.success(flashToast.title, {
        description: flashToast.description,
      });
      void fetch("/auth/flash-toast", { method: "DELETE" });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [flashToast]);

  return null;
}
