"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  completePasswordResetAction,
  requestPasswordResetAction,
  resendPasswordResetAction,
  restartPasswordResetAction,
  verifyPasswordResetOtpAction,
  type PasswordResetFormState,
} from "@/app/auth/password-reset/actions";
import { PasswordInput } from "./password-input";
import type { AuthRole } from "@/lib/auth/session";

type PasswordResetFlowProps = {
  initialStage: PasswordResetFormState["stage"];
  loginHref: string;
  portalLabel: string;
  role: AuthRole;
};

const stageCopy = {
  request: {
    eyebrow: "Password recovery",
    title: "Forgot your password?",
    description: "Enter your account email and we’ll send a secure reset code.",
  },
  otp: {
    eyebrow: "Check your email",
    title: "Enter your reset code",
    description: "Use the six-digit code we sent. It expires in five minutes.",
  },
  password: {
    eyebrow: "Code verified",
    title: "Create a new password",
    description: "Use at least eight characters for your new password.",
  },
} as const;

export function PasswordResetFlow({
  initialStage,
  loginHref,
  portalLabel,
  role,
}: PasswordResetFlowProps) {
  const [flowState, setFlowState] = useState<PasswordResetFormState>({
    stage: initialStage,
    message: "",
  });
  const copy = stageCopy[flowState.stage];

  return (
    <>
      <div className="mb-5">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#e64a19]">
          {copy.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-[#11131a]">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {copy.description}
        </p>
        <p className="mt-2 text-xs font-semibold text-zinc-500">
          {portalLabel}
        </p>
      </div>

      {flowState.stage === "request" ? (
        <RequestCodeForm role={role} onResult={setFlowState} />
      ) : null}
      {flowState.stage === "otp" ? (
        <VerifyCodeForm
          role={role}
          state={flowState}
          onResult={setFlowState}
        />
      ) : null}
      {flowState.stage === "password" ? (
        <NewPasswordForm role={role} onResult={setFlowState} />
      ) : null}

      <div className="mt-5 border-t border-zinc-100 pt-4 text-center text-sm text-zinc-600">
        Remembered your password?{" "}
        <Link
          href={loginHref}
          className="rounded-md font-bold text-[#bf360c] hover:text-[#e64a19] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/10"
        >
          Return to sign in
        </Link>
      </div>
    </>
  );
}

function RequestCodeForm({
  role,
  onResult,
}: {
  role: AuthRole;
  onResult: Dispatch<SetStateAction<PasswordResetFormState>>;
}) {
  const serverAction = requestPasswordResetAction.bind(null, role);
  const [state, action, pending] = useActionState<PasswordResetFormState, FormData>(
    async (previous, formData) => {
      const result = await serverAction(previous, formData);
      onResult(result);
      return result;
    },
    { stage: "request", message: "" },
  );

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-zinc-500">
          Account email
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(state.errors?.email)}
          className="min-h-12 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-[#11131a] outline-none transition placeholder:text-zinc-400 focus:border-[#e64a19] focus:ring-4 focus:ring-[#e64a19]/10"
        />
        {state.errors?.email ? (
          <span className="mt-1.5 block text-xs font-semibold text-[#9f2f12]">
            {state.errors.email}
          </span>
        ) : null}
      </label>
      <StatusMessage message={state.message} />
      <SubmitButton pending={pending} idleLabel="Send reset code" />
    </form>
  );
}

function VerifyCodeForm({
  role,
  state,
  onResult,
}: {
  role: AuthRole;
  state: PasswordResetFormState;
  onResult: Dispatch<SetStateAction<PasswordResetFormState>>;
}) {
  const verifyServerAction = verifyPasswordResetOtpAction.bind(null, role);
  const resendServerAction = resendPasswordResetAction.bind(null, role);
  const restartServerAction = restartPasswordResetAction.bind(null, role);
  const [verifyState, verifyAction, verifyPending] = useActionState<
    PasswordResetFormState,
    FormData
  >(
    async (previous, formData) => {
      const result = await verifyServerAction(previous, formData);
      onResult(result);
      return result;
    },
    state,
  );
  const [resendState, resendAction, resendPending] = useActionState<
    PasswordResetFormState,
    FormData
  >(
    async (previous, formData) => {
      const result = await resendServerAction(previous, formData);
      onResult(result);
      return result;
    },
    state,
  );
  const [, restartAction, restartPending] = useActionState<
    PasswordResetFormState,
    FormData
  >(
    async (previous, formData) => {
      const result = await restartServerAction(previous, formData);
      onResult(result);
      return result;
    },
    state,
  );
  const activeMessage = verifyState.message || resendState.message || state.message;
  const activeError = verifyState.errors?.otp;
  const resendAvailableAt =
    resendState.resendAvailableAt ?? state.resendAvailableAt ?? 0;

  return (
    <div className="space-y-4">
      {state.emailHint ? (
        <p className="rounded-lg bg-zinc-50 px-3 py-2 text-center text-xs font-semibold text-zinc-600">
          Code sent to {state.emailHint}
        </p>
      ) : null}
      <form action={verifyAction} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-zinc-500">
            Six-digit code
          </span>
          <input
            name="otp"
            type="text"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            aria-invalid={Boolean(activeError)}
            className="min-h-12 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center font-mono text-xl font-bold tracking-[0.35em] text-[#11131a] outline-none transition placeholder:text-zinc-300 focus:border-[#e64a19] focus:ring-4 focus:ring-[#e64a19]/10"
          />
          {activeError ? (
            <span className="mt-1.5 block text-xs font-semibold text-[#9f2f12]">
              {activeError}
            </span>
          ) : null}
        </label>
        <StatusMessage message={activeMessage} />
        <SubmitButton pending={verifyPending} idleLabel="Verify code" />
      </form>

      <ResendControl
        action={resendAction}
        availableAt={resendAvailableAt}
        pending={resendPending}
      />

      <form action={restartAction}>
        <button
          type="submit"
          disabled={restartPending}
          className="min-h-11 w-full rounded-lg px-3 text-sm font-bold text-zinc-600 transition hover:bg-zinc-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/10 disabled:opacity-60"
        >
          Use a different email
        </button>
      </form>
    </div>
  );
}

function ResendControl({
  action,
  availableAt,
  pending,
}: {
  action: (formData: FormData) => void;
  availableAt: number;
  pending: boolean;
}) {
  const [remaining, setRemaining] = useState(() =>
    secondsRemaining(availableAt),
  );

  useEffect(() => {
    if (remaining <= 0) return;

    const timer = window.setInterval(() => {
      setRemaining(secondsRemaining(availableAt));
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [availableAt, remaining]);

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending || remaining > 0}
        className="min-h-11 w-full rounded-lg border border-button-outline bg-white px-3 text-sm font-bold text-[#bf360c] transition hover:bg-[#fbe9e7] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/10 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:hover:bg-white"
      >
        {pending
          ? "Sending..."
          : remaining > 0
            ? `Resend code in ${remaining}s`
            : "Resend code"}
      </button>
    </form>
  );
}

function NewPasswordForm({
  role,
  onResult,
}: {
  role: AuthRole;
  onResult: Dispatch<SetStateAction<PasswordResetFormState>>;
}) {
  const serverAction = completePasswordResetAction.bind(null, role);
  const [state, action, pending] = useActionState<PasswordResetFormState, FormData>(
    async (previous, formData) => {
      const result = await serverAction(previous, formData);
      onResult(result);
      return result;
    },
    { stage: "password", message: "" },
  );

  return (
    <form action={action} className="space-y-4">
      <PasswordField
        name="password"
        label="New password"
        placeholder="Create a new password"
        error={state.errors?.password}
        showHelp
      />
      <PasswordField
        name="confirmPassword"
        label="Confirm new password"
        placeholder="Re-enter your new password"
        error={state.errors?.confirmPassword}
      />
      <StatusMessage message={state.message} />
      <SubmitButton pending={pending} idleLabel="Reset password" />
    </form>
  );
}

function PasswordField({
  name,
  label,
  placeholder,
  error,
  showHelp = false,
}: {
  name: string;
  label: string;
  placeholder: string;
  error?: string;
  showHelp?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-zinc-500">
        {label}
      </span>
      <PasswordInput
        name={name}
        required
        minLength={name === "password" ? 8 : undefined}
        autoComplete={name === "password" ? "new-password" : "new-password"}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="px-3 py-2 text-sm text-[#11131a] placeholder:text-zinc-400"
      />
      {showHelp ? (
        <span className="mt-1.5 block text-xs font-medium text-zinc-500">
          Use at least 8 characters.
        </span>
      ) : null}
      {error ? (
        <span className="mt-1.5 block text-xs font-semibold text-[#9f2f12]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function SubmitButton({
  pending,
  idleLabel,
}: {
  pending: boolean;
  idleLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-lg bg-[#e64a19] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/20 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Please wait..." : idleLabel}
    </button>
  );
}

function StatusMessage({ message }: { message: string }) {
  if (!message) return null;

  return (
    <p
      className="rounded-lg border border-[#f4b6a5] bg-[#fff4f0] px-3 py-2 text-sm font-semibold leading-6 text-[#9f2f12]"
      aria-live="polite"
    >
      {message}
    </p>
  );
}

function secondsRemaining(availableAt: number) {
  return Math.max(0, Math.ceil((availableAt - Date.now()) / 1_000));
}
