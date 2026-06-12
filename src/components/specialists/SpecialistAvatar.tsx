import type { ReactElement } from "react";
import type { SpecialistId } from "@/lib/specialists/types";

/**
 * Avatares SVG inline dos 5 especialistas virtuais.
 * Estilo: ilustração vetorial simples — rosto neutro + jaleco com cor distinta.
 * Sem dependência de imagem externa, escalável.
 */

interface Props {
  specialistId: SpecialistId;
  size?: number;
  className?: string;
}

const FACE_BASE = "#FBCFA9";
const HAIR_DARK = "#3B2A20";
const HAIR_LIGHT = "#6B4A2E";
const STETHOSCOPE = "#1F2937";

const AVATARS: Record<SpecialistId, (size: number) => ReactElement> = {
  victor: (size) => (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label="Dr. Victor">
      <defs>
        <linearGradient id="v-coat" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="46" fill="#EFF6FF" />
      {/* Jaleco */}
      <path d="M14 96 C 18 70, 30 64, 48 64 C 66 64, 78 70, 82 96 Z" fill="url(#v-coat)" />
      <path d="M48 64 L 44 96 L 52 96 L 48 64 Z" fill="#FFFFFF" opacity="0.85" />
      {/* Estetoscópio */}
      <path d="M36 66 Q 30 78, 38 84" stroke={STETHOSCOPE} strokeWidth="2.5" fill="none" />
      <circle cx="39" cy="86" r="3" fill={STETHOSCOPE} />
      {/* Pescoço */}
      <rect x="42" y="56" width="12" height="10" fill={FACE_BASE} />
      {/* Cabeça */}
      <circle cx="48" cy="42" r="18" fill={FACE_BASE} />
      {/* Cabelo */}
      <path d="M30 38 Q 32 24, 48 22 Q 64 24, 66 38 Q 60 32, 48 32 Q 36 32, 30 38 Z" fill={HAIR_DARK} />
      {/* Sobrancelhas — sérias */}
      <rect x="38" y="40" width="6" height="1.5" fill={HAIR_DARK} />
      <rect x="52" y="40" width="6" height="1.5" fill={HAIR_DARK} />
      {/* Olhos */}
      <circle cx="41" cy="44" r="1.5" fill="#1F2937" />
      <circle cx="55" cy="44" r="1.5" fill="#1F2937" />
      {/* Boca — neutra */}
      <path d="M43 52 L 53 52" stroke="#9B6B45" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  ana: (size) => (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label="Dra. Ana">
      <defs>
        <linearGradient id="a-coat" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#6B7280" />
          <stop offset="1" stopColor="#374151" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="46" fill="#F1F5F9" />
      <path d="M14 96 C 18 70, 30 64, 48 64 C 66 64, 78 70, 82 96 Z" fill="url(#a-coat)" />
      <path d="M48 64 L 44 96 L 52 96 L 48 64 Z" fill="#FFFFFF" opacity="0.85" />
      <path d="M36 66 Q 30 78, 38 84" stroke={STETHOSCOPE} strokeWidth="2.5" fill="none" />
      <circle cx="39" cy="86" r="3" fill={STETHOSCOPE} />
      <rect x="42" y="56" width="12" height="10" fill={FACE_BASE} />
      <circle cx="48" cy="42" r="18" fill={FACE_BASE} />
      {/* Cabelo longo preso */}
      <path d="M28 38 Q 26 22, 48 20 Q 70 22, 68 38 Q 70 52, 64 58 L 62 50 Q 60 38, 48 36 Q 36 38, 34 50 L 32 58 Q 26 52, 28 38 Z" fill={HAIR_DARK} />
      <rect x="38" y="40" width="6" height="1.2" fill={HAIR_DARK} />
      <rect x="52" y="40" width="6" height="1.2" fill={HAIR_DARK} />
      <circle cx="41" cy="44" r="1.5" fill="#1F2937" />
      <circle cx="55" cy="44" r="1.5" fill="#1F2937" />
      <path d="M44 52 L 52 52" stroke="#9B6B45" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  cris: (size) => (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label="Dra. Cris">
      <defs>
        <linearGradient id="c-coat" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#F472B6" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="46" fill="#FDF2F8" />
      <path d="M14 96 C 18 70, 30 64, 48 64 C 66 64, 78 70, 82 96 Z" fill="url(#c-coat)" />
      {/* Detalhe infantil — ursinho no jaleco */}
      <circle cx="64" cy="78" r="4" fill="#FBBF24" />
      <circle cx="62" cy="76" r="1.2" fill="#1F2937" />
      <circle cx="66" cy="76" r="1.2" fill="#1F2937" />
      <path d="M48 64 L 44 96 L 52 96 L 48 64 Z" fill="#FFFFFF" opacity="0.9" />
      <path d="M36 66 Q 30 78, 38 84" stroke={STETHOSCOPE} strokeWidth="2.5" fill="none" />
      <circle cx="39" cy="86" r="3" fill="#FBBF24" />
      <rect x="42" y="56" width="12" height="10" fill={FACE_BASE} />
      <circle cx="48" cy="42" r="18" fill={FACE_BASE} />
      {/* Cabelo curto cacheado */}
      <path d="M28 36 Q 30 20, 48 20 Q 66 20, 68 36 Q 64 28, 56 30 Q 48 24, 40 30 Q 32 28, 28 36 Z" fill={HAIR_LIGHT} />
      {/* Sobrancelhas alegres */}
      <path d="M38 41 Q 41 39, 44 41" stroke={HAIR_LIGHT} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M52 41 Q 55 39, 58 41" stroke={HAIR_LIGHT} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="41" cy="44" r="1.5" fill="#1F2937" />
      <circle cx="55" cy="44" r="1.5" fill="#1F2937" />
      {/* Sorriso */}
      <path d="M42 51 Q 48 56, 54 51" stroke="#9B3F58" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  ),
  bruno: (size) => (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label="Dr. Bruno">
      <defs>
        <linearGradient id="b-coat" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="46" fill="#ECFDF5" />
      <path d="M14 96 C 18 70, 30 64, 48 64 C 66 64, 78 70, 82 96 Z" fill="url(#b-coat)" />
      <path d="M48 64 L 44 96 L 52 96 L 48 64 Z" fill="#FFFFFF" opacity="0.85" />
      <path d="M36 66 Q 30 78, 38 84" stroke={STETHOSCOPE} strokeWidth="2.5" fill="none" />
      <circle cx="39" cy="86" r="3" fill={STETHOSCOPE} />
      <rect x="42" y="56" width="12" height="10" fill={FACE_BASE} />
      <circle cx="48" cy="42" r="18" fill={FACE_BASE} />
      {/* Cabelo raspado */}
      <path d="M30 38 Q 32 28, 48 26 Q 64 28, 66 38 Q 60 34, 48 34 Q 36 34, 30 38 Z" fill={HAIR_DARK} />
      {/* Sobrancelhas focadas */}
      <rect x="38" y="40" width="6" height="1.5" fill={HAIR_DARK} transform="rotate(-5 41 41)" />
      <rect x="52" y="40" width="6" height="1.5" fill={HAIR_DARK} transform="rotate(5 55 41)" />
      <circle cx="41" cy="44" r="1.5" fill="#1F2937" />
      <circle cx="55" cy="44" r="1.5" fill="#1F2937" />
      <path d="M43 52 L 53 52" stroke="#9B6B45" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  lucia: (size) => (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label="Dra. Lúcia">
      <defs>
        <linearGradient id="l-coat" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E5E7EB" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="46" fill="#F5F3FF" />
      <path d="M14 96 C 18 70, 30 64, 48 64 C 66 64, 78 70, 82 96 Z" fill="url(#l-coat)" stroke="#C7D2FE" strokeWidth="1" />
      {/* Pin violeta */}
      <circle cx="36" cy="78" r="2.5" fill="#A78BFA" />
      <path d="M48 64 L 44 96 L 52 96 L 48 64 Z" fill="#A78BFA" opacity="0.3" />
      <path d="M36 66 Q 30 78, 38 84" stroke="#A78BFA" strokeWidth="2.5" fill="none" />
      <circle cx="39" cy="86" r="3" fill="#A78BFA" />
      <rect x="42" y="56" width="12" height="10" fill={FACE_BASE} />
      <circle cx="48" cy="42" r="18" fill={FACE_BASE} />
      {/* Cabelo médio com franja */}
      <path d="M28 38 Q 28 22, 48 20 Q 68 22, 68 38 Q 66 32, 58 30 Q 48 28, 38 30 Q 30 32, 28 38 Z" fill={HAIR_LIGHT} />
      {/* Sobrancelhas suaves */}
      <path d="M38 41 Q 41 40, 44 41" stroke={HAIR_LIGHT} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M52 41 Q 55 40, 58 41" stroke={HAIR_LIGHT} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <circle cx="41" cy="44" r="1.5" fill="#1F2937" />
      <circle cx="55" cy="44" r="1.5" fill="#1F2937" />
      {/* Sorriso acolhedor */}
      <path d="M42 52 Q 48 55, 54 52" stroke="#9B6B45" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  ),
};

export function SpecialistAvatar({ specialistId, size = 64, className }: Props) {
  const renderer = AVATARS[specialistId];
  if (!renderer) return null;
  return <div className={className} style={{ width: size, height: size }}>{renderer(size)}</div>;
}

export default SpecialistAvatar;
