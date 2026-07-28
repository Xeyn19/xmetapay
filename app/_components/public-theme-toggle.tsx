"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

export function PublicThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const isLight = mounted && resolvedTheme === "light";
  const label = isLight ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isLight}
      title={label}
      disabled={!mounted}
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="public-theme-toggle inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/25 disabled:cursor-wait"
    >
      {isLight ? (
        <Moon aria-hidden="true" className="size-5" />
      ) : (
        <Sun aria-hidden="true" className="size-5" />
      )}
    </button>
  );
}
