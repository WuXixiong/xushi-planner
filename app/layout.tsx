import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title: "序事 · 待办与时间规划",
    description: "把大任务拆成清晰节点，再亲手放进自己的空余时间。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "序事 · 待办与时间规划",
      description: "把复杂的事，一步步做完。",
      images: [{ url: image, width: 1536, height: 1024, alt: "序事任务规划应用" }],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
