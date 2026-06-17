import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { AppState, DragoPatch, EnclosPatch } from "./types";
import { EnclosPane } from "./components/EnclosPane";
import { DragodindePane } from "./components/DragodindePane";
import { SettingsDialog } from "./components/SettingsDialog";
import { OddsCalculator } from "./components/OddsCalculator";
import { RushSimulator } from "./components/RushSimulator";
import { BreedingTree } from "./components/BreedingTree";
import { NamingTab } from "./components/NamingTab";
import { HerdTab } from "./components/HerdTab";

type Tab = "tracker" | "herd" | "planner" | "odds" | "sim" | "naming";

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
  const onDragoAdd = useCallback(
    async (enclosId: number) => {
      await api.addDragodinde(enclosId);
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

  const { enclos, meta, settings } = state;
  const active = enclos.find((e) => e.id === activeId) ?? enclos[0];

  return (
    <>
      <header>
        <h1>🐉 Dragodinde Notif</h1>
        <nav className="tabs">
          <button
            className={"tab" + (tab === "tracker" ? " active" : "")}
            onClick={() => setTab("tracker")}
          >
            Élevage
          </button>
          <button
            className={"tab" + (tab === "herd" ? " active" : "")}
            onClick={() => setTab("herd")}
          >
            Cheptel
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
            className={"tab" + (tab === "sim" ? " active" : "")}
            onClick={() => setTab("sim")}
          >
            Simulateur
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
        <div className="split">
          <EnclosPane
            enclos={enclos}
            activeId={active?.id ?? null}
            meta={meta}
            onSelect={setActiveId}
            onEnclosPatch={onEnclosPatch}
            onEnclosAdd={onEnclosAdd}
            onEnclosDelete={onEnclosDelete}
          />
          <DragodindePane
            enclos={active}
            meta={meta}
            onDragoPatch={onDragoPatch}
            onDragoAdd={onDragoAdd}
            onDragoDelete={onDragoDelete}
          />
        </div>
      ) : tab === "herd" ? (
        <div className="split">
          <HerdTab enclos={enclos} onChanged={refresh} />
        </div>
      ) : tab === "planner" ? (
        <div className="split">
          <BreedingTree />
        </div>
      ) : tab === "odds" ? (
        <div className="split">
          <OddsCalculator />
        </div>
      ) : tab === "sim" ? (
        <div className="split">
          <RushSimulator />
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
