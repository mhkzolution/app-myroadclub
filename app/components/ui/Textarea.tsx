import { forwardRef, type TextareaHTMLAttributes } from "react";
import { controlClasses, joinClasses } from "./classNames";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={joinClasses(controlClasses, "min-h-24 resize-y", className)}
      {...props}
    />
  );
});
