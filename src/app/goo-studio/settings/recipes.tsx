// Loading indicators shared by the Settings page and its cards. Buttons and
// fields come from the admin-wide recipes in ../_ui/recipes (docs/ADMIN_DESIGN.md 5.3).

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin ${className}`}
      aria-hidden="true"
    />
  );
}

export function LoadingLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Spinner className="text-[var(--foreground-subtle)]" />
      <p className="text-[11px] text-[var(--foreground-subtle)]">{label}</p>
    </div>
  );
}
