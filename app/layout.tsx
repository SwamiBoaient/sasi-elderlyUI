import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ElderlyAuthProvider } from "./contexts/ElderlyAuthContext";
import FetchHeaderProvider from "./components/FetchHeaderProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LifeEase",
  description: "Elderly chat interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ElderlyAuthProvider>
          <FetchHeaderProvider />
          {children}
        </ElderlyAuthProvider>
      </body>
    </html>
  );
}
