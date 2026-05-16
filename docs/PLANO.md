# Plano de Execução — Doctor Aide Flow

> Documento consolidado de todas as pendências operacionais identificadas durante as revisões.
> **Foco:** funcionalidades. Segurança/LGPD seguem em parking lot por decisão sua.
> **Data:** 2026-05-16. **Branch atual:** `claude/improve-terminal-experience-XkJtB`.

---

## 1. Resumo executivo

O app está em **release candidate** segundo o teste E2E do Gemini, com fluxos
principais funcionando: extração individual, geração de evolução, passagem de
plantão em lote. Faltam **9 pendências operacionais** para o sistema ficar
"completo o suficiente para uso beta sustentado". Estimativa total: **~5 a 7
dias úteis** se você quiser tudo.

Recomendo atacar nessa ordem:

| # | Fase | Status | Por quê | Esforço |
|---|---|---|---|---|
| 1 | Endpoint `/api/ai/refinar-evolucao` no Python | ✅ **ENTREGUE** | Destrava feature do PR2 | 30 min |
| 2 | Antibióticos rotineiros pré-cadastrados | ✅ **ENTREGUE** (9/9 E2E) | Você pediu, alto valor clínico | 3 h |
| 3 | Export DOCX/PDF/TXT da evolução | ✅ **ENTREGUE** (11/11 E2E) | Fecha o ciclo "extrair → editar → entregar" | 4 h |
| 4 | Página do paciente como centro de operações | ⏳ aguardando alinhamento | Você disse que está incompleta | 1–2 dias |
| 5 | Prescrição assistida | ⏳ depende de F2 | Completa o tríade clínico | 1–2 dias |
| 6 | Dashboard com triagem visual | ✅ **ENTREGUE** (10/10 E2E) | Médico vê plantão de relance | 1 dia |
| 7 | Auth real + sync cloud | ⏳ aguardando D3 (Clerk vs Supabase) | Hoje perde dados ao limpar navegador | 1–2 dias |
| 8 | Bugs pré-existentes do typecheck | ✅ **ENTREGUE** (zero erros) | Bloqueia regressões silenciosas | 2 h |
| 9 | CI/CD básico | ✅ **ENTREGUE** | Bloqueia regressões | 2 h |

---

## 2. Estado atual do sistema

### 2.1 O que funciona (E2E validado)
- **Extração de 1 documento** (DOCX, PDF, imagem, HEIC do iPhone) — `services/clinical_agents/app.py:110-378`
- **Geração de evolução** com 5 templates (enfermaria/UTI/UPA/UBS/pedi)
- **Passagem de plantão em lote** (até 20 docs, pipeline 2-modelos) — entregue no commit `3cdf66b`
- **PR1 da evolução**: seletor de template, anti-sobrescrita, auto-save de rascunho (12/12 E2E ✅)
- **PR2 da evolução**: refinar com IA, versões locais, usar evolução anterior como base (14/14 E2E ✅)
- **Histórico de evoluções** com modal e botão "USAR COMO BASE"
- **Dashboard** lista pacientes (sem priorização visual ainda)
- **Login mock** + plantão local com localStorage

### 2.2 Backend Python (Railway)
- FastAPI em `services/clinical_agents/app.py`
- Endpoints:
  - `POST /api/extract/extract-async` — single doc
  - `GET /api/extract/job/{id}` — status
  - `POST /api/extract/bulk` — até 20 docs (novo)
  - `GET /api/extract/bulk/job/{id}` — status (novo)
  - `POST /api/ai/gerar-evolucao` — gera texto de evolução
  - `POST /api/ai/refinar-evolucao` — **NÃO EXISTE, frontend já usa**
  - `GET /health` — diagnóstico
- Modelos: defaults `gpt-4o-mini` (env vars `OPENAI_MODEL`, `OPENAI_BULK_MODEL`, `OPENAI_ANALYSIS_MODEL` para sobrescrever)

### 2.3 Frontend (Vercel)
- React 19.2 + TypeScript 5 + Vite 7 + TanStack Router
- 23 rotas em `src/routes/`
- Cliente: `src/lib/documentExtractor.ts` (single + bulk)
- Estado: localStorage + Supabase (fallback duplo)

### 2.4 Dados
- Supabase configurado mas com **RLS desabilitado** em produção (migration `99999_local_mode_schema.sql` reverteu segurança)
- Auth: mock local em `src/hooks/useSupabaseUser.ts` (gera UUID no localStorage)

---

## 3. Pendências operacionais — detalhadas

### F1 — Endpoint `/api/ai/refinar-evolucao` no Python 🔴 BLOQUEADOR

**Status:** Frontend (PR2) já chama esse endpoint. Backend não existe → toast de erro em produção.

**O que fazer:**
1. Adicionar em `services/clinical_agents/app.py` antes do bloco AI ENDPOINTS:
   ```python
   class RefineRequest(BaseModel):
       current_text: str
       instruction: str
       tipo_unidade: Optional[str] = None
       preferences: Optional[Dict[str, Any]] = None

   @app.post("/api/ai/refinar-evolucao")
   async def refinar_evolucao(req: RefineRequest):
       if not openai_key:
           raise HTTPException(503, "OpenAI não configurada")
       prompt = f"""Edite o texto a seguir conforme a instrução, preservando estrutura,
   linguagem médica e CAIXA ALTA.

   INSTRUÇÃO: {req.instruction}

   TEXTO ATUAL:
   \"\"\"{req.current_text}\"\"\"

   Retorne APENAS o texto editado, sem comentários nem markdown."""
       response = await client.chat.completions.create(
           model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
           messages=[{"role": "user", "content": prompt}],
           temperature=0.0,
           max_tokens=16000,
       )
       return {"evolution_text": response.choices[0].message.content.strip()}
   ```

**Risco se não fizer:** PR2 ainda parece quebrado pra você.

**Tempo:** 30 min (incluindo deploy + smoke test).

---

### F2 — Antibióticos rotineiros pré-cadastrados 🟡

**Status:** Você pediu explicitamente. Hoje não há sugestão automática.

**O que fazer:**

1. Criar `src/lib/antibioticos-rotineiros.ts` com tabela:
   ```ts
   export const ATB_ROTINEIROS = [
     { nome: "CEFTRIAXONA", dose: "1g", via: "IV", frequencia: "12/12h" },
     { nome: "PIPERACILINA + TAZOBACTAM", dose: "4,5g", via: "IV", frequencia: "6/6h" },
     { nome: "VANCOMICINA", dose: "1g", via: "IV", frequencia: "12/12h" },
     { nome: "MEROPENEM", dose: "1g", via: "IV", frequencia: "8/8h" },
     { nome: "AMOXICILINA + CLAVULANATO", dose: "875mg", via: "VO", frequencia: "12/12h" },
     { nome: "AZITROMICINA", dose: "500mg", via: "VO/IV", frequencia: "1x/dia" },
     { nome: "CLINDAMICINA", dose: "600mg", via: "IV", frequencia: "8/8h" },
     { nome: "METRONIDAZOL", dose: "500mg", via: "IV/VO", frequencia: "8/8h" },
     { nome: "CIPROFLOXACINO", dose: "400mg", via: "IV", frequencia: "12/12h" },
     { nome: "LEVOFLOXACINO", dose: "750mg", via: "VO/IV", frequencia: "1x/dia" },
     { nome: "CEFEPIME", dose: "2g", via: "IV", frequencia: "12/12h" },
     { nome: "TIGECICLINA", dose: "100mg ataque, 50mg manutenção", via: "IV", frequencia: "12/12h" },
     { nome: "POLIMIXINA B", dose: "1MUI", via: "IV", frequencia: "12/12h" },
     { nome: "OXACILINA", dose: "2g", via: "IV", frequencia: "4/4h" },
   ];
   ```
   Lista validada por médico antes de produção (você confirma se essas são as suas).

2. Em `src/routes/revisar-extracao.tsx`, na seção de antibióticos: chips clicáveis dos rotineiros + autocomplete por nome para custom.

3. No prompt do backend (`services/clinical_agents/app.py:228+`), adicionar a lista no system message: *"Se encontrar antibióticos, normalize o nome para esta lista canônica: [...]"*.

**Tempo:** 3 h (1h tabela validada, 1h UI, 1h prompt).

---

### F3 — Export DOCX / PDF / TXT da evolução 🟡

**Status:** Você pediu duas vezes. Médico hoje copia-cola pro Word.

**O que fazer:**

1. **Backend Python** — novo endpoint:
   ```python
   class ExportRequest(BaseModel):
       text: str
       format: str  # "docx" | "pdf" | "txt"
       header: Optional[Dict[str, str]] = None  # nome, leito, CRM, data

   @app.post("/api/export/evolucao")
   async def export_evolucao(req: ExportRequest):
       # python-docx para DOCX, reportlab para PDF, raw para TXT
       # retorna FileResponse com Content-Disposition
   ```

2. Adicionar `python-docx` e `reportlab` em `services/clinical_agents/requirements.txt`.

3. **Frontend** — 3 botões na tela de evolução (`src/routes/evolucao.$id.index.tsx`):
   - DOCX (azul) — endpoint export + download via `<a download>`
   - PDF (vermelho) — idem
   - TXT (cinza) — geração client-side (não precisa backend)

4. Cabeçalho do documento exportado:
   ```
   HOSPITAL [nome]                    Dr. [médico] CRM [crm]
   PACIENTE: [nome]    LEITO: [leito]    DATA: dd/mm/aaaa
   ─────────────────────────────────────────────────────
   [texto da evolução]
   ```

**Risco:** sem isso, o fluxo é incompleto — o médico precisa do documento físico/digital final.

**Tempo:** 4 h (2h backend, 2h frontend + headers).

---

### F4 — Página do paciente como centro de operações 🔴

**Status:** Você disse "ainda não está completa". Hoje em `src/routes/paciente.$id.tsx` (565 linhas) é mais uma lista de campos do que um cockpit.

**O que fazer:**

1. **Layout reorganizado em 4 cards:**
   - **Identificação** (editável inline): nome, idade, sexo, leito, setor, data admissão, motivo
   - **Problemas & antecedentes**: problem list ativos/resolvidos + comorbidades
   - **Tratamento**: medicações contínuas, prescrição atual, antibióticos com D{N}
   - **Exames**: laboratórios recentes, exames de imagem

2. **Edição inline em cada campo** (sem abrir modal):
   - Click no campo → vira input
   - Blur → salva localStorage/Supabase
   - Toast de "salvo" discreto

3. **Botões de ação primários:**
   - "GERAR EVOLUÇÃO" → `/evolucao/$id`
   - "GERAR PRESCRIÇÃO" → `/prescricao/$id`
   - "ANEXAR DOCUMENTO" → `/upload-ia?patient_id=X` (merge no paciente existente — já existe `mergeLocalPatient`)
   - "ALTA / TRANSFERÊNCIA"

4. **Timeline de evoluções** na lateral direita:
   - Lista das evoluções desse paciente em ordem cronológica
   - Click → modal "ver completa"
   - Botão "Carregar como base hoje" → `/evolucao/$id?from=<id>` (já funciona)

5. **Indicador de gravidade** no header (vem do ranking da passagem):
   - Badge colorido com status atual

**Risco:** sem isso, o médico fica navegando entre 5 telas por paciente.

**Tempo:** 1–2 dias.

---

### F5 — Prescrição assistida 🟡

**Status:** Rota `/prescricao/$id` existe mas não foi validada. Provavelmente texto livre hoje.

**O que fazer:**

1. **Builder com autocomplete**:
   - Input "Adicionar medicação" → autocomplete dos antibióticos rotineiros + base de meds comuns
   - Cada med vira chip com dose/via/frequência editáveis
   - Botão "Sugerir antibiótico" baseado no diagnóstico (chama IA)

2. **Cálculo de dose** por peso/clearance:
   - Slot pra peso (kg) e clearance (mL/min/1,73m²)
   - Para antibióticos sensíveis (Vanco, Mero, Pip-Tazo) ajusta dose automaticamente
   - Fonte: UpToDate ou referências oficiais (você valida)

3. **Geração de PDF imprimível** (reusa `/api/export/evolucao` mas com format prescricao):
   - Cabeçalho com CRM, paciente, data
   - Lista numerada de medicações
   - Assinatura no rodapé

4. **Sugestão IA "completar prescrição"** → analisa o paciente extraído e propõe protocolo padrão (sepse → ATB empírico, IAM → AAS+clopi+stat etc).

**Tempo:** 1–2 dias.

---

### F6 — Dashboard com triagem visual 🟡

**Status:** Hoje é lista. Você quer "ver o plantão de relance".

**O que fazer:**

1. **Cards de gravidade no topo** (reaproveita ranking da passagem):
   - 🔴 N críticos · 🟠 N graves · 🟡 N moderados · 🟢 N leves/alta

2. **Filtros rápidos** (chips no topo da lista):
   - "Críticos primeiro" (default)
   - "Sem evolução hoje"
   - "ATB > 7 dias"
   - "Alta sugerida"

3. **Busca** por nome/leito (já tem stub, melhorar UX).

4. **Cada card de paciente** mostra:
   - Badge de gravidade colorido
   - Leito · Nome · Idade·Sexo · DIH
   - 1 linha de resumo (problemas ativos top 2)
   - Indicadores: ATB ativo (D{N}), pendências (N), última evolução (há quanto tempo)

5. **Reordenação manual** (drag-and-drop) opcional.

**Tempo:** 1 dia.

---

### F7 — Auth real + sincronização cloud 🟡

**Status:** Hoje `useSupabaseUser` cria UUID no localStorage. Se limpar navegador, perde tudo.

**O que fazer:**

1. **Integrar Clerk** (mais simples) ou **Supabase Auth**:
   - `src/lib/clerk.ts` já existe — verificar configuração
   - Substituir `useSupabaseUser` por hook real
   - Login screen em `/login` (já existe rota)

2. **JWT do Clerk como token do Supabase**:
   - JWT template no Clerk com `sub` → `auth.uid()` no Supabase
   - `createClient` com `accessToken` callback

3. **Sync inicial ao logar**:
   - Buscar pacientes do shift ativo do Supabase
   - Merge com localStorage (preferir Supabase quando conflito)
   - UI indica "sincronizando..." durante carga

4. **Sync periódico**:
   - Quando salvar paciente/evolução/prescrição: tenta Supabase, fallback localStorage
   - Ao reconectar, sincroniza pendentes (já existe parcial em `mergeLocalPatient`)

**Atenção:** F7 destrava F-FUTURA (RLS de verdade) mas NÃO está priorizada agora porque você disse "segurança fica pra depois". Avaliar se vale fazer mesmo sem RLS — sim, porque o problema aqui é **funcional** (perder dados), não só de segurança.

**Tempo:** 1–2 dias.

---

### F8 — Bugs pré-existentes do typecheck 🟢

**Status:** `npx tsc --noEmit` retorna 8 erros (não meus, herdados).

Erros atuais:
- `src/routes/dashboard.tsx(168,43)`: `'shift' is possibly 'null'`
- `src/routes/dashboard.tsx(169,24)`: idem
- `src/routes/dashboard.tsx(411,25)`: `Cannot find name 'Users'. Did you mean 'User'?`
- `src/routes/encaminhamento.$id.tsx(59,23)`: `'name' is specified more than once`
- `src/routes/encaminhamento.$id.tsx(59,37)`: `'bed' is specified more than once`
- `src/routes/paciente.$id.tsx(565,18)`: `Cannot find name 'X'`
- `src/routes/processando.$jobId.tsx(90,60)`: comparison sem overlap
- `src/routes/tipo.tsx(33,15)`: argumentos faltando

**Risco:** silenciosamente quebra em runtime quando tocar nessas linhas.

**Tempo:** 2 h.

---

### F9 — CI/CD mínimo 🟢

**Status:** Sem `.github/workflows`. Qualquer regressão passa.

**O que fazer:**

`.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run build
```

Opcional: rodar suíte E2E (`scratch/e2e-pr1.mjs` e `e2e-pr2.mjs`) em headless com Playwright instalado.

**Tempo:** 2 h (incluindo fixes que fizerem o pipeline passar).

---

## 4. Decisões pendentes que dependem de você

| # | Decisão | Opções | Recomendação |
|---|---|---|---|
| D1 | Qual modelo OpenAI default em produção? | gpt-4o-mini (atual) / gpt-4o full | Manter mini até validar custo real em 1 semana |
| D2 | Lista de antibióticos rotineiros — você valida? | Lista acima ou outra | Você revisa, eu uso |
| D3 | Auth: Clerk ou Supabase Auth? | Clerk (mais polish) / Supabase Auth (integração nativa) | Clerk — `src/lib/clerk.ts` já tem stub |
| D4 | Onde guardar templates de evolução? | Frontend (hoje) / Backend Python / Supabase (editável pelo médico) | Backend Python — fácil de iterar sem rebuild do frontend |
| D5 | Streaming na evolução? | Sim agora / depois / não | Depois (Fase polimento) |
| D6 | PR2 com endpoint `/api/ai/refinar-evolucao` faltando — fazer F1 agora? | Sim/não | Sim — é só 30 min |

---

## 5. Backlog deferido (não bloqueia uso beta)

Coisas identificadas mas que ficam pra depois:

- **Segurança/LGPD**: RLS desativado, `.env` no histórico git, dados de paciente no repo (`L03 - MANOEL PEDRO FILHO 26.04.docx`, `create_test_file.cjs`). Você disse "agora não".
- **PR3 da evolução**: streaming SSE, indicador de qualidade dos dados, modo conciso vs detalhado, feedback "salvo cloud vs local".
- **Bulk export da passagem** (PDF/imagem pra WhatsApp).
- **Critérios clínicos automáticos**: TFGe (CKD-EPI), dose por peso, alergias cruzadas.
- **Mobile/PWA**: app está web-only; iPhone do médico funciona mas sem instalável.
- **Notificações**: "paciente X com PCR subindo", "ATB X completou 7 dias".
- **Multi-hospital**: hoje tudo é flat. Algum dia você vai querer separar.
- **Histórico de revisão de IA**: quem editou o quê e quando.

---

## 6. Riscos identificados

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Railway derruba o servidor mid-bulk (20 docs) | Média | Alto (perde lote inteiro) | Persistir bulk_jobs no Supabase em vez de memória |
| gpt-4o-mini extrai mal um documento crítico | Alta | Médio (médico corrige) | F2 (ATB rotineiros) + revisar prompt periodicamente com casos reais |
| Médico digita evolução longa e perde por reload do Vercel | Baixa (já tem auto-save) | Alto | Já mitigado (PR1) |
| Custo da OpenAI passa de orçamento sem aviso | Média | Alto | Adicionar log de custo por chamada + dashboard simples |
| TanStack Router regenera routeTree de forma estranha em produção | Baixa | Médio | CI rodando `npm run build` em todo PR |

---

## 7. Sequência ótima recomendada

```
DIA 1 (4 h)
├── F1: endpoint refinar-evolucao (30 min)
├── F2: antibióticos rotineiros (3 h)
└── F8 parcial: fixar erros TS mais urgentes (30 min)

DIA 2 (8 h)
├── F3: export DOCX/PDF/TXT (4 h)
└── F6: dashboard com triagem visual (4 h)

DIA 3 - 4 (16 h)
└── F4: página do paciente reformulada (1-2 dias)

DIA 5 - 6 (12 h)
└── F5: prescrição assistida (1-2 dias)

DIA 7 (8 h)
├── F7: auth real + sync cloud (parte 1)
└── F9: CI básico

DIA 8 (4 h)
└── F7: auth real + sync cloud (parte 2)
```

**Total:** 5 a 7 dias úteis. Cada fase é commit/PR independente — podemos parar a qualquer momento e o que estiver entregue funciona.

---

## 8. Plano de validação por fase

Cada fase termina com:
1. **Build verde** (`npm run build`)
2. **Suíte E2E correspondente** (criar como `scratch/e2e-fN.mjs`)
3. **Smoke test manual** (você no Vercel preview)
4. **Commit + push**

Para F1, F4, F5, F7 que envolvem backend Python: deploy no Railway + checar `/health` após cada mudança.

---

## 9. O que eu posso fazer SOZINHA, sem aprovação

- F1 (endpoint refinar-evolucao) — segurança baixa, completa feature já feita
- F8 (bugs pré-existentes do TS) — só correção, sem comportamento novo
- F9 (CI) — só adiciona workflow, não afeta runtime

Coisas que **PRECISO** que você decida antes:
- D2 (lista validada de antibióticos)
- D3 (Clerk vs Supabase Auth)
- F4, F5 — envolvem design clínico, prefiro alinhar com você antes

---

## 10. Próximo passo

Quando acordar, me diz:
1. Concorda com a sequência? Quer trocar algo de ordem?
2. Posso começar pela F1 já agora (sem esperar você)?
3. Lista de antibióticos do item D2 — você usa essas mesmas ou tem outras?
4. Decisão D3 (Clerk ou Supabase Auth)?

Sem isso, fico parada esperando.

---

*Última atualização: 2026-05-16. Próxima revisão: após você acordar.*
