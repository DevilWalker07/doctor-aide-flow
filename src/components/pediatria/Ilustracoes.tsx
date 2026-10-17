/**
 * Ilustrações da emergência pediátrica. Formas planas com a paleta `--ped-*`
 * de `src/styles.css` (redefinida no tema escuro) e os tokens do app — nada de
 * hex. Cada uma responde a uma pergunta clínica: quanto aspirar, que tubo,
 * que carga, qual o normal para a idade.
 */
import type { CSSProperties } from "react";
import type { Porte } from "@/lib/pediatria/porte";

const tinta = "var(--ped-tinta)";

// ───────────────────────────────────────────────────────────────── seringa

const GRADUACAO: Record<number, { passo: number; rotulo: number }> = {
  1: { passo: 0.1, rotulo: 0.5 },
  3: { passo: 0.1, rotulo: 1 },
  5: { passo: 0.2, rotulo: 1 },
  10: { passo: 0.5, rotulo: 2 },
  20: { passo: 1, rotulo: 5 },
  60: { passo: 2, rotulo: 10 },
};

/**
 * Seringa graduada que enche até `volumeMl`. Zero na ponta (direita), como a
 * seringa real; o êmbolo recua junto com o líquido e uma seta marca até onde
 * aspirar.
 */
export function Seringa({
  volumeMl,
  capacidadeMl,
  alerta = false,
  className = "",
}: {
  volumeMl: number;
  capacidadeMl: number;
  alerta?: boolean;
  className?: string;
}) {
  const x0 = 58;
  const x1 = 252;
  const L = x1 - x0;
  const yTopo = 22;
  const yBase = 54;
  const frac = Math.min(1, Math.max(0, volumeMl / capacidadeMl));
  const w = Math.max(frac > 0 ? 3 : 0, L * frac);
  const g = GRADUACAO[capacidadeMl] ?? { passo: capacidadeMl / 10, rotulo: capacidadeMl / 2 };
  const n = Math.round(capacidadeMl / g.passo);
  const marcas = Array.from({ length: n + 1 }, (_, i) => i * g.passo);
  const liquido = alerta ? "var(--warning)" : "var(--primary)";
  const nivel = x1 - w;
  return (
    <svg
      viewBox="0 0 310 76"
      className={className}
      role="img"
      aria-label={`Seringa de ${capacidadeMl} mL com ${volumeMl.toFixed(2).replace(".", ",")} mL`}
    >
      {/* êmbolo: haste, apoio do polegar e borracha seguem o nível */}
      <g className="ped-suave" style={{ transform: `translateX(${-w}px)` }}>
        <rect x="10" y="35" width={x1 - 22} height="6" rx="1.5" fill="var(--ped-metal)" />
        <rect x="4" y="18" width="8" height="40" rx="3" fill="var(--ped-metal)" />
        <rect
          x={x1 - 14}
          y={yTopo + 1.5}
          width="12"
          height={yBase - yTopo - 3}
          rx="2.5"
          fill={tinta}
        />
        <line
          x1={x1 - 10}
          x2={x1 - 10}
          y1={yTopo + 2}
          y2={yBase - 2}
          stroke="var(--ped-metal)"
          strokeWidth="1"
        />
        <line
          x1={x1 - 6}
          x2={x1 - 6}
          y1={yTopo + 2}
          y2={yBase - 2}
          stroke="var(--ped-metal)"
          strokeWidth="1"
        />
      </g>
      {/* corpo de vidro */}
      <rect
        x={x0}
        y={yTopo}
        width={L}
        height={yBase - yTopo}
        rx="5"
        fill="var(--ped-vidro)"
        fillOpacity="0.55"
      />
      <rect
        className="ped-suave"
        x={nivel}
        y={yTopo + 1}
        width={w}
        height={yBase - yTopo - 2}
        fill={liquido}
        fillOpacity="0.42"
      />
      <rect
        x={x0 + 4}
        y={yTopo + 4}
        width={L - 8}
        height="3"
        rx="1.5"
        fill="var(--card)"
        fillOpacity="0.7"
      />
      <rect
        x={x0}
        y={yTopo}
        width={L}
        height={yBase - yTopo}
        rx="5"
        fill="none"
        stroke={tinta}
        strokeOpacity="0.7"
        strokeWidth="1.6"
      />
      {/* aba do dedo */}
      <rect x={x0 - 8} y="10" width="8" height="56" rx="3" fill={tinta} fillOpacity="0.75" />
      {/* graduação: zero na ponta */}
      {marcas.map((v) => {
        const mx = x1 - (v / capacidadeMl) * L;
        const maior = Math.abs(v / g.rotulo - Math.round(v / g.rotulo)) < 1e-6;
        return (
          <g key={v}>
            <line
              x1={mx}
              x2={mx}
              y1={yTopo}
              y2={yTopo + (maior ? 10 : 5)}
              stroke={tinta}
              strokeOpacity="0.65"
              strokeWidth={maior ? 1.3 : 0.8}
            />
            {maior && v > 0 && (
              <text
                x={mx}
                y={yBase + 13}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={tinta}
                fillOpacity="0.7"
              >
                {String(Number(v.toFixed(2))).replace(".", ",")}
              </text>
            )}
          </g>
        );
      })}
      {/* bico, canhão colorido e agulha */}
      <path
        d={`M${x1} 31 h10 v14 h-10`}
        fill="var(--ped-vidro)"
        stroke={tinta}
        strokeOpacity="0.7"
        strokeWidth="1.4"
      />
      <rect x={x1 + 10} y="30" width="12" height="16" rx="2" fill="var(--warning)" />
      <path
        d={`M${x1 + 22} 37 H302 L306 38 L302 39 H${x1 + 22} Z`}
        fill="var(--ped-metal)"
        stroke={tinta}
        strokeOpacity="0.4"
        strokeWidth="0.6"
      />
      {/* seta "aspirar até aqui" */}
      {frac > 0 && (
        <g className="ped-suave" style={{ transform: `translateX(${nivel}px)` }}>
          <path d="M0 19 l-5 -8 h10 z" fill={liquido} />
        </g>
      )}
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────── criança

function Rosto({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const o = r * 0.36;
  return (
    <g>
      <circle cx={cx - o} cy={cy + r * 0.05} r={r * 0.09} fill={tinta} />
      <circle cx={cx + o} cy={cy + r * 0.05} r={r * 0.09} fill={tinta} />
      <circle
        cx={cx - o * 1.45}
        cy={cy + r * 0.38}
        r={r * 0.14}
        fill="var(--destructive)"
        fillOpacity="0.22"
      />
      <circle
        cx={cx + o * 1.45}
        cy={cy + r * 0.38}
        r={r * 0.14}
        fill="var(--destructive)"
        fillOpacity="0.22"
      />
      <path
        d={`M${cx - r * 0.2} ${cy + r * 0.38} q${r * 0.2} ${r * 0.2} ${r * 0.4} 0`}
        fill="none"
        stroke={tinta}
        strokeWidth={Math.max(1.4, r * 0.08)}
        strokeLinecap="round"
      />
    </g>
  );
}

const PORTE_NOME: Record<Porte, string> = {
  bebe: "bebê",
  pequeno: "pré-escolar",
  escolar: "escolar",
  adolescente: "adolescente",
};

/**
 * A criança muda de porte com o peso/idade digitados — bebê, pré-escolar,
 * escolar, adolescente. Serve de checagem: 25 kg num bebê salta aos olhos.
 */
export function Crianca({ porte, className = "" }: { porte: Porte; className?: string }) {
  const pele = "var(--ped-pele)";
  const sombra = "var(--ped-pele-sombra)";
  const roupa = "var(--ped-roupa)";
  const roupa2 = "var(--ped-roupa-escura)";
  const cabelo = "var(--ped-cabelo)";
  return (
    <svg
      viewBox="0 0 120 150"
      className={className}
      role="img"
      aria-label={`Ilustração: ${PORTE_NOME[porte]}`}
    >
      <ellipse cx="60" cy="143" rx="40" ry="5" fill={tinta} fillOpacity="0.08" />
      {porte === "bebe" && (
        <g key="bebe" className="ped-aparece">
          <ellipse cx="40" cy="132" rx="15" ry="9" fill={roupa2} />
          <ellipse cx="80" cy="132" rx="15" ry="9" fill={roupa2} />
          <circle cx="28" cy="134" r="6" fill={pele} />
          <circle cx="92" cy="134" r="6" fill={pele} />
          <path d="M34 128 C 30 96, 40 86, 60 86 C 80 86, 90 96, 86 128 Z" fill={roupa} />
          <rect x="52" y="112" width="16" height="8" rx="2" fill="var(--card)" fillOpacity="0.5" />
          <path
            d="M36 98 C 24 104, 22 112, 26 118"
            stroke={pele}
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M84 98 C 96 104, 98 112, 94 118"
            stroke={pele}
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="31" cy="60" r="7" fill={sombra} />
          <circle cx="89" cy="60" r="7" fill={sombra} />
          <circle cx="60" cy="58" r="30" fill={pele} />
          <path d="M54 30 q6 -8 12 0 q-4 -2 -6 4 q-2 -6 -6 -4z" fill={cabelo} />
          <Rosto cx={60} cy={58} r={30} />
        </g>
      )}
      {porte === "pequeno" && (
        <g key="pequeno" className="ped-aparece">
          <rect x="44" y="108" width="12" height="30" rx="5" fill={pele} />
          <rect x="64" y="108" width="12" height="30" rx="5" fill={pele} />
          <ellipse cx="49" cy="139" rx="9" ry="5" fill={roupa2} />
          <ellipse cx="71" cy="139" rx="9" ry="5" fill={roupa2} />
          <path d="M40 98 h40 v16 a4 4 0 0 1 -4 4 h-32 a4 4 0 0 1 -4 -4z" fill={roupa2} />
          <path d="M36 70 C 36 62, 84 62, 84 70 L 82 102 H 38 Z" fill={roupa} />
          <path
            d="M37 72 C 26 80, 24 92, 28 102"
            stroke={pele}
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M83 72 C 94 80, 96 92, 92 102"
            stroke={pele}
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="60" cy="40" r="25" fill={pele} />
          <path
            d="M35 38 C 36 16, 84 14, 85 38 C 78 28, 66 24, 60 26 C 52 24, 42 28, 35 38 Z"
            fill={cabelo}
          />
          <Rosto cx={60} cy={42} r={24} />
        </g>
      )}
      {porte === "escolar" && (
        <g key="escolar" className="ped-aparece">
          <rect x="46" y="100" width="12" height="38" rx="5" fill={roupa2} />
          <rect x="62" y="100" width="12" height="38" rx="5" fill={roupa2} />
          <ellipse cx="51" cy="140" rx="9" ry="4.5" fill={tinta} fillOpacity="0.8" />
          <ellipse cx="69" cy="140" rx="9" ry="4.5" fill={tinta} fillOpacity="0.8" />
          <path d="M40 58 C 40 52, 80 52, 80 58 L 78 104 H 42 Z" fill={roupa} />
          <path
            d="M41 60 C 32 72, 31 88, 33 100"
            stroke={pele}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M79 60 C 88 72, 89 88, 87 100"
            stroke={pele}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <rect x="55" y="44" width="10" height="10" fill={sombra} />
          <circle cx="60" cy="30" r="19" fill={pele} />
          <path
            d="M41 30 C 40 10, 80 8, 79 28 C 74 20, 64 17, 58 19 C 50 18, 44 22, 41 30 Z"
            fill={cabelo}
          />
          <Rosto cx={60} cy={32} r={18} />
        </g>
      )}
      {porte === "adolescente" && (
        <g key="adolescente" className="ped-aparece">
          <rect x="47" y="92" width="12" height="46" rx="5" fill={roupa2} />
          <rect x="61" y="92" width="12" height="46" rx="5" fill={roupa2} />
          <ellipse cx="52" cy="140" rx="9" ry="4.5" fill={tinta} fillOpacity="0.8" />
          <ellipse cx="68" cy="140" rx="9" ry="4.5" fill={tinta} fillOpacity="0.8" />
          <path d="M38 50 C 38 44, 82 44, 82 50 L 78 96 H 42 Z" fill={roupa} />
          <path
            d="M39 52 C 31 66, 30 82, 32 94"
            stroke={pele}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M81 52 C 89 66, 90 82, 88 94"
            stroke={pele}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <rect x="55" y="36" width="10" height="11" fill={sombra} />
          <ellipse cx="60" cy="24" rx="15" ry="17" fill={pele} />
          <path
            d="M44 24 C 42 4, 78 2, 76 22 C 72 14, 62 12, 56 13 C 50 13, 46 17, 44 24 Z"
            fill={cabelo}
          />
          <Rosto cx={60} cy={26} r={15} />
        </g>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────── via aérea

/** Tubo endotraqueal: linha radiopaca, cuff, balonete-piloto e marca de profundidade. */
export function Tubo({ diametro, className = "" }: { diametro: number; className?: string }) {
  const esp = 5 + diametro * 1.5;
  const trajeto = "M18 30 C 90 30, 140 34, 168 86";
  return (
    <svg
      viewBox="0 0 190 110"
      className={className}
      role="img"
      aria-label={`Tubo endotraqueal ${diametro} mm`}
    >
      <path
        d="M60 32 C 60 60, 40 70, 34 92"
        fill="none"
        stroke={tinta}
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      <ellipse
        cx="32"
        cy="98"
        rx="7"
        ry="9"
        fill="var(--primary)"
        fillOpacity="0.25"
        stroke="var(--primary)"
        strokeWidth="1.4"
      />
      <path
        d={trajeto}
        fill="none"
        stroke={tinta}
        strokeOpacity="0.35"
        strokeWidth={esp + 2.5}
        strokeLinecap="round"
      />
      <path
        d={trajeto}
        fill="none"
        stroke="var(--ped-vidro)"
        strokeWidth={esp}
        strokeLinecap="round"
      />
      <path d={trajeto} fill="none" stroke="var(--primary)" strokeWidth="1.6" />
      <ellipse
        cx="158"
        cy="68"
        rx={esp * 0.95}
        ry={esp * 1.7}
        transform="rotate(-32 158 68)"
        fill="var(--primary)"
        fillOpacity="0.28"
        stroke="var(--primary)"
        strokeWidth="1.4"
      />
      {[0, 1, 2].map((i) => (
        <line
          key={i}
          x1={96 + i * 12}
          x2={96 + i * 12}
          y1={30 - esp / 2 - 1}
          y2={30 + esp / 2 + 1}
          stroke={tinta}
          strokeOpacity="0.6"
          strokeWidth="1.2"
          transform={`rotate(${4 + i * 3} ${96 + i * 12} 30)`}
        />
      ))}
      <rect
        x="6"
        y={30 - esp / 2 - 4}
        width="16"
        height={esp + 8}
        rx="2"
        fill="var(--ped-metal)"
        stroke={tinta}
        strokeOpacity="0.4"
      />
    </svg>
  );
}

/** Laringoscópio com cabo serrilhado e lâmina reta (Miller) ou curva (Macintosh), lâmpada acesa. */
export function Laringoscopio({ curva, className = "" }: { curva: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 150 110"
      className={className}
      role="img"
      aria-label={curva ? "Lâmina curva" : "Lâmina reta"}
    >
      <rect
        x="14"
        y="30"
        width="26"
        height="76"
        rx="8"
        fill="var(--ped-metal)"
        stroke={tinta}
        strokeOpacity="0.35"
      />
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={i}
          x1="18"
          x2="36"
          y1={42 + i * 7}
          y2={42 + i * 7}
          stroke={tinta}
          strokeOpacity="0.25"
          strokeWidth="2"
        />
      ))}
      <rect x="12" y="22" width="30" height="12" rx="3" fill={tinta} fillOpacity="0.7" />
      {curva ? (
        <path
          d="M40 24 C 76 16, 112 26, 138 62 L 132 66 C 108 36, 78 28, 40 34 Z"
          fill="var(--ped-metal)"
          stroke={tinta}
          strokeOpacity="0.45"
        />
      ) : (
        <path
          d="M40 22 L 140 26 L 142 34 L 40 34 Z"
          fill="var(--ped-metal)"
          stroke={tinta}
          strokeOpacity="0.45"
        />
      )}
      <circle
        cx={curva ? 122 : 128}
        cy={curva ? 46 : 30}
        r="9"
        fill="var(--warning)"
        fillOpacity="0.3"
      />
      <circle cx={curva ? 122 : 128} cy={curva ? 46 : 30} r="4" fill="var(--warning)" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────── desfibrilador

/** Monitor-desfibrilador: traçado no visor, carga em joules, botões de carga e choque, pás adesivas. */
export function Desfibrilador({
  joules,
  carga,
  sincronizado = false,
  className = "",
}: {
  joules: number | null;
  /** 0 a 1 */
  carga: number;
  sincronizado?: boolean;
  className?: string;
}) {
  const c = Math.min(1, Math.max(0, carga));
  const ecg = sincronizado
    ? "M28 56 h12 l3 -3 l3 3 h4 l3 -24 l4 36 l3 -12 h8 l4 -5 l4 5 h10 l3 -24 l4 36 l3 -12 h8 l4 -5 l4 5 h10"
    : "M28 52 q4 -12 8 0 t8 0 t8 3 t8 -6 t8 8 t8 -8 t8 5 t8 -3 t8 3 t8 -5 t8 2";
  return (
    <svg
      viewBox="0 0 220 142"
      className={className}
      role="img"
      aria-label={`Desfibrilador${sincronizado ? " em modo sincronizado" : ""}${joules !== null ? ` em ${joules} joules` : ""}`}
    >
      <path
        d="M190 112 C 210 120, 206 134, 186 134"
        fill="none"
        stroke={tinta}
        strokeOpacity="0.4"
        strokeWidth="2"
      />
      <path
        d="M176 112 C 170 128, 150 136, 136 132"
        fill="none"
        stroke={tinta}
        strokeOpacity="0.4"
        strokeWidth="2"
      />
      <rect
        x="112"
        y="124"
        width="26"
        height="14"
        rx="4"
        fill="var(--card)"
        stroke={tinta}
        strokeOpacity="0.4"
      />
      <rect
        x="182"
        y="126"
        width="26"
        height="12"
        rx="4"
        fill="var(--card)"
        stroke={tinta}
        strokeOpacity="0.4"
      />
      <rect
        x="6"
        y="8"
        width="208"
        height="110"
        rx="16"
        fill="var(--card)"
        stroke={tinta}
        strokeOpacity="0.55"
        strokeWidth="2"
      />
      <rect x="18" y="20" width="124" height="86" rx="8" fill="var(--navy)" />
      <path
        d={ecg}
        fill="none"
        stroke="var(--success)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {sincronizado && (
        <g fill="var(--warning)">
          <path d="M71 26 l3 5 h-6z" />
          <path d="M124 26 l3 5 h-6z" />
        </g>
      )}
      <text
        x="80"
        y="94"
        textAnchor="middle"
        fontSize="22"
        fontWeight="800"
        fill="var(--warning)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {joules !== null ? `${joules} J` : "— J"}
      </text>
      {sincronizado && (
        <text x="136" y="34" textAnchor="end" fontSize="10" fontWeight="800" fill="var(--warning)">
          SINC
        </text>
      )}
      <rect x="154" y="22" width="48" height="8" rx="4" fill="var(--muted)" />
      <rect
        className="ped-suave"
        x="154"
        y="22"
        width={48 * c}
        height="8"
        rx="4"
        fill="var(--warning)"
      />
      <circle cx="166" cy="56" r="11" fill="var(--warning)" />
      <circle
        cx="192"
        cy="56"
        r="11"
        fill="var(--destructive)"
        className={c >= 1 ? "ped-batida" : ""}
      />
      <path d="M193 47 l-6 10 h5 l-2 8 l7 -11 h-5 z" fill="var(--destructive-foreground)" />
      <rect x="154" y="88" width="48" height="18" rx="6" fill={tinta} fillOpacity="0.08" />
      <text
        x="178"
        y="100"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill={tinta}
        fillOpacity={sincronizado ? 0.9 : 0.35}
      >
        SINC
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────── sinais vitais

/** Coração que bate na frequência dada (bpm), com aorta e artéria pulmonar. */
export function Coracao({ bpm, className = "" }: { bpm: number; className?: string }) {
  const estilo = { "--ped-ciclo": `${60 / Math.max(30, bpm)}s` } as CSSProperties;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <g className="ped-batida" style={estilo}>
        <path
          d="M30 16 C 30 6, 42 4, 45 12"
          fill="none"
          stroke="var(--destructive)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M23 18 V 8"
          stroke="var(--ped-roupa-escura)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M32 60 C 14 50, 6 40, 8 28 C 10 16, 22 12, 30 20 C 38 12, 54 14, 56 28 C 58 40, 50 50, 32 60 Z"
          fill="var(--destructive)"
        />
        <path
          d="M30 22 C 28 34, 32 44, 38 52"
          fill="none"
          stroke="var(--destructive-foreground)"
          strokeOpacity="0.35"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <ellipse
          cx="19"
          cy="28"
          rx="5"
          ry="3"
          fill="var(--card)"
          fillOpacity="0.4"
          transform="rotate(-30 19 28)"
        />
      </g>
    </svg>
  );
}

/** Pulmões que respiram na frequência dada (irpm), com traqueia anelada e brônquios. */
export function Pulmoes({ irpm, className = "" }: { irpm: number; className?: string }) {
  const estilo = { "--ped-ciclo": `${60 / Math.max(6, irpm)}s` } as CSSProperties;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <g className="ped-respira" style={estilo}>
        <path
          d="M27 20 C 14 18, 6 32, 6 48 C 6 58, 18 60, 26 54 C 29 52, 29 46, 29 40 Z"
          fill="var(--ped-roupa)"
        />
        <path
          d="M37 20 C 50 18, 58 32, 58 48 C 58 58, 46 60, 38 54 C 35 52, 35 46, 35 40 Z"
          fill="var(--ped-roupa)"
        />
        <path
          d="M14 40 q6 2 10 -2 M12 48 q8 2 14 -2 M50 40 q-6 2 -10 -2 M52 48 q-8 2 -14 -2"
          fill="none"
          stroke="var(--card)"
          strokeOpacity="0.5"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M32 2 V 24 M32 24 L 24 32 M32 24 L 40 32"
        fill="none"
        stroke={tinta}
        strokeOpacity="0.7"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {[6, 11, 16].map((y) => (
        <line key={y} x1="29" x2="35" y1={y} y2={y} stroke="var(--card)" strokeWidth="1.2" />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────── infusão

/** Bomba de seringa: o fluxo no equipo corre mais rápido quanto maior a vazão. */
export function BombaSeringa({
  vazao,
  fracao,
  className = "",
}: {
  vazao: number;
  fracao: number;
  className?: string;
}) {
  const ciclo = vazao > 0 ? Math.max(0.15, Math.min(6, 6 / vazao)) : 0;
  const estilo = { "--ped-ciclo": `${ciclo}s` } as CSSProperties;
  const cor = Math.min(1, Math.max(0, fracao) * 4);
  return (
    <svg viewBox="0 0 230 100" className={className} aria-hidden="true">
      <rect
        x="4"
        y="34"
        width="150"
        height="60"
        rx="12"
        fill="var(--card)"
        stroke={tinta}
        strokeOpacity="0.5"
        strokeWidth="2"
      />
      <rect x="16" y="46" width="64" height="26" rx="5" fill="var(--navy)" />
      <text
        x="48"
        y="64"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fill="var(--success)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {vazao > 0 ? vazao.toFixed(1).replace(".", ",") : "—"}
      </text>
      <text
        x="48"
        y="86"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill={tinta}
        fillOpacity="0.6"
      >
        mL/h
      </text>
      <circle cx="106" cy="58" r="7" fill="var(--success)" opacity={vazao > 0 ? 1 : 0.3} />
      <circle cx="132" cy="58" r="7" fill={tinta} fillOpacity="0.2" />
      <rect x="8" y="17" width="34" height="6" rx="2" fill="var(--ped-metal)" />
      <rect
        x="40"
        y="8"
        width="96"
        height="24"
        rx="4"
        fill="var(--ped-vidro)"
        stroke={tinta}
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <rect
        x="50"
        y="10"
        width="84"
        height="20"
        fill="var(--primary)"
        fillOpacity={0.12 + 0.5 * cor}
      />
      <rect x="44" y="10" width="8" height="20" rx="2" fill={tinta} fillOpacity="0.8" />
      <path
        d="M136 20 H158 C 180 20, 182 58, 226 58"
        fill="none"
        stroke="var(--border)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {vazao > 0 && (
        <path
          className="ped-fluxo"
          style={estilo}
          d="M136 20 H158 C 180 20, 182 58, 226 58"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="4 8"
        />
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────── botão RCP

/** Traçado de ECG que corre dentro do botão de RCP. */
export function TracadoEcg({ className = "" }: { className?: string }) {
  const d = "M0 22 H30 l4 -4 l4 4 h6 l4 -18 l5 32 l4 -14 h10 l4 -6 l5 6 H120";
  return (
    <svg viewBox="0 0 120 40" className={className} aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="ped-traco"
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
