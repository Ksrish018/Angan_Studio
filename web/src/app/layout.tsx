import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT"] });

export const metadata: Metadata = {
  title: "Aangan Concierge",
  description: "Every enquiry answered. Every designer prepared.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Concierge", statusBarStyle: "default" },
};

export const viewport = { themeColor: "#f6f2ec" };

// Applies the saved Day/Night choice before paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='day')t='linen';if(t==='night')t='atelier';if(['linen','atelier','gallery','courtyard'].indexOf(t)>-1)document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
