import { AlertTriangle, Check } from "lucide-react";
import { useState } from "react";
import { formatarNumero } from "../../../shared/pediatria/calculos";
import { KIT_INTUBACAO } from "../../../shared/pediatria/kits";
import { viaAereaPaciente, type ViaAerea } from "../../../shared/pediatria/viaAerea";
import { DoseRapida } from "./DoseRapida";
import type { Paciente } from "./Identificacao";
import { Laringoscopio, Tubo } from "./Ilustracoes";

const mm = (n: number) => formatarNumero(n, 1);

/**
 * O que se pega na bandeja para intubar: tubo com e sem cuff (diâmetro),
 * lâmina reta e curva (com o número de cada e qual usar), profundidade,
 * sonda de aspiração e máscara laríngea de resgate. Usado na aba IOT e na
 * gaveta de intubação do modo RCP.
 */
export function CartaoIot({ va }: { va: ViaAerea }) {
  return (
    <div className="grid gap-3" data-testid="ped-iot">
      {va.fonte === "peso" && (
        <p className="t-body text-foreground border-warning bg-warning/10 flex gap-2 rounded-2xl border p-3">
          <AlertTriangle className="text-warning h-5 w-5 shrink-0" aria-hidden="true" />
          Estimado pela faixa de peso da fita de ressuscitação. Informe a idade para usar a fórmula
          do PALS.
        </p>
      )}

      {/* tubo */}
      <section
        aria-labelledby="iot-tubo"
        className="bg-card border-border grid gap-3 rounded-3xl border p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 id="iot-tubo" className="t-title text-foreground">
            Tubo endotraqueal
          </h3>
          <Tubo diametro={va.tuboComCuff} className="h-14 w-24 shrink-0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="border-primary bg-primary/10 grid gap-0.5 rounded-2xl border-2 p-3">
            <span className="t-label text-primary">Com cuff · preferido</span>
            <span
              className="text-foreground text-4xl leading-none font-black tabular-nums"
              data-testid="iot-cuff"
            >
              {mm(va.tuboComCuff)}
              <span className="ml-1 text-lg font-bold">mm</span>
            </span>
            <span className="t-label text-muted-foreground">
              ter também {mm(va.tuboComCuff - 0.5)} e {mm(va.tuboComCuff + 0.5)}
            </span>
          </div>
          <div className="border-border grid gap-0.5 rounded-2xl border-2 p-3">
            <span className="t-label text-muted-foreground">Sem cuff</span>
            <span
              className="text-foreground text-4xl leading-none font-black tabular-nums"
              data-testid="iot-sem-cuff"
            >
              {mm(va.tuboSemCuff)}
              <span className="ml-1 text-lg font-bold">mm</span>
            </span>
            <span className="t-label text-muted-foreground">diâmetro interno</span>
          </div>
        </div>
        <p className="t-body text-foreground">
          Fixar em <strong className="tabular-nums">{mm(va.profundidadeCm)} cm</strong> na rima
          labial (3 × diâmetro do tubo com cuff). Pressão do cuff abaixo de 20–25 cmH₂O.
        </p>
      </section>

      {/* lâmina */}
      <section
        aria-labelledby="iot-lamina"
        className="bg-card border-border grid gap-3 rounded-3xl border p-4"
      >
        <h3 id="iot-lamina" className="t-title text-foreground">
          Lâmina do laringoscópio
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div
            className={`grid justify-items-center gap-1 rounded-2xl border-2 p-3 text-center ${
              va.laminaIndicada === "curva" ? "border-border" : "border-primary bg-primary/10"
            }`}
          >
            <Laringoscopio curva={false} className="h-16 w-24" />
            <span className="t-label text-muted-foreground">Reta (Miller)</span>
            <span
              className="text-foreground text-4xl leading-none font-black tabular-nums"
              data-testid="iot-lamina-reta"
            >
              {va.laminaReta}
            </span>
            {va.laminaIndicada === "reta" && <span className="t-label text-primary">Indicada</span>}
          </div>
          <div
            className={`grid justify-items-center gap-1 rounded-2xl border-2 p-3 text-center ${
              va.laminaCurva ? "border-primary bg-primary/10" : "border-border opacity-60"
            }`}
          >
            <Laringoscopio curva className="h-16 w-24" />
            <span className="t-label text-muted-foreground">Curva (Macintosh)</span>
            <span
              className="text-foreground text-4xl leading-none font-black tabular-nums"
              data-testid="iot-lamina-curva"
            >
              {va.laminaCurva ?? "—"}
            </span>
            {!va.laminaCurva && (
              <span className="t-label text-muted-foreground">Prefira a reta</span>
            )}
          </div>
        </div>
        <p className="t-label text-muted-foreground">
          {va.laminaCurva
            ? "Acima de 2 anos, reta ou curva conforme a experiência de quem intuba."
            : "Abaixo de 2 anos a epiglote é longa e mole: a lâmina reta levanta a epiglote direto."}
        </p>
      </section>

      {/* material */}
      <section
        aria-labelledby="iot-material"
        className="bg-card border-border grid gap-2 rounded-3xl border p-4"
      >
        <h3 id="iot-material" className="t-title text-foreground">
          Material
        </h3>
        <dl className="grid grid-cols-2 gap-3">
          <div className="bg-muted rounded-2xl p-3">
            <dt className="t-label text-muted-foreground">Sonda de aspiração</dt>
            <dd className="text-foreground text-2xl font-black tabular-nums">
              {va.aspiracaoFr} Fr
            </dd>
          </div>
          <div className="bg-muted rounded-2xl p-3">
            <dt className="t-label text-muted-foreground">Máscara laríngea (resgate)</dt>
            <dd className="text-foreground text-2xl font-black tabular-nums">
              {va.mascaraLaringea ? `nº ${va.mascaraLaringea}` : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {va.avisoNeonato && (
        <p className="t-body text-foreground flex gap-2">
          <AlertTriangle className="text-warning h-5 w-5 shrink-0" aria-hidden="true" />
          Neonato: escolha o tubo pelo peso e pela idade gestacional.
        </p>
      )}
    </div>
  );
}

const CHECKLIST = [
  "Oxigênio a 100% e pré-oxigenação",
  "Aspirador ligado, sonda de Yankauer",
  "Bolsa-válvula-máscara do tamanho certo",
  "Monitor: SpO₂, ECG, PA",
  "Acesso venoso ou intraósseo funcionando",
  "Drogas aspiradas e rotuladas",
  "Tubos (com e sem cuff) e fio-guia testados",
  "Plano B: máscara laríngea à mão",
  "Capnografia para confirmar o tubo",
];

export function Intubacao({ paciente }: { paciente: Paciente }) {
  const va = viaAereaPaciente(paciente.idade, paciente.peso);
  const [feitos, setFeitos] = useState<Set<number>>(() => new Set());
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid content-start gap-4">{va && <CartaoIot va={va} />}</div>
      <div className="grid content-start gap-4">
        <section
          aria-labelledby="iot-check"
          className="bg-card border-border grid gap-2 rounded-3xl border p-4"
        >
          <div className="flex items-center justify-between">
            <h2 id="iot-check" className="t-title text-foreground">
              Antes de intubar
            </h2>
            <span className="t-label text-muted-foreground tabular-nums">
              {feitos.size}/{CHECKLIST.length}
            </span>
          </div>
          <ul className="grid gap-1">
            {CHECKLIST.map((item, i) => (
              <li key={item}>
                <label className="t-body text-foreground hover:bg-accent flex min-h-12 items-center gap-3 rounded-2xl px-2">
                  <input
                    type="checkbox"
                    checked={feitos.has(i)}
                    onChange={(e) => {
                      const n = new Set(feitos);
                      if (e.target.checked) n.add(i);
                      else n.delete(i);
                      setFeitos(n);
                    }}
                    className="accent-primary h-5 w-5 shrink-0"
                  />
                  <span className={feitos.has(i) ? "text-muted-foreground line-through" : ""}>
                    {item}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {feitos.size === CHECKLIST.length && (
            <p className="t-body text-success flex items-center gap-2 font-semibold">
              <Check className="h-5 w-5" aria-hidden="true" /> Tudo pronto
            </p>
          )}
        </section>
        <section aria-labelledby="ped-sri" className="grid gap-3">
          <h2 id="ped-sri" className="t-title text-foreground">
            Sequência rápida de intubação
          </h2>
          <ul className="grid gap-3">
            {KIT_INTUBACAO.map((it) => (
              <DoseRapida key={it.droga.id} item={it} peso={paciente.peso} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
