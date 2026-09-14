import * as React from "react";
import { Key, Sparkles, ExternalLink, Eye, EyeOff, Check } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

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
  const [apiKey, setApiKey] = React.useState("");
  const [providerName, setProviderName] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [userEditedName, setUserEditedName] = React.useState(false);

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

  function handleReset() {
    setApiKey("");
    setProviderName("");
    setShowKey(false);
    setUserEditedName(false);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      handleReset();
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) return;

    const detectedInfo = detectProviderFromApiKey(trimmedKey);
    const finalName = providerName.trim() || detectedInfo.name;

    const created = saveCustomApiProvider({
      name: finalName,
      apiKey: trimmedKey,
      type: detectedInfo.type,
      baseUrl: detectedInfo.baseUrl,
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
              placeholder="Например, Google Gemini или DeepSeek"
              value={providerName}
              onChange={(e) => {
                setUserEditedName(true);
                setProviderName(e.target.value);
              }}
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
