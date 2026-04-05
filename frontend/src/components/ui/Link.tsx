"use client";

import React, { useEffect, useState } from "react";
import NextLink from "next/link";

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  variant?: "nav" | "footer" | "primary" | "ghost";
  preserveHostLink?: boolean;
}

export const Link: React.FC<LinkProps> = ({
  children,
  className = "",
  variant = "ghost",
  href,
  preserveHostLink = false,
  ...props
}) => {
  const [finalHref, setFinalHref] = useState<string>(href);

  useEffect(() => {
    if (preserveHostLink && typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const parts = hostname.split(".");

      if (parts.length > 2) {
        const mainDomain = parts.slice(-2).join(".");
        setFinalHref(`${protocol}//${mainDomain}${href}`);
      } else {
        setFinalHref(href);
      }
    }
  }, [preserveHostLink, href]);

  const baseStyles = "transition-all duration-200 cursor-pointer";

  const variants = {
    nav: "text-sm font-medium text-on-surface-variant hover:text-primary",
    footer:
      "text-xs md:text-sm text-on-surface-variant hover:text-primary font-medium",
    primary: "text-primary font-bold hover:underline flex items-center gap-1",
    ghost: "text-on-surface-variant hover:text-primary",
  };

  const fullClassName = `${baseStyles} ${variants[variant]} ${className}`;

  if (preserveHostLink && finalHref.startsWith("http")) {
    return (
      <a href={finalHref} className={fullClassName} {...props}>
        {children}
      </a>
    );
  }

  return (
    <NextLink href={href} className={fullClassName} {...props}>
      {children}
    </NextLink>
  );
};
