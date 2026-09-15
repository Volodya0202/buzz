import * as React from "react";
import { ExternalLink, Plus, RefreshCw } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

import {
  useAcpRuntimesQueryForced,
  useGitBashPrerequisiteQuery,
} from "@/features/agents/hooks";
import type { AcpRuntimeCatalogEntry } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { HarnessCatalogDialog } from "./HarnessCatalogDialog";
import { HarnessRow } from "./HarnessRow";
import { stableRowOrder, yourHarnessEntries } from "./harnessCatalogLogic";
import { SettingsOptionGroup } from "./SettingsOptionGroup";

function GitBashCard({
  prerequisite,
}: {
  prerequisite: NonNullable<
    ReturnType<typeof useGitBashPrerequisiteQuery>["data"]
  >;
}) {
  return (
    <div
      className={cn(
        "min-h-16 px-4 py-4 text-sm",
        !prerequisite.available && "bg-amber-500/5",
      )}
      data-testid="doctor-git-bash"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Git Bash</p>
            <span aria-hidden="true" className="text-muted-foreground/50">
              ·
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium",
                prerequisite.available
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              )}
            >
              {prerequisite.available ? "Доступно" : "Требуется действие"}
            </span>
          </div>
          {!prerequisite.available ? (
            <button
              className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => void openUrl(prerequisite.installInstructionsUrl)}
              type="button"
            >
              <ExternalLink className="h-4 w-4" /> Установить Git для Windows
            </button>
          ) : null}
        </div>
        {!prerequisite.available ? (
          <div
            className="mt-3 space-y-1 text-sm text-muted-foreground/70"
            data-settings-subcopy
          >
            <p>Требуется для инструментов оболочки buzz-agent в Windows.</p>
            <p>{prerequisite.installHint}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Consolidated "Agent runtimes" surface for Settings → Agents.
 *
 * Replaces the old "Agent runtimes" (DoctorSettingsPanel) + "Bring your own
 * harness" (HarnessManagementCard) pair with one operational area:
 *
 * - **Your runtimes** — stable rows for ready (or one-click-ready) runtimes
 *   and everything the user authored. Row order never changes when a runtime
 *   installs (stableRowOrder), so the page doesn't jump under the pointer.
 * - **Add runtimes** — a master-detail catalog dialog for everything that
 *   needs multi-step setup, plus the custom-harness form.
 */
export function HarnessesSettingsPanel() {
  const runtimesQuery = useAcpRuntimesQueryForced();
  const gitBashQuery = useGitBashPrerequisiteQuery();
  const [catalogOpen, setCatalogOpen] = React.useState(false);
  // Incremented each time the user clicks "Check again" so HarnessRow
  // useEffect clears stale install results from before the refresh.
  const [resetEpoch, setResetEpoch] = React.useState(0);

  const entries = React.useMemo(
    () => yourHarnessEntries(runtimesQuery.data ?? []),
    [runtimesQuery.data],
  );

  // Sticky row order: initial sort once, then preserve relative order across
  // refetches/toggles so enabling a harness never reorders the list.
  const orderRef = React.useRef<string[]>([]);
  const rows = React.useMemo(() => {
    orderRef.current = stableRowOrder(orderRef.current, entries);
    const byId = new Map(entries.map((e) => [e.id, e]));
    return orderRef.current
      .map((id) => byId.get(id))
      .filter((e): e is AcpRuntimeCatalogEntry => e !== undefined);
  }, [entries]);

  const isRefreshing = runtimesQuery.isFetching;

  return (
    <SettingsOptionGroup
      data-testid="settings-harnesses"
      description="Выберите, какие инструменты агентов Buzz может использовать на этом устройстве."
      headerAction={
        <Button
          disabled={isRefreshing}
          onClick={() => {
            setResetEpoch((e) => e + 1);
            void runtimesQuery.forceRefresh();
            void gitBashQuery.refetch();
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCw
            className={cn("h-4 w-4", isRefreshing && "animate-spin")}
          />
          Проверить снова
        </Button>
      }
      title="Среды выполнения агентов"
    >
      <div className="divide-y divide-border/55">
        {gitBashQuery.data ? (
          <section>
            <div className="px-4 py-3 text-sm">
              <h2 className="text-lg font-semibold tracking-tight">
                Системные требования
              </h2>
              <p
                className="mt-1 text-sm font-normal text-muted-foreground/70"
                data-settings-subcopy
              >
                Инструменты Windows, необходимые поддерживаемым агентам.
              </p>
            </div>
            <GitBashCard prerequisite={gitBashQuery.data} />
          </section>
        ) : null}

        <section aria-label="Ваши среды выполнения">
          {/* The sub-header only earns its keep when another section (System
              prerequisites, Windows-only) shares the page; otherwise it just
              restates the page header. */}
          {gitBashQuery.data ? (
            <div className="border-b border-border/55 px-4 py-3 text-sm">
              <h2 className="text-lg font-semibold tracking-tight">
                Ваши среды выполнения
              </h2>
              <p
                className="mt-1 text-sm font-normal text-muted-foreground/70"
                data-settings-subcopy
              >
                Готовы к использованию или готовы к установке в один клик.
              </p>
            </div>
          ) : null}

          {runtimesQuery.isLoading ? (
            <div className="px-4 py-4 text-sm font-normal text-muted-foreground">
              Проверка сред выполнения агентов...
            </div>
          ) : rows.length > 0 ? (
            <div
              className="divide-y divide-border/55"
              data-testid="doctor-runtime-list"
            >
              {rows.map((runtime) => (
                <HarnessRow
                  embedded
                  key={runtime.id}
                  resetEpoch={resetEpoch}
                  runtime={runtime}
                />
              ))}
            </div>
          ) : (
            <div className="bg-amber-500/10 px-4 py-4 text-sm text-warning">
              Пока нет готовых сред выполнения агентов — добавьте ниже.
            </div>
          )}

          {runtimesQuery.error instanceof Error ? (
            <p className="border-t border-border/55 bg-destructive/10 px-4 py-4 text-sm text-destructive">
              {runtimesQuery.error.message}
            </p>
          ) : null}

          <div className="border-t border-border/55 px-4 py-3">
            <Button
              className="gap-2"
              data-testid="harness-add-button"
              onClick={() => setCatalogOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              Добавить среды
            </Button>
          </div>
        </section>
      </div>

      <HarnessCatalogDialog onOpenChange={setCatalogOpen} open={catalogOpen} />
    </SettingsOptionGroup>
  );
}
