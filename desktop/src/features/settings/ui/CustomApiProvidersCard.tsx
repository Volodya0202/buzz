import * as React from "react";
import { Plus, Trash2, Key, Sparkles, ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

import { Button } from "@/shared/ui/button";
import {
  useCustomApiProviders,
  type CustomApiProvider,
} from "@/features/agents/lib/customApiProviders";
import { CreateCustomProviderDialog } from "@/features/agents/ui/CreateCustomProviderDialog";
import { SettingsOptionGroup } from "./SettingsOptionGroup";

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export function CustomApiProvidersCard() {
  const { providers, deleteProvider } = useCustomApiProviders();
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  return (
    <>
      <SettingsOptionGroup
        data-testid="settings-custom-api-providers"
        title="Кастомные API провайдеры"
        description="Подключение собственных моделей и сервисов (Google Gemini, Groq, OpenRouter, Anthropic и др.) только по ключу API."
      >
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {providers.length === 0
                ? "У вас пока нет добавленных кастомных API провайдеров."
                : `Настроено провайдеров: ${providers.length}`}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Добавить провайдер</span>
            </Button>
          </div>

          {providers.length > 0 ? (
            <div className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden bg-background">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-3 gap-3 text-sm"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {provider.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                        {provider.type === "gemini"
                          ? "Google Gemini"
                          : provider.type === "anthropic"
                            ? "Anthropic"
                            : provider.type === "openrouter"
                              ? "OpenRouter"
                              : "OpenAI-совместимый"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      <Key className="h-3 w-3 text-muted-foreground/70" />
                      <span>{maskKey(provider.apiKey)}</span>
                      {provider.baseUrl ? (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[200px]">
                            {provider.baseUrl}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8"
                    onClick={() => deleteProvider(provider.id)}
                    title="Удалить провайдер"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Quick tips about Gemini and other accounts */}
          <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-xs text-muted-foreground space-y-1.5">
            <div className="font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Подключение Google Gemini через Google-аккаунт:</span>
            </div>
            <p>
              Вы можете бесплатно получить ключ Gemini в Google AI Studio,
              войдя через свой Google-аккаунт, и вставить его здесь. Ключ
              начинается на <code>AIza...</code> и работает со всеми моделями
              (Gemini 2.0 Flash, 1.5 Pro).
            </p>
            <div className="pt-1">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                onClick={() =>
                  void openUrl("https://aistudio.google.com/app/apikey")
                }
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Открыть Google AI Studio для входа в аккаунт</span>
              </button>
            </div>
          </div>
        </div>
      </SettingsOptionGroup>

      <CreateCustomProviderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
