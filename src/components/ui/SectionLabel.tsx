interface SectionLabelProps {
  label: string;
  heading?: string;
  subheading?: string;
  align?: "left" | "center";
  action?: React.ReactNode;
}

export default function SectionLabel({
  label,
  heading,
  subheading,
  align = "left",
  action,
}: SectionLabelProps) {
  return (
    <div
      className={`flex items-end justify-between gap-4 ${
        align === "center" ? "flex-col text-center items-center" : ""
      }`}
    >
      <div>
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
          {label}
        </p>
        {heading && (
          <h2 className="font-display text-3xl md:text-4xl font-light text-[var(--foreground)] leading-tight">
            {heading}
          </h2>
        )}
        {subheading && (
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">{subheading}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
