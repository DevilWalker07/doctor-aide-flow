# Revisão rápida da base de código — tarefas sugeridas

## 1) Erro de digitação (nomenclatura): `conducta` → `conduta`

**Problema encontrado**
- O domínio está em português, mas a estrutura de dados usa o identificador `conducta` (espanhol), o que aumenta inconsistência semântica e risco de confusão em manutenção.

**Onde aparece**
- `src/lib/store.ts`
- `src/routes/evolucao.$id.tsx`

**Tarefa proposta**
- Renomear de forma consistente:
  - tipo `PatientData.conducta` para `PatientData.conduta`
  - acessos `data.conducta` para `data.conduta`
  - chamadas `patch("conducta", ...)` para `patch("conduta", ...)`
- Fazer migração retrocompatível dos dados em `localStorage` para não perder registros antigos.

**Critérios de aceite**
- Build/lint sem erros.
- UI de condutas/pendências/intercorrências continua funcionando.
- Dados já salvos com a chave antiga seguem legíveis após atualização.

---

## 2) Bug funcional: data "de hoje" está hardcoded

**Problema encontrado**
- A tela usa `const TODAY = "2026-03-28"`, o que congela o cálculo do dia de antibiótico (`abxDay`) e causa resultados incorretos com o passar do tempo.

**Onde aparece**
- `src/routes/evolucao.$id.tsx`

**Tarefa proposta**
- Substituir a constante hardcoded por data dinâmica em timezone adequado (ex.: `new Date()` com normalização local/UTC explícita).
- Revisar cálculo para evitar valores negativos quando `d0` está no futuro.

**Critérios de aceite**
- O badge `ATB D{n}/{durDays}` muda corretamente a cada dia.
- Para `d0` futuro, o valor não fica negativo (regra definida e testada).

---

## 3) Ajuste de comentário/documentação de código: regra D0 x D1

**Problema encontrado**
- Em `abxDay`, o comentário diz `D0 starts at 1`, o que está conceitualmente ambíguo e conflita com convenções clínicas (D0 costuma ser o dia zero, não dia 1).

**Onde aparece**
- `src/lib/medical.ts`

**Tarefa proposta**
- Padronizar a convenção de contagem (D0 ou D1) no código e no texto de interface.
- Atualizar comentário para refletir exatamente a regra implementada (incluindo bordas: mesmo dia, datas futuras).

**Critérios de aceite**
- Comentário e comportamento real estão alinhados.
- Time consegue inferir a regra apenas lendo função + comentário.

---

## 4) Melhoria de testes: cobertura para utilitários clínicos críticos

**Problema encontrado**
- O projeto não tem suíte de testes configurada nos scripts (`test` ausente), embora existam funções puras críticas para regras clínicas.

**Onde aparece**
- `package.json`
- `src/lib/medical.ts`

**Tarefa proposta**
- Adicionar framework de teste (ex.: Vitest) e script `npm run test`.
- Criar testes unitários para:
  - `abxDay` (mesmo dia, dia seguinte, `d0` futuro)
  - `pcrTrend` (rising/falling/stable/rebound)
  - `ckdStage` (limiares 90/60/45/30/15)

**Critérios de aceite**
- `npm run test` executa localmente.
- Casos de borda principais cobertos.
- Falhas futuras em regressão de cálculo são detectadas automaticamente.
