# Clinical Agents Service

Servico Python separado para orquestrar os agentes clinicos.

## Papel no SaaS

- Receber documentos enviados pelo frontend.
- Converter arquivos com Docling.
- Enviar texto estruturado para agentes Agno.
- Retornar JSON clinico validado para o frontend.

## Agentes planejados

- ExtractorAgent: extrai dados de evolucao, prescricao, laboratorio e laudos.
- EvolutionAgent: gera evolucao medica no modelo padrao.
- PrescriptionAgent: gera prescricao revisavel.
- HandoffAgent: gera passagem de plantao.
- ReferralAgent: gera encaminhamentos.
- SafetyReviewerAgent: revisa incertezas e riscos clinicos.

## Deploy sugerido

Frontend no Vercel. Este servico Python deve rodar separado, por exemplo em Railway, Render, Fly.io ou Cloud Run.
