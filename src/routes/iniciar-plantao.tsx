import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ChevronLeft, ArrowRight, Calendar, Building2, Stethoscope, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isValid } from "date-fns";
import { z } from "zod";
import { createShift } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { getLocal } from "@/lib/ambientes";
import { storage } from "@/lib/storage";

import { ControlledInput } from "@/components/ui/controlled-input";

export const Route = createFileRoute("/iniciar-plantao")({
  component: IniciarPlantaoPage,
  validateSearch: z.object({ local: z.string().optional() }),
  head: () => ({ meta: [{ title: "Iniciar Plantão — MEDFLUXO" }] }),
});

function IniciarPlantaoPage() {
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const { local: localId } = Route.useSearch();
  const local = getLocal(localId);
  const setorPre = local?.label ?? null;
  const tipoPre = local?.tipoEvolucao ?? null;
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [hospital, setHospital] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const padrao = localStorage.getItem("da_hospital_padrao");
      if (padrao) setHospital(padrao);
    } catch (e) {
      console.error("Erro ao ler localStorage", e);
    }
  }, []);

  const handleContinue = async () => {
    if (!userId) {
      toast.error("Usuário não identificado");
      return;
    }
    if (saving) return;
    setSaving(true);

    const hospitalValue = hospital.trim() || "Unidade não informada";
    let displayDate = "Data não informada";
    try {
      if (data) {
        const dateObj = parseISO(data);
        if (isValid(dateObj)) {
          displayDate = format(dateObj, "dd/MM/yyyy");
        }
      }
    } catch (e) {
      console.error("Erro na formatação da data", e);
    }

    const destino = () => {
      if (tipoPre) {
        storage.setTipo(tipoPre);
        nav({ to: "/dashboard" });
      } else {
        nav({ to: "/tipo" });
      }
    };

    try {
      // Try Supabase first
      const shift = await createShift(
        {
          date: data || new Date().toISOString().slice(0, 10),
          hospital: hospitalValue,
          ...(setorPre ? { sector: setorPre, type: tipoPre ?? undefined } : {}),
        },
        userId,
      );

      // Sync to localStorage
      const localShift = {
        id: shift.id,
        data: shift.date,
        data_formatada: displayDate,
        hospital: shift.hospital,
        setor: shift.sector || setorPre,
        tipo: shift.type || tipoPre,
        status: "active",
        criado_em: new Date(shift.created_at).getTime(),
      };
      localStorage.setItem("da_shift_id", shift.id);
      localStorage.setItem("da_plantao_ativo", JSON.stringify(localShift));
      toast.success("Plantão iniciado com sucesso!");
      destino();
    } catch (err) {
      console.warn("Supabase indisponível, salvando offline.", err);
      toast.warning("Erro ao salvar plantão. Continuando offline.");

      // Fallback: save only to localStorage with temporary ID
      const tempId = "temp_" + Date.now();
      const localShift = {
        id: tempId,
        data: data || new Date().toISOString().slice(0, 10),
        data_formatada: displayDate,
        hospital: hospitalValue,
        setor: setorPre,
        tipo: tipoPre,
        status: "active",
        criado_em: Date.now(),
      };
      localStorage.setItem("da_shift_id", tempId);
      localStorage.setItem("da_plantao_ativo", JSON.stringify(localShift));
      destino();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <div className="bg-card border-border w-full max-w-md rounded-3xl border p-6 sm:p-8">
        <div className="text-center">
          <div className="bg-primary/10 text-primary mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
            <Stethoscope className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="t-display text-foreground">Iniciar plantão</h1>
          <p className="t-body text-muted-foreground mt-2">
            Dois campos e você está dentro. Dá para ajustar depois.
          </p>
          {setorPre && (
            <div
              className="bg-primary/10 text-primary t-label mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2"
              data-testid="shift-ambiente"
            >
              {local && <local.icon className="h-4 w-4" aria-hidden="true" />} {setorPre}
            </div>
          )}
        </div>

        <div className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="shift-date"
              className="t-label text-muted-foreground mb-1.5 flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" /> Data do plantão
            </label>
            <ControlledInput
              id="shift-date"
              type="date"
              value={data}
              onValueChange={setData}
              className="appearance-none"
            />
          </div>

          <div>
            <label
              htmlFor="hospital-name"
              className="t-label text-muted-foreground mb-1.5 flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" aria-hidden="true" /> Hospital ou unidade
            </label>
            <ControlledInput
              id="hospital-name"
              type="text"
              value={hospital}
              onValueChange={setHospital}
              placeholder="Ex.: Hospital Nair Alves de Souza"
            />
          </div>

          <button
            onClick={handleContinue}
            disabled={saving}
            data-testid="shift-submit"
            className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Abrindo plantão…
              </>
            ) : (
              <>
                Continuar <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </>
            )}
          </button>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="t-label text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Cancelar e voltar
          </Link>
        </div>
      </div>
    </div>
  );
}
