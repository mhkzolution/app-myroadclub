import type { HTMLAttributes } from "react";
import { joinClasses } from "./classNames";

export function StatusBanner({
  tone,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone: "error" | "success" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={joinClasses(
        "rounded-xl border px-3 py-3 text-sm leading-5",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-green-200 bg-green-50 text-green-800",
        className
      )}
      {...props}
    />
  );
}
