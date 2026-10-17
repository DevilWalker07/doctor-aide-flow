import { AlertTriangle, Check, Copy, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatarMl, formatarNumero } from "../../../shared/pediatria/calculos";
import {
  DROGAS_INFUSAO,
  doseParaVazao,
  montarSeringa,
  seringaPreparada,
  textoPrescricao,
  unidadeBase,
  vazaoParaDose,
  type Diluente,
  type DrogaInfusao,
} from "../../../shared/pediatria/infusoes";
import { BombaSeringa } from "./Ilustracoes";

const lerNumero = (t: string) => {
  const n = Number(t.replace(",", "."));
  return t.trim() === "" || !Number.isFinite(n) ? 0 : n;
};
const txt = (n: number) => String(Number(n.toPrecision(4))).replace(".", ",");

type Modo = "montar" | "preparada";

function CalculadoraInfusao({ droga, peso }: { droga: DrogaInfusao; peso: number }) {
  const [modo, setModo] = useState<Modo>(droga.padrao ? "preparada" : "montar");
  const [doseTxt, setDoseTxt] = useState(txt(droga.faixa[0]));
  const [vazaoTxt, setVazaoTxt] = useState("2");
  const [totalMl, setTotalMl] = useState(droga.padrao?.totalMl ?? 50);
  const [drogaMlTxt, setDrogaMlTxt] = useState(txt(droga.padrao?.drogaMl ?? 1));
  const [apresTxt, setApresTxt] = useState(txt(droga.apresentacao));
  const [diluente, setDiluente] = useState<Diluente>("SF 0,9%");
  const [copiado, setCopiado] = useState(false);

  const base = unidadeBase(droga.unidade);
  const apres = lerNumero(apresTxt);
  const apresAlterada = apres !== droga.apresentacao;
  const dose = lerNumero(doseTxt);

  // No modo "seringa preparada" a concentração é fixa: a dose define a vazão.
  const seringa =
    modo === "montar"
      ? montarSeringa(droga, apres, dose, peso, lerNumero(vazaoTxt), totalMl)
      : seringaPreparada(apres, lerNumero(drogaMlTxt), totalMl);
  const vazao =
    modo === "montar"
      ? lerNumero(vazaoTxt)
      : vazaoParaDose(dose, peso, droga.unidade, seringa.concentracao);
  const porMlH = doseParaVazao(1, peso, droga.unidade, seringa.concentracao);
  const foraDaFaixa = dose > 0 && (dose < droga.faixa[0] || dose > droga.faixa[1]);

  const prescricao = seringa.invalida
    ? null
    : textoPrescricao({
        droga,
        apresentacaoTexto: apresAlterada ? `${txt(apres)} ${base}/mL` : droga.apresentacaoTexto,
        seringa,
        vazao,
        dose,
        diluente,
      });

  const copiar = async () => {
    if (!prescricao) return;
    try {
      await navigator.clipboard.writeText(prescricao);
      setCopiado(true);
      toast.success("Prescrição copiada");
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie à mão.");
    }
  };

  const campo =
    "border-input bg-input-bg text-foreground focus-visible:ring-ring h-12 w-full rounded-2xl border px-4 text-lg font-bold tabular-nums focus-visible:ring-2 focus-visible:outline-none";
  const passos = 200;
  const pos = Math.round(
    ((Math.min(Math.max(dose, droga.faixa[0]), droga.faixa[1]) - droga.faixa[0]) /
      (droga.faixa[1] - droga.faixa[0])) *
      passos,
  );

  return (
    <div className="grid gap-5">
      <div className="bg-muted flex rounded-2xl p-1" role="group" aria-label="Como calcular">
        {(
          [
            ["montar", "Montar a seringa"],
            ["preparada", "Seringa já preparada"],
          ] as const
        ).map(([m, rotulo]) => (
          <button
            key={m}
            type="button"
            aria-pressed={modo === m}
            onClick={() => setModo(m)}
            className={`touch-target t-label flex-1 rounded-xl px-3 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none ${
              modo === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        <label htmlFor="ped-inf-dose" className="t-label text-muted-foreground">
          Dose ({droga.unidade}) · habitual {txt(droga.faixa[0])} a {txt(droga.faixa[1])}
        </label>
        <input
          id="ped-inf-dose"
          data-testid="ped-inf-dose"
          inputMode="decimal"
          value={doseTxt}
          onChange={(e) => setDoseTxt(e.target.value)}
          className={campo}
        />
        <input
          type="range"
          min={0}
          max={passos}
          value={pos}
          aria-label="Ajustar dose dentro da faixa habitual"
          onChange={(e) => {
            const v =
              droga.faixa[0] +
              (Number(e.target.value) / passos) * (droga.faixa[1] - droga.faixa[0]);
            setDoseTxt(txt(v));
          }}
          className="accent-primary h-11 w-full"
        />
        {foraDaFaixa && (
          <p className="t-body text-foreground flex gap-2">
            <AlertTriangle className="text-warning h-5 w-5 shrink-0" aria-hidden="true" />
            Fora da faixa habitual. Confira a dose.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {modo === "montar" ? (
          <label className="grid gap-1">
            <span className="t-label text-muted-foreground">Vazão desejada (mL/h)</span>
            <input
              data-testid="ped-inf-vazao"
              inputMode="decimal"
              value={vazaoTxt}
              onChange={(e) => setVazaoTxt(e.target.value)}
              className={campo}
            />
          </label>
        ) : (
          <label className="grid gap-1">
            <span className="t-label text-muted-foreground">Droga na seringa (mL)</span>
            <input
              inputMode="decimal"
              value={drogaMlTxt}
              onChange={(e) => setDrogaMlTxt(e.target.value)}
              className={campo}
            />
          </label>
        )}
        <label className="grid gap-1">
          <span className="t-label text-muted-foreground">Volume total (mL)</span>
          <select
            value={totalMl}
            onChange={(e) => setTotalMl(Number(e.target.value))}
            className={campo}
          >
            {[10, 20, 50, 60, 100].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="t-label text-muted-foreground">Apresentação ({base}/mL)</span>
          <input
            inputMode="decimal"
            value={apresTxt}
            onChange={(e) => setApresTxt(e.target.value)}
            className={campo}
          />
        </label>
        <label className="grid gap-1">
          <span className="t-label text-muted-foreground">Diluente</span>
          <select
            value={diluente}
            onChange={(e) => setDiluente(e.target.value as Diluente)}
            className={campo}
          >
            <option>SF 0,9%</option>
            <option>SG 5%</option>
          </select>
        </label>
      </div>
      {apresAlterada && (
        <p className="t-label text-warning-foreground bg-warning/30 rounded-xl px-3 py-2">
          Apresentação alterada — o padrão é {droga.apresentacaoTexto}.
        </p>
      )}

      <div
        className="bg-card border-primary/40 grid gap-3 rounded-3xl border p-4"
        aria-live="polite"
      >
        {seringa.invalida ? (
          <p className="t-body text-foreground flex gap-2">
            <AlertTriangle className="text-warning h-5 w-5 shrink-0" aria-hidden="true" />
            {modo === "montar"
              ? "Não cabe na seringa: aumente a vazão ou o volume total."
              : "Informe quanto de droga vai na seringa."}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div className="grid gap-1">
                <p className="t-label text-muted-foreground">Preparo</p>
                <p className="t-body text-foreground tabular-nums" data-testid="ped-inf-preparo">
                  <strong className="text-primary text-2xl">
                    {formatarMl(seringa.drogaMl)} mL
                  </strong>{" "}
                  de {droga.nome.toLowerCase()} +{" "}
                  <strong>{formatarMl(seringa.diluenteMl)} mL</strong> de {diluente}
                </p>
                <p className="t-label text-muted-foreground tabular-nums">
                  = {formatarNumero(seringa.concentracao, 3)} {base}/mL
                </p>
              </div>
              <BombaSeringa
                vazao={vazao}
                fracao={seringa.drogaMl / seringa.totalMl}
                className="text-foreground/70 h-20 w-36"
              />
            </div>
            <p className="t-body text-foreground tabular-nums" data-testid="ped-inf-vazao-final">
              Correr a{" "}
              <strong className="text-primary text-2xl">{formatarNumero(vazao, 1)} mL/h</strong>
            </p>
            <p className="t-label text-muted-foreground tabular-nums">
              Para titular: cada 1 mL/h = {formatarNumero(porMlH, 3)} {droga.unidade}
            </p>
          </>
        )}
      </div>

      {prescricao && (
        <div className="grid gap-2">
          <p className="t-label text-muted-foreground">Texto de prescrição</p>
          <p
            className="t-body text-foreground bg-muted rounded-2xl p-3 select-all"
            data-testid="ped-inf-prescricao"
          >
            {prescricao}
          </p>
          <button
            type="button"
            onClick={copiar}
            className="touch-target border-border text-foreground hover:bg-accent focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-2xl border font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {copiado ? (
              <Check className="text-success h-5 w-5" aria-hidden="true" />
            ) : (
              <Copy className="h-5 w-5" aria-hidden="true" />
            )}
            {copiado ? "Copiado" : "Copiar prescrição"}
          </button>
        </div>
      )}

      {droga.notas && (
        <ul className="grid gap-2">
          {droga.notas.map((n) => (
            <li key={n} className="t-label text-muted-foreground flex gap-2">
              <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Infusoes({ peso }: { peso: number }) {
  const [id, setId] = useState(DROGAS_INFUSAO[0].id);
  const droga = DROGAS_INFUSAO.find((d) => d.id === id) ?? DROGAS_INFUSAO[0];
  return (
    <section aria-label="Infusões contínuas" className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:content-start lg:px-0"
        role="group"
        aria-label="Escolha a droga"
      >
        {DROGAS_INFUSAO.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={d.id === id}
            onClick={() => setId(d.id)}
            className={`touch-target t-label shrink-0 rounded-full border px-4 text-left focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none lg:rounded-2xl ${
              d.id === id
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border"
            }`}
          >
            {d.nome}
          </button>
        ))}
      </div>
      <div className="bg-card border-border rounded-3xl border p-4">
        <h2 className="t-title text-foreground mb-4">
          {droga.nome}{" "}
          <span className="t-label text-muted-foreground font-medium">
            {droga.apresentacaoTexto}
          </span>
        </h2>
        {/* key: ao trocar de droga a calculadora recomeça com os padrões dela */}
        <CalculadoraInfusao key={droga.id} droga={droga} peso={peso} />
      </div>
    </section>
  );
}
