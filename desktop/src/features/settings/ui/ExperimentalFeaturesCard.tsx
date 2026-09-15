import { setAgentManagedProfiles } from "@/shared/api/tauriWorkspace";
import { desktopFeatures, useFeatureToggle } from "@/shared/features";
import type { FeatureDefinition } from "@/shared/features";
import { Switch } from "@/shared/ui/switch";
import { SettingsOptionGroup, SettingsOptionRow } from "./SettingsOptionGroup";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

const FEATURE_LOCALIZATION: Record<
  string,
  { name: string; description: string }
> = {
  workflows: {
    name: "Рабочие процессы (Workflows)",
    description: "Автоматизации на основе YAML с этапами подтверждения",
  },
  projects: {
    name: "Проекты (Projects)",
    description: "Просмотр Git-репозиториев и совместная работа",
  },
  pulse: {
    name: "Пульс (Pulse)",
    description: "Лента активности с заметками, публикациями и действиями агентов",
  },
  forum: {
    name: "Форумные каналы (Forum Channels)",
    description: "Каналы с ветками обсуждений для развернутых дискуссий",
  },
  agentManagedProfiles: {
    name: "Профили, управляемые агентами",
    description:
      "Разрешить агентам самостоятельно управлять своим именем и аватаром на реле вместо восстановления локальной копии",
  },
};

function FeatureRow({ feature }: { feature: FeatureDefinition }) {
  const [enabled, toggle] = useFeatureToggle(feature.id);
  const switchId = `feature-toggle-${feature.id}`;
  const localized = FEATURE_LOCALIZATION[feature.id];
  const displayName = localized?.name ?? feature.name;
  const displayDesc = localized?.description ?? feature.description;

  return (
    <SettingsOptionRow>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" id={`${switchId}-label`}>
          {displayName}
        </p>
        <p className="text-xs text-muted-foreground/70" data-settings-subcopy>
          {displayDesc}
        </p>
      </div>
      <Switch
        aria-labelledby={`${switchId}-label`}
        checked={enabled}
        data-testid={switchId}
        onCheckedChange={(value) => {
          toggle(value);
          if (feature.id === "agentManagedProfiles") {
            void setAgentManagedProfiles(value).catch((error) => {
              console.error(
                "Failed to apply agent-managed profiles setting:",
                error,
              );
            });
          }
        }}
      />
    </SettingsOptionRow>
  );
}

export function ExperimentalFeaturesCard() {
  // Manifest is preview-only by definition; every desktop entry is a preview
  // feature.
  const previewFeatures = desktopFeatures;

  return (
    <section className="min-w-0" data-testid="settings-experimental">
      <SettingsSectionHeader
        title="Эксперименты"
        description={
          <>
            Эти функции работают, но всё ещё дорабатываются. Включите их, чтобы
            первыми опробовать новые возможности.
          </>
        }
      />

      <SettingsOptionGroup title="Функции">
        {previewFeatures.map((f) => (
          <FeatureRow feature={f} key={f.id} />
        ))}
      </SettingsOptionGroup>
    </section>
  );
}
