import * as React from "react";
import { Key, Sparkles, ExternalLink, Eye, EyeOff, Check, Loader2, Globe } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { useTranslation } from "@/shared/i18n";
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
  detectProviderFromApiKey,
  saveCustomApiProvider,
  type CustomApiProvider,
} from "../lib/customApiProviders";

interface CreateCustomProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProviderCreated?: (provider: CustomApiProvider) => void;
}

export function CreateCustomProviderDialog({
  open,
  onOpenChange,
  onProviderCreated,
}: CreateCustomProviderDialogProps) {
  const { dict } = useTranslation();
  const [apiKey, setApiKey] = React.useState("");
  const [providerName, setProviderName] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [userEditedName, setUserEditedName] = React.useState(false);
  const [userEditedBaseUrl, setUserEditedBaseUrl] = React.useState(false);
  const [isWaitingForLogin, setIsWaitingForLogin] = React.useState(false);
  const [loginSuccess, setLoginSuccess] = React.useState(false);

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

  function handleReset() {
    setApiKey("");
    setProviderName("");
    setBaseUrl("");
    setShowKey(false);
    setUserEditedName(false);
    setUserEditedBaseUrl(false);
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
    setIsWaitingForLogin(true);
    setLoginSuccess(false);
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
      } | null>("get_gemini_cookies");
      if (session && (session.cookieHeader || session.psid)) {
        setApiKey(session.cookieHeader || session.psid);
        setLoginSuccess(true);
      }
    } catch (err) {
      console.warn("Could not retrieve existing cookies:", err);
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
      name: finalName,
      apiKey: trimmedKey,
      type: detectedInfo.type,
      baseUrl: finalBaseUrl || undefined,
      models: detectedInfo.models,
      defaultModel: detectedInfo.defaultModel,
    });

    onProviderCreated?.(created);
    handleClose(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <span>Добавить API провайдер</span>
          </DialogTitle>
          <DialogDescription>
            Вставьте API-ключ. Сервис (Google Gemini, Anthropic, OpenRouter, Groq
            или OpenAI) будет распознан автоматически.
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
                autoFocus
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
                onClick={() =>
                  void openUrl("https://openrouter.ai/keys")
                }
              >
                <ExternalLink className="h-3 w-3" /> OpenRouter
              </button>
              <span>·</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-primary hover:underline"
                onClick={() =>
                  void openUrl("https://console.groq.com/keys")
                }
              >
                <ExternalLink className="h-3 w-3" /> Groq
              </button>
              <span>·</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-primary hover:underline"
                onClick={() =>
                  void openUrl("https://gemini.google.com")
                }
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

            <details className="mt-1.5 text-xs text-muted-foreground/80 cursor-pointer select-none">
              <summary className="font-medium hover:text-foreground">
                Ручной ввод куки (альтернатива)
              </summary>
              <div className="mt-1.5 leading-relaxed bg-background/70 p-2 rounded border border-border/50 text-2xs space-y-1">
                <p>1. Откройте <strong>gemini.google.com</strong> в браузере со своей учетной записью.</p>
                <p>2. Нажмите <strong>F12</strong> → вкладка <strong>Application</strong> (или «Хранилище») → <strong>Cookies</strong> → <code>https://gemini.google.com</code>.</p>
                <p>3. Скопируйте значение куки <strong>__Secure-1PSID</strong> (начинается с <code>g.a000...</code>) и вставьте его в поле ключа выше.</p>
              </div>
            </details>
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
              placeholder="Например, Google Gemini или DeepSeek"
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

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={!apiKey.trim()}>
              Сохранить провайдер
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
