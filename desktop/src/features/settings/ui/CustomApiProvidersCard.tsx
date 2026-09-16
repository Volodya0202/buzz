import * as React from "react";
import { Plus, Trash2, Key, Sparkles, ExternalLink, Pencil, Cpu, Star } from "lucide-react";
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
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingProvider, setEditingProvider] = React.useState<CustomApiProvider | null>(null);

  function handleOpenCreate() {
    setEditingProvider(null);
    setDialogOpen(true);
  }

  function handleOpenEdit(provider: CustomApiProvider) {
    setEditingProvider(provider);
    setDialogOpen(true);
  }

  function handleDialogClose(open: boolean) {
    if (!open) {
      setEditingProvider(null);
    }
    setDialogOpen(open);
  }

  return (
    <>
      <SettingsOptionGroup
        data-testid="settings-custom-api-providers"
        title="Кастомные API провайдеры"
        description="Подключение собственных моделей и сервисов (Google Gemini, Groq, OpenRouter, DeepSeek, Anthropic и др.) по ключу API с автополучением моделей."
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
              onClick={handleOpenCreate}
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
                  className="flex items-start justify-between p-3 gap-3 text-sm"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">
                        {provider.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                        {provider.type === "gemini"
                          ? "Google Gemini"
                          : provider.type === "gemini-web"
                            ? "Gemini Web (Подписка)"
                            : provider.type === "anthropic"
                              ? "Anthropic"
                              : provider.type === "openrouter"
                                ? "OpenRouter"
                                : "OpenAI-совместимый"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Key className="h-3 w-3 text-muted-foreground/70" />
                        <span>{maskKey(provider.apiKey)}</span>
                      </span>
                      {provider.baseUrl ? (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[280px]">
                            {provider.baseUrl}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {/* Configured models preview */}
                    {provider.models && provider.models.length > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-2xs text-muted-foreground inline-flex items-center gap-1">
                          <Cpu className="h-3 w-3" />
                          <span>Модели ({provider.models.length}):</span>
                        </span>
                        {provider.models.slice(0, 5).map((m) => {
                          const isDef = m === provider.defaultModel;
                          return (
                            <span
                              key={m}
                              className={`inline-flex items-center gap-0.5 text-2xs px-1.5 py-0.2 rounded border font-mono ${
                                isDef
                                  ? "bg-primary/15 border-primary/40 text-primary font-medium"
                                  : "bg-muted/60 text-muted-foreground border-border/60"
                              }`}
                            >
                              {isDef && <Star className="h-2.5 w-2.5 fill-primary text-primary" />}
                              <span>{m}</span>
                            </span>
                          );
                        })}
                        {provider.models.length > 5 && (
                          <span className="text-2xs text-muted-foreground">
                            +{provider.models.length - 5} ещё
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground h-8 w-8"
                      onClick={() => handleOpenEdit(provider)}
                      title="Редактировать провайдер и модели"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-8 w-8"
                      onClick={() => deleteProvider(provider.id)}
                      title="Удалить провайдер"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Quick tips about Gemini and other accounts */}
          <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-xs text-muted-foreground space-y-1.5">
            <div className="font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Кастомные провайдеры и модели:</span>
            </div>
            <p>
              Вы можете добавить любой сервис (DeepSeek, OpenRouter, Groq, OmniRouter, LiteLLM или Google Gemini),
              нажать кнопку <strong>«Получить модели с сервера»</strong> или вручную добавить нужные модели.
              Все настроенные модели автоматически станут доступны для выбора у каждого вашего агента.
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
                <span>Открыть Google AI Studio для бесплатного ключа Gemini</span>
              </button>
            </div>
          </div>
        </div>
      </SettingsOptionGroup>

      <CreateCustomProviderDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        initialProvider={editingProvider}
      />
    </>
  );
}
