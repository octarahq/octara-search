import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "hero" | "outline" | "ghost";
}

export const Button = ({
  children,
  variant = "hero",
  className = "",
  ...props
}: ButtonProps) => {
  const baseStyles =
    "px-6 py-2.5 md:px-8 md:py-3 rounded-xl font-bold tracking-tight transition-all scale-95 hover:scale-100 active:scale-95";

  const variants = {
    hero: "bg-emerald-500 text-on-primary shadow-xl shadow-primary/5 hover:shadow-primary/20",
    outline:
      "text-on-surface ring-1 ring-outline-variant/30 hover:ring-primary hover:text-primary bg-surface-container-high",
    ghost:
      "p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
