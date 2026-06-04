import type { ClinicalFinding, PatientContext, ProtocolDefinition } from "./types";
import { HIPONATREMIA_GRAVE } from "./protocols/hiponatremia";

/**
 * Registry de protocolos ativos. PoC só com hiponatremia grave —
 * arquitetura suporta expandir pra 20+ sem mudar nada aqui.
 */
const PROTOCOLS: ProtocolDefinition[] = [
  HIPONATREMIA_GRAVE,
];

export function getProtocol(id: string): ProtocolDefinition | undefined {
  return PROTOCOLS.find((p) => p.id === id);
}

/**
 * Roda todos os protocolos contra o quadro do paciente e retorna achados.
 * Pura, síncrona, <1ms pra 20 protocolos.
 */
export function evaluateProtocols(ctx: PatientContext): ClinicalFinding[] {
  const findings: ClinicalFinding[] = [];
  const now = new Date().toISOString();

  for (const p of PROTOCOLS) {
    const t = p.trigger(ctx);
    if (!t.matched) continue;
    findings.push({
      id: `${p.id}_${Date.now()}`,
      protocol_id: p.id,
      severity: p.severity,
      title: p.title,
      evidence: t.evidence ?? "",
      problem_entry: p.problem_entry(ctx),
      detected_at: now,
    });
  }

  return findings;
}

/**
 * Parser do texto formatado dos labs (padrão Dr. Luan).
 * Aceita variações de espaçamento e separadores.
 *
 * Ex: "-LAB (18/05/26): HB 8.5 | HT 24 | LEUCO 12000 | NA 120 | K 4.2 | PCR 35"
 *
 * Retorna o objeto labs do PatientContext.
 */
export function parseLabFormatted(text: string | undefined | null): PatientContext["labs"] {
  if (!text || typeof text !== "string") return undefined;

  const labs: NonNullable<PatientContext["labs"]> = {};
  const upper = text.toUpperCase();

  // Helper: pega o primeiro numero (inteiro ou decimal com . ou ,)
  // após uma chave/sinônimo
  const grab = (keys: string[]): number | undefined => {
    for (const k of keys) {
      // Aceita "NA 120", "NA: 120", "NA=120", "NA  120,5", "NA 12.500"
      const re = new RegExp(`\\b${k}\\b[\\s:=]*([\\d]+[\\.,]?\\d*)`, "i");
      const m = upper.match(re);
      if (m && m[1]) {
        // Normaliza vírgula brasileira pra ponto decimal.
        // Pra "12.500" (milhar) o ponto fica como separador → vira 12.5
        // — então só convertemos vírgula. Pra valores >999 (leuco, plq)
        // separadores de milhar viram ponto sem decimal de fato.
        const raw = m[1];
        let num: number;
        if (raw.includes(",")) {
          num = parseFloat(raw.replace(/\./g, "").replace(",", "."));
        } else if (raw.includes(".") && raw.split(".")[1]?.length === 3) {
          // "12.500" sem vírgula = 12500 (separador de milhar)
          num = parseInt(raw.replace(/\./g, ""), 10);
        } else {
          num = parseFloat(raw);
        }
        if (!Number.isNaN(num)) return num;
      }
    }
    return undefined;
  };

  labs.sodio = grab(["NA", "SÓDIO", "SODIO"]);
  labs.potassio = grab(["K", "POTÁSSIO", "POTASSIO"]);
  labs.creatinina = grab(["CR", "CREATININA", "CREA"]);
  labs.ureia = grab(["UR", "UREIA"]);
  labs.hb = grab(["HB", "HEMOGLOBINA", "HGB"]);
  labs.leucocitos = grab(["LEUCO", "LEUCÓCITOS", "LEUCOCITOS"]);
  labs.plaquetas = grab(["PLQ", "PLAQUETAS", "PLT"]);
  labs.pcr = grab(["PCR"]);
  labs.lactato = grab(["LACTATO"]);
  labs.glicemia = grab(["GLI", "GLICEMIA"]);

  // Limpa undefineds
  const cleaned: NonNullable<PatientContext["labs"]> = {};
  for (const [k, v] of Object.entries(labs)) {
    if (v !== undefined) (cleaned as any)[k] = v;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/**
 * Builder do PatientContext a partir do objeto paciente do estado.
 *
 * Lida com 2 shapes (Supabase camelCase vs storage local pt-BR).
 */
export function buildContextFromPatient(patient: any): PatientContext {
  if (!patient) return {};

  const peso = parsePeso(patient.peso ?? patient.weight ?? patient.data?.peso);
  const sexo = patient.sexo ?? patient.sex;
  const idade = parseIdade(patient.idade ?? patient.age);

  // Lab: tenta `formatted` (texto Dr. Luan) primeiro, fallback pra
  // `valores` estruturado.
  const labText = patient.data?.lab?.formatted ?? patient.lab?.formatted;
  const labStruct = patient.data?.lab?.valores ?? patient.lab?.valores;
  const labs = parseLabFormatted(labText) ?? labStruct ?? undefined;

  const problemas = (patient.diagnoses || patient.problem_list || patient.lista_de_problemas || [])
    .map((p: any) => (typeof p === "string" ? p : p?.text ?? ""))
    .filter(Boolean);

  const antibioticos = (patient.antibioticos || patient.antibiotics || patient.data?.abx || [])
    .map((a: any) => ({
      nome: a.nome ?? a.name,
      data_inicio: a.data_inicio ?? a.dataInicio ?? a.d0,
      status: a.status,
    }));

  return { peso, sexo, idade, labs, problemas, antibioticos };
}

function parsePeso(v: any): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const m = String(v).match(/(\d+[\.,]?\d*)/);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function parseIdade(v: any): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return Math.trunc(v);
  const m = String(v).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : undefined;
}
