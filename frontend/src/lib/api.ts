const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

let memoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  memoryToken = token;
}

export async function secureFetch(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (memoryToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${memoryToken}`);
  }

  // Gera chave única de idempotência automática para requisições mutáveis
  if (options.method && ["POST", "PATCH"].includes(options.method.toUpperCase())) {
    if (!headers.has("Idempotency-Key")) {
      headers.set("Idempotency-Key", crypto.randomUUID());
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Erro na comunicação com o servidor.");
  }
  return data;
}
