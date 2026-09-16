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
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = await tokenProvider();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
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
