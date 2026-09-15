export const teamCatalogCopy = {
  chooseFromCatalog: "Выбрать из каталога",
  dialogTitle: "Каталог команд",
  dialogDescription: "Просмотр команд, опубликованных на этом реле.",
  emptyCatalogTitle: "Нет опубликованных команд",
  emptyCatalogDescription: "Опубликованные команды появятся здесь.",
  addAction: "Добавить команду",
  addedAction: "Добавлено в мои команды",
  addingAction: "Добавление…",
  shareTitle: "Опубликовать в каталоге",
  shareDescription:
    "Любой участник этого сообщества сможет найти и добавить копию этой команды. Инструкции команды и всех её участников публикуются в открытом виде. Память и секреты не включаются.",
} as const;

/**
 * The warning notice shown when the backend automatically queues a retraction
 * for a shared team that can no longer be projected.
 *
 * "Queued" is accurate — the tombstone has been enqueued for the flush loop
 * but the relay head may still be discoverable until the flush succeeds.
 * Using "queued for removal" rather than "was removed" avoids a false claim
 * that the catalog has already changed.
 */
export function teamAutoRetractedNotice(
  teamName: string,
  reason: string,
): string {
  return `"${teamName}" has been queued for removal from the community catalog because it can no longer be projected: ${reason}`;
}

/**
 * The result message for a share toggle.
 *
 * `queued` is not a failure: the head is durably enqueued and the flush loop
 * will publish it, so the copy promises eventual visibility rather than
 * claiming the catalog already changed.
 */
export function teamShareNotice(
  teamName: string,
  shared: boolean,
  publicationStatus: "published" | "queued",
): string {
  if (publicationStatus === "queued") {
    return shared
      ? `Sharing ${teamName} is queued. It will appear after the relay accepts the update.`
      : `Removing ${teamName} is queued. It may remain discoverable until the relay accepts the update.`;
  }
  return shared
    ? `Published ${teamName} to the community catalog.`
    : `${teamName} is no longer discoverable in the community catalog.`;
}
