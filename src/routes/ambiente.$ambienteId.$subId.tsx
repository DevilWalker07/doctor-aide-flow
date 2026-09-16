import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { EmConstrucao } from "@/components/EmConstrucao";
import { getAmbiente, getSubAmbiente, type Ambiente, type SubAmbiente } from "@/lib/ambientes";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/ambiente/$ambienteId/$subId")({
  loader: ({ params }) => {
    const ambiente = getAmbiente(params.ambienteId);
    const sub = getSubAmbiente(params.ambienteId, params.subId);
    if (!ambiente || !sub) throw notFound();
    return { ambiente, sub };
  },
  component: SubAmbientePage,
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.sub.label ?? "Área"} — MEDFLUXO` }],
  }),
});

function SubAmbientePage() {
  const { ambiente, sub } = Route.useLoaderData() as { ambiente: Ambiente; sub: SubAmbiente };
  const nav = useNavigate();

  // Registra a escolha antes de sair: é o que alimenta o "Continuar em" do hub.
  useEffect(() => {
    try {
      storage.setUltimoAmbiente(ambiente.id, sub.id);
    } catch {
      /* storage bloqueado: a retomada simplesmente não aparece */
    }
    if (sub.implementado) {
      try {
        storage.setTipo(sub.tipoEvolucao);
      } catch {
        /* idem */
      }
      nav({
        to: "/iniciar-plantao",
        search: { ambiente: ambiente.id, sub: sub.id },
        replace: true,
      });
    }
  }, [ambiente, sub, nav]);

  if (sub.implementado) return null;
  return <EmConstrucao ambiente={ambiente} sub={sub} />;
}
