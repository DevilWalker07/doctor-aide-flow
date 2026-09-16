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
  constructor(message: string, public readonly raw?: string) {
    super(502, "ai_invalid_response", message);
    this.name = "AIResponseError";
  }
}
