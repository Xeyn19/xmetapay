"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { superAdminLoginAction, type SuperAdminLoginState } from "@/app/super-admin/actions";
import { PasswordInput } from "@/app/_components/password-input";

export function SuperAdminLoginForm() {
  const [state, action, pending] = useActionState<SuperAdminLoginState, FormData>(superAdminLoginAction, {
    message: "",
    feedbackId: 0,
  });
  const [values, setValues] = useState({ email: "", password: "" });

  useEffect(() => {
    if (!state.message || state.feedbackId === 0) {
      return;
    }

    toast.error("Unable to sign in", {
      description: state.message,
      id: "company-sign-in-error",
    });
  }, [state.feedbackId, state.message]);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--public-muted)]">
          Company email
        </span>
        <input
          name="email"
          type="email"
          required
          value={values.email}
          onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
          placeholder="Enter your company email"
          aria-invalid={Boolean(state.errors?.email)}
          className="public-field min-h-12 w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#ff7043] focus:ring-4 focus:ring-[#ff7043]/10"
        />
        {state.errors?.email ? <span className="mt-1.5 block text-xs font-semibold text-[var(--public-error-text)]">{state.errors.email}</span> : null}
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--public-muted)]">
          Password
        </span>
        <PasswordInput
          name="password"
          required
          value={values.password}
          onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
          placeholder="Enter your password"
          aria-invalid={Boolean(state.errors?.password)}
          className="px-3 py-2 text-sm text-[var(--public-text)] placeholder:text-[var(--public-subtle)]"
        />
        {state.errors?.password ? <span className="mt-1.5 block text-xs font-semibold text-[var(--public-error-text)]">{state.errors.password}</span> : null}
      </label>

      <div className="text-right">
        <Link
          href="/forgot-password"
          className="public-link inline-flex min-h-11 items-center rounded-md px-1 text-sm font-bold focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/20"
        >
          Forgot password?
        </Link>
      </div>

      {state.message ? (
        <p className="public-error rounded-lg border px-3 py-2 text-sm font-semibold" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-lg bg-[#e64a19] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
