# Motor Luan

## Objetivo

O Motor Luan é a camada de orquestração clínica do DOUTOR AJUDA / HNAS ASSIST. Ele recebe textos clínicos, evoluções de ontem, pacientes e laboratórios, e devolve estruturas revisáveis pelo médico.

## Agentes

- `orquestrador`: decide qual agente deve processar o conteúdo.
- `clinicaMedica`: extrai dados de enfermaria clínica médica.
- `pediatria`: reservado para extração pediátrica segura.
- `uti`: reservado para dados críticos de UTI.
- `geradorEvolucao`: gera evolução médica em caixa alta.
- `mapaPlantao`: gera mapa textual de passagem.
- `briefing`: gera roteiro textual do plantão.

## Prompts

Os prompts ficam em:

- `server/prompts/orquestrador.prompt.ts`
- `server/prompts/clinicaMedica.prompt.ts`
- `server/prompts/pediatria.prompt.ts`
- `server/prompts/uti.prompt.ts`
- `server/prompts/geradorEvolucao.prompt.ts`
- `server/prompts/mapaPlantao.prompt.ts`
- `server/prompts/briefing.prompt.ts`

O arquivo `Texto colado.txt` não foi encontrado no workspace. Os prompts atuais usam uma base clínica segura equivalente e podem receber esse conteúdo depois sem alterar a arquitetura.

## Serviços

- `server/services/openaiClient.ts`: cria o cliente OpenAI e centraliza completions.
- `server/services/motorLuan.service.ts`: coordena agentes, prompts e fallback.
- `server/services/mock.service.ts`: respostas fake quando não há API key.
- `server/services/round.service.ts`: mapa e briefing determinísticos locais.

## Frontend

O cliente fica em `src/lib/ai/aiService.ts` e expõe:

- `processDocumentsWithMotorLuan`
- `generateEvolutionWithMotorLuan`
- `importYesterdayEvolutions`
- `generateRoundMap`
- `generateBriefing`
- `extractLabWithAI`

Todas as funções tentam backend primeiro e usam fallback local se falhar.

## Segurança

- Chave OpenAI apenas no backend.
- Nenhuma chave real é salva em `localStorage`.
- O frontend usa somente `VITE_AI_BACKEND_URL`.
- O resultado da IA é apoio à decisão e deve ser revisado pelo médico.
