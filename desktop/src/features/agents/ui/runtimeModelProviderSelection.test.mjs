import assert from "node:assert/strict";
import test from "node:test";

import {
  selectionOnModelDropdownChange,
  selectionOnProviderDropdownChange,
  selectionOnRuntimeChange,
} from "./runtimeModelProviderSelection.ts";

const base = {
  provider: "",
  model: "",
  isCustomProviderEditing: false,
  isCustomModelEditing: false,
  envVars: {},
};

// --- selectionOnRuntimeChange ---

test("runtime switch clears stale effort env aliases (native + ACP sentinel), preserving the Save-gated column", () => {
  // Claude/buzz-agent → Goose: the previous runtime's effort env aliases are
  // stale under Goose. They are cleared; unrelated env survives. The canonical
  // effort column is Save-gated, not in this state, so it is untouched here.
  const next = selectionOnRuntimeChange(
    {
      ...base,
      envVars: {
        BUZZ_ACP_EFFORT_LEVEL: "high",
        BUZZ_AGENT_THINKING_EFFORT: "medium",
        GOOSE_THINKING_EFFORT: "max",
        KEEP: "x",
      },
    },
    {
      previousRuntime: "buzz-agent",
      nextRuntime: "goose",
      nextRuntimeCanChooseProvider: true,
      lockedRuntimeReset: "full",
    },
  );
  assert.deepEqual(next.envVars, { KEEP: "x" });
});

test("no-op runtime change (previous === next) leaves effort env aliases intact", () => {
  const next = selectionOnRuntimeChange(
    { ...base, envVars: { GOOSE_THINKING_EFFORT: "high", KEEP: "x" } },
    {
      previousRuntime: "goose",
      nextRuntime: "goose",
      nextRuntimeCanChooseProvider: true,
      lockedRuntimeReset: "full",
    },
  );
  assert.deepEqual(next.envVars, { GOOSE_THINKING_EFFORT: "high", KEEP: "x" });
});

test("runtime change to a provider-locked runtime, full reset (Persona/Edit): clears provider, custom flags, and managed API key", () => {
  const next = selectionOnRuntimeChange(
    {
      ...base,
      provider: "anthropic",
      model: "claude-4",
      isCustomProviderEditing: true,
      isCustomModelEditing: true,
      envVars: { ANTHROPIC_API_KEY: "sk-1", KEEP: "x" },
    },
    {
      previousRuntime: "buzz-agent",
      nextRuntime: "claude",
      nextRuntimeCanChooseProvider: false,
      lockedRuntimeReset: "full",
    },
  );
  assert.equal(next.provider, "");
  assert.equal(next.isCustomProviderEditing, false);
  assert.equal(next.isCustomModelEditing, false);
  assert.deepEqual(next.envVars, { KEEP: "x" });
});

test("runtime change to a provider-locked runtime, provider-only reset (Create): keeps env vars and custom-model flag", () => {
  const next = selectionOnRuntimeChange(
    {
      ...base,
      provider: "anthropic",
      envVars: { ANTHROPIC_API_KEY: "sk-1" },
      isCustomModelEditing: true,
      model: "my-custom",
    },
    {
      previousRuntime: "buzz-agent",
      nextRuntime: "claude",
      nextRuntimeCanChooseProvider: false,
      lockedRuntimeReset: "provider-only",
    },
  );
  assert.equal(next.provider, "");
  assert.equal(next.isCustomProviderEditing, false);
  assert.deepEqual(next.envVars, { ANTHROPIC_API_KEY: "sk-1" });
});

test("runtime change between provider-selection runtimes keeps provider state", () => {
  const current = {
    ...base,
    provider: "anthropic",
    envVars: { ANTHROPIC_API_KEY: "sk-1" },
  };
  const next = selectionOnRuntimeChange(current, {
    previousRuntime: "goose",
    nextRuntime: "buzz-agent",
    nextRuntimeCanChooseProvider: true,
    lockedRuntimeReset: "full",
  });
  assert.equal(next.provider, "anthropic");
  assert.deepEqual(next.envVars, { ANTHROPIC_API_KEY: "sk-1" });
});

// --- selectionOnProviderDropdownChange ---

test("provider switch clears the previous managed API key and sets the provider", () => {
  const next = selectionOnProviderDropdownChange(
    {
      ...base,
      provider: "anthropic",
      envVars: { ANTHROPIC_API_KEY: "sk-1", KEEP: "x" },
    },
    {
      runtime: "buzz-agent",
      nextValue: "openai",
      clearModelWhenApiKeyMissing: false,
    },
  );
  assert.equal(next.provider, "openai");
  assert.equal(next.isCustomProviderEditing, false);
  assert.deepEqual(next.envVars, { KEEP: "x" });
});

test("custom-provider entry clears the managed key and enters custom editing", () => {
  const next = selectionOnProviderDropdownChange(
    {
      ...base,
      provider: "anthropic",
      envVars: { ANTHROPIC_API_KEY: "sk-1" },
    },
    {
      runtime: "buzz-agent",
      nextValue: "__custom_provider__",
      clearModelWhenApiKeyMissing: false,
    },
  );
  assert.equal(next.isCustomProviderEditing, true);
  assert.equal(next.provider, "");
  assert.deepEqual(next.envVars, {});
});

test("auto-provider selection maps to empty provider", () => {
  const next = selectionOnProviderDropdownChange(
    { ...base, provider: "anthropic", envVars: { ANTHROPIC_API_KEY: "sk-1" } },
    {
      runtime: "buzz-agent",
      nextValue: "__auto_provider__",
      clearModelWhenApiKeyMissing: false,
    },
  );
  assert.equal(next.provider, "");
  assert.deepEqual(next.envVars, {});
});

test("Persona mode clears the model when the new provider's API key is missing", () => {
  const next = selectionOnProviderDropdownChange(
    { ...base, model: "claude-4", provider: "" },
    {
      runtime: "buzz-agent",
      nextValue: "anthropic",
      clearModelWhenApiKeyMissing: true,
    },
  );
  assert.equal(next.model, "");
});

test("Create/Edit mode keeps the model when the new provider's API key is missing", () => {
  // claude-4 is scope-agnostic here: shouldClearKnownModelForSelectionScope
  // only clears known models for the selection scope, and a custom string
  // stays put — mirroring the dialogs' behavior without the persona flag.
  const next = selectionOnProviderDropdownChange(
    { ...base, model: "my-custom-model", provider: "" },
    {
      runtime: "buzz-agent",
      nextValue: "anthropic",
      clearModelWhenApiKeyMissing: false,
    },
  );
  assert.equal(next.model, "my-custom-model");
});

test("custom-model editing suppresses the model-scope clear on provider switch", () => {
  const next = selectionOnProviderDropdownChange(
    { ...base, model: "anything", isCustomModelEditing: true },
    {
      runtime: "buzz-agent",
      nextValue: "openai",
      clearModelWhenApiKeyMissing: false,
    },
  );
  assert.equal(next.model, "anything");
  assert.equal(next.isCustomModelEditing, true);
});

// --- selectionOnModelDropdownChange ---

test("custom-model entry with clear (Persona) drops a known model", () => {
  const next = selectionOnModelDropdownChange(
    { ...base, model: "known-model" },
    {
      nextValue: "__custom_model__",
      clearKnownModelOnCustomEntry: true,
      isModelCustom: false,
    },
  );
  assert.equal(next.isCustomModelEditing, true);
  assert.equal(next.model, "");
});

test("custom-model entry keeps an already-custom model (Persona) and any model (Edit)", () => {
  const personaCustom = selectionOnModelDropdownChange(
    { ...base, model: "already-custom" },
    {
      nextValue: "__custom_model__",
      clearKnownModelOnCustomEntry: true,
      isModelCustom: true,
    },
  );
  assert.equal(personaCustom.model, "already-custom");

  const edit = selectionOnModelDropdownChange(
    { ...base, model: "known-model" },
    {
      nextValue: "__custom_model__",
      clearKnownModelOnCustomEntry: false,
      isModelCustom: false,
    },
  );
  assert.equal(edit.model, "known-model");
  assert.equal(edit.isCustomModelEditing, true);
});

test("auto-model selection clears the model; concrete selection sets it", () => {
  const auto = selectionOnModelDropdownChange(
    { ...base, model: "old", isCustomModelEditing: true },
    {
      nextValue: "__auto_model__",
      clearKnownModelOnCustomEntry: false,
      isModelCustom: false,
    },
  );
  assert.equal(auto.model, "");
  assert.equal(auto.isCustomModelEditing, false);

  const concrete = selectionOnModelDropdownChange(
    { ...base, model: "" },
    {
      nextValue: "gpt-5",
      clearKnownModelOnCustomEntry: false,
      isModelCustom: false,
    },
  );
  assert.equal(concrete.model, "gpt-5");
});

// --- selectionOnProviderDropdownChange with custom providers & presets ---

test("selecting gemini provider sets default URL and model", () => {
  const next = selectionOnProviderDropdownChange(
    { ...base, provider: "", model: "" },
    {
      runtime: "buzz-agent",
      nextValue: "gemini",
      clearModelWhenApiKeyMissing: false,
    },
  );

  assert.equal(next.provider, "gemini");
  assert.equal(
    next.envVars["OPENAI_COMPAT_BASE_URL"],
    "https://generativelanguage.googleapis.com/v1beta/openai/",
  );
  assert.equal(next.model, "gemini-2.0-flash");
});

test("selecting custom provider routes baseUrl correctly per type", async () => {
  const { saveCustomApiProvider } = await import(
    "../lib/customApiProviders.ts"
  );
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    dispatchEvent: () => true,
  };

  // 1. OmniRouter (openai-compat)
  const omni = saveCustomApiProvider({
    id: "custom-omnirouter-test",
    name: "OmniRouter",
    apiKey: "sk-omni-test",
    type: "openai-compat",
    baseUrl: "http://localhost:20128/v1",
  });
  const omniNext = selectionOnProviderDropdownChange(
    { ...base, provider: "", model: "" },
    {
      runtime: "buzz-agent",
      nextValue: omni.id,
      clearModelWhenApiKeyMissing: false,
    },
  );
  assert.equal(omniNext.envVars["OPENAI_COMPAT_API_KEY"], "sk-omni-test");
  assert.equal(
    omniNext.envVars["OPENAI_COMPAT_BASE_URL"],
    "http://localhost:20128/v1",
  );

  // 2. OpenRouter (openrouter)
  const openrouter = saveCustomApiProvider({
    id: "custom-openrouter-test",
    name: "OpenRouter",
    apiKey: "sk-or-test",
    type: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "nvidia/nemotron-3.5-lightning:free",
  });
  const orNext = selectionOnProviderDropdownChange(
    { ...base, provider: "", model: "" },
    {
      runtime: "buzz-agent",
      nextValue: openrouter.id,
      clearModelWhenApiKeyMissing: false,
    },
  );
  assert.equal(orNext.envVars["OPENROUTER_API_KEY"], "sk-or-test");
  assert.equal(
    orNext.envVars["OPENROUTER_BASE_URL"],
    "https://openrouter.ai/api/v1",
  );
  assert.equal(orNext.model, "nvidia/nemotron-3.5-lightning:free");

  // 3. Anthropic (anthropic)
  const anthropic = saveCustomApiProvider({
    id: "custom-anthropic-test",
    name: "Anthropic",
    apiKey: "sk-ant-test",
    type: "anthropic",
    baseUrl: "https://custom.anthropic.endpoint",
  });
  const antNext = selectionOnProviderDropdownChange(
    { ...base, provider: "", model: "" },
    {
      runtime: "buzz-agent",
      nextValue: anthropic.id,
      clearModelWhenApiKeyMissing: false,
    },
  );
  assert.equal(antNext.envVars["ANTHROPIC_API_KEY"], "sk-ant-test");
  assert.equal(
    antNext.envVars["ANTHROPIC_BASE_URL"],
    "https://custom.anthropic.endpoint",
  );
});

