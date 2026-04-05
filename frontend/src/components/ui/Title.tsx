import React from "react";

interface TitleProps {
  children: React.ReactNode;
  variant?: "h1" | "h2" | "h3";
  className?: string;
}

export const Title = ({
  children,
  variant = "h1",
  className = "",
}: TitleProps) => {
  const styles = {
    h1: "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter text-emerald-500 leading-none",
    h2: "text-3xl md:text-5xl font-bold tracking-tight text-on-surface",
    h3: "font-headline font-bold text-on-surface text-base md:text-lg mb-1 md:mb-2",
  };

  const Component = variant;

  return (
    <Component className={`${styles[variant]} ${className}`}>
      {children}
    </Component>
  );
};
