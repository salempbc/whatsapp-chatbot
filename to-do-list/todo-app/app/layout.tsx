import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ThemeProvider } from "next-themes";
import { Header } from "@/components/layout/Header";
import { PWARegister } from "@/components/layout/PWARegister";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "TaskFlow — Smart To-Do App",
  description:
    "A modern to-do application with priorities, due dates, subtasks, notes, recurring tasks, and more.",
  keywords: ["todo", "task manager", "productivity", "organize"],
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport = {
  themeColor: "#4f46e5",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ClerkProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Header isSignedIn={!!userId} />
            <main>{children}</main>
            <Toaster />
            <PWARegister />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
