import { forwardRef, type InputHTMLAttributes } from "react";
import { controlClasses, joinClasses } from "./classNames";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={joinClasses(controlClasses, className)} {...props} />;
  }
);
