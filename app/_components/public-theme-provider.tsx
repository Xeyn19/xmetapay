"use client";

import { ThemeProvider } from "next-themes";

export const PUBLIC_THEME_STORAGE_KEY = "xmetapay-public-theme";

export function PublicThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="data-public-theme"
      defaultTheme="dark"
      enableColorScheme={false}
      enableSystem={false}
      storageKey={PUBLIC_THEME_STORAGE_KEY}
      themes={["light", "dark"]}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
