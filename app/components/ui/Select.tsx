import { forwardRef, type SelectHTMLAttributes } from "react";
import { controlClasses, joinClasses } from "./classNames";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select ref={ref} className={joinClasses(controlClasses, "pr-10", className)} {...props} />
    );
  }
);
