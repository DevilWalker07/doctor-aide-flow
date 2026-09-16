import { describe, expect, it } from "vitest";
import {
  formatEncaminhamentoWhatsApp,
  formatOrientacoesWhatsApp,
  formatReceitaWhatsApp,
  horariosAtivos,
  unidadeLabel,
} from "../../src/lib/documentos/formatters";
import type { MedicoDocumento, ReceitaDocumento } from "../../src/lib/documentos/types";
import { montarEncaminhamento } from "../../src/lib/medical/encaminhamentoTemplates";
import {
  buscarMedicamentos,
  CLASSES_POR_ESPECIALIDADE,
  getMedicamento,
  HORARIOS,
  MEDICAMENTOS,
} from "../../src/lib/medical/medicamentos";
import { ORIENTACOES } from "../../src/lib/medical/orientacoes";

const medico: MedicoDocumento = {
  nome: "LUAN CARVALHO",
  crm: "12345-BA",
  especialidade: "CLÍNICA MÉDICA",
  hospital: "H",
};

describe("catálogo de medicamentos", () => {
  it("ids únicos, presets completos e horários válidos", () => {
    const ids = MEDICAMENTOS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const validos = new Set(HORARIOS.map((h) => h.id));
    for (const m of MEDICAMENTOS) {
      expect(m.presets.length, m.id).toBeGreaterThan(0);
      for (const p of m.presets) {
        expect(p.instrucao.length, `${m.id}/${p.id}`).toBeGreaterThan(10);
        expect(p.quantidade.length, `${m.id}/${p.id}`).toBeGreaterThan(0);
        for (const h of Object.keys(p.horarios))
          expect(validos.has(h as never), `${m.id}/${p.id}/${h}`).toBe(true);
      }
    }
  });
  it("busca sem acento e filtra por especialidade/classe/FP", () => {
    expect(buscarMedicamentos("espiro").map((m) => m.id)).toEqual(["espironolactona-25"]);
    expect(
      buscarMedicamentos("", { especialidade: "Endocrinologia", classe: "Insulina" }).every(
        (m) => m.classe === "Insulina",
      ),
    ).toBe(true);
    expect(buscarMedicamentos("", { farmaciaPopular: true }).every((m) => m.farmaciaPopular)).toBe(
      true,
    );
    expect(CLASSES_POR_ESPECIALIDADE["Cardiologia/Nefrologia"]).toContain("Diurético");
    expect(getMedicamento("losartana-50")?.presets[0].horarios).toEqual({ manha: 1 });
  });
});

describe("formatters WhatsApp", () => {
  const doc: ReceitaDocumento = {
    paciente: { nome: "JOSE", idade: "70", sexo: "M" },
    itens: [
      {
        id: "1",
        medicamentoId: "espironolactona-25",
        nome: "Espironolactona",
        apresentacao: "25 mg comprimido",
        dose: "25 mg",
        quantidade: "30 comprimidos",
        horarios: { manha: 1, noite: 2 },
        instrucao: "Tomar 1 comprimido pela manhã.",
        duracao: "Uso contínuo",
        observacao: "",
        acao: "comprimido",
        farmaciaPopular: true,
        controlado: null,
      },
    ],
    observacoes: "Retorno em 7 dias",
    vias: 1,
    data: "15/09/2026",
  };

  it("receita: cabeçalho, emojis de horário na ordem e badge FP", () => {
    const t = formatReceitaWhatsApp(doc, medico);
    const linhas = t.split("\n");
    expect(linhas[0]).toBe("💊 *RECEITA MÉDICA* — Dr(a). LUAN CARVALHO (CRM 12345-BA)");
    expect(t).toContain("🌅 Manhã: 1 comprimido  |  🌙 Noite: 2 comprimidos");
    expect(t).toContain("🏥 Disponível na Farmácia Popular");
    expect(t).toContain("📌 Retorno em 7 dias");
    expect(t.indexOf("🌅")).toBeLessThan(t.indexOf("🌙"));
  });
  it("unidadeLabel e horariosAtivos", () => {
    expect(unidadeLabel("comprimido", 1)).toBe("1 comprimido");
    expect(unidadeLabel("inalacao", 2)).toBe("2 jatos");
    expect(horariosAtivos({ noite: 1, manha: 2 }).map((h) => h.id)).toEqual(["manha", "noite"]);
  });
  it("orientações: ✅ itens e 🚨 sinais de alerta", () => {
    const t = formatOrientacoesWhatsApp(
      {
        paciente: { nome: "A" },
        orientacaoIds: ["diabetes"],
        extras: ["Beber água"],
        retorno: "UBS 7 dias",
        data: "15/09/2026",
      },
      medico,
    );
    expect(t).toContain("*CUIDADOS COM O DIABETES*");
    expect(t).toContain("✅ ");
    expect(t).toContain("🚨 ");
    expect(t).toContain("✅ Beber água");
    expect(t).toContain("🗓️ *Retorno:* UBS 7 dias");
  });
  it("encaminhamento: monta texto estruturado", () => {
    const texto = montarEncaminhamento(
      {
        destino: "Nefrologia",
        prioridade: "urgente",
        hipoteses: ["DRC 3"],
        resumoClinico: "HAS.",
        justificativa: "Piora renal.",
        exames: ["Creatinina / Ureia"],
        solicitacao: "",
      },
      { nome: "JOAO", idade: "58", sexo: "Masculino" },
      "15/09/2026",
    );
    expect(texto).toContain("Destino: Nefrologia");
    expect(texto).toContain("Prioridade: Urgente");
    expect(texto).toContain("- DRC 3");
    expect(texto).toContain("Solicito avaliação e conduta.");
    expect(
      formatEncaminhamentoWhatsApp(
        { paciente: { nome: "JOAO" }, form: {} as never, texto, data: "15/09/2026" },
        medico,
      ),
    ).toContain("📄 *ENCAMINHAMENTO MÉDICO*");
  });
});

describe("orientações", () => {
  it("ids únicos e frases curtas sem jargão excessivo", () => {
    const ids = ORIENTACOES.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of ORIENTACOES) for (const i of o.itens) expect(i.length, o.id).toBeLessThan(220);
  });
});
