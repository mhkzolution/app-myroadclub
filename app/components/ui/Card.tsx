import type { HTMLAttributes } from "react";
import { joinClasses } from "./classNames";

export function Card({
  as: Element = "div",
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: "div" | "section" }) {
  return (
    <Element
      className={joinClasses(
        "rounded-2xl border border-mrc-border bg-white p-4 shadow-sm md:p-5",
        className
      )}
      {...props}
    />
  );
}
