import { forwardRef, type ButtonHTMLAttributes } from "react";
import { joinClasses } from "./classNames";

const variants = {
  primary: "bg-mrc-gradient-btn text-white shadow-[0_4px_14px_var(--mrc-shadow-primary)]",
  secondary: "border border-mrc-border bg-white text-mrc-text hover:border-mrc-primary",
  danger: "bg-mrc-danger text-white",
} as const;

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: keyof typeof variants;
    loading?: boolean;
  }
>(function Button(
  { variant = "primary", loading = false, disabled, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={joinClasses(
        "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30 disabled:cursor-not-allowed disabled:opacity-65",
        variants[variant],
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  );
});
