import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  icon,
  children,
  className,
  right,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <section className={cn("bg-card border-border rounded-3xl border p-5 sm:p-6", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-secondary text-muted-foreground flex h-10 w-10 items-center justify-center rounded-2xl">
            {icon}
          </div>
          <h2 className="t-title text-foreground">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Chip({
  label,
  selected,
  onClick,
  testid,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  testid?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      aria-pressed={selected}
      className={cn(
        "t-label inline-flex min-h-[2.75rem] items-center rounded-xl border px-3.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:border-primary/40",
      )}
    >
      {label}
    </button>
  );
}
