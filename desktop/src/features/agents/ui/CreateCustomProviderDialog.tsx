import * as React from "react";
import {
  Key,
  Sparkles,
  ExternalLink,
  Eye,
  EyeOff,
  Check,
  Loader2,
  Globe,
  Cpu,
  DownloadCloud,
  X,
  Star,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { useTranslation } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  COMMON_PROVIDER_MODEL_PRESETS,
  detectProviderFromApiKey,
  probeCustomProviderModels,
  saveCustomApiProvider,
  type CustomApiProvider,
} from "../lib/customApiProviders";

interface CreateCustomProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProviderCreated?: (provider: CustomApiProvider) => void;
  initialProvider?: CustomApiProvider | null;
}

export function CreateCustomProviderDialog({
  open,
  onOpenChange,
  onProviderCreated,
  initialProvider,
}: CreateCustomProviderDialogProps) {
  const { dict } = useTranslation();
  const isEdit = Boolean(initialProvider);

  const [apiKey, setApiKey] = React.useState("");
  const [providerName, setProviderName] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [models, setModels] = React.useState<string[]>([]);
  const [defaultModel, setDefaultModel] = React.useState<string>("");
  const [newModelInput, setNewModelInput] = React.useState("");
  const [isProbingModels, setIsProbingModels] = React.useState(false);
  const [probeError, setProbeError] = React.useState<string | null>(null);
  const [probeSuccessCount, setProbeSuccessCount] = React.useState<number | null>(null);

  const [showKey, setShowKey] = React.useState(false);
  const [userEditedName, setUserEditedName] = React.useState(false);
  const [userEditedBaseUrl, setUserEditedBaseUrl] = React.useState(false);
  const [userEditedModels, setUserEditedModels] = React.useState(false);
  const [isWaitingForLogin, setIsWaitingForLogin] = React.useState(false);
  const [loginSuccess, setLoginSuccess] = React.useState(false);

  // Initialize or reset when open / initialProvider changes
  React.useEffect(() => {
    if (!open) return;
    if (initialProvider) {
      setApiKey(initialProvider.apiKey);
      setProviderName(initialProvider.name);
      setBaseUrl(initialProvider.baseUrl || "");
      setModels(initialProvider.models || []);
      setDefaultModel(
        initialProvider.defaultModel || (initialProvider.models?.[0] ?? ""),
      );
      setUserEditedName(true);
      setUserEditedBaseUrl(true);
      setUserEditedModels(true);
    } else {
      setApiKey("");
      setProviderName("");
      setBaseUrl("");
      setModels([]);
      setDefaultModel("");
      setUserEditedName(false);
      setUserEditedBaseUrl(false);
      setUserEditedModels(false);
    }
    setNewModelInput("");
    setIsProbingModels(false);
    setProbeError(null);
    setProbeSuccessCount(null);
    setShowKey(false);
    setIsWaitingForLogin(false);
    setLoginSuccess(false);
  }, [open, initialProvider]);

  // Listen for background captured session cookies from the native Gemini login window
  React.useEffect(() => {
    if (!open) return;
    let unlisten: UnlistenFn | undefined;
    let isSubscribed = true;

    async function bindListener() {
      try {
        unlisten = await listen<{
          psid: string;
          psidts?: string;
          psidcc?: string;
          cookieHeader: string;
        }>("gemini-cookies-captured", (event) => {
          if (!isSubscribed) return;
          const session = event.payload;
          const val = session?.cookieHeader || session?.psid;
          if (val) {
            setApiKey(val);
            setIsWaitingForLogin(false);
            setLoginSuccess(true);
          }
        });
      } catch (err) {
        console.warn("Failed to listen for gemini cookies:", err);
      }
    }

    void bindListener();

    return () => {
      isSubscribed = false;
      unlisten?.();
    };
  }, [open]);

  const detected = React.useMemo(() => {
    if (!apiKey.trim()) return null;
    return detectProviderFromApiKey(apiKey);
  }, [apiKey]);

  // Sync auto-detected name until user manually overrides it
  React.useEffect(() => {
    if (!userEditedName && detected) {
      setProviderName(detected.name);
    }
  }, [detected, userEditedName]);

  // Sync auto-detected base URL until user manually overrides it
  React.useEffect(() => {
    if (!userEditedBaseUrl && detected?.baseUrl) {
      setBaseUrl(detected.baseUrl);
    }
  }, [detected, userEditedBaseUrl]);

  // Sync auto-detected models until user manually overrides them
  React.useEffect(() => {
    if (!userEditedModels && detected?.models) {
      setModels(detected.models);
      if (detected.defaultModel) {
        setDefaultModel(detected.defaultModel);
      }
    }
  }, [detected, userEditedModels]);

  function handleReset() {
    setApiKey("");
    setProviderName("");
    setBaseUrl("");
    setModels([]);
    setDefaultModel("");
    setNewModelInput("");
    setIsProbingModels(false);
    setProbeError(null);
    setProbeSuccessCount(null);
    setShowKey(false);
    setUserEditedName(false);
    setUserEditedBaseUrl(false);
    setUserEditedModels(false);
    setIsWaitingForLogin(false);
    setLoginSuccess(false);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      handleReset();
      if (isWaitingForLogin) {
        void invoke("close_gemini_login_window");
      }
    }
    onOpenChange(nextOpen);
  }

  async function handleAutoLogin() {
    setLoginSuccess(false);
    try {
      const existing = await invoke<{
        psid: string;
        psidts?: string;
        psidcc?: string;
        cookieHeader: string;
      } | null>("get_gemini_cookies");
      if (existing && (existing.cookieHeader || existing.psid)) {
        setApiKey(existing.cookieHeader || existing.psid);
        setLoginSuccess(true);
        return;
      }
    } catch (err) {
      console.warn("Probe existing cookies failed:", err);
    }

    setIsWaitingForLogin(true);
    try {
      await invoke("open_gemini_login_window");
    } catch (err) {
      console.error("Failed to open Gemini login window:", err);
      setIsWaitingForLogin(false);
    }
  }

  async function handleCheckExisting() {
    try {
      const session = await invoke<{
        psid: string;
        psidts?: string;
        psidcc?: string;
        cookieHeader: string;
      } | null>("import_browser_gemini_cookies");
      if (session && (session.cookieHeader || session.psid)) {
        setApiKey(session.cookieHeader || session.psid);
        setLoginSuccess(true);
      }
    } catch (err) {
      console.warn("Could not retrieve browser cookies:", err);
    }
  }

  async function handleProbeModels() {
    const targetUrl = baseUrl.trim() || detected?.baseUrl;
    if (!targetUrl) {
      setProbeError("Укажите Base URL для загрузки списка моделей");
      return;
    }
    setIsProbingModels(true);
    setProbeError(null);
    setProbeSuccessCount(null);
    try {
      const fetched = await probeCustomProviderModels(
        targetUrl,
        apiKey.trim(),
        detected?.type,
      );
      setModels(fetched);
      setUserEditedModels(true);
      if (!defaultModel || !fetched.includes(defaultModel)) {
        setDefaultModel(fetched[0] ?? "");
      }
      setProbeSuccessCount(fetched.length);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setProbeError(msg);
    } finally {
      setIsProbingModels(false);
    }
  }

  function handleAddModel() {
    const trimmed = newModelInput.trim();
    if (!trimmed) return;
    if (!models.includes(trimmed)) {
      const updated = [...models, trimmed];
      setModels(updated);
      setUserEditedModels(true);
      if (!defaultModel) {
        setDefaultModel(trimmed);
      }
    }
    setNewModelInput("");
  }

  function handleRemoveModel(m: string) {
    const updated = models.filter((item) => item !== m);
    setModels(updated);
    setUserEditedModels(true);
    if (defaultModel === m) {
      setDefaultModel(updated[0] ?? "");
    }
  }

  function applyPreset(presetKey: string) {
    const preset = COMMON_PROVIDER_MODEL_PRESETS[presetKey];
    if (preset) {
      const merged = Array.from(new Set([...models, ...preset]));
      setModels(merged);
      setUserEditedModels(true);
      if (!defaultModel && merged[0]) {
        setDefaultModel(merged[0]);
      }
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) return;

    const detectedInfo = detectProviderFromApiKey(trimmedKey);
    const finalName = userEditedName
      ? providerName.trim() || detectedInfo.name
      : detectedInfo.name;
    const finalBaseUrl = userEditedBaseUrl
      ? baseUrl.trim() || undefined
      : detectedInfo.baseUrl;

    const created = saveCustomApiProvider({
      id: initialProvider?.id,
      name: finalName,
      apiKey: trimmedKey,
      type: detectedInfo.type,
      baseUrl: finalBaseUrl || undefined,
      models: models.length > 0 ? models : detectedInfo.models,
      defaultModel: defaultModel || models[0] || detectedInfo.defaultModel,
    });

    onProviderCreated?.(created);
    handleClose(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <span>
              {isEdit ? "Редактировать API провайдер" : "Добавить API провайдер"}
            </span>
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Измените параметры провайдера, список моделей и модель по умолчанию."
              : "Вставьте API-ключ. Сервис (Google Gemini, Anthropic, OpenRouter, Groq или OpenAI) будет распознан автоматически."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* API Key field */}
          <div className="space-y-1.5">
            <label
              htmlFor="custom-provider-api-key"
              className="text-sm font-medium text-foreground flex items-center justify-between"
            >
              <span>Ключ API (или токен) *</span>
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {showKey ? (
                  <>
                    <EyeOff className="h-3 w-3" /> Скрыть
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3" /> Показать
                  </>
                )}
              </button>
            </label>
            <div className="relative">
              <Input
                id="custom-provider-api-key"
                type={showKey ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                autoFocus={!isEdit}
                placeholder="sk-..., AIza..., gsk_..., ya29...."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-xs pr-8"
              />
              {detected ? (
                <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
              ) : null}
            </div>
          </div>

          {/* Quick links to get keys */}
          <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground space-y-1.5">
            <div className="font-medium text-foreground flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Получить ключ в один клик:</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-primary hover:underline"
                onClick={() =>
                  void openUrl("https://aistudio.google.com/app/apikey")
                }
              >
                <ExternalLink className="h-3 w-3" /> Google Gemini (AI Studio)
              </button>
              <span>·</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-primary hover:underline"
                onClick={() => void openUrl("https://openrouter.ai/keys")}
              >
                <ExternalLink className="h-3 w-3" /> OpenRouter
              </button>
              <span>·</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-primary hover:underline"
                onClick={() => void openUrl("https://console.groq.com/keys")}
              >
                <ExternalLink className="h-3 w-3" /> Groq
              </button>
              <span>·</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-primary hover:underline"
                onClick={() => void openUrl("https://gemini.google.com")}
              >
                <ExternalLink className="h-3 w-3" /> Gemini Web
              </button>
            </div>

            {/* Automated Gemini Web Connection */}
            <div className="pt-2 border-t border-border/40 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <span>Gemini Web (Подписка):</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoLogin}
                    disabled={isWaitingForLogin}
                    className="h-7 text-xs px-2.5 gap-1.5 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-medium"
                  >
                    {isWaitingForLogin ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        <span>{dict.geminiBridge.waitingLogin}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span>{dict.geminiBridge.autoLoginBtn}</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCheckExisting}
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                    title={dict.geminiBridge.checkExisting}
                  >
                    {dict.geminiBridge.checkExisting}
                  </Button>
                </div>
              </div>

              {isWaitingForLogin && (
                <div className="flex items-center justify-between p-2 rounded bg-amber-500/10 border border-amber-500/30 text-2xs text-amber-700 dark:text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {dict.geminiBridge.waitingLogin}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void invoke("close_gemini_login_window");
                      setIsWaitingForLogin(false);
                    }}
                    className="text-2xs underline hover:opacity-80 font-medium ml-2"
                  >
                    {dict.common.cancel}
                  </button>
                </div>
              )}

              {loginSuccess && (
                <div className="flex items-center gap-1.5 p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-2xs text-emerald-700 dark:text-emerald-300 font-medium">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  {dict.geminiBridge.loginSuccess}
                </div>
              )}
            </div>
          </div>

          {/* Detected badge & name */}
          {detected ? (
            <div className="rounded-lg border border-border/60 bg-accent/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Определённый тип:</span>
                <span className="font-semibold text-foreground px-2 py-0.5 rounded bg-background border text-xs">
                  {detected.hint}
                </span>
              </div>
              {detected.baseUrl ? (
                <div className="text-xs text-muted-foreground truncate">
                  <span className="font-medium">URL: </span>
                  <code>{detected.baseUrl}</code>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Provider name input */}
          <div className="space-y-1.5">
            <label
              htmlFor="custom-provider-name"
              className="text-sm font-medium text-foreground"
            >
              Название провайдера
            </label>
            <Input
              id="custom-provider-name"
              type="text"
              placeholder="Например, DeepSeek, Google Gemini или OpenAI"
              value={providerName}
              onChange={(e) => {
                setUserEditedName(true);
                setProviderName(e.target.value);
              }}
            />
          </div>

          {/* Base URL input */}
          <div className="space-y-1.5">
            <label
              htmlFor="custom-provider-base-url"
              className="text-sm font-medium text-foreground flex items-center justify-between"
            >
              <span>Базовый URL (Base URL)</span>
              <span className="text-xs text-muted-foreground font-normal">
                Опционально (OmniRouter, LiteLLM, Ollama)
              </span>
            </label>
            <Input
              id="custom-provider-base-url"
              type="text"
              placeholder="http://localhost:20128/v1 или https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => {
                setUserEditedBaseUrl(true);
                setBaseUrl(e.target.value);
              }}
              className="font-mono text-xs"
            />
          </div>

          {/* Models Section */}
          <div className="space-y-2.5 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-primary" />
                <span>Модели провайдера ({models.length})</span>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleProbeModels}
                disabled={isProbingModels || (!baseUrl.trim() && !detected?.baseUrl)}
                className="h-7 text-xs px-2.5 gap-1.5 border-primary/30 hover:bg-primary/10 text-primary"
                title="Загрузить список доступных моделей с сервера провайдера (/v1/models)"
              >
                {isProbingModels ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span>Загрузка моделей...</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud className="h-3.5 w-3.5" />
                    <span>Получить модели с сервера</span>
                  </>
                )}
              </Button>
            </div>

            {probeError && (
              <div className="p-2 rounded bg-destructive/10 border border-destructive/30 text-2xs text-destructive leading-relaxed break-words">
                {probeError}
              </div>
            )}

            {probeSuccessCount !== null && (
              <div className="flex items-center gap-1 p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-2xs text-emerald-700 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Успешно загружено моделей с сервера: {probeSuccessCount}</span>
              </div>
            )}

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap text-2xs text-muted-foreground">
              <span>Быстрые пресеты:</span>
              <button
                type="button"
                onClick={() => applyPreset("deepseek")}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border text-2xs"
              >
                DeepSeek
              </button>
              <button
                type="button"
                onClick={() => applyPreset("openrouter_free")}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border text-2xs"
              >
                OpenRouter (Free)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("openai")}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border text-2xs"
              >
                OpenAI
              </button>
              <button
                type="button"
                onClick={() => applyPreset("qwen")}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border text-2xs"
              >
                Qwen
              </button>
              <button
                type="button"
                onClick={() => applyPreset("llama")}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border text-2xs"
              >
                Llama
              </button>
            </div>

            {/* Models list & chips */}
            <div className="max-h-36 overflow-y-auto p-2 rounded-md border border-border/60 bg-background/50 flex flex-wrap gap-1.5">
              {models.length === 0 ? (
                <span className="text-xs text-muted-foreground italic py-1">
                  Модели не добавлены. Введите название ниже или нажмите «Получить модели с сервера».
                </span>
              ) : (
                models.map((m) => {
                  const isDef = m === defaultModel;
                  return (
                    <span
                      key={m}
                      className={cn(
                        "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors",
                        isDef
                          ? "bg-primary/15 border-primary text-primary font-medium"
                          : "bg-muted/60 border-border text-foreground hover:bg-muted",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setDefaultModel(m)}
                        title={
                          isDef
                            ? "Модель по умолчанию"
                            : "Нажмите, чтобы сделать моделью по умолчанию"
                        }
                        className="flex items-center gap-1"
                      >
                        {isDef ? (
                          <Star className="h-3 w-3 fill-primary text-primary shrink-0" />
                        ) : null}
                        <span className="font-mono text-2xs">{m}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveModel(m)}
                        className="hover:text-destructive text-muted-foreground ml-0.5 shrink-0"
                        title="Удалить модель"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })
              )}
            </div>

            {/* Add custom model input */}
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Добавить модель (например, deepseek-v4-flash или deepseek-chat)"
                value={newModelInput}
                onChange={(e) => setNewModelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddModel();
                  }
                }}
                className="text-xs h-8 font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddModel}
                disabled={!newModelInput.trim()}
                className="h-8 text-xs shrink-0"
              >
                Добавить
              </Button>
            </div>

            {models.length > 0 && (
              <div className="text-2xs text-muted-foreground flex items-center justify-between gap-2 flex-wrap pt-0.5">
                <span>
                  По умолчанию:{" "}
                  <strong className="text-foreground font-mono">
                    {defaultModel || "Первая из списка"}
                  </strong>
                </span>
                <span className="text-muted-foreground/80">
                  (Кликните по модели, чтобы назначить её по умолчанию)
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={!apiKey.trim()}>
              {isEdit ? "Сохранить изменения" : "Сохранить провайдер"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
