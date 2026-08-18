import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Process Management Center",
  description: "Interactive customer complaints and quality handling demo.",
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
