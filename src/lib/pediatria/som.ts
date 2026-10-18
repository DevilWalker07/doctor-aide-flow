/**
 * Sons do modo RCP, sintetizados com Web Audio — nada de arquivo de áudio
 * para baixar, funciona offline. O metrônomo agenda os cliques no relógio do
 * próprio AudioContext (lookahead), porque setInterval sozinho atrasa quando a
 * aba perde foco e a cadência de 110/min viraria 95.
 *
 * O AudioContext só pode nascer num gesto do usuário (iOS): `Sons.iniciar()`
 * é chamado no toque do botão "Iniciar RCP".
 */

export type Batida =
  | { tipo: "compressao"; n: number; total: number | null }
  | { tipo: "ventilacao"; n: number };

type Padrao = { compressoes: number; ventilacoes: number } | "continuo";

export class Sons {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  mudo = false;

  iniciar() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
  }

  get agora() {
    return this.ctx?.currentTime ?? 0;
  }

  get pronto() {
    return this.ctx !== null;
  }

  /** O navegador segurou o áudio (sem toque do usuário ainda): falta um toque. */
  get suspenso() {
    return this.ctx?.state === "suspended";
  }

  private tom(
    freq: number,
    inicio: number,
    dur: number,
    tipo: OscillatorType = "sine",
    volume = 0.5,
  ) {
    if (!this.ctx || !this.master || this.mudo) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, inicio);
    g.gain.setValueAtTime(0.0001, inicio);
    g.gain.exponentialRampToValueAtTime(volume, inicio + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    osc.connect(g).connect(this.master);
    osc.start(inicio);
    osc.stop(inicio + dur + 0.02);
  }

  /** Clique do metrônomo; o primeiro do ciclo é mais agudo. */
  clique(quando: number, acento: boolean) {
    this.tom(acento ? 1568 : 1046, quando, 0.06, "square", acento ? 0.35 : 0.25);
  }

  /** "Ventile": dois tons graves e mais longos. */
  ventilacao(quando: number) {
    this.tom(392, quando, 0.35, "triangle", 0.5);
  }

  /** Alarme de checagem de ritmo: três bipes. */
  alarme() {
    const t = this.agora;
    [0, 0.22, 0.44].forEach((d) => this.tom(880, t + d, 0.16, "square", 0.4));
  }

  /** Troca de compressor: dois tons descendentes, diferentes de todos os outros. */
  troca() {
    const t = this.agora;
    this.tom(784, t, 0.22, "triangle", 0.45);
    this.tom(523, t + 0.26, 0.32, "triangle", 0.45);
  }

  /** Lembrete suave (adrenalina liberada). */
  lembrete() {
    const t = this.agora;
    this.tom(660, t, 0.18, "sine", 0.4);
    this.tom(990, t + 0.2, 0.25, "sine", 0.4);
  }

  /** Som de carga do DEA: varredura ascendente; resolve quando "pronto". */
  carregar(ms = 2500): Promise<void> {
    if (this.ctx && this.master && !this.mudo) {
      const t = this.agora;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(2400, t + ms / 1000);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.1);
      g.gain.setValueAtTime(0.12, t + ms / 1000 - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.05);
    }
    return new Promise((r) => setTimeout(r, ms));
  }

  /** "Pronto para chocar": bipe contínuo intermitente curto. */
  prontoParaChocar() {
    const t = this.agora;
    for (let i = 0; i < 4; i++) this.tom(2093, t + i * 0.18, 0.12, "square", 0.3);
  }

  /** Choque: estalo de ruído. */
  choque() {
    if (!this.ctx || !this.master || this.mudo) return;
    const t = this.agora;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.25, this.ctx.sampleRate);
    const dados = buf.getChannelData(0);
    for (let i = 0; i < dados.length; i++)
      dados[i] = (Math.random() * 2 - 1) * (1 - i / dados.length) ** 2;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = 0.6;
    src.buffer = buf;
    src.connect(g).connect(this.master);
    src.start(t);
  }

  fechar() {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}

/**
 * Metrônomo de compressões com pausa para ventilação (15:2 / 30:2) ou
 * contínuo com uma ventilação a cada `ventilacaoMs` (via aérea avançada).
 */
export class Metronomo {
  private timer: ReturnType<typeof setInterval> | null = null;
  private proxima = 0;
  private proximaVent = 0;
  private passo = 0;
  private visuais: ReturnType<typeof setTimeout>[] = [];

  constructor(
    private sons: Sons,
    private aoBater: (b: Batida) => void,
  ) {}

  get rodando() {
    return this.timer !== null;
  }

  iniciar(bpm: number, padrao: Padrao, ventilacaoMs = 2500) {
    this.parar();
    if (!this.sons.pronto) return;
    const intervalo = 60 / bpm;
    const pausaVent = 1.2; // ~1 s por ventilação
    this.passo = 0;
    this.proxima = this.sons.agora + 0.1;
    this.proximaVent = this.proxima + ventilacaoMs / 1000;
    const agendarVisual = (quando: number, b: Batida) => {
      const atraso = Math.max(0, (quando - this.sons.agora) * 1000);
      this.visuais.push(setTimeout(() => this.aoBater(b), atraso));
      // Só os agendados nos próximos ~150 ms importam; os antigos já dispararam.
      if (this.visuais.length > 32) this.visuais.splice(0, this.visuais.length - 32);
    };
    const tick = () => {
      const horizonte = this.sons.agora + 0.15;
      while (this.proxima < horizonte) {
        if (padrao === "continuo") {
          this.passo += 1;
          this.sons.clique(this.proxima, false);
          agendarVisual(this.proxima, { tipo: "compressao", n: this.passo, total: null });
          this.proxima += intervalo;
          while (this.proximaVent < this.proxima) {
            this.sons.ventilacao(this.proximaVent);
            agendarVisual(this.proximaVent, { tipo: "ventilacao", n: 1 });
            this.proximaVent += ventilacaoMs / 1000;
          }
          continue;
        }
        const cicloLen = padrao.compressoes + padrao.ventilacoes;
        const pos = this.passo % cicloLen;
        if (pos < padrao.compressoes) {
          this.sons.clique(this.proxima, pos === 0);
          agendarVisual(this.proxima, {
            tipo: "compressao",
            n: pos + 1,
            total: padrao.compressoes,
          });
          this.proxima += pos === padrao.compressoes - 1 ? 0.3 : intervalo;
        } else {
          const n = pos - padrao.compressoes + 1;
          this.sons.ventilacao(this.proxima);
          agendarVisual(this.proxima, { tipo: "ventilacao", n });
          this.proxima += pausaVent;
        }
        this.passo += 1;
      }
    };
    tick();
    this.timer = setInterval(tick, 25);
  }

  parar() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.visuais.forEach(clearTimeout);
    this.visuais = [];
  }
}
