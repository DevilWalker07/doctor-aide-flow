import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, ChevronLeft, ChevronRight, FileUp, Keyboard, type LucideIcon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/novo-paciente")({
  component: NovoPacientePage,
  head: () => ({ meta: [{ title: "Novo paciente — MEDFLUXO" }] }),
});

type Situacao = "admissao" | "internado";

const SITUACOES: Array<{ id: Situacao; label: string; descricao: string }> = [
  { id: "admissao", label: "Admissão nova", descricao: "Paciente chegou agora" },
  { id: "internado", label: "Já internado", descricao: "Assumindo o leito de outro plantão" },
];

interface Opcao {
  label: string;
  descricao: string;
  icon: LucideIcon;
  testid: string;
  /** Quando ausente, a opção abre o formulário manual. */
  engine?: "vision" | "docling";
}

const OPCOES: Opcao[] = [
  {
    label: "Digitar os dados",
    descricao: "Formulário completo, sem depender da IA",
    icon: Keyboard,
    testid: "patient-card-manual",
  },
  {
    label: "Fotografar o prontuário",
    descricao: "Abre a câmera; a IA lê evolução, prescrição ou anotação",
    icon: Camera,
    testid: "patient-card-foto",
    engine: "vision",
  },
  {
    label: "Enviar arquivo",
    descricao: "PDF, DOCX ou imagem já salva no aparelho",
    icon: FileUp,
    testid: "patient-card-arquivo",
    engine: "docling",
  },
];

/**
 * Antes o cadastro passava por três telas de escolha em sequência:
 * /novo-paciente → /admissao-nova ou /paciente-internado → /cadastro-manual
 * ou /upload-ia. Eram três toques e três carregamentos para chegar a duas
 * ações reais — digitar ou enviar documento —, sendo que a diferença entre os
 * cinco caminhos era apenas dois parâmetros de busca. Agora é uma tela: a
 * situação do paciente é um seletor, não um passo.
 */
function NovoPacientePage() {
  const nav = useNavigate();
  const [situacao, setSituacao] = useState<Situacao>("admissao");

  const abrir = (opcao: Opcao) => {
    localStorage.setItem("da_tipo_admissao", situacao);
    if (opcao.engine) {
      nav({
        to: "/upload-ia",
        search: { tipo: situacao, engine: opcao.engine, patient_id: undefined },
      });
    } else {
      nav({ to: "/cadastro-manual", search: { tipo: situacao } as never });
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-5 sm:px-6">
        <Link
          to="/dashboard"
          aria-label="Voltar ao plantão"
          className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <span className="t-eyebrow text-muted-foreground">Novo paciente</span>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="t-display text-foreground">Como quer cadastrar?</h1>
          <p className="t-body text-muted-foreground mt-2">
            Qualquer caminho leva à mesma ficha — dá para completar depois.
          </p>
        </div>

        <section aria-labelledby="situacao-titulo">
          <h2 id="situacao-titulo" className="t-eyebrow text-muted-foreground">
            Situação do paciente
          </h2>
          <div
            role="radiogroup"
            aria-labelledby="situacao-titulo"
            className="bg-secondary mt-2 flex gap-1.5 rounded-2xl p-1.5"
          >
            {SITUACOES.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={situacao === s.id}
                onClick={() => setSituacao(s.id)}
                data-testid={`patient-situacao-${s.id}`}
                className={`focus-visible:ring-ring flex min-h-[3.5rem] flex-1 flex-col items-center justify-center rounded-xl px-2 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  situacao === s.id
                    ? "bg-card text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-base font-bold">{s.label}</span>
                <span className="t-label font-normal">{s.descricao}</span>
              </button>
            ))}
          </div>
        </section>

        <ul className="space-y-3">
          {OPCOES.map((o) => (
            <li key={o.testid}>
              <button
                onClick={() => abrir(o)}
                data-testid={o.testid}
                className="border-border bg-card hover:bg-secondary focus-visible:ring-ring flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="bg-secondary text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                  <o.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="t-title text-foreground">{o.label}</p>
                  <p className="t-body text-muted-foreground">{o.descricao}</p>
                </div>
                <ChevronRight
                  className="text-muted-foreground h-5 w-5 shrink-0"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
