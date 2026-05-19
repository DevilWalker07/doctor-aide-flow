import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, FlaskConical, Stethoscope, Settings2 } from "lucide-react";

/**
 * Navegação fixa no rodapé — só aparece em viewports mobile (md:hidden).
 *
 * Esconde automaticamente em rotas onde atrapalha (login/cadastro/chat,
 * que já tem seu próprio input no rodapé).
 *
 * Inclui safe-area-inset-bottom pro iPhone com home indicator.
 */

const HIDE_ON_PREFIXES = [
  "/login",
  "/cadastro",
  "/nova-senha",
  "/especialistas/", // tela de chat tem input fixo no rodapé
];

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  // matchPrefix: rota ativa se pathname começar com isso (default: igualdade)
  matchPrefix?: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/dashboard", label: "Plantão", icon: LayoutGrid },
  { href: "/lab-rapido", label: "Lab", icon: FlaskConical },
  { href: "/especialistas", label: "IAs", icon: Stethoscope, matchPrefix: true },
  { href: "/configuracoes", label: "Ajustes", icon: Settings2 },
];

export default function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (HIDE_ON_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
      aria-label="Navegação principal"
    >
      <ul className="grid grid-cols-5 max-w-md mx-auto">
        {ITEMS.map((item) => {
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
