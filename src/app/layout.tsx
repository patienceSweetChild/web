import { PinCatalogProvider } from "@/features/pins";
import { UserProvider } from "@/features/users/user-provider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OAS Pin Library",
  description: "OAS package flat-lay catalogue — Next.js + Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          <PinCatalogProvider>{children}</PinCatalogProvider>
        </UserProvider>
      </body>
    </html>
  );
}
