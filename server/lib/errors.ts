export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class AIUnavailableError extends HttpError {
  constructor(message = "IA indisponível: OPENAI_API_KEY não configurada.") {
    super(503, "ai_unavailable", message);
    this.name = "AIUnavailableError";
  }
}

export class AIResponseError extends HttpError {
  constructor(
    message: string,
    public readonly raw?: string,
  ) {
    super(502, "ai_invalid_response", message);
    this.name = "AIResponseError";
  }
}

/**
 * Modelo configurado que a OpenAI não aceita, ou chave sem acesso a ele.
 *
 * Existe para não cair no 500 genérico. Um `OPENAI_MODEL` com nome de exibição
 * em vez de ID ("GPT-5.6 Luna" em vez do identificador) fazia toda chamada de
 * IA responder "Erro interno no servidor" — sem dizer qual variável estava
 * errada nem qual valor foi recusado.
 */
export class ModeloIndisponivelError extends HttpError {
  constructor(modelo: string, motivo: string) {
    super(
      503,
      "modelo_indisponivel",
      `O modelo "${modelo}" não está disponível para esta chave: ${motivo} ` +
        "Confira OPENAI_MODEL (ou OPENAI_MODEL_VISAO / OPENAI_MODEL_COPILOTO) — " +
        "o valor precisa ser o ID da API, não o nome de exibição.",
    );
    this.name = "ModeloIndisponivelError";
  }
}
