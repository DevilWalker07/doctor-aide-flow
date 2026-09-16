import { createFileRoute, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { EmConstrucao } from "@/components/EmConstrucao";
import { getLocal, type Local } from "@/lib/ambientes";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/local/$localId")({
  beforeLoad: ({ context, params, location }) => {
    const local = getLocal(params.localId);
    if (!local) throw notFound();

    // Abrir plantão mexe com dados de paciente, então aqui a conta é exigida.
    // O destino vai no `redirect` para o médico voltar a este local depois de
    // entrar, em vez de cair no dashboard e ter de escolher de novo.
    if (context.auth.configured && !context.auth.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  loader: ({ params }) => {
    const local = getLocal(params.localId);
    if (!local) throw notFound();
    return { local };
  },
  component: LocalPage,
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.local.label ?? "Local"} — MEDFLUXO` }],
  }),
});

function LocalPage() {
  const { local } = Route.useLoaderData() as { local: Local };
  const nav = useNavigate();

  useEffect(() => {
    // Registra a escolha antes de sair: alimenta o "Continuar em" do hub.
    try {
      storage.setUltimoAmbiente(local.id);
    } catch {
      /* storage bloqueado: a retomada simplesmente não aparece */
    }
    if (!local.implementado) return;

    try {
      storage.setTipo(local.tipoEvolucao);
    } catch {
      /* idem */
    }
    nav({ to: "/iniciar-plantao", search: { local: local.id }, replace: true });
  }, [local, nav]);

  if (local.implementado) return null;
  return <EmConstrucao local={local} />;
}
