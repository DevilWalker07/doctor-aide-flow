import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { storage } from "@/lib/storage";
import { ArquivoNaoLido, normalizarArquivo, type Documento } from "@/lib/passagem/normalizar";
import {
  gerarMapa,
  lerLeitoNoServidor,
  motivoDoErro,
  transcreverNoServidor,
  type LeitoLido,
  type MapaPronto,
} from "@/lib/passagem/passagem";
import { diaSeguinte, isoParaBR } from "../../shared/passagem/datas";
import { lerNomeDoArquivo } from "../../shared/passagem/nomeArquivo";

export const Route = createFileRoute("/passagem-plantao")({
  component: PassagemPlantaoPage,
  head: () => ({ meta: [{ title: "Passagem de Plantão IA — MEDFLUXO" }] }),
});

/**
 * Passagem de plantão: cada arquivo vira um leito, na tela, um por um.
 *
 * Tudo acontece no navegador, menos as chamadas de IA: o arquivo vira
 * Markdown aqui, cada leito é uma chamada curta, e o DOCX é montado aqui e
 * baixado direto. Sem job, sem Storage, sem consultar andamento — o estado de
 * cada leito é o que a tela mostra, e leito que falha ganha "tentar de novo"
 * só para ele.
 *
 * Recarregar a página perde o que está em andamento. É aceitável para um
 * fluxo de um ou dois minutos e evita guardar dado de paciente no navegador.
 */

type Estado = "na-fila" | "lendo" | "consultando" | "pronto" | "falhou";

interface Item {
  id: string;
  file: File;
  estado: Estado;
  /** O Markdown fica guardado: tentar de novo não repete a transcrição da foto. */
  doc?: Documento;
  resultado?: LeitoLido;
  motivo?: string;
}

const CONCORRENCIA = 3;
const MAX_ARQUIVOS = 40;
const ACEITOS = ".docx,.doc,.pdf,.txt,.md,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*";

const ROTULO: Record<Estado, string> = {
  "na-fila": "Na fila",
  lendo: "Lendo o arquivo…",
  consultando: "Consultando a IA…",
  pronto: "Pronto",
  falhou: "Falhou",
};

function PassagemPlantaoPage() {
  const nav = useNavigate();
  const [setor, setSetor] = useState<"CMF" | "CMM" | "CMF/CMM">("CMF/CMM");
  // Vão para o cabeçalho do mapa, como no modelo do hospital. O hospital fica
  // guardado porque não muda de um plantão para o outro.
  const [hospital, setHospital] = useState(() => storage.getHospitalPadrao() ?? "");
  const [periodo, setPeriodo] = useState<"diurno" | "noturno">("diurno");
  // Seletor nativo: sem digitar data de madrugada, sem formato errado.
  const [dataISO, setDataISO] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [itens, setItens] = useState<Item[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [trabalhando, setTrabalhando] = useState<null | "leitos" | "mapa">(null);
  const [mapa, setMapa] = useState<(MapaPronto & { url: string }) | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Os workers leem o estado mais recente daqui, não da closure.
  const itensRef = useRef<Item[]>([]);
  itensRef.current = itens;

  const dataPlantao = isoParaBR(dataISO) ?? "";

  useEffect(() => {
    if (!mapa) return;
    return () => URL.revokeObjectURL(mapa.url);
  }, [mapa]);

  const atualizar = useCallback((id: string, mudanca: Partial<Item>) => {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...mudanca } : i)));
  }, []);

  /** Mudou o que entra na linha (data, setor): o que já foi lido precisa ser lido de novo. */
  const invalidar = useCallback(() => {
    setMapa(null);
    setItens((prev) =>
      prev.map((i) =>
        i.estado === "pronto" ? { ...i, estado: "na-fila", resultado: undefined } : i,
      ),
    );
  }, []);

  function adicionar(lista: FileList | File[]) {
    setMapa(null);
    setErroGeral(null);
    setItens((prev) => {
      const nomes = new Set(prev.map((i) => i.file.name));
      const novos = Array.from(lista)
        .filter((f) => !nomes.has(f.name))
        .map((f): Item => ({ id: crypto.randomUUID(), file: f, estado: "na-fila" }));
      const todos = [...prev, ...novos];
      if (todos.length > MAX_ARQUIVOS) {
        setErroGeral(`No máximo ${MAX_ARQUIVOS} arquivos por passagem.`);
        return todos.slice(0, MAX_ARQUIVOS);
      }
      return todos;
    });
  }

  async function lerUm(id: string) {
    const item = itensRef.current.find((i) => i.id === id);
    if (!item) return;
    try {
      let doc = item.doc;
      if (!doc) {
        atualizar(id, { estado: "lendo", motivo: undefined });
        doc = await normalizarArquivo(item.file, transcreverNoServidor);
        atualizar(id, { doc });
      }
      atualizar(id, { estado: "consultando", motivo: undefined });
      const resultado = await lerLeitoNoServidor(doc, item.file.name, dataPlantao, setor);
      atualizar(id, {
        estado: "pronto",
        resultado: { ...resultado, avisos: [...doc.avisos, ...resultado.avisos] },
      });
    } catch (err) {
      const motivo = err instanceof ArquivoNaoLido ? err.message : motivoDoErro(err);
      atualizar(id, { estado: "falhou", motivo });
    }
  }

  async function lerPendentes(ids: string[]) {
    const fila = [...ids];
    const trabalhador = async () => {
      for (let id = fila.shift(); id; id = fila.shift()) await lerUm(id);
    };
    await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, fila.length) }, trabalhador));
  }

  async function gerar() {
    if (!dataPlantao) {
      setErroGeral("Escolha a data do plantão.");
      return;
    }
    setErroGeral(null);
    setMapa(null);
    const pendentes = itensRef.current.filter((i) => i.estado !== "pronto").map((i) => i.id);
    if (pendentes.length) {
      setTrabalhando("leitos");
      await lerPendentes(pendentes);
    }
    const atuais = itensRef.current;
    const lidos = atuais.filter((i) => i.estado === "pronto" && i.resultado);
    if (lidos.length === 0) {
      setTrabalhando(null);
      setErroGeral("Nenhum leito foi lido. Veja o motivo em cada arquivo e tente de novo.");
      return;
    }
    setTrabalhando("mapa");
    try {
      const pronto = await gerarMapa({
        lidos: lidos.map((i) => ({
          arquivo: i.file.name,
          linha: i.resultado!.linha,
          alertas: i.resultado!.alertas,
        })),
        falhas: atuais
          .filter((i) => i.estado === "falhou")
          .map((i) => ({ arquivo: i.file.name, motivo: i.motivo ?? "motivo desconhecido" })),
        setor,
        dataPlantao,
        cabecalho: {
          hospital: hospital.trim() || undefined,
          periodo,
          passagemPara: diaSeguinte(dataPlantao) ?? undefined,
        },
      });
      setMapa({ ...pronto, url: URL.createObjectURL(pronto.blob) });
    } catch (err) {
      setErroGeral(`Falha ao montar o DOCX: ${motivoDoErro(err)}`);
    } finally {
      setTrabalhando(null);
    }
  }

  async function tentarDeNovo(id: string) {
    setMapa(null);
    await lerUm(id);
  }

  const prontos = itens.filter((i) => i.estado === "pronto").length;
  const falhos = itens.filter((i) => i.estado === "falhou").length;
  const ocupado = trabalhando !== null;

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-card border-border sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => nav({ to: "/" })}
            aria-label="Voltar"
            className="text-muted-foreground hover:bg-secondary focus-visible:ring-ring inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="t-title text-foreground">Passagem de plantão</h1>
            <p className="t-label text-muted-foreground font-normal">
              Um arquivo por leito — Word, PDF ou foto
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        <section className="bg-card border-border rounded-3xl border p-5">
          <h2 className="t-title text-foreground mb-4">Plantão</h2>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="t-label text-muted-foreground">Setor</span>
              <div className="flex gap-2">
                {(["CMF", "CMM", "CMF/CMM"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      if (s !== setor) invalidar();
                      setSetor(s);
                    }}
                    aria-pressed={setor === s}
                    disabled={ocupado}
                    className={`t-label focus-visible:ring-ring inline-flex min-h-11 items-center rounded-xl border px-4 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 ${
                      setor === s
                        ? "bg-navy text-navy-foreground border-navy"
                        : "bg-card text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="passagem-data" className="t-label text-muted-foreground">
                Data do plantão
              </label>
              <input
                id="passagem-data"
                type="date"
                value={dataISO}
                disabled={ocupado}
                onChange={(e) => {
                  if (e.target.value !== dataISO) invalidar();
                  setDataISO(e.target.value);
                }}
                data-testid="handoff-data"
                className="bg-card border-border text-foreground focus:ring-ring min-h-11 w-44 rounded-xl border px-3 text-base focus:ring-2 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="t-label text-muted-foreground">Período</span>
              <div className="flex gap-2">
                {(["diurno", "noturno"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPeriodo(p);
                      setMapa(null);
                    }}
                    aria-pressed={periodo === p}
                    disabled={ocupado}
                    data-testid={`handoff-periodo-${p}`}
                    className={`t-label focus-visible:ring-ring inline-flex min-h-11 items-center rounded-xl border px-4 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 ${
                      periodo === p
                        ? "bg-navy text-navy-foreground border-navy"
                        : "bg-card text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    {p === "diurno" ? "Diurno" : "Noturno"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="passagem-hospital" className="t-label text-muted-foreground">
                Hospital
              </label>
              <input
                id="passagem-hospital"
                type="text"
                value={hospital}
                onChange={(e) => {
                  setHospital(e.target.value);
                  setMapa(null);
                }}
                onBlur={() => storage.setHospitalPadrao(hospital)}
                placeholder="Nome do hospital"
                data-testid="handoff-hospital"
                className="bg-card border-border text-foreground focus:ring-ring min-h-11 w-64 max-w-full rounded-xl border px-3 text-base focus:ring-2 focus:outline-none"
              />
            </div>
          </div>
        </section>

        <div
          role="button"
          tabIndex={0}
          aria-label="Adicionar arquivos dos leitos"
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            if (!ocupado) adicionar(e.dataTransfer.files);
          }}
          onClick={() => !ocupado && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !ocupado) inputRef.current?.click();
          }}
          className={`focus-visible:ring-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
            arrastando
              ? "border-navy bg-navy/5"
              : "border-border hover:border-navy/40 hover:bg-secondary/30"
          }`}
        >
          <Upload className={`h-8 w-8 ${arrastando ? "text-navy" : "text-muted-foreground"}`} />
          <p className="t-body text-foreground font-bold">
            {arrastando ? "Solte os arquivos aqui" : "Adicionar os arquivos dos leitos"}
          </p>
          <p className="t-label text-muted-foreground text-center font-normal">
            Word (.docx), PDF, foto ou print — um arquivo por leito
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACEITOS}
            className="hidden"
            data-testid="handoff-files"
            onChange={(e) => {
              if (e.target.files) adicionar(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {itens.length > 0 && (
          <section className="bg-card border-border overflow-hidden rounded-3xl border">
            <div className="border-border bg-secondary/30 flex items-center justify-between border-b px-5 py-2">
              <span className="t-label text-muted-foreground" data-testid="handoff-contagem">
                {itens.length} arquivo{itens.length !== 1 ? "s" : ""} · {prontos} pronto
                {prontos !== 1 ? "s" : ""}
                {falhos > 0 && <span className="text-destructive"> · {falhos} com falha</span>}
              </span>
              <button
                onClick={() => {
                  setItens([]);
                  setMapa(null);
                  setErroGeral(null);
                }}
                disabled={ocupado}
                className="t-label text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Limpar tudo
              </button>
            </div>
            <ul className="divide-border divide-y">
              {itens.map((item) => (
                <LinhaItem
                  key={item.id}
                  item={item}
                  ocupado={ocupado}
                  onRemover={() => {
                    setItens((prev) => prev.filter((i) => i.id !== item.id));
                    setMapa(null);
                  }}
                  onTentar={() => void tentarDeNovo(item.id)}
                />
              ))}
            </ul>
          </section>
        )}

        {erroGeral && (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 t-body text-foreground flex gap-3 rounded-2xl border p-4"
          >
            <AlertTriangle
              className="text-destructive mt-0.5 h-5 w-5 shrink-0"
              aria-hidden="true"
            />
            {erroGeral}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => void gerar()}
            disabled={ocupado || itens.length === 0}
            data-testid="handoff-generate"
            className="bg-navy text-navy-foreground focus-visible:ring-ring inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ocupado ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                {trabalhando === "leitos"
                  ? `Lendo leitos… ${prontos} de ${itens.length}`
                  : "Montando o mapa…"}
              </>
            ) : (
              <>
                <FileText className="h-5 w-5" aria-hidden="true" />
                {mapa ? "Gerar o mapa de novo" : "Gerar mapa"}
              </>
            )}
          </button>

          {mapa && (
            <a
              href={mapa.url}
              download={mapa.nome}
              data-testid="handoff-download"
              className="bg-success text-success-foreground focus-visible:ring-ring inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              Baixar DOCX ({mapa.pacientes} leito{mapa.pacientes !== 1 ? "s" : ""})
            </a>
          )}
        </div>

        {mapa && mapa.avisos.length > 0 && (
          <div
            data-testid="handoff-avisos"
            className="border-warning/50 bg-warning/10 flex gap-3 rounded-2xl border p-4"
          >
            <AlertTriangle className="text-warning mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="t-body text-foreground mb-1 font-bold">
                O mapa saiu com avisos (estão também no topo do DOCX):
              </p>
              <ul className="space-y-1">
                {mapa.avisos.map((a, i) => (
                  <li key={i} className="t-body text-foreground">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {itens.length === 0 && (
          <section className="bg-card border-border rounded-3xl border p-5">
            <h3 className="t-title text-foreground mb-3">Como funciona</h3>
            <ol className="space-y-2">
              {[
                "Escolha o setor e a data do plantão.",
                "Adicione um arquivo por leito: Word, PDF, foto ou print da evolução.",
                "Cada leito é lido separadamente — o nome, o leito e a internação vêm do cabeçalho do documento.",
                "Leito que falhar mostra o motivo e pode ser tentado de novo sozinho.",
                "Baixe o DOCX no formato do mapa do hospital.",
              ].map((passo, i) => (
                <li key={i} className="t-body text-muted-foreground flex gap-3">
                  <span className="bg-navy text-navy-foreground t-label mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    {i + 1}
                  </span>
                  {passo}
                </li>
              ))}
            </ol>
            <p className="t-body text-muted-foreground mt-4">
              Word e PDF com texto são lidos no próprio aparelho. Foto e PDF escaneado passam pela
              IA página por página, e o leito sai marcado no mapa para você conferir os valores.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function LinhaItem({
  item,
  ocupado,
  onRemover,
  onTentar,
}: {
  item: Item;
  ocupado: boolean;
  onRemover: () => void;
  onTentar: () => void;
}) {
  const leito = item.resultado?.linha.leito ?? lerNomeDoArquivo(item.file.name).leito;
  const andando = item.estado === "lendo" || item.estado === "consultando";
  const avisos = item.resultado?.avisos ?? [];
  return (
    <li className="px-5 py-3" data-testid="handoff-item" data-estado={item.estado}>
      <div className="flex items-center gap-3">
        {andando ? (
          <Loader2 className="text-navy h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
        ) : item.estado === "pronto" ? (
          <CheckCircle2 className="text-success h-5 w-5 shrink-0" aria-hidden="true" />
        ) : item.estado === "falhou" ? (
          <AlertTriangle className="text-destructive h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <FileText className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="t-body text-foreground truncate">
            {leito && <span className="font-bold">{leito} · </span>}
            {item.resultado?.linha.paciente ?? item.file.name}
          </p>
          <p
            className={`t-label font-normal ${item.estado === "falhou" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {item.estado === "falhou" ? `Falhou: ${item.motivo}` : ROTULO[item.estado]}
            {item.resultado?.linha.lidoDeImagem && " · lido de imagem — confira valores"}
          </p>
          {avisos.map((a, i) => (
            <p key={i} className="t-label text-foreground font-normal">
              ⚠ {a}
            </p>
          ))}
        </div>
        {item.estado === "falhou" && (
          <button
            onClick={onTentar}
            disabled={ocupado}
            data-testid="handoff-retry"
            className="t-label text-navy hover:bg-secondary focus-visible:ring-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Tentar de novo
          </button>
        )}
        <button
          onClick={onRemover}
          disabled={ocupado}
          aria-label={`Remover ${item.file.name}`}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
