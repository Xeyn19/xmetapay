import Link from "next/link";

type Portal = "admin" | "parent";
type Field = {
  label: string;
  type?: string;
  placeholder: string;
  name: string;
  options?: string[];
};

const portalTheme = {
  admin: {
    href: "/admin",
    loginHref: "/admin/dashboard",
  },
  parent: {
    href: "/parent",
    loginHref: "/parent/dashboard",
  },
};

export function BrandMark() {
  return (
    <Link href="/" className="inline-flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e64a19] text-sm font-bold text-white shadow-sm">
        XP
      </span>
      <span>
        <span className="block text-base font-bold tracking-tight text-[#11131a]">
          XMETA Pay
        </span>
        <span className="block text-xs font-medium text-zinc-500">
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

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-6 text-[#11131a] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-3xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <BrandMark />
          <Link
            href="/"
            className="rounded-lg border border-button-outline bg-white px-4 py-2 text-sm font-semibold text-[#bf360c] transition hover:bg-[#fbe9e7] hover:text-[#e64a19]"
          >
            Choose portal
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center py-10">
          <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            {children}
            <div className="mt-7 border-t border-zinc-100 pt-5 text-center text-sm text-zinc-600">
              {mode === "login" ? "New to this portal?" : "Already have access?"}{" "}
              <Link
                href={`/${portal}/${otherMode}`}
                className="font-bold text-[#bf360c] hover:text-[#e64a19]"
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
  const theme = portalTheme[portal];
  const action = mode === "login" ? theme.loginHref : theme.href;
  const method = "get";

  return (
    <form action={action} method={method} className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e64a19]">
          {portal === "admin" ? "Admin access" : "Family access"}
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#11131a]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{subtitle}</p>
      </div>

      <div className="grid gap-4">
        {fields.map((field) => (
          <label key={field.name} className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
              {field.label}
            </span>
            {field.options ? (
              <select
                name={field.name}
                className="h-12 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-[#11131a] outline-none transition focus:border-[#e64a19] focus:ring-4 focus:ring-[#e64a19]/10"
                defaultValue=""
              >
                <option value="" disabled>
                  {field.placeholder}
                </option>
                {field.options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                name={field.name}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                className="h-12 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-[#11131a] outline-none transition placeholder:text-zinc-400 focus:border-[#e64a19] focus:ring-4 focus:ring-[#e64a19]/10"
              />
            )}
          </label>
        ))}
      </div>

      {mode === "login" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="inline-flex items-center gap-2 text-zinc-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300 accent-[#e64a19]"
            />
            Remember me
          </label>
          <a href="#" className="font-semibold text-[#bf360c] hover:text-[#e64a19]">
            Forgot password?
          </a>
        </div>
      ) : null}

      <button
        type="submit"
        className="h-12 w-full rounded-lg bg-[#e64a19] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#bf360c] focus:outline-none focus:ring-4 focus:ring-[#e64a19]/20"
      >
        {mode === "login" ? "Sign in" : "Create account"}
      </button>
    </form>
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
    <article className="flex h-full flex-col rounded-2xl border-[0.5px] border-zinc-300 bg-white p-6 text-left text-[#11131a] shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f1ff] text-[#2f68b7]">
        {isAdmin ? <SettingsIcon /> : <PeopleIcon />}
      </div>
      <h2 className="mt-6 text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-3 flex-1 leading-7 text-zinc-600">
        {description}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-[#f4f1e9] px-3 py-1 text-[11px] font-bold text-zinc-700"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link
          href={href}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-[#e64a19] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#bf360c] focus:outline-none focus:ring-4 focus:ring-[#e64a19]/20"
        >
          Sign in
        </Link>
        <Link
          href={registerHref}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-button-outline bg-white px-4 text-sm font-bold text-[#bf360c] transition hover:bg-[#fbe9e7] hover:text-[#e64a19] focus:outline-none focus:ring-4 focus:ring-[#e64a19]/10"
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
