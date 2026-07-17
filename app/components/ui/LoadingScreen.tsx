export function LoadingScreen({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex min-h-dvh flex-col items-center justify-center bg-white" role="status">
      <span className="size-11 animate-spin rounded-full border-4 border-slate-200 border-t-mrc-primary motion-reduce:animate-none" aria-hidden />
      <p className="mt-3.5 text-sm text-mrc-muted">{label}</p>
    </div>
  );
}
