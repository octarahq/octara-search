import React from "react";

interface CardProps {
  title?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}

export const Card = ({ title, icon, children, className = "" }: CardProps) => {
  return (
    <div
      className={`bg-surface-container-low rounded-2xl p-4 md:p-5 text-left group hover:bg-surface-container-high transition-all duration-300 ring-1 ring-outline-variant/10 hover:ring-primary/20 ${className}`}
    >
      {icon && (
        <span
          className="material-symbols-outlined text-emerald-500 mb-2 md:mb-3 block"
          data-icon={icon}
        >
          {icon}
        </span>
      )}
      {title && (
        <h3 className="font-headline font-bold text-on-surface text-zinc-100 md:text-lg mb-1 md:mb-2">
          {title}
        </h3>
      )}
      <div className="text-xs md:text-sm text-on-surface-variant leading-relaxed">
        {children}
      </div>
    </div>
  );
};
