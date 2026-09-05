import type { Metadata } from "next";
import { themeBootstrap } from "./chat/theme.mjs";

export const metadata: Metadata = {
  title: "AFS AI Chat Workbench",
  description: "AI-assisted aftersales customer complaint demo.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />{children}</body>
    </html>
  );
}
