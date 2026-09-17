import { API_BASE } from "./clinicalAgentsConfig";

type TokenProvider = () => Promise<string | null>;
let tokenProvider: TokenProvider = async () => null;
let onUnauthorized: () => void = () => {};

export function setTokenProvider(fn: TokenProvider) {
  tokenProvider = fn;
}

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** O servidor não respondeu — não adianta reformular a chamada. */
  get inalcancavel(): boolean {
    return this.status === 0 || this.status === 503;
  }
}

/**
 * Servidor inalcançável: o `fetch` nem chegou a receber resposta.
 *
 * Não é o mesmo que uma chamada que falhou — e a diferença importa, porque o
 * médico precisa saber se vale tentar de novo ou se o servidor caiu inteiro.
 * `status` 0 marca isso; `ApiError.inalcancavel` é a leitura.
 */
export const SERVIDOR_INALCANCAVEL = "servidor_inalcancavel";

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);

  // Obter o token pode falhar sozinho — sessão guardada que não casa mais com
  // a chave do Supabase, por exemplo. Isso não é motivo para abortar: rota
  // pública como /health não precisa de token, e rota protegida responde 401,
  // que já tem tratamento. Antes a exceção escapava daqui e era contada como
  // "servidor fora do ar".
  let token: string | null = null;
  try {
    token = await tokenProvider();
  } catch (err) {
    console.warn("[apiClient] não foi possível obter o token de acesso:", err);
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      0,
      SERVIDOR_INALCANCAVEL,
      "Servidor de IA fora do ar. Documentos e impressão continuam funcionando.",
    );
  }
  if (response.status === 401) onUnauthorized();
  return response;
}

async function readError(response: Response): Promise<ApiError> {
  const payload = await response.json().catch(() => null);
  const message =
    (payload && typeof payload === "object" && (payload.message || payload.error)) ||
    `Erro ${response.status}`;
  const code = (payload && typeof payload === "object" && payload.error) || "http_error";
  return new ApiError(
    response.status,
    String(code),
    String(message),
    payload?.details ?? payload?.issues,
  );
}

export async function apiJson<T>(path: string, body: unknown, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, {
    method: "POST",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await apiFetch(path, { method: "POST", body: formData });
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<T>;
}

export { readError as apiReadError };
