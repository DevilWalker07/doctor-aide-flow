import type * as React from "react";
import type { ReactNode } from "react";

export function AuthShell({
  titulo,
  subtitulo,
  children,
  rodape,
}: {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* A logo do Medfluxo, não um ícone genérico de estetoscópio. */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <img
            src="/logo.png"
            alt="Medfluxo"
            className="h-20 w-20 rounded-3xl object-contain"
            width={80}
            height={80}
          />
          <p className="t-body text-muted-foreground">Assistente clínico de plantão</p>
        </div>

        <div className="bg-card border-border rounded-3xl border p-6 sm:p-8">
          <h1 className="t-display text-foreground">{titulo}</h1>
          <p className="t-body text-muted-foreground mt-1 mb-6">{subtitulo}</p>
          {children}
        </div>

        {rodape && <div className="t-body text-muted-foreground mt-6 text-center">{rodape}</div>}
      </div>
    </div>
  );
}

// 16 px não é estética: abaixo disso o Safari do iPhone dá zoom ao focar o
// campo, e a primeira coisa que o médico faz no app é digitar e-mail e senha.
export const authInputCls =
  "w-full min-h-[3rem] bg-secondary/40 border border-border rounded-xl px-4 py-3 text-base font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-colors";
export const authButtonCls =
  "w-full min-h-[3rem] rounded-2xl bg-primary text-primary-foreground text-base font-bold transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2";

/**
 * Campo de autenticação com rótulo de verdade.
 *
 * As quatro telas de conta usavam só `placeholder`: o rótulo desaparece assim
 * que o médico começa a digitar, e leitor de tela anuncia campo sem nome.
 */
export function AuthField({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="t-label text-muted-foreground">
        {label}
      </label>
      <input id={id} className={authInputCls} {...props} />
    </div>
  );
}
