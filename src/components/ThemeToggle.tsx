import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";

const ROTULOS = {
  light: { Icon: Sun, texto: "Tema claro", proximo: "escuro" },
  dark: { Icon: Moon, texto: "Tema escuro", proximo: "automático" },
  system: { Icon: Monitor, texto: "Tema automático", proximo: "claro" },
} as const;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, cycleTheme } = useTheme();
  const { Icon, texto, proximo } = ROTULOS[theme];

  return (
    <button
      type="button"
      onClick={cycleTheme}
      data-testid="theme-toggle"
      title={`${texto} — tocar para ${proximo}`}
      aria-label={`${texto}. Tocar para mudar para ${proximo}.`}
      className={`touch-target inline-flex items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${className}`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
