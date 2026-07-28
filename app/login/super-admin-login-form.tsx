"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { superAdminLoginAction, type SuperAdminLoginState } from "@/app/super-admin/actions";
import { PasswordInput } from "@/app/_components/password-input";

export function SuperAdminLoginForm() {
  const [state, action, pending] = useActionState<SuperAdminLoginState, FormData>(superAdminLoginAction, {
    message: "",
  });
  const [values, setValues] = useState({ email: "", password: "" });
  const lastMessage = useRef("");

  useEffect(() => {
    if (!state.message || lastMessage.current === state.message) {
      return;
    }

    lastMessage.current = state.message;
    toast.error("Company sign in failed", {
      description: state.message,
    });
  }, [state.message]);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-zinc-400">
          Company email
        </span>
        <input
          name="email"
          type="email"
          required
          value={values.email}
          onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
          placeholder="xmeta@gmail.com"
          aria-invalid={Boolean(state.errors?.email)}
          className="min-h-12 w-full rounded-lg border border-white/15 bg-white/[0.055] px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#ff7043] focus:ring-4 focus:ring-[#ff7043]/10"
        />
        {state.errors?.email ? <span className="mt-1.5 block text-xs font-semibold text-[#9f2f12]">{state.errors.email}</span> : null}
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-zinc-400">
          Password
        </span>
        <PasswordInput
          name="password"
          required
          value={values.password}
          onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
          placeholder="Enter company password"
          aria-invalid={Boolean(state.errors?.password)}
          className="px-3 py-2 text-sm text-white placeholder:text-zinc-500"
        />
        {state.errors?.password ? <span className="mt-1.5 block text-xs font-semibold text-[#9f2f12]">{state.errors.password}</span> : null}
      </label>

      <div className="text-right">
        <Link
          href="/forgot-password"
          className="inline-flex min-h-11 items-center rounded-md px-1 text-sm font-bold text-[#ff8a65] hover:text-[#ffb09a] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/20"
        >
          Forgot password?
        </Link>
      </div>

      {state.message ? (
        <p className="rounded-lg border border-red-400/25 bg-red-950/35 px-3 py-2 text-sm font-semibold text-red-200" aria-live="polite">
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
