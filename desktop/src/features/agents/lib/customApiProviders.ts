import * as React from "react";

export type CustomProviderType =
  | "openai-compat"
  | "anthropic"
  | "openrouter"
  | "gemini";

export interface CustomApiProvider {
  id: string;
  name: string;
  apiKey: string;
  type: CustomProviderType;
  baseUrl?: string;
  models?: string[];
  defaultModel?: string;
  createdAt: number;
}

export interface DetectedProviderInfo {
  type: CustomProviderType;
  name: string;
  envVar: string;
  baseUrl?: string;
  models?: string[];
  defaultModel?: string;
  hint: string;
}

const STORAGE_KEY = "buzz.custom-api-providers.v1";
const UPDATE_EVENT = "buzz:custom-api-providers-updated";

/**
 * Automatically inspects the API key format to detect the provider family,
 * recommended endpoint URL, and model suggestions.
 */
export function detectProviderFromApiKey(rawKey: string): DetectedProviderInfo {
  const key = rawKey.trim();

  // Anthropic API Key: starts with sk-ant-
  if (key.startsWith("sk-ant-")) {
    return {
      type: "anthropic",
      name: "Anthropic Claude",
      envVar: "ANTHROPIC_API_KEY",
      baseUrl: "https://api.anthropic.com",
      models: [
        "claude-3-7-sonnet-latest",
        "claude-3-5-sonnet-latest",
        "claude-3-5-haiku-latest",
      ],
      defaultModel: "claude-3-7-sonnet-latest",
      hint: "Распознан ключ Anthropic",
    };
  }

  // OpenRouter API Key: starts with sk-or-
  if (key.startsWith("sk-or-")) {
    return {
      type: "openrouter",
      name: "OpenRouter",
      envVar: "OPENROUTER_API_KEY",
      baseUrl: "https://openrouter.ai/api/v1",
      models: [
        "anthropic/claude-3.7-sonnet",
        "openai/gpt-4o",
        "deepseek/deepseek-chat",
      ],
      defaultModel: "anthropic/claude-3.7-sonnet",
      hint: "Распознан ключ OpenRouter",
    };
  }

  // Groq API Key: starts with gsk_
  if (key.startsWith("gsk_")) {
    return {
      type: "openai-compat",
      name: "Groq",
      envVar: "OPENAI_COMPAT_API_KEY",
      baseUrl: "https://api.groq.com/openai/v1",
      models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
      defaultModel: "llama-3.3-70b-versatile",
      hint: "Распознан ключ Groq (OpenAI-совместимый)",
    };
  }

  // xAI (Grok) API Key: starts with xai-
  if (key.startsWith("xai-")) {
    return {
      type: "openai-compat",
      name: "xAI (Grok)",
      envVar: "OPENAI_COMPAT_API_KEY",
      baseUrl: "https://api.x.ai/v1",
      models: ["grok-2", "grok-beta"],
      defaultModel: "grok-2",
      hint: "Распознан ключ xAI Grok",
    };
  }

  // Google Gemini API Key: starts with AIza
  if (key.startsWith("AIza")) {
    return {
      type: "gemini",
      name: "Google Gemini",
      envVar: "OPENAI_COMPAT_API_KEY",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
      defaultModel: "gemini-2.0-flash",
      hint: "Распознан ключ Google Gemini (AI Studio)",
    };
  }

  // Google OAuth Access Token (Bearer): starts with ya29.
  if (key.startsWith("ya29.")) {
    return {
      type: "gemini",
      name: "Google Gemini (Аккаунт Google)",
      envVar: "OPENAI_COMPAT_API_KEY",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      models: ["gemini-2.0-flash", "gemini-1.5-pro"],
      defaultModel: "gemini-2.0-flash",
      hint: "Распознан токен авторизации Google Аккаунта (OAuth)",
    };
  }

  // Generic OpenAI or OpenAI-compatible
  return {
    type: "openai-compat",
    name: "OpenAI-совместимый",
    envVar: "OPENAI_COMPAT_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    defaultModel: "gpt-4o",
    hint: "OpenAI-совместимый провайдер",
  };
}

export function getCustomApiProviders(): CustomApiProvider[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (p) => p && typeof p.id === "string" && typeof p.apiKey === "string",
      );
    }
    return [];
  } catch {
    return [];
  }
}

function notifyProvidersUpdated(): void {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
    }
  } catch {
    // Ignore environments where CustomEvent might be restricted
  }
}

export function saveCustomApiProvider(
  provider: Omit<CustomApiProvider, "id" | "createdAt"> & { id?: string },
): CustomApiProvider {
  const providers = getCustomApiProviders();
  const id =
    provider.id ||
    `custom-${provider.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "provider"}-${Date.now().toString(36)}`;

  const entry: CustomApiProvider = {
    id,
    name: provider.name.trim() || "Пользовательский провайдер",
    apiKey: provider.apiKey.trim(),
    type: provider.type,
    baseUrl: provider.baseUrl?.trim() || undefined,
    models: provider.models,
    defaultModel: provider.defaultModel,
    createdAt: Date.now(),
  };

  const existingIdx = providers.findIndex((p) => p.id === id);
  if (existingIdx >= 0) {
    providers[existingIdx] = entry;
  } else {
    providers.push(entry);
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
  } catch (err) {
    console.warn("Failed to persist custom API provider in localStorage:", err);
  }

  notifyProvidersUpdated();
  return entry;
}

export function deleteCustomApiProvider(id: string): void {
  const providers = getCustomApiProviders().filter((p) => p.id !== id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
  } catch (err) {
    console.warn("Failed to delete custom API provider from localStorage:", err);
  }
  notifyProvidersUpdated();
}

/**
 * Hook that provides a reactive, synchronized list of custom API providers.
 */
export function useCustomApiProviders(): {
  providers: CustomApiProvider[];
  saveProvider: typeof saveCustomApiProvider;
  deleteProvider: typeof deleteCustomApiProvider;
  refresh: () => void;
} {
  const [providers, setProviders] = React.useState<CustomApiProvider[]>(() =>
    getCustomApiProviders(),
  );

  const refresh = React.useCallback(() => {
    setProviders(getCustomApiProviders());
  }, []);

  React.useEffect(() => {
    function handleUpdate() {
      refresh();
    }
    window.addEventListener(UPDATE_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(UPDATE_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [refresh]);

  return {
    providers,
    saveProvider: saveCustomApiProvider,
    deleteProvider: deleteCustomApiProvider,
    refresh,
  };
}
