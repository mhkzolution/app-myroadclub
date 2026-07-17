import type { ReactNode } from "react";

type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-semibold text-slate-600" htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-mrc-danger" aria-hidden>*</span>}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && <p id={hintId} className="mt-1.5 text-xs leading-5 text-mrc-muted">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm text-red-700">{error}</p>}
    </div>
  );
}
