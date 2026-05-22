import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, FlaskConical, Stethoscope, Settings2, LogIn } from "lucide-react";

/**
 * Navegação fixa no rodapé — só aparece em viewports mobile (md:hidden).
 *
 * Tem 2 modos:
 * - Logado (default): 5 abas — Início, Plantão, Lab, IAs, Ajustes
 * - Convidado (guest=true): 3 abas — Lab, IAs, Entrar
 *
 * Esconde em rotas onde atrapalha (chat tem input fixo no rodapé).
 * Inclui safe-area-inset-bottom pro iPhone com home indicator.
 */

const HIDE_ON_PREFIXES = [
  "/especialistas/", // tela de chat tem input fixo no rodapé
];

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  matchPrefix?: boolean;
}

const ITEMS_LOGGED: NavItem[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/dashboard", label: "Plantão", icon: LayoutGrid },
  { href: "/lab-rapido", label: "Lab", icon: FlaskConical },
  { href: "/especialistas", label: "IAs", icon: Stethoscope, matchPrefix: true },
  { href: "/configuracoes", label: "Ajustes", icon: Settings2 },
];

const ITEMS_GUEST: NavItem[] = [
  { href: "/lab-rapido", label: "Lab", icon: FlaskConical },
  { href: "/especialistas", label: "IAs", icon: Stethoscope, matchPrefix: true },
  { href: "/login", label: "Entrar", icon: LogIn },
];

export default function BottomNav({ guest = false }: { guest?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (HIDE_ON_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const items = guest ? ITEMS_GUEST : ITEMS_LOGGED;
  const cols = guest ? "grid-cols-3" : "grid-cols-5";

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
      aria-label="Navegação principal"
    >
      <ul className={`grid ${cols} max-w-md mx-auto`}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.matchPrefix
            ? pathname.startsWith(item.href)
            : pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                to={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 h-14 transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 2} />
                <span className={`text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
