import { Document, Packer, Paragraph, TextRun } from "docx";
import { writeFileSync } from "fs";
import { jsPDF } from "jspdf";

async function generateDocx() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun("PACIENTE: MARIA DOCX TESTE"),
            new TextRun({ text: "IDADE: 60 ANOS", break: 1 }),
            new TextRun({ text: "LEITO: L05", break: 1 }),
            new TextRun({ text: "HDA: PACIENTE COM HISTORIA DE DISPNEIA AOS ESFORCOS.", break: 2 }),
            new TextRun({ text: "ALERGIAS: PENICILINA.", break: 1 }),
          ],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync("scratch/tests/test.docx", buffer);
  console.log("DOCX generated.");
}

async function generatePdf() {
  const doc = new jsPDF();
  doc.text("PACIENTE: CARLOS PDF TESTE", 10, 10);
  doc.text("IDADE: 52 ANOS", 10, 20);
  doc.text("SETOR: UTI CLINICA", 10, 30);
  doc.text("HDA: ADMITIDO POR INSUFICIENCIA RENAL AGUDA.", 10, 40);
  doc.text("CONDUTA: INICIAR HEMODIALISE.", 10, 50);
  doc.save("scratch/tests/test.pdf");
  // Wait, doc.save() in node might not work as expected with jsPDF without some tweaks, 
  // but usually it works if configured. Actually doc.output() is better for Node.
  const data = doc.output();
  writeFileSync("scratch/tests/test.pdf", data, "binary");
  console.log("PDF generated.");
}

generateDocx();
generatePdf();
