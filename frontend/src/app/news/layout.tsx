import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Actualités",
  description:
    "Dernières nouvelles, actualités internationales, financières et technologiques en temps réel sur Octara News.",
};

export default function NewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
