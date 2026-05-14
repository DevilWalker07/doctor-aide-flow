import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { loadPendingExtraction } from "@/lib/documentExtractor";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/revisar-extracao")({
  component: RevisarExtracaoStub,
});

function RevisarExtracaoStub() {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const session = loadPendingExtraction();
    if (!session) {
      nav({ to: "/novo-paciente" });
    } else {
      setData(session);
    }
  }, [nav]);

  if (!data) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Revisar Extração</h1>
      <p className="text-muted-foreground mb-4">
        (Esta é uma tela temporária para a Etapa 1. Na próxima etapa, você verá a interface completa de revisão.)
      </p>
      
      <div className="bg-white border rounded-xl p-6 shadow-sm overflow-auto">
        <h2 className="font-bold mb-2">Arquivo: {data.fileName}</h2>
        <h3 className="font-bold mb-2">Motor: {data.engine}</h3>
        
        <pre className="text-xs bg-secondary p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(data.extracted, null, 2)}
        </pre>
      </div>

      <button 
        onClick={() => nav({ to: "/novo-paciente" })}
        className="mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-bold"
      >
        Voltar para Novo Paciente
      </button>
    </div>
  );
}
