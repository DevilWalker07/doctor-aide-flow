export const RACIOCINIO_INTERNO = `
RACIOCÍNIO (interno)
Antes de preencher os campos, escreva na chave "_raciocinio" (PRIMEIRA chave do JSON, máx. 80 palavras) : 1) que pacientes/leitos identificou; 2) qual a data mais recente do texto; 3) quais dados estão ausentes (→ null / NÃO REFERIDO); 4) quais limiares críticos ou protocolos foram acionados. "_raciocinio" é descartado pelo sistema — não coloque dados clínicos somente nele.
`;

export const RACIOCINIO_POR_PACIENTE = `
RACIOCÍNIO (interno)
Cada objeto de "pacientes" começa com a chave "_raciocinio" (1–2 linhas): leito identificado, data mais recente, dados ausentes, limiares/protocolos acionados. É descartado pelo sistema — todo dado clínico deve estar nos campos oficiais.
`;
