/**
 * Ilustrações da emergência pediátrica. Traço único, uma cor de preenchimento,
 * tudo em `currentColor` e tokens — funcionam nos dois temas. Cada uma
 * responde a uma pergunta clínica: quanto aspirar, que tubo, que carga.
 */
import type { CSSProperties } from "react";

/** Seringa que enche até `volumeMl` numa seringa de `capacidadeMl`. */
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
  const x0 = 44;
  const x1 = 204;
  const largura = x1 - x0;
  const frac = Math.min(1, Math.max(0, volumeMl / capacidadeMl));
  const w = Math.max(frac > 0 ? 2 : 0, largura * frac);
  const marcas = Array.from({ length: 11 }, (_, i) => x1 - (largura * i) / 10);
  const liquido = alerta ? "var(--warning)" : "var(--primary)";
  return (
    <svg
      viewBox="0 0 248 56"
      className={className}
      role="img"
      aria-label={`Seringa de ${capacidadeMl} mL com ${volumeMl.toFixed(2).replace(".", ",")} mL`}
    >
      {/* êmbolo: haste + borracha seguem o nível do líquido */}
      <g className="ped-suave" style={{ transform: `translateX(${-w}px)` }}>
        <rect
          x={x1 - 10}
          y="17"
          width="8"
          height="22"
          rx="2"
          fill="var(--foreground)"
          opacity="0.75"
        />
        <rect
          x="6"
          y="25"
          width={x1 - 14}
          height="6"
          rx="2"
          fill="var(--muted-foreground)"
          opacity="0.5"
        />
        <rect
          x="2"
          y="14"
          width="6"
          height="28"
          rx="2"
          fill="var(--muted-foreground)"
          opacity="0.7"
        />
      </g>
      <rect
        className="ped-suave"
        x={x1 - w}
        y="16"
        width={w}
        height="24"
        fill={liquido}
        fillOpacity="0.35"
      />
      {/* corpo */}
      <rect
        x={x0}
        y="14"
        width={largura}
        height="28"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x={x0 - 6} y="8" width="6" height="40" rx="2" fill="currentColor" opacity="0.8" />
      {marcas.map((mx, i) => (
        <line
          key={mx}
          x1={mx}
          x2={mx}
          y1="14"
          y2={i % 5 === 0 ? 24 : 20}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.55"
        />
      ))}
      {/* bico e agulha */}
      <path d={`M${x1} 22 h10 v12 h-10`} fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1={x1 + 10} y1="28" x2="246" y2="28" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Silhueta que cresce com o peso: checagem visual de plausibilidade. */
export function Crianca({ peso, className = "" }: { peso: number | null; className?: string }) {
  const p = peso && peso > 0 ? Math.min(peso, 60) : 10;
  const escala = 0.45 + 0.55 * Math.sqrt(p / 60);
  return (
    <svg viewBox="0 0 100 120" className={className} aria-hidden="true">
      <line
        x1="10"
        y1="116"
        x2="90"
        y2="116"
        stroke="var(--border)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g
        className="ped-suave"
        style={{ transform: `scale(${escala})`, transformOrigin: "50px 116px" }}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="50" cy="22" r="14" fill="var(--primary)" fillOpacity="0.15" />
        <path d="M50 38 v38" />
        <path d="M50 48 l-20 16 M50 48 l20 16" />
        <path d="M50 76 l-14 38 M50 76 l14 38" />
      </g>
    </svg>
  );
}

/** Tubo endotraqueal com cuff; a espessura acompanha o diâmetro. */
export function Tubo({ diametro, className = "" }: { diametro: number; className?: string }) {
  const esp = 4 + diametro * 1.6;
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden="true">
      <path
        d="M10 14 C 60 14, 92 24, 104 66"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.85"
        strokeWidth={esp}
        strokeLinecap="round"
        className="ped-suave"
      />
      <path
        d="M10 14 C 60 14, 92 24, 104 66"
        fill="none"
        stroke="var(--card)"
        strokeWidth={Math.max(1.5, esp - 5)}
        strokeLinecap="round"
      />
      <ellipse
        cx="96"
        cy="46"
        rx={esp * 0.9}
        ry={esp * 1.6}
        transform="rotate(-25 96 46)"
        fill="var(--primary)"
        fillOpacity="0.25"
        stroke="var(--primary)"
        strokeWidth="1.5"
      />
      <rect
        x="4"
        y={14 - esp / 2 - 3}
        width="10"
        height={esp + 6}
        rx="2"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

/** Laringoscópio: lâmina reta (Miller) ou curva (Macintosh). */
export function Laringoscopio({ curva, className = "" }: { curva: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden="true">
      <rect x="10" y="8" width="18" height="60" rx="6" fill="currentColor" opacity="0.8" />
      <path
        d={curva ? "M28 14 C 60 10, 92 22, 108 52" : "M28 14 L 108 18"}
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx={curva ? 104 : 106} cy={curva ? 46 : 18} r="4" fill="var(--warning)" />
    </svg>
  );
}

/** Desfibrilador com a carga no visor; a barra enche quando `carregando`. */
export function Desfibrilador({
  joules,
  carga,
  className = "",
}: {
  joules: number;
  /** 0 a 1 */
  carga: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 100"
      className={className}
      role="img"
      aria-label={`Desfibrilador em ${joules} joules`}
    >
      <rect
        x="6"
        y="10"
        width="148"
        height="82"
        rx="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <rect x="18" y="22" width="80" height="44" rx="6" fill="var(--navy)" />
      <text
        x="58"
        y="52"
        textAnchor="middle"
        fontSize="22"
        fontWeight="800"
        fill="var(--warning)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {joules} J
      </text>
      <rect x="18" y="74" width="80" height="8" rx="4" fill="var(--muted)" />
      <rect
        className="ped-suave"
        x="18"
        y="74"
        width={80 * Math.min(1, Math.max(0, carga))}
        height="8"
        rx="4"
        fill="var(--warning)"
      />
      <circle cx="126" cy="34" r="12" fill="var(--destructive)" fillOpacity="0.85" />
      <path d="M124 27 l-4 9 h6 l-3 8 l8-11 h-6 l3-6z" fill="var(--destructive-foreground)" />
      <rect x="114" y="56" width="24" height="10" rx="3" fill="currentColor" opacity="0.35" />
      <rect x="114" y="72" width="24" height="10" rx="3" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

/** Coração que bate na frequência dada (bpm). */
export function Coracao({ bpm, className = "" }: { bpm: number; className?: string }) {
  const estilo = { "--ped-ciclo": `${60 / Math.max(30, bpm)}s` } as CSSProperties;
  return (
    <svg viewBox="0 0 48 44" className={className} aria-hidden="true">
      <path
        className="ped-batida"
        style={estilo}
        d="M24 41 C 10 31, 2 23, 2 13 A 11 11 0 0 1 24 8 A 11 11 0 0 1 46 13 C 46 23, 38 31, 24 41 Z"
        fill="var(--destructive)"
        fillOpacity="0.85"
      />
    </svg>
  );
}

/** Pulmões que respiram na frequência dada (irpm). */
export function Pulmoes({ irpm, className = "" }: { irpm: number; className?: string }) {
  const estilo = { "--ped-ciclo": `${60 / Math.max(6, irpm)}s` } as CSSProperties;
  return (
    <svg viewBox="0 0 48 44" className={className} aria-hidden="true">
      <path
        d="M24 2 v14 M24 16 l-6 6 M24 16 l6 6"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <g className="ped-respira" style={estilo} fill="var(--primary)" fillOpacity="0.55">
        <path d="M18 14 C 8 14, 3 26, 4 38 C 5 42, 14 42, 19 38 L 20 20 Z" />
        <path d="M30 14 C 40 14, 45 26, 44 38 C 43 42, 34 42, 29 38 L 28 20 Z" />
      </g>
    </svg>
  );
}

/** Bomba de seringa: o fluxo no equipo corre mais rápido quanto maior a vazão. */
export function BombaSeringa({
  vazao,
  fracao,
  className = "",
}: {
  vazao: number;
  /** Quanto da seringa é droga pura (0 a 1) — pinta a cor da solução. */
  fracao: number;
  className?: string;
}) {
  const ciclo = vazao > 0 ? Math.max(0.15, Math.min(6, 6 / vazao)) : 0;
  const estilo = { "--ped-ciclo": `${ciclo}s` } as CSSProperties;
  return (
    <svg viewBox="0 0 220 90" className={className} aria-hidden="true">
      <rect
        x="4"
        y="30"
        width="132"
        height="54"
        rx="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="16" y="42" width="54" height="22" rx="4" fill="var(--navy)" />
      <text x="43" y="58" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--success)">
        {vazao > 0 ? vazao.toFixed(1).replace(".", ",") : "—"}
      </text>
      <circle cx="96" cy="53" r="6" fill="var(--success)" opacity={vazao > 0 ? 1 : 0.3} />
      <circle cx="116" cy="53" r="6" fill="currentColor" opacity="0.3" />
      {/* seringa sobre a bomba */}
      <rect
        x="20"
        y="8"
        width="96"
        height="18"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="34"
        y="10"
        width="80"
        height="14"
        fill="var(--primary)"
        fillOpacity={0.12 + 0.5 * Math.min(1, Math.max(0, fracao) * 4)}
      />
      <rect x="6" y="14" width="28" height="6" rx="2" fill="currentColor" opacity="0.5" />
      <path
        d="M116 17 H150 C 170 17, 172 50, 214 50"
        fill="none"
        stroke="var(--border)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {vazao > 0 && (
        <path
          className="ped-fluxo"
          style={estilo}
          d="M116 17 H150 C 170 17, 172 50, 214 50"
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
