import { AgentDefaultsEditor } from "@/features/agents/ui/AgentDefaultsEditor";
import { SettingsOptionGroup } from "./SettingsOptionGroup";

export function AgentDefaultsSettingsCard() {
  return (
    <SettingsOptionGroup
      data-testid="settings-global-agent-config"
      description="Настройки провайдера, модели, режима рассуждений и переменных окружения, наследуемые локальными агентами. Индивидуальные настройки агента всегда имеют приоритет."
      title="Настройки агентов по умолчанию"
    >
      <div className="px-4 py-4">
        <AgentDefaultsEditor layout="flat" />
      </div>
    </SettingsOptionGroup>
  );
}
