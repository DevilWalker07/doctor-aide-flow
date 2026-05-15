import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/recuperar-senha")({
  component: RecuperarSenhaPage,
  head: () => ({ meta: [{ title: "Recuperar Senha - DOUTOR AJUDA" }] }),
});

function RecuperarSenhaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
      <div className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-[#1e293b]">Recuperar senha</h1>
        <p className="mt-3 text-sm leading-6 text-[#64748b]">
          A recuperacao de senha agora e feita pelo Clerk na tela de login.
        </p>
        <Link
          to="/login"
          className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white"
        >
          Ir para login
        </Link>
      </div>
    </div>
  );
}
