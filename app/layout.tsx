import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://relayjob.dpdns.org"),
  title: "Relay 接棒 — 私密 AI 职业匹配",
  description: "一个不能浏览的招聘平台。把真实需求告诉 AI，只有彼此合适时才被看见。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Relay 接棒 — 私密 AI 职业匹配",
    description: "不公开浏览，双方互选后匿名沟通。",
    url: "https://relayjob.dpdns.org",
    siteName: "Relay 接棒",
    locale: "zh_CN",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1536,
        height: 1024,
        alt: "Relay 接棒 — 私密 AI 职业匹配",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Relay 接棒 — 私密 AI 职业匹配",
    description: "不公开浏览，双方互选后匿名沟通。",
    images: ["/og.png"],
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
