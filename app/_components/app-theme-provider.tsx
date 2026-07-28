"use client";

import { ThemeProvider } from "next-themes";

export const THEME_STORAGE_KEY = "xmetapay-public-theme";

export function AppThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableColorScheme={false}
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
      themes={["light", "dark"]}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
