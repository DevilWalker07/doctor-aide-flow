import { ChevronRight } from "lucide-react";
import {
  ESPECIALISTAS,
  ESPECIALISTA_IDS,
  type Especialista,
  type EspecialistaId,
} from "../../../shared/especialistas";
import { EspecialistaAvatar } from "./EspecialistaAvatar";

interface Props {
  /** Aparece primeiro, com selo. Só sugestão — os cinco ficam disponíveis. */
  sugerido?: EspecialistaId;
  onEscolher: (id: EspecialistaId) => void;
}

/**
 * Escolha do especialista antes de perguntar.
 *
 * É consultar um colega: você olha quem é, o que ele faz e como responde, e
 * então pergunta. Antes eram quatro rótulos num seletor, sem nome e sem cara —
 * escolher "Pediatria" não é a mesma coisa que chamar a Dra. Cris.
 */
export function EspecialistaPicker({ sugerido, onEscolher }: Props) {
  const ordem = sugerido
    ? [sugerido, ...ESPECIALISTA_IDS.filter((id) => id !== sugerido)]
    : ESPECIALISTA_IDS;

  return (
    <div className="space-y-3" data-testid="especialista-picker">
      <div>
        <h2 className="t-title text-foreground">Com quem você quer falar?</h2>
        <p className="t-body text-muted-foreground mt-1">
          Todos respondem sobre qualquer assunto — a especialidade muda o enquadramento, não o que
          dá para perguntar.
        </p>
      </div>

      <ul className="space-y-2.5">
        {ordem.map((id) => {
          const e: Especialista = ESPECIALISTAS[id];
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onEscolher(id)}
                data-testid={`especialista-${id}`}
                className="border-border bg-card hover:bg-secondary focus-visible:ring-ring flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <EspecialistaAvatar especialistaId={id} size={52} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="t-title text-foreground">{e.nome}</span>
                    <span className="t-label text-muted-foreground font-normal">{e.titulo}</span>
                    {id === sugerido && (
                      <span className="t-label text-primary bg-primary/10 rounded-md px-1.5 font-normal">
                        seu setor
                      </span>
                    )}
                  </div>
                  <p className="t-body text-muted-foreground">{e.saudacao}</p>
                  <p className="t-label text-muted-foreground mt-0.5 font-normal">
                    {e.bases.join(" · ")}
                  </p>
                </div>
                <ChevronRight
                  className="text-muted-foreground h-5 w-5 shrink-0"
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
