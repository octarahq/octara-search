import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: string;
  endContent?: React.ReactNode;
}

export const Input = ({
  startIcon,
  endContent,
  className = "",
  ...props
}: InputProps) => {
  return (
    <div className="w-full relative group max-w-3xl">
      <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-700"></div>
      <div className="relative bg-surface-container-low rounded-full flex items-center px-6 py-4 md:py-5 shadow-2xl ring-1 ring-outline-variant/30 hover:ring-primary/40 focus-within:ring-primary/60 transition-all duration-300">
        {startIcon && (
          <span
            className="material-symbols-outlined text-on-surface-variant mr-4"
            data-icon={startIcon}
          >
            {startIcon}
          </span>
        )}
        <input
          {...props}
          className={`bg-transparent border-none focus:ring-0 w-full text-lg md:text-xl text-on-surface placeholder:text-on-surface-variant/40 font-body ${className}`}
        />
        {endContent}
      </div>
    </div>
  );
};
