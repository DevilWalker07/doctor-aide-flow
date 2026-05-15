const fs = require('fs');
const { Document, Packer, Paragraph, TextRun } = require('docx');

const doc = new Document({
    sections: [{
        properties: {},
        children: [
            new Paragraph({
                children: [
                    new TextRun("PACIENTE: MANOEL PEDRO FILHO"),
                    new TextRun({
                        text: "\nLEITO: L03",
                        break: 1,
                    }),
                    new TextRun({
                        text: "\nHDA: Paciente idoso, hipertenso e diabético, admitido por quadro de dispneia progressiva aos esforços há 3 dias. Refere tosse produtiva com expectoração amarelada.",
                        break: 2,
                    }),
                    new TextRun({
                        text: "\nPROBLEMAS: IC Compensada, HAS, DM2.",
                        break: 2,
                    }),
                    new TextRun({
                        text: "\nMEDICAÇÕES: Losartana 50mg, Metformina 850mg.",
                        break: 2,
                    }),
                ],
            }),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("L03 - MANOEL PEDRO FILHO 26.04.docx", buffer);
    console.log("Document created successfully");
});
