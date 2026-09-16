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
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-3 mb-4 ml-1">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
            {icon}
          </div>
          <h2 className="text-[10px] font-black tracking-[0.2em] uppercase text-foreground">
            {title}
          </h2>
        </div>
        {right}
      </div>
      <div
        className={cn(
          "bg-white border border-border rounded-[2rem] p-5 sm:p-8 shadow-sm",
          className,
        )}
      >
        {children}
      </div>
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
        "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
        selected
          ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
          : "bg-white text-muted-foreground border-border hover:border-primary/40",
      )}
    >
      {label}
    </button>
  );
}
