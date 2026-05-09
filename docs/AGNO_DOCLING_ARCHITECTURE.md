# Agno + Docling architecture

## Objetivo

Criar um servico Python separado para agentes clinicos do DOUTOR AJUDA.

## Agno

Agno sera usado para organizar agentes de IA:

- agente extrator de documentos clinicos
- agente gerador de evolucao medica
- agente gerador de prescricao
- agente gerador de passagem de plantao
- agente gerador de encaminhamentos
- agente revisor de seguranca clinica

## Docling

Docling sera usado antes dos agentes para converter PDF, DOCX, PPTX e imagens em texto estruturado ou Markdown.

Fluxo:

1. upload do arquivo no frontend
2. envio ao servico Python
3. Docling converte documento em Markdown
4. Agno envia Markdown ao agente correto
5. agente retorna JSON clinico estruturado
6. frontend revisa e salva no Supabase

## Deploy

Frontend: Vercel.
Backend de agentes: Render, Railway, Fly.io, Cloud Run ou container separado.

O Vercel deve ficar responsavel pela UI TanStack/Vite. O servico Agno/Docling deve ficar separado porque depende de Python e processamento de documentos.
