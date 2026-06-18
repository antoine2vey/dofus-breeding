import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { AppState, DragoPatch, EnclosPatch } from "./types";
import { EnclosWorkspace } from "./components/EnclosWorkspace";
import { SettingsDialog } from "./components/SettingsDialog";
import { OddsCalculator } from "./components/OddsCalculator";
import { BreedingTree } from "./components/BreedingTree";
import { NamingTab } from "./components/NamingTab";
import { HerdTab } from "./components/HerdTab";
import { AssistantTab } from "./components/AssistantTab";

type Tab = "tracker" | "herd" | "assistant" | "planner" | "odds" | "naming";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("tracker");

  const refresh = useCallback(async () => {
    try {
      const data = await api.getState();
      setState(data);
      setActiveId((cur) =>
        cur != null && data.enclos.some((e) => e.id === cur) ? cur : (data.enclos[0]?.id ?? null),
      );
    } catch {
      /* transient: keep last state */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  const onEnclosPatch = useCallback(
    async (id: number, body: EnclosPatch) => {
      await api.patchEnclos(id, body);
      refresh();
    },
    [refresh],
  );
  const onDragoPatch = useCallback(
    async (id: number, body: DragoPatch) => {
      await api.patchDragodinde(id, body);
      refresh();
    },
    [refresh],
  );
  const onEnclosAdd = useCallback(async () => {
    const created = await api.addEnclos();
    if ("id" in created) setActiveId(created.id);
    refresh();
  }, [refresh]);
  const onEnclosDelete = useCallback(
    async (id: number) => {
      await api.removeEnclos(id);
      setActiveId(null);
      refresh();
    },
    [refresh],
  );
  const onDragoMove = useCallback(
    async (id: number, enclosId: number | null) => {
      await api.moveDragodinde(id, enclosId);
      refresh();
    },
    [refresh],
  );
  const onDragoDelete = useCallback(
    async (id: number) => {
      await api.removeDragodinde(id);
      refresh();
    },
    [refresh],
  );

  if (!state) return <div className="loading">Loading…</div>;

  const { enclos, stable, meta, settings } = state;
  const allMounts = [...stable, ...enclos.flatMap((e) => e.dragodindes)];

  return (
    <>
      <header>
        <h1>🐉 Dragodinde Notif</h1>
        <nav className="tabs">
          <button
            className={"tab" + (tab === "tracker" ? " active" : "")}
            onClick={() => setTab("tracker")}
          >
            Enclos
          </button>
          <button
            className={"tab" + (tab === "herd" ? " active" : "")}
            onClick={() => setTab("herd")}
          >
            Étable
          </button>
          <button
            className={"tab" + (tab === "assistant" ? " active" : "")}
            onClick={() => setTab("assistant")}
          >
            Assistant
          </button>
          <button
            className={"tab" + (tab === "planner" ? " active" : "")}
            onClick={() => setTab("planner")}
          >
            Planificateur
          </button>
          <button
            className={"tab" + (tab === "odds" ? " active" : "")}
            onClick={() => setTab("odds")}
          >
            Probabilités
          </button>
          <button
            className={"tab" + (tab === "naming" ? " active" : "")}
            onClick={() => setTab("naming")}
          >
            Nommage
          </button>
        </nav>
        <div className="settings">
          <span className={"pill " + (settings.webhookConfigured ? "ok" : "bad")}>
            {settings.webhookConfigured ? "webhook ✓" : "webhook ✗"}
          </span>
          <button className="ghost" onClick={() => setSettingsOpen(true)}>
            ⚙︎ Discord
          </button>
        </div>
      </header>

      {tab === "tracker" ? (
        <EnclosWorkspace
          enclos={enclos}
          stable={stable}
          activeId={activeId}
          meta={meta}
          onSelect={setActiveId}
          onEnclosPatch={onEnclosPatch}
          onEnclosAdd={onEnclosAdd}
          onEnclosDelete={onEnclosDelete}
          onDragoPatch={onDragoPatch}
          onDragoMove={onDragoMove}
          onDragoDelete={onDragoDelete}
        />
      ) : tab === "herd" ? (
        <div className="split">
          <HerdTab enclos={enclos} stable={stable} onChanged={refresh} />
        </div>
      ) : tab === "assistant" ? (
        <div className="split">
          <AssistantTab enclos={enclos} stable={stable} onChanged={refresh} />
        </div>
      ) : tab === "planner" ? (
        <div className="split">
          <BreedingTree mounts={allMounts} />
        </div>
      ) : tab === "odds" ? (
        <div className="split">
          <OddsCalculator />
        </div>
      ) : (
        <div className="split">
          <NamingTab />
        </div>
      )}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onConfigured={() => refresh()}
      />
    </>
  );
}
