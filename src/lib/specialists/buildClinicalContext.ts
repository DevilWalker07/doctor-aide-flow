/**
 * Compilador de contexto clínico para envio aos especialistas virtuais.
 * Recebe o objeto paciente (em qualquer formato — PT ou EN) e produz
 * um documento texto estruturado contendo TODOS os dados disponíveis.
 *
 * O objetivo é dar à IA o quadro completo para ela analisar criticamente,
 * sem precisar inferir formatos.
 */

import { differenceInDays, parseISO, isValid, format } from "date-fns";

interface AnyPatient {
  [key: string]: any;
}

interface BuildOptions {
  evolutions?: Array<{ created_at: string; content: string }>;
  prescriptionContent?: any; // o conteúdo da última prescrição (se houver)
}

function pickStr(p: AnyPatient, keys: string[]): string | null {
  for (const k of keys) {
    const v = p?.[k];
    if (v != null && v !== "") return String(v);
  }
  return null;
}

function pickArr(p: AnyPatient, keys: string[]): any[] {
  for (const k of keys) {
    if (Array.isArray(p?.[k])) return p[k];
  }
  return [];
}

function pickObj(p: AnyPatient, keys: string[]): Record<string, any> {
  for (const k of keys) {
    if (p?.[k] && typeof p[k] === "object" && !Array.isArray(p[k])) return p[k];
  }
  return {};
}

function dia(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  if (!isValid(d)) return null;
  return differenceInDays(new Date(), d);
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return "DATA AUSENTE";
  const d = parseISO(dateStr);
  if (!isValid(d)) return dateStr;
  return format(d, "dd/MM/yyyy");
}

function textOf(item: any): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") return item.text || item.content || JSON.stringify(item);
  return String(item);
}

export function buildClinicalContext(
  patient: AnyPatient,
  options: BuildOptions = {}
): string {
  if (!patient) return "PACIENTE NÃO INFORMADO.";

  const out: string[] = [];
  out.push("CONTEXTO CLÍNICO COMPLETO");
  out.push("=========================");

  // IDENTIFICAÇÃO
  out.push("\nIDENTIFICAÇÃO:");
  out.push(`- Nome: ${pickStr(patient, ["nome", "name"]) || "DADO AUSENTE"}`);
  out.push(`- Idade: ${pickStr(patient, ["idade", "age"]) || "DADO AUSENTE"}`);
  out.push(`- Sexo: ${pickStr(patient, ["sexo", "sex"]) || "DADO AUSENTE"}`);
  const peso = pickStr(patient, ["peso", "weight"]);
  if (peso) out.push(`- Peso: ${peso} kg`);
  else out.push("- Peso: DADO AUSENTE");
  out.push(`- Leito: ${pickStr(patient, ["leito", "bed"]) || "DADO AUSENTE"}`);
  out.push(`- Setor: ${pickStr(patient, ["setor", "sector"]) || "DADO AUSENTE"}`);

  const admDate = pickStr(patient, ["data_admissao", "admission_date", "admissionDate"]);
  const dih = dia(admDate);
  out.push(`- Data de admissão: ${fmtDate(admDate)}${dih != null ? ` (DIH ${dih})` : ""}`);

  // MOTIVO + HDA
  out.push("\nMOTIVO DE ADMISSÃO / QUEIXA PRINCIPAL:");
  out.push(pickStr(patient, ["motivo_admissao", "reason_for_admission"]) || "DADO AUSENTE");

  const hda = pickStr(patient, ["hda"]);
  if (hda) {
    out.push("\nHISTÓRIA DA DOENÇA ATUAL (HDA):");
    out.push(hda);
  }

  // ANTECEDENTES
  const antecedentes = pickArr(patient, ["antecedentes_patologicos", "antecedentes", "comorbidades", "comorbidities"]);
  if (antecedentes.length) {
    out.push("\nANTECEDENTES PATOLÓGICOS:");
    antecedentes.forEach((a: any, i: number) => out.push(`  ${i + 1}. ${textOf(a)}`));
  }

  const alergias = pickArr(patient, ["alergias", "allergies"]);
  if (alergias.length) {
    out.push("\nALERGIAS:");
    alergias.forEach((a: any) => out.push(`  ⚠ ${textOf(a)}`));
  }

  // MEDICAÇÕES CONTÍNUAS (uso domiciliar / prévio)
  const medsCont = pickArr(patient, ["medicacoes_uso_continuo", "medications", "medicacoes"]);
  if (medsCont.length) {
    out.push("\nMEDICAÇÕES DE USO CONTÍNUO (prévias / domiciliares):");
    medsCont.forEach((m: any, i: number) => out.push(`  ${i + 1}. ${textOf(m)}`));
  }

  // LISTA DE PROBLEMAS
  const problemas = pickArr(patient, ["problemas_ativos", "problemList", "diagnoses", "lista_de_problemas", "problem_list"]);
  if (problemas.length) {
    out.push("\nLISTA DE PROBLEMAS ATIVOS:");
    problemas.forEach((p: any, i: number) => out.push(`  ${i + 1}. ${textOf(p)}`));
  }

  const problemasResolvidos = pickArr(patient, ["problemas_resolvidos"]);
  if (problemasResolvidos.length) {
    out.push("\nPROBLEMAS RESOLVIDOS:");
    problemasResolvidos.forEach((p: any) => out.push(`  - ${textOf(p)}`));
  }

  // ANTIBIÓTICOS — separa ativos de já finalizados/suspensos
  let atbs = pickArr(patient, ["antibioticos", "antibiotics"]);
  if (!atbs.length && Array.isArray(patient?.data?.abx)) atbs = patient.data.abx;
  if (atbs.length) {
    const ativos: any[] = [];
    const finalizados: any[] = [];
    for (const a of atbs) {
      const status = (a.status || "").toLowerCase();
      const fim = a.data_fim || a.dataFim || a.end_date;
      const fimPassado = fim ? new Date(`${fim}T00:00:00`).getTime() <= Date.now() : false;
      if (status === "finalizado" || status === "suspenso" || fimPassado) finalizados.push(a);
      else ativos.push(a);
    }

    if (ativos.length) {
      out.push("\nANTIBIÓTICOS EM USO:");
      ativos.forEach((a: any, i: number) => {
        const nome = a.nome || a.name || "ATB";
        const dose = a.dose || "";
        const via = a.via || "";
        const freq = a.frequencia || a.freq || "";
        const dInicio = a.data_inicio || a.dataInicio || a.d0;
        const d = dia(dInicio);
        const dDay = d != null ? `D${d + 1}` : "D?";
        out.push(`  ${i + 1}. ${nome} ${dose} ${via} ${freq} — ${dDay} (início ${fmtDate(dInicio)})`);
      });
    }

    if (finalizados.length) {
      out.push("\nANTIBIÓTICOS JÁ FINALIZADOS (histórico — não contar D-day):");
      finalizados.forEach((a: any, i: number) => {
        const nome = a.nome || a.name || "ATB";
        const dInicio = a.data_inicio || a.dataInicio || a.d0;
        const dFim = a.data_fim || a.dataFim || a.end_date;
        const motivo = (a.status || "").toLowerCase() === "suspenso" ? "suspenso" : "finalizado";
        out.push(`  ${i + 1}. ${nome} — ${motivo} (${fmtDate(dInicio)} → ${fmtDate(dFim) || "?"})`);
      });
    }
  }

  // PRESCRIÇÃO ATUAL DA INTERNAÇÃO
  const presc = options.prescriptionContent || pickObj(patient, ["prescricao_atual", "prescriptionContent"]);
  if (presc && Object.keys(presc).length) {
    out.push("\nPRESCRIÇÃO ATUAL DA INTERNAÇÃO:");
    if (presc.dieta) out.push(`- Dieta: ${presc.dieta}`);
    if (Array.isArray(presc.cuidados_gerais) && presc.cuidados_gerais.length) {
      out.push(`- Cuidados: ${presc.cuidados_gerais.join(", ")}`);
    }
    if (presc.sinais_vitais) out.push(`- Sinais vitais: ${presc.sinais_vitais}`);
    if (Array.isArray(presc.medicacoes_continuas) && presc.medicacoes_continuas.length) {
      out.push("- Medicações em curso:");
      presc.medicacoes_continuas.forEach((m: string) => out.push(`    · ${m}`));
    }
    if (Array.isArray(presc.sintomaticos) && presc.sintomaticos.length) {
      out.push(`- Sintomáticos: ${presc.sintomaticos.join(" | ")}`);
    }
    if (Array.isArray(presc.profilaxias) && presc.profilaxias.length) {
      out.push(`- Profilaxias: ${presc.profilaxias.join(" | ")}`);
    }
    if (presc.hidratacao && presc.hidratacao !== "Nenhuma") {
      out.push(`- Hidratação: ${presc.hidratacao}`);
    }
    if (Array.isArray(presc.exames) && presc.exames.length) {
      out.push(`- Exames solicitados: ${presc.exames.join(" | ")}`);
    }
  }

  // EXAME FÍSICO
  const exame = pickObj(patient, ["exame_fisico_detalhado", "exame_fisico", "physical_exam"]);
  if (exame && Object.keys(exame).length) {
    out.push("\nEXAME FÍSICO:");
    const sistemas = ["geral", "acv", "ar", "abdome", "neuro", "extremidades", "pele"];
    for (const s of sistemas) {
      if (exame[s]) out.push(`  ${s.toUpperCase()}: ${exame[s]}`);
    }
    // Campos UTI (VM, DVA, etc) — listar tudo que sobrou
    Object.entries(exame).forEach(([k, v]) => {
      if (!sistemas.includes(k) && v) out.push(`  ${k.toUpperCase()}: ${v}`);
    });
  }

  // LABORATÓRIOS — com tendência (raw + mapeado: data.labs_all / data.lab)
  let labs = pickArr(patient, ["laboratorios", "labs"]);
  if (!labs.length && Array.isArray(patient?.data?.labs_all)) {
    labs = patient.data.labs_all.map((l: any) => ({ data: l.data, texto_compacto: l.texto }));
  }
  if (!labs.length && patient?.data?.lab?.formatted) {
    labs = [{ data: patient.data.lab.date || null, texto_compacto: patient.data.lab.formatted }];
  }
  if (labs.length) {
    out.push("\nEXAMES LABORATORIAIS (ordem cronológica):");
    const sorted = [...labs].sort((a: any, b: any) => {
      const da = parseISO(a.data || a.date || "").getTime() || 0;
      const db = parseISO(b.data || b.date || "").getTime() || 0;
      return da - db;
    });
    sorted.forEach((l: any) => {
      const d = fmtDate(l.data || l.date);
      const v = l.texto_compacto || l.valor || l.text || "";
      out.push(`  [${d}] ${v}`);
    });
  }

  // EXAMES DE IMAGEM
  const imagens = pickArr(patient, ["exames_imagem"]);
  if (imagens.length) {
    out.push("\nEXAMES DE IMAGEM:");
    imagens.forEach((i: any) => {
      const d = fmtDate(i.data || i.date);
      const modalidade = i.modalidade || i.modality || "";
      const desc = i.descricao || i.description || "";
      const laudo = i.laudo || i.report || "";
      out.push(`  [${d}] ${modalidade} — ${desc}${laudo ? ` :: ${laudo}` : ""}`);
    });
  }

  // CONDUTAS REGISTRADAS
  const condutas = pickArr(patient, ["condutas", "conducts"]);
  if (condutas.length) {
    out.push("\nCONDUTAS REGISTRADAS:");
    condutas.forEach((c: any, i: number) => out.push(`  ${i + 1}. ${textOf(c)}`));
  }

  // EVOLUÇÕES
  const evs = options.evolutions || pickArr(patient, ["evolutions"]);
  if (evs.length) {
    out.push("\nEVOLUÇÕES (do mais antigo ao mais recente):");
    const sorted = [...evs].sort((a: any, b: any) => {
      const da = parseISO(a.created_at || a.data || "").getTime() || 0;
      const db = parseISO(b.created_at || b.data || "").getTime() || 0;
      return da - db;
    });
    sorted.forEach((e: any, i: number) => {
      const d = e.created_at ? fmtDate(e.created_at) : `EV ${i + 1}`;
      const content = e.content || "";
      out.push(`\n--- EVOLUÇÃO ${d} ---`);
      out.push(content);
    });
  }

  // PENDÊNCIAS
  const pendencias = pickArr(patient, ["pendencias", "pending_issues", "pendingIssues"]);
  if (pendencias.length) {
    out.push("\nPENDÊNCIAS EM ABERTO:");
    pendencias.forEach((p: any, i: number) => out.push(`  ${i + 1}. ${textOf(p)}`));
  }

  // ALERTAS
  const alertas = pickArr(patient, ["alertas", "alerts", "safety_alerts"]);
  if (alertas.length) {
    out.push("\nALERTAS / SINAIS DE ALARME:");
    alertas.forEach((a: any) => out.push(`  ⚠ ${textOf(a)}`));
  }

  return out.join("\n");
}
