import type { Patient, PatientData } from "../types/patient";
import { calcularHgtStats } from "./glicemia";
import { formatarLaboratorio } from "./laboratorio";
import { calcularCKDEPI2021, classificarDRC } from "./renal";

export function gerarEvolucaoLocal(patient: Patient, data: PatientData = patient.data || {}) {
  const creat = Number(String(data.lab?.raw?.Creatinina || data.lab?.raw?.Cr || "0").replace(",", "."));
  const tfge = calcularCKDEPI2021(creat, patient.age, patient.sex);
  const drc = classificarDRC(tfge);
  const hgt = calcularHgtStats([data.hgt?.h06, data.hgt?.h12, data.hgt?.h18, data.hgt?.h00]);
  const lab = data.lab?.formatted || formatarLaboratorio(data.lab?.raw || {});

  return `EVOLUÇÃO MÉDICA

#LISTA DE PROBLEMAS:
[ATIVOS]
1. ${data.conducta?.dx || patient.hda || "NÃO REFERIDO"}
[RESOLVIDOS]
1. NÃO REFERIDO

MEDICAÇÕES EM USO:
- ANTIBIÓTICO: ${data.abx?.length ? data.abx.map((a) => `${a.name} ${a.dose} ${a.via} ${a.freq}`).join("; ") : "NÃO REFERIDO"}
- SINTOMÁTICOS: NÃO REFERIDO
- PROFILAXIAS: NÃO REFERIDO
- USO CONTÍNUO: NÃO REFERIDO
- SE NECESSÁRIO: NÃO REFERIDO

#ADMISSÃO / HISTÓRIA DA DOENÇA ATUAL:
${patient.hda || "NÃO REFERIDO"}

#EVOLUÇÃO DIÁRIA:
${patient.currentStatus || "NÃO REFERIDO"}

#EXAME FÍSICO:
ECT: ${data.exam?.ect || "NÃO REFERIDO"}
ACV: ${data.exam?.acv || "NÃO REFERIDO"}
AR: ${data.exam?.ar || "NÃO REFERIDO"}
ABD: ${data.exam?.abd || "NÃO REFERIDO"}
EXT: ${data.exam?.ext || "NÃO REFERIDO"}

#EXAMES COMPLEMENTARES:
* LABORATÓRIO
${lab}
HGT: MÉDIA ${hgt.mean} / PICO ${hgt.peak} / NADIR ${hgt.nadir}
TFGe (CKD-EPI 2021): ${tfge || "NÃO CALCULADO"} ${drc.stage}

CONDUTAS:
${data.conducta?.condutas || "NÃO REFERIDO"}

PENDÊNCIAS:
${data.conducta?.pendencias || "NÃO REFERIDO"}

INTERCORRÊNCIAS:
${data.conducta?.intercorrencias || "NÃO REFERIDO"}`.toUpperCase();
}
