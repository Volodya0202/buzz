import {
  getShortcutsByCategory,
  getPlatformKeys,
  type KeyboardShortcut,
} from "@/shared/lib/keyboard-shortcuts";
import {
  SettingsOptionGroup,
  SettingsOptionGroupList,
  SettingsOptionRow,
} from "./SettingsOptionGroup";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

function KeyCombo({ shortcut }: { shortcut: KeyboardShortcut }) {
  const keys = getPlatformKeys(shortcut);
  // Split on "+" but keep "+" as a standalone key (e.g. for zoom-in "⌘+")
  const parts = keys
    .split(/(?<!\+)\+(?!\s*$)/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <span className="flex items-center gap-1">
      {parts.map((part) => (
        <kbd
          className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border/70 bg-muted/60 px-1.5 font-mono text-xs text-muted-foreground"
          key={part}
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  Navigation: "Навигация",
  Messages: "Сообщения",
  Formatting: "Форматирование",
  Zoom: "Масштаб",
};

const SHORTCUT_TRANSLATIONS: Record<string, { label: string; description: string }> = {
  "quick-search": {
    label: "Быстрый поиск",
    description: "Открыть диалог поиска",
  },
  "browse-channels": {
    label: "Обзор каналов",
    description: "Открыть список всех каналов",
  },
  "browse-dms": {
    label: "Новое личное сообщение",
    description: "Начать диалог с пользователем",
  },
  "new-channel": {
    label: "Новый канал",
    description: "Открыть диалог создания канала",
  },
  "open-settings": {
    label: "Настройки",
    description: "Открыть или закрыть настройки",
  },
  "go-back": {
    label: "Назад",
    description: "Перейти к предыдущей странице",
  },
  "go-forward": {
    label: "Вперёд",
    description: "Перейти к следующей странице",
  },
  "find-in-channel": {
    label: "Поиск в канале",
    description: "Искать сообщения в текущем канале",
  },
  "go-home": {
    label: "Главная",
    description: "Перейти в общую ленту",
  },
  "toggle-sidebar": {
    label: "Боковая панель",
    description: "Показать или скрыть боковую панель",
  },
  "mark-current-read": {
    label: "Отметить как прочитанное",
    description: "Отметить текущую беседу прочитанной",
  },
  "mark-all-read": {
    label: "Отметить всё как прочитанное",
    description: "Отметить все беседы прочитанными",
  },
  "zoom-in": {
    label: "Увеличить",
    description: "Увеличить масштаб интерфейса",
  },
  "zoom-out": {
    label: "Уменьшить",
    description: "Уменьшить масштаб интерфейса",
  },
  "zoom-reset": {
    label: "Сбросить масштаб",
    description: "Вернуть масштаб интерфейса по умолчанию",
  },
  "send-message": {
    label: "Отправить сообщение",
    description: "Отправить текущее сообщение",
  },
  "new-line": {
    label: "Новая строка",
    description: "Вставить перенос строки в поле ввода",
  },
  "always-address-agent": {
    label: "Обратиться к агенту",
    description: "Обратиться к агенту по умолчанию или переключить активного агента",
  },
  "publish-note": {
    label: "Опубликовать заметку",
    description: "Опубликовать заметку в Pulse",
  },
  "close-dialog": {
    label: "Закрыть окно",
    description: "Закрыть текущий диалог или настройки",
  },
  "toggle-huddle": {
    label: "Начать или покинуть созвон",
    description: "Начать или подключиться к созвону в канале; выйти при подключении",
  },
  "push-to-talk": {
    label: "Нажать для разговора",
    description: "Удерживайте для включения микрофона в созвоне",
  },
  "format-bold": {
    label: "Жирный",
    description: "Применить жирное начертание",
  },
  "format-italic": {
    label: "Курсив",
    description: "Применить курсивное начертание",
  },
  "format-strikethrough": {
    label: "Зачёркнутый",
    description: "Применить зачёркивание текста",
  },
  "format-code": {
    label: "Код",
    description: "Форматировать как встроенный код",
  },
  "format-link": {
    label: "Вставить ссылку",
    description: "Оформить ссылку на выделенном тексте или изменить ссылку",
  },
};

export function KeyboardShortcutsCard() {
  const categories = getShortcutsByCategory();

  return (
    <section className="min-w-0" data-testid="settings-shortcuts">
      <SettingsSectionHeader
        title="Горячие клавиши"
        description="Все доступные сочетания клавиш. Назначения клавиш фиксированы."
      />

      <SettingsOptionGroupList>
        {[...categories.entries()].map(([category, shortcuts]) => (
          <SettingsOptionGroup
            key={category}
            title={CATEGORY_LABELS[category] ?? category}
          >
            {shortcuts.map((shortcut) => {
              const translated = SHORTCUT_TRANSLATIONS[shortcut.id];
              const label = translated?.label ?? shortcut.label;
              const description = translated?.description ?? shortcut.description;

              return (
                <SettingsOptionRow
                  className="min-h-12 px-3 py-2"
                  key={shortcut.id}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground">
                      {label}
                    </span>
                    <span
                      className="ml-2 text-muted-foreground/70"
                      data-settings-subcopy
                    >
                      {description}
                    </span>
                  </div>
                  <KeyCombo shortcut={shortcut} />
                </SettingsOptionRow>
              );
            })}
          </SettingsOptionGroup>
        ))}
      </SettingsOptionGroupList>
    </section>
  );
}
