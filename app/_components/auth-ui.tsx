"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, registerAction, type AuthFormState } from "@/app/auth/actions";
import { PasswordInput } from "./password-input";
import { cn } from "@/lib/utils";

type Portal = "admin" | "parent";
type Field = {
  label: string;
  type?: string;
  placeholder: string;
  name: string;
  options?: string[];
  spanFull?: boolean;
};

export function BrandMark() {
  return (
    <Link
      href="/"
      className="inline-flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/20"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e64a19] text-sm font-bold text-white shadow-sm">
        XP
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-bold tracking-tight text-[#11131a]">
          XMETA Pay
        </span>
        <span className="block truncate text-xs font-medium text-zinc-500">
          School payment portal
        </span>
      </span>
    </Link>
  );
}

export function PortalAuthLayout({
  portal,
  mode,
  children,
}: {
  portal: Portal;
  mode: "login" | "register";
  children: React.ReactNode;
}) {
  const otherMode = mode === "login" ? "register" : "login";
  const isLogin = mode === "login";

  return (
    <main className="min-h-[100svh] bg-[#f7f8fa] px-4 py-4 text-[#11131a] sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-32px)] w-full max-w-4xl flex-col sm:min-h-[calc(100svh-48px)]">
        <header className="flex min-h-12 items-center justify-between gap-3">
          <BrandMark />
          <Link
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-button-outline bg-white px-3 py-2 text-sm font-semibold text-[#bf360c] transition hover:bg-[#fbe9e7] hover:text-[#e64a19] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/10 sm:px-4"
          >
            Choose portal
          </Link>
        </header>

        <section className={isLogin ? "flex flex-1 items-center justify-center py-6 sm:py-8" : "flex flex-1 items-center justify-center py-8 sm:py-10 lg:py-12"}>
          <div className={isLogin ? "w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6" : "w-full max-w-3xl rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7 lg:p-8"}>
            {children}
            <div className={isLogin ? "mt-5 border-t border-zinc-100 pt-4 text-center text-sm text-zinc-600" : "mt-7 border-t border-zinc-100 pt-5 text-center text-sm text-zinc-600"}>
              {mode === "login" ? "New to this portal?" : "Already have access?"}{" "}
              <Link
                href={`/${portal}/${otherMode}`}
                className="rounded-md font-bold text-[#bf360c] hover:text-[#e64a19] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/10"
              >
                {mode === "login" ? "Create an account" : "Sign in instead"}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function AuthForm({
  portal,
  mode,
  title,
  subtitle,
  fields,
}: {
  portal: Portal;
  mode: "login" | "register";
  title: string;
  subtitle: string;
  fields: Field[];
}) {
  const isLogin = mode === "login";
  const serverAction = (isLogin ? loginAction : registerAction).bind(null, portal);
  const [state, action, pending] = useActionState<AuthFormState, FormData>(serverAction, {
    message: "",
  });
  const fieldGridClass =
    mode === "register" ? "grid gap-4 sm:grid-cols-2" : "grid gap-4";
  const passwordIndex = fields.findIndex((field) => field.name === "password");
  const confirmPasswordIndex = fields.findIndex((field) => field.name === "confirmPassword");
  const hasPasswordPair =
    mode === "register" &&
    passwordIndex >= 0 &&
    confirmPasswordIndex >= 0;
  const visibleFields = hasPasswordPair
    ? fields.filter((field) => field.name !== "password" && field.name !== "confirmPassword")
    : fields;
  const passwordFields = hasPasswordPair
    ? [fields[passwordIndex], fields[confirmPasswordIndex]]
    : [];

  return (
    <form action={action} className={isLogin ? "space-y-4" : "space-y-5 sm:space-y-6"}>
      <div>
        <p className={isLogin ? "text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#e64a19]" : "text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[#e64a19] sm:text-xs sm:tracking-[0.18em]"}>
          {portal === "admin" ? "Admin access" : "Family access"}
        </p>
        <h2 className={isLogin ? "mt-2 text-2xl font-bold leading-tight text-[#11131a]" : "mt-3 text-2xl font-bold leading-tight tracking-tight text-[#11131a] sm:text-3xl"}>
          {title}
        </h2>
        <p className={isLogin ? "mt-2 text-sm leading-6 text-zinc-600" : "mt-2 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base sm:leading-7"}>
          {subtitle}
        </p>
      </div>

      <div className={fieldGridClass}>
        {visibleFields.map((field) => (
          <AuthField key={field.name} field={field} compact={isLogin} error={state.errors?.[field.name]} />
        ))}
        {hasPasswordPair ? (
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:gap-4">
            {passwordFields.map((field) => (
              <AuthField key={field.name} field={field} compact={isLogin} alignLabel error={state.errors?.[field.name]} />
            ))}
          </div>
        ) : null}
      </div>

      {state.message ? (
        <p className="rounded-lg border border-[#f4b6a5] bg-[#fff4f0] px-3 py-2 text-sm font-semibold text-[#9f2f12]" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      {mode === "login" ? (
        <div className="flex flex-col gap-3 text-sm min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <label className="inline-flex min-h-8 items-center gap-2 text-zinc-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300 accent-[#e64a19] focus-visible:ring-4 focus-visible:ring-[#e64a19]/20"
            />
            Remember me
          </label>
          <a
            href="#"
            className="inline-flex min-h-8 items-center rounded-md font-semibold text-[#bf360c] hover:text-[#e64a19] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/10"
          >
            Forgot password?
          </a>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-lg bg-[#e64a19] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}

function AuthField({
  field,
  compact,
  alignLabel = false,
  error,
}: {
  field: Field;
  compact: boolean;
  alignLabel?: boolean;
  error?: string;
}) {
  return (
    <label className={cn("block", field.spanFull && "sm:col-span-2")}>
      <span className={compact ? "mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-zinc-500" : `mb-2 block text-[0.7rem] font-bold uppercase tracking-[0.1em] text-zinc-500 sm:text-xs sm:tracking-[0.12em] ${alignLabel ? "min-h-8 sm:min-h-0" : ""}`}>
        {field.label}
      </span>
      {field.options ? (
        <select
          name={field.name}
          required
          aria-invalid={Boolean(error)}
          className="min-h-12 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-[#11131a] outline-none transition focus:border-[#e64a19] focus:ring-4 focus:ring-[#e64a19]/10"
          defaultValue=""
        >
          <option value="" disabled>
            {field.placeholder}
          </option>
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : field.type === "password" ? (
        <PasswordInput
          name={field.name}
          placeholder={field.placeholder}
          required
          aria-invalid={Boolean(error)}
          className="px-3 py-2 text-sm text-[#11131a] placeholder:text-zinc-400"
        />
      ) : (
        <input
          name={field.name}
          type={field.type ?? "text"}
          placeholder={field.placeholder}
          required
          aria-invalid={Boolean(error)}
          className="min-h-12 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-[#11131a] outline-none transition placeholder:text-zinc-400 focus:border-[#e64a19] focus:ring-4 focus:ring-[#e64a19]/10"
        />
      )}
      {error ? <span className="mt-1.5 block text-xs font-semibold text-[#9f2f12]">{error}</span> : null}
    </label>
  );
}

export function PortalCard({
  title,
  description,
  href,
  registerHref,
  variant,
  tags,
}: {
  title: string;
  description: string;
  href: string;
  registerHref: string;
  variant: Portal;
  tags: string[];
}) {
  const isAdmin = variant === "admin";

  return (
    <article className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 text-left text-[#11131a] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md sm:p-6 lg:p-7">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e8f1ff] text-[#2f68b7] ring-1 ring-[#2f68b7]/10">
        {isAdmin ? <SettingsIcon /> : <PeopleIcon />}
      </div>
      <h2 className="mt-5 text-xl font-bold leading-tight tracking-tight sm:text-2xl">
        {title}
      </h2>
      <p className="mt-3 flex-1 text-sm leading-7 text-zinc-600 sm:text-base">
        {description}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex min-h-7 items-center rounded-md bg-[#f1f3f5] px-3 text-[11px] font-bold text-zinc-700"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-3 min-[420px]:flex-row">
        <Link
          href={href}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[#e64a19] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/20"
        >
          Sign in
        </Link>
        <Link
          href={registerHref}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-button-outline bg-white px-4 py-2 text-sm font-bold text-[#bf360c] transition hover:bg-[#fbe9e7] hover:text-[#e64a19] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/10"
        >
          Register
        </Link>
      </div>
    </article>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.3 4.6 9.8 6.7a6.5 6.5 0 0 0-1.2.7l-2-.7-1.7 3 1.6 1.4a5.8 5.8 0 0 0 0 1.8l-1.6 1.4 1.7 3 2-.7c.4.3.8.5 1.2.7l.5 2.1h3.4l.5-2.1c.4-.2.8-.4 1.2-.7l2 .7 1.7-3-1.6-1.4a5.8 5.8 0 0 0 0-1.8l1.6-1.4-1.7-3-2 .7a6.5 6.5 0 0 0-1.2-.7l-.5-2.1h-3.4Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 11.5a3 3 0 1 0-2.1-5.1"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.5 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.8 19.2c.7-2.9 2.7-4.4 5.7-4.4s5 1.5 5.7 4.4"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.5 15.1c2.6.2 4.3 1.6 4.9 4.1"
      />
    </svg>
  );
}
