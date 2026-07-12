import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relay 接棒 — 私密 AI 职业匹配",
  description: "一个不能浏览的招聘平台。把真实需求告诉 AI，只有彼此合适时才被看见。",
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
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
