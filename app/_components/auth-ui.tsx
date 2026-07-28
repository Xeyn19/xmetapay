"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { loginAction, registerAction, type AuthFormState } from "@/app/auth/actions";
import { AuthToastListener } from "./auth-toast-listener";
import { BrandLogo } from "./brand-logo";
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
  required?: boolean;
};

export function BrandMark() {
  return (
    <Link
      href="/"
      className="inline-flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/20"
    >
      <BrandLogo />
      <span className="min-w-0">
        <span className="block truncate text-base font-bold tracking-tight text-white">
          XMETA Pay
        </span>
        <span className="block truncate text-xs font-medium text-zinc-400">
          School payments, simplified
        </span>
      </span>
    </Link>
  );
}

export function PublicPageShell({
  children,
  headerAction,
}: {
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <main className="public-auth-shell relative min-h-[100svh] overflow-hidden px-4 py-4 text-white sm:px-6 sm:py-6 lg:px-8">
      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-32px)] w-full max-w-5xl flex-col sm:min-h-[calc(100svh-48px)]">
        <header className="flex min-h-12 items-center justify-between gap-3">
          <BrandMark />
          {headerAction}
        </header>
        {children}
      </div>
    </main>
  );
}

export function AuthCard({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-white/[0.13] bg-[#202122]/90 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#ff7043] before:to-transparent sm:p-7",
        wide ? "max-w-4xl lg:p-8" : "max-w-md",
      )}
    >
      {children}
    </div>
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
    <PublicPageShell
      headerAction={
        <Link
          href="/"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-zinc-200 shadow-sm transition hover:border-[#ff7043]/50 hover:bg-[#e64a19]/10 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/20 sm:px-4"
        >
          All portals
        </Link>
      }
    >
        <section className={isLogin ? "flex flex-1 items-center justify-center py-8 sm:py-10" : "flex flex-1 items-start justify-center py-8 sm:py-10 lg:py-12"}>
          <AuthCard wide={!isLogin}>
            {children}
            <div className={isLogin ? "mt-5 border-t border-white/10 pt-4 text-center text-sm text-zinc-400" : "mt-7 border-t border-white/10 pt-5 text-center text-sm text-zinc-400"}>
              {mode === "login" ? "New to this portal?" : "Already have access?"}{" "}
              <Link
                href={`/${portal}/${otherMode}`}
                className="rounded-md font-bold text-[#ff8a65] hover:text-[#ffb09a] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/20"
              >
                {mode === "login" ? "Create an account" : "Sign in instead"}
              </Link>
            </div>
          </AuthCard>
        </section>
    </PublicPageShell>
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
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, ""])),
  );
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

  function updateFieldValue(name: string, value: string) {
    setFieldValues((current) => ({ ...current, [name]: value }));
  }

  return (
    <form action={action} className={isLogin ? "space-y-4" : "space-y-5 sm:space-y-6"}>
      <AuthToastListener state={state} mode={mode} portal={portal} />
      <div>
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#e64a19]">
          {portal === "admin" ? "Admin access" : "Family access"}
        </p>
        <h1 className={isLogin ? "mt-2 text-2xl font-bold leading-tight tracking-tight text-white" : "mt-2 text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl"}>
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          {subtitle}
        </p>
      </div>

      <div className={fieldGridClass}>
        {visibleFields.map((field) => (
          <AuthField
            key={field.name}
            field={field}
            compact={isLogin}
            error={state.errors?.[field.name]}
            value={fieldValues[field.name] ?? ""}
            onValueChange={updateFieldValue}
          />
        ))}
        {hasPasswordPair ? (
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 sm:gap-4">
            {passwordFields.map((field) => (
              <AuthField
                key={field.name}
                field={field}
                compact={isLogin}
                alignLabel
                error={state.errors?.[field.name]}
                value={fieldValues[field.name] ?? ""}
                onValueChange={updateFieldValue}
                showPasswordHelp={mode === "register" && field.name === "password"}
              />
            ))}
          </div>
        ) : null}
      </div>

      {isLogin ? (
        <div className="text-right">
          <Link
            href={`/${portal}/forgot-password`}
            className="inline-flex min-h-11 items-center rounded-md px-1 text-sm font-bold text-[#ff8a65] hover:text-[#ffb09a] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/20"
          >
            Forgot password?
          </Link>
        </div>
      ) : null}

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
  value,
  onValueChange,
  showPasswordHelp = false,
}: {
  field: Field;
  compact: boolean;
  alignLabel?: boolean;
  error?: string;
  value: string;
  onValueChange: (name: string, value: string) => void;
  showPasswordHelp?: boolean;
}) {
  const required = field.required ?? true;

  if (field.type === "studentReferences") {
    return <StudentReferencesField error={error} />;
  }

  return (
    <label className={cn("block", field.spanFull && "sm:col-span-2")}>
      <span className={compact ? "mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-zinc-400" : `mb-2 block text-[0.7rem] font-bold uppercase tracking-[0.1em] text-zinc-400 sm:text-xs sm:tracking-[0.12em] ${alignLabel ? "min-h-8 sm:min-h-0" : ""}`}>
        {field.label}
        {!required ? <span className="ml-1 font-semibold normal-case tracking-normal text-zinc-500">(optional)</span> : null}
      </span>
      {field.options ? (
        <select
          name={field.name}
          required={required}
          aria-invalid={Boolean(error)}
          className="min-h-12 w-full rounded-lg border border-white/15 bg-white/[0.055] px-3 py-2 text-sm text-white outline-none transition focus:border-[#ff7043] focus:ring-4 focus:ring-[#ff7043]/10"
          value={value}
          onChange={(event) => onValueChange(field.name, event.target.value)}
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
          required={required}
          minLength={field.name === "password" ? 8 : undefined}
          value={value}
          onChange={(event) => onValueChange(field.name, event.target.value)}
          aria-invalid={Boolean(error)}
          className="px-3 py-2 text-sm text-white placeholder:text-zinc-500"
        />
      ) : (
        <input
          name={field.name}
          type={field.type ?? "text"}
          placeholder={field.placeholder}
          required={required}
          value={value}
          onChange={(event) => onValueChange(field.name, event.target.value)}
          aria-invalid={Boolean(error)}
          className="min-h-12 w-full rounded-lg border border-white/15 bg-white/[0.055] px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#ff7043] focus:ring-4 focus:ring-[#ff7043]/10"
        />
      )}
      {showPasswordHelp ? (
        <span className="mt-1.5 block text-xs font-medium text-zinc-400">
          Use at least 8 characters.
        </span>
      ) : null}
      {error ? <span className="mt-1.5 block text-xs font-semibold text-[#9f2f12]">{error}</span> : null}
    </label>
  );
}

function StudentReferencesField({ error }: { error?: string }) {
  const [references, setReferences] = useState([""]);
  const countLabel = `${references.length} ${references.length === 1 ? "student" : "students"}`;

  function updateReference(index: number, value: string) {
    setReferences((current) => current.map((reference, itemIndex) => (itemIndex === index ? value : reference)));
  }

  function addReference() {
    setReferences((current) => [...current, ""]);
  }

  function removeReference(index: number) {
    setReferences((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="block text-[0.7rem] font-bold uppercase tracking-[0.1em] text-zinc-400 sm:text-xs sm:tracking-[0.12em]">
          Student IDs or references
        </span>
        <span className="rounded-md bg-[#fbe9e7] px-2 py-1 text-[11px] font-bold text-[#bf360c]">
          {countLabel}
        </span>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/15 p-3 sm:p-4">
        <p className="max-w-2xl text-xs leading-5 text-zinc-400 sm:text-[13px] sm:leading-6">
          Enter the student references from the school. Add all children you want connected to this parent account.
        </p>
        <div className="mt-3 grid gap-2.5">
          {references.map((reference, index) => (
            <div key={index} className="grid gap-2 min-[560px]:grid-cols-[2rem_minmax(0,1fr)_auto] min-[560px]:items-center">
              <span className="hidden size-8 items-center justify-center rounded-lg bg-white/[0.07] text-xs font-bold text-zinc-400 min-[560px]:inline-flex">
                {index + 1}
              </span>
              <input
                name="studentReferences"
                type="text"
                value={reference}
                onChange={(event) => updateReference(index, event.target.value)}
                placeholder={index === 0 ? "BWA-001" : "Another student reference"}
                required={index === 0}
                aria-label={`Student reference ${index + 1}`}
                aria-invalid={Boolean(error)}
                className="min-h-12 min-w-0 rounded-lg border border-white/15 bg-white/[0.055] px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#ff7043] focus:ring-4 focus:ring-[#ff7043]/10"
              />
              {references.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeReference(index)}
                  className="min-h-11 rounded-lg border border-white/15 bg-white/[0.05] px-3 text-sm font-bold text-zinc-300 transition hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/20 min-[560px]:min-h-12"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <button
            type="button"
            onClick={addReference}
            className="min-h-11 rounded-lg border border-[#ff7043]/35 bg-[#e64a19]/10 px-3 text-sm font-bold text-[#ff9a7a] transition hover:bg-[#e64a19]/20 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/20"
          >
            Add another student
          </button>
          <span className="text-xs leading-5 text-zinc-400">
            Duplicate references are ignored safely.
          </span>
        </div>
      </div>
      {error ? <span className="mt-1.5 block text-xs font-semibold text-[#9f2f12]">{error}</span> : null}
    </div>
  );
}

export function PortalCard({
  title,
  description,
  href,
  registerHref,
  variant,
}: {
  title: string;
  description: string;
  href: string;
  registerHref: string;
  variant: Portal;
}) {
  const isAdmin = variant === "admin";

  return (
    <article className="flex h-full flex-col rounded-xl border border-white/[0.13] bg-[#202122]/88 p-5 text-left text-white shadow-[0_20px_55px_rgba(0,0,0,0.32)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-[#ff7043]/40 hover:bg-[#242526]/92 hover:shadow-[0_24px_60px_rgba(0,0,0,0.4)] sm:p-6">
      <div className="flex size-11 items-center justify-center rounded-lg bg-[#e64a19]/15 text-[#ff8a65] ring-1 ring-[#ff7043]/20">
        {isAdmin ? <SettingsIcon /> : <PeopleIcon />}
      </div>
      <h2 className="mt-4 text-xl font-bold leading-tight tracking-tight">
        {title}
      </h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-zinc-400">
        {description}
      </p>
      <div className="mt-5 flex flex-col gap-3 min-[420px]:flex-row">
        <Link
          href={href}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[#e64a19] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/20"
        >
          Sign in
        </Link>
        <Link
          href={registerHref}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-white/15 bg-white/[0.055] px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-[#ff7043]/40 hover:bg-[#e64a19]/10 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/20"
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
