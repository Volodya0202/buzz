import { AgentDefaultsSettingsCard } from "./AgentDefaultsSettingsCard";
import {
  setKeepMentionedAgentsPinned,
  useKeepMentionedAgentsPinned,
} from "@/features/messages/lib/autoPinMentionedAgentsPreference";
import { Switch } from "@/shared/ui/switch";
import { CustomApiProvidersCard } from "./CustomApiProvidersCard";
import { HarnessesSettingsPanel } from "./HarnessesSettingsPanel";
import { PreventSleepSettingsCard } from "./PreventSleepSettingsCard";
import {
  SettingsOptionGroup,
  SettingsOptionGroupList,
  SettingsOptionRow,
} from "./SettingsOptionGroup";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

export function AgentsSettingsPanel() {
  const automaticallyMentionAgents = useKeepMentionedAgentsPinned();

  return (
    <section className="min-w-0" data-testid="settings-agents">
      <SettingsSectionHeader
        title="Агенты"
        description="Управление поведением агентов в беседах, их запуск и провайдеры моделей."
      />

      <SettingsOptionGroupList>
        <SettingsOptionGroup title="Беседы">
          <SettingsOptionRow data-testid="settings-automatic-agent-mentions">
            <div className="min-w-0">
              <label
                className="font-medium text-foreground"
                htmlFor="settings-automatic-agent-mentions-switch"
              >
                Автоматически упоминать агентов
              </label>
              <p
                className="mt-0.5 text-sm text-muted-foreground/70"
                data-settings-subcopy
              >
                Обращаться к выбранным агентам в ответах ветки
              </p>
            </div>
            <Switch
              aria-label="Автоматически упоминать агентов"
              checked={automaticallyMentionAgents}
              id="settings-automatic-agent-mentions-switch"
              onCheckedChange={setKeepMentionedAgentsPinned}
            />
          </SettingsOptionRow>
        </SettingsOptionGroup>
        <PreventSleepSettingsCard />
        <HarnessesSettingsPanel />
        <CustomApiProvidersCard />
        <AgentDefaultsSettingsCard />
      </SettingsOptionGroupList>
    </section>
  );
}
