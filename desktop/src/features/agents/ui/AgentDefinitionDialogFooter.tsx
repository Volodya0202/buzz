import { Button } from "@/shared/ui/button";

type AgentDefinitionDialogFooterProps = {
  canSubmit: boolean;
  isAvatarUploadPending: boolean;
  isPending: boolean;
  onCancel: () => void;
  publishesCatalogUpdates: boolean;
  submitLabel: string;
};

function localizeSubmitLabel(label: string): string {
  if (label === "Create agent") return "Создать агента";
  if (label === "Save changes") return "Сохранить изменения";
  return label;
}

export function AgentDefinitionDialogFooter({
  canSubmit,
  isAvatarUploadPending,
  isPending,
  onCancel,
  publishesCatalogUpdates,
  submitLabel,
}: AgentDefinitionDialogFooterProps) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-3">
        {publishesCatalogUpdates ? (
          <p
            className="max-w-sm text-xs text-muted-foreground"
            data-testid="persona-dialog-catalog-publish-notice"
          >
            Этот агент находится в каталоге сообщества. Ваши изменения будут
            опубликованы после сохранения.
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button
          disabled={isPending || isAvatarUploadPending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Отмена
        </Button>
        <Button
          data-testid="persona-dialog-submit"
          disabled={!canSubmit}
          form="persona-dialog-form"
          type="submit"
        >
          {isPending
            ? "Сохранение..."
            : isAvatarUploadPending
              ? "Загрузка..."
              : publishesCatalogUpdates
                ? "Сохранить и опубликовать"
                : localizeSubmitLabel(submitLabel)}
        </Button>
      </div>
    </div>
  );
}
