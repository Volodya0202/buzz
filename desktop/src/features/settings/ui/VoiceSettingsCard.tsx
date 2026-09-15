import * as React from "react";
import { ChevronDown, Play, Trash2, Upload, Volume2 } from "lucide-react";

import { invokeTauri } from "@/shared/api/tauri";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Switch } from "@/shared/ui/switch";
import {
  SettingsOptionGroup,
  SettingsOptionGroupList,
  SettingsOptionRow,
} from "./SettingsOptionGroup";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import {
  selectedVoiceForBackend,
  type VoiceRegistryEntry,
  voiceOptionLabel,
  voicesForBackend,
} from "./voiceSettingsLogic";

export type TtsSettings = {
  version: number;
  agentTextToSpeech: boolean;
  voicePreferences: string[];
};

type TtsVoiceMutation = {
  settings: TtsSettings;
  registry: VoiceRegistryEntry[];
};

export function VoiceSettingsCard() {
  const [settings, setSettings] = React.useState<TtsSettings | null>(null);
  const [registry, setRegistry] = React.useState<VoiceRegistryEntry[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);
  const [deleteCandidate, setDeleteCandidate] =
    React.useState<VoiceRegistryEntry | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let disposed = false;
    Promise.all([
      invokeTauri<TtsSettings>("get_tts_settings"),
      invokeTauri<VoiceRegistryEntry[]>("list_voice_registry"),
    ])
      .then(([nextSettings, nextRegistry]) => {
        if (!disposed) {
          setSettings(nextSettings);
          setRegistry(nextRegistry);
        }
      })
      .catch((loadError) => {
        if (!disposed) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Voice settings could not be loaded.",
          );
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  const saveEnabled = React.useCallback(async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const saved = await invokeTauri<TtsSettings>("set_tts_enabled", {
        enabled,
      });
      setSettings(saved);
    } catch (saveError) {
      try {
        const state = await invokeTauri<{ tts_enabled: boolean }>(
          "get_huddle_state",
        );
        setSettings((current) =>
          current
            ? { ...current, agentTextToSpeech: state.tts_enabled }
            : current,
        );
      } catch {
        // Keep the last confirmed state when native reconciliation is
        // unavailable; the visible save error makes the failure explicit.
      }
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Voice settings could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const savePocketVoice = React.useCallback(async (voiceKey: string) => {
    setBusy(true);
    setError(null);
    try {
      const saved = await invokeTauri<TtsSettings>("set_pocket_voice", {
        voiceKey,
      });
      setSettings(saved);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Voice settings could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const importPocketVoice = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await invokeTauri<TtsVoiceMutation | null>(
        "import_pocket_voice",
      );
      if (result) {
        setSettings(result.settings);
        setRegistry(result.registry);
      }
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Voice could not be imported.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const deletePocketVoice = React.useCallback(async (voiceKey: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await invokeTauri<TtsVoiceMutation>(
        "delete_pocket_voice",
        { voiceKey },
      );
      setSettings(result.settings);
      setRegistry(result.registry);
      setDeleteCandidate(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Voice could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const voices = voicesForBackend(registry, "pocket");
  const selectedVoice = selectedVoiceForBackend(
    settings?.voicePreferences ?? [],
    voices,
  );
  const enabled = settings?.agentTextToSpeech ?? true;
  const controlsDisabled = !settings || busy || !enabled;

  return (
    <section className="min-w-0" data-testid="settings-voice">
      <SettingsSectionHeader
        title="Голос"
        description="Выберите, воспроизводить ли ответы агентов голосом во время активного созвона."
      />

      <SettingsOptionGroupList>
        <SettingsOptionGroup title="Воспроизведение">
          <SettingsOptionRow>
            <div className="min-w-0">
              <label
                className="text-sm font-medium"
                htmlFor="agent-text-to-speech-switch"
              >
                Озвучивание текста агентов
              </label>
              <p
                className="text-sm text-muted-foreground/70"
                data-settings-subcopy
              >
                Озвучивать новые сообщения агентов в порядке их поступления.
              </p>
            </div>
            <Switch
              checked={enabled}
              data-testid="agent-text-to-speech-toggle"
              disabled={!settings || busy}
              id="agent-text-to-speech-switch"
              onCheckedChange={(checked) => {
                if (settings) void saveEnabled(checked);
              }}
            />
          </SettingsOptionRow>
        </SettingsOptionGroup>

        <div
          aria-disabled={!enabled}
          className={cn(
            "transition-opacity",
            !enabled && "pointer-events-none opacity-45",
          )}
          data-testid="pocket-voice-controls"
        >
          <SettingsOptionGroup title="Голос">
            <SettingsOptionRow>
              <div className="min-w-0">
                <p className="text-sm font-medium">Голос Pocket TTS</p>
                <p
                  className="text-sm text-muted-foreground/70"
                  data-settings-subcopy
                >
                  Голосовые файлы хранятся локально на этом устройстве.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={`Pocket TTS voice: ${selectedVoice?.displayName ?? "Mary"}`}
                      className="min-w-32 justify-between"
                      data-testid="pocket-voice-selector"
                      disabled={controlsDisabled}
                      variant="outline"
                    >
                      {selectedVoice
                        ? voiceOptionLabel(selectedVoice, voices)
                        : "Mary"}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="max-h-80 overflow-y-auto"
                  >
                    <DropdownMenuRadioGroup
                      onValueChange={(voiceKey) => {
                        if (settings) void savePocketVoice(voiceKey);
                      }}
                      value={selectedVoice?.key}
                    >
                      {voices.map((voice) => (
                        <DropdownMenuRadioItem
                          key={voice.key}
                          value={voice.key}
                        >
                          {voiceOptionLabel(voice, voices)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  aria-label={`Preview ${selectedVoice?.displayName ?? "Mary"}`}
                  data-testid="pocket-voice-preview"
                  disabled={controlsDisabled || previewing || !selectedVoice}
                  onClick={() => {
                    if (!selectedVoice) return;
                    setPreviewing(true);
                    setError(null);
                    void invokeTauri<void>("preview_pocket_voice", {
                      voiceKey: selectedVoice.key,
                    })
                      .catch((previewError) => {
                        setError(
                          previewError instanceof Error
                            ? previewError.message
                            : "Voice preview could not be played.",
                        );
                      })
                      .finally(() => setPreviewing(false));
                  }}
                  size="sm"
                  variant="outline"
                >
                  {previewing ? (
                    <Volume2 className="h-4 w-4 animate-pulse" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Прослушать
                </Button>
                <Button
                  data-testid="pocket-voice-import"
                  disabled={controlsDisabled}
                  onClick={() => void importPocketVoice()}
                  size="sm"
                  variant="outline"
                >
                  <Upload className="h-4 w-4" />
                  Добавить голос
                </Button>
                {selectedVoice?.key.startsWith("pocket:imported:") && (
                  <Button
                    aria-label={`Удалить ${selectedVoice.displayName}`}
                    data-testid="pocket-voice-delete"
                    disabled={controlsDisabled}
                    onClick={() => setDeleteCandidate(selectedVoice)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </SettingsOptionRow>
          </SettingsOptionGroup>
        </div>
      </SettingsOptionGroupList>
      {error && (
        <p
          className="mt-4 text-sm text-destructive"
          data-testid="voice-settings-error"
          role="alert"
        >
          {error}
        </p>
      )}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null);
        }}
        open={deleteCandidate !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить импортированный голос?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate
                ? `${deleteCandidate.displayName} и его локальный аудиофайл будут удалены.`
                : "Этот импортированный голос и его локальный аудиофайл будут удалены."}
              {selectedVoice?.key === deleteCandidate?.key &&
                " Вместо него будет выбран голос Mary."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-pocket-voice-delete"
              disabled={busy || !deleteCandidate}
              onClick={(event) => {
                event.preventDefault();
                if (deleteCandidate) {
                  void deletePocketVoice(deleteCandidate.key);
                }
              }}
            >
              Удалить голос
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
