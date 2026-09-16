import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  deleteCustomApiProvider,
  detectProviderFromApiKey,
  getCustomApiProviders,
  saveCustomApiProvider,
} from "./customApiProviders.ts";

// Setup mock window and localStorage for node environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();
globalThis.window = {
  localStorage: mockStorage,
  dispatchEvent: () => true,
};

beforeEach(() => {
  mockStorage.clear();
});

// ── detectProviderFromApiKey ───────────────────────────────────────────────

test("detectProviderFromApiKey identifies Anthropic keys", () => {
  const result = detectProviderFromApiKey("sk-ant-api03-abcdef12345");
  assert.equal(result.type, "anthropic");
  assert.equal(result.envVar, "ANTHROPIC_API_KEY");
  assert.equal(result.baseUrl, "https://api.anthropic.com");
  assert.equal(result.defaultModel, "claude-3-7-sonnet-latest");
});

test("detectProviderFromApiKey identifies OpenRouter keys and free model presets", () => {
  const result = detectProviderFromApiKey("sk-or-v1-abcdef1234567890");
  assert.equal(result.type, "openrouter");
  assert.equal(result.envVar, "OPENROUTER_API_KEY");
  assert.equal(result.baseUrl, "https://openrouter.ai/api/v1");
  assert.equal(result.defaultModel, "nvidia/nemotron-3.5-lightning:free");
  assert.ok(result.models?.includes("nvidia/nemotron-3.5-lightning:free"));
  assert.ok(result.models?.includes("google/gemma-4-31b-it:free"));
  assert.ok(result.models?.includes("anthropic/claude-3.7-sonnet"));
});

test("detectProviderFromApiKey identifies Groq keys", () => {
  const result = detectProviderFromApiKey("gsk_abcdef123456");
  assert.equal(result.type, "openai-compat");
  assert.equal(result.envVar, "OPENAI_COMPAT_API_KEY");
  assert.equal(result.baseUrl, "https://api.groq.com/openai/v1");
  assert.equal(result.defaultModel, "llama-3.3-70b-versatile");
});

test("detectProviderFromApiKey identifies Google Gemini keys (AI Studio)", () => {
  const result = detectProviderFromApiKey("AIzaSyD-1234567890");
  assert.equal(result.type, "gemini");
  assert.equal(result.envVar, "OPENAI_COMPAT_API_KEY");
  assert.equal(
    result.baseUrl,
    "https://generativelanguage.googleapis.com/v1beta/openai/",
  );
  assert.equal(result.defaultModel, "gemini-2.0-flash");
  assert.ok(result.models?.includes("gemini-3.8-flash"));
  assert.ok(result.models?.includes("gemini-2.0-flash"));
});

test("detectProviderFromApiKey identifies Gemini Web session cookies", () => {
  const result = detectProviderFromApiKey("__Secure-1PSID=test-cookie-123");
  assert.equal(result.type, "gemini-web");
  assert.equal(result.envVar, "GEMINI_SESSION_COOKIE");
  assert.equal(result.baseUrl, "http://127.0.0.1:20129/v1");
  assert.equal(result.defaultModel, "gemini-advanced");
  assert.ok(result.models?.includes("gemini-3.8-flash"));
  assert.ok(result.models?.includes("gemini-advanced"));
});

test("detectProviderFromApiKey identifies Google OAuth Bearer token", () => {
  const result = detectProviderFromApiKey("ya29.a0AfH6SMC...");
  assert.equal(result.type, "gemini");
  assert.equal(result.envVar, "OPENAI_COMPAT_API_KEY");
  assert.equal(result.defaultModel, "gemini-2.0-flash");
  assert.ok(result.models?.includes("gemini-3.8-flash"));
});

test("detectProviderFromApiKey falls back to openai-compat for generic/omnirouter keys", () => {
  const result = detectProviderFromApiKey("sk-local-omniroute-key-12345");
  assert.equal(result.type, "openai-compat");
  assert.equal(result.envVar, "OPENAI_COMPAT_API_KEY");
  assert.equal(result.baseUrl, "https://api.openai.com/v1");
});

// ── saveCustomApiProvider, getCustomApiProviders, deleteCustomApiProvider ──

test("saveCustomApiProvider persists provider with custom OmniRouter baseUrl", () => {
  const provider = saveCustomApiProvider({
    name: "OmniRouter Local",
    apiKey: "sk-e3cbb57cf6917a91-4d9484-9a3ecfa6",
    type: "openai-compat",
    baseUrl: "http://localhost:20128/v1",
    models: ["groq/llama-3.3-70b-versatile", "gemini-2.0-flash"],
    defaultModel: "gemini-2.0-flash",
  });

  assert.ok(provider.id.startsWith("custom-omnirouter-local-"));
  assert.equal(provider.name, "OmniRouter Local");
  assert.equal(provider.baseUrl, "http://localhost:20128/v1");

  const list = getCustomApiProviders();
  assert.equal(list.length, 1);
  assert.equal(list[0]?.id, provider.id);
  assert.equal(list[0]?.baseUrl, "http://localhost:20128/v1");
});

test("saveCustomApiProvider generates distinct collision-safe IDs for rapid saves", () => {
  const p1 = saveCustomApiProvider({
    name: "OpenRouter Provider",
    apiKey: "sk-or-1",
    type: "openrouter",
  });
  const p2 = saveCustomApiProvider({
    name: "OpenRouter Provider",
    apiKey: "sk-or-2",
    type: "openrouter",
  });

  assert.notEqual(p1.id, p2.id);
  const list = getCustomApiProviders();
  assert.equal(list.length, 2);
});

test("deleteCustomApiProvider removes provider by ID", () => {
  const p = saveCustomApiProvider({
    name: "To Delete",
    apiKey: "key-123",
    type: "openai-compat",
  });
  assert.equal(getCustomApiProviders().length, 1);

  deleteCustomApiProvider(p.id);
  assert.equal(getCustomApiProviders().length, 0);
});
