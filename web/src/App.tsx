import { useCallback, useEffect, useRef, useState } from "react";
import { api, setUnauthorizedHandler, type Me } from "./api";
import type { AppState, DragoPatch, EnclosPatch } from "./types";
import { EnclosWorkspace } from "./components/EnclosWorkspace";
import { SettingsDialog } from "./components/SettingsDialog";
import { OddsCalculator } from "./components/OddsCalculator";
import { BreedingTree } from "./components/BreedingTree";
import { NamingTab } from "./components/NamingTab";
import { HerdTab } from "./components/HerdTab";
import { AssistantTab } from "./components/AssistantTab";
import { SuccesTab } from "./components/SuccesTab";

type Tab = "tracker" | "herd" | "assistant" | "succes" | "planner" | "odds" | "naming";

/** Logged-out landing — the only thing reachable without a Better Auth session. */
function LoginWall() {
  return (
    <div className="login-wall">
      <h1>🐉 Dragodinde Notif</h1>
      <p>Suis ta reproduction de dragodindes. Connecte-toi avec Discord pour commencer.</p>
      <button className="discord-btn" onClick={() => api.signInDiscord()}>
        Se connecter avec Discord
      </button>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = checking
  const [activeId, setActiveId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("tracker");

  // Resolve auth once on mount; any later 401 (expired session) flips back to the login wall.
  useEffect(() => {
    setUnauthorizedHandler(() => setMe(null));
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  // Monotonic guard: drop out-of-order /api/state responses so a slow poll can't clobber a fresh
  // optimistic edit (e.g. a Succès toggle) with stale data.
  const reqSeq = useRef(0);
  const refresh = useCallback(async () => {
    const seq = ++reqSeq.current;
    try {
      const data = await api.getState();
      if (seq !== reqSeq.current) return; // a newer refresh superseded this one
      setState(data);
      setActiveId((cur) =>
        cur != null && data.enclos.some((e) => e.id === cur) ? cur : (data.enclos[0]?.id ?? null),
      );
    } catch {
      /* transient: keep last state */
    }
  }, []);

  useEffect(() => {
    if (!me) return; // only poll once signed in
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh, me]);

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

  if (me === undefined) return <div className="loading">Loading…</div>;
  if (me === null) return <LoginWall />;
  if (!state) return <div className="loading">Loading…</div>;

  const { enclos, stable, achievements, meta, settings } = state;
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
            className={"tab" + (tab === "succes" ? " active" : "")}
            onClick={() => setTab("succes")}
          >
            Succès
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
          {me && <span className="pill">{me.name ?? "connecté"}</span>}
          <button className="ghost" onClick={() => api.signOut()}>
            Déconnexion
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
      ) : tab === "succes" ? (
        <div className="split">
          <SuccesTab achievements={achievements} onChanged={refresh} />
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
