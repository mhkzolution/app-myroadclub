export function joinClasses(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export const controlClasses =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-mrc-text shadow-sm outline-none transition placeholder:text-slate-400 focus:border-mrc-cyan focus:ring-4 focus:ring-mrc-cyan/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-mrc-danger aria-[invalid=true]:ring-mrc-danger/15 md:text-sm";
