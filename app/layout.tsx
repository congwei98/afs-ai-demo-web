import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AFS Process Management Center",
  description: "AFS-wide AI-assisted process workbench demo.",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
