import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Octara - Moteur de recherche intelligent & rapide",
    template: "%s | Octara",
  },
  description:
    "Octara est un moteur de recherche nouvelle génération, ultra-rapide et respectueux de la vie privée. Explorez le web proprement.",
  metadataBase: new URL("https://search.octara.xyz"),
  keywords: [
    "moteur de recherche",
    "search engine",
    "privacy",
    "fast search",
    "octara",
  ],
  authors: [{ name: "Octara Team" }],
  creator: "Octara",
  publisher: "Octara",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://search.octara.xyz",
    siteName: "Octara Search",
    title: "Octara - Moteur de recherche intelligent",
    description: "Découvrez une nouvelle façon d'explorer le web avec Octara.",
    images: [
      {
        url: "/favicon.ico",
        width: 1200,
        height: 630,
        alt: "Octara Search",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Octara Search",
    description: "Moteur de recherche intelligent & ultra-rapide.",
    images: ["/favicon.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-on-surface flex flex-col selection:bg-primary-fixed selection:text-on-primary-fixed antialiased">
        {children}
      </body>
    </html>
  );
}
