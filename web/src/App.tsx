import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api, type Me, setUnauthorizedHandler } from './api'
import { AssistantTab } from './components/AssistantTab'
import { BreedingTree } from './components/BreedingTree'
import { EnclosWorkspace } from './components/EnclosWorkspace'
import { HerdTab } from './components/HerdTab'
import { NamingTab } from './components/NamingTab'
import { OddsCalculator } from './components/OddsCalculator'
import { OnboardingWizard } from './components/OnboardingWizard'
import { SettingsDialog } from './components/SettingsDialog'
import { SuccesTab } from './components/SuccesTab'
import type { AppState, DragoPatch, EnclosPatch, Species } from './types'

type SettingsSection = 'webhook' | 'ai' | 'species'

// Each tab is a real route, so a refresh / deep link lands back on the same tab. Paths are the
// source of truth for "which tab is active"; per-page filters live in the query string (see the
// individual tab components + useSearchParamState).
const TABS = [
  { path: '/enclos', label: 'Enclos' },
  { path: '/etable', label: 'Étable' },
  { path: '/assistant', label: 'Assistant' },
  { path: '/succes', label: 'Succès' },
  { path: '/planificateur', label: 'Planificateur' },
  { path: '/probabilites', label: 'Probabilités' },
  { path: '/nommage', label: 'Nommage' }
] as const

/** Logged-out landing — the only thing reachable without a Better Auth session. */
function LoginWall() {
  return (
    <div className="login-wall">
      <h1>🐉 Élevage</h1>
      <p>
        Suis ta reproduction de montures (dragodinde · muldo · volkorne). Connecte-toi avec Discord
        pour commencer.
      </p>
      <button className="discord-btn" onClick={() => api.signInDiscord()}>
        Se connecter avec Discord
      </button>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [me, setMe] = useState<Me | null | undefined>(undefined) // undefined = checking
  const [activeId, setActiveId] = useState<number | null>(null)
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const onboardChecked = useRef(false)
  // The globally-selected species drives the per-species reference tabs (Succès/Naming/Roster/Odds/
  // Tree). The herd/enclos + assistant stay cross-species. Persisted across reloads.
  const [species, setSpecies] = useState<Species>(
    () => (localStorage.getItem('dd-species') as Species) || 'dragodinde'
  )
  useEffect(() => {
    localStorage.setItem('dd-species', species)
  }, [species])

  // Resolve auth once on mount; any later 401 (expired session) flips back to the login wall.
  useEffect(() => {
    setUnauthorizedHandler(() => setMe(null))
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null))
  }, [])

  // Monotonic guard: drop out-of-order /api/state responses so a slow poll can't clobber a fresh
  // optimistic edit (e.g. a Succès toggle) with stale data.
  const reqSeq = useRef(0)
  const refresh = useCallback(async () => {
    const seq = ++reqSeq.current
    try {
      const data = await api.getState()
      if (seq !== reqSeq.current) return // a newer refresh superseded this one
      setState(data)
      setActiveId((cur) =>
        cur != null && data.enclos.some((e) => e.id === cur) ? cur : (data.enclos[0]?.id ?? null)
      )
    } catch {
      /* transient: keep last state */
    }
  }, [])

  useEffect(() => {
    if (!me) return // only poll once signed in
    refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [refresh, me])

  // Keep the active species valid — if the persisted one is disabled, fall back to dragodinde.
  useEffect(() => {
    if (state && !state.settings.speciesConfig[species]?.enabled) setSpecies('dragodinde')
  }, [state, species])

  // First-run: auto-open onboarding once, when an empty stock meets a not-yet-dismissed user.
  useEffect(() => {
    if (!state || onboardChecked.current) return
    const empty = state.stable.length === 0 && state.enclos.every((e) => e.mounts.length === 0)
    if (empty && !localStorage.getItem('dd-onboarded')) {
      onboardChecked.current = true
      setWizardOpen(true)
    }
  }, [state])
  const closeWizard = () => {
    localStorage.setItem('dd-onboarded', '1')
    setWizardOpen(false)
  }

  const onEnclosPatch = useCallback(
    async (id: number, body: EnclosPatch) => {
      await api.patchEnclos(id, body)
      refresh()
    },
    [refresh]
  )
  const onDragoPatch = useCallback(
    async (id: number, body: DragoPatch) => {
      await api.patchDragodinde(id, body)
      refresh()
    },
    [refresh]
  )
  const onEnclosAdd = useCallback(async () => {
    const created = await api.addEnclos()
    if ('id' in created) setActiveId(created.id)
    refresh()
  }, [refresh])
  const onEnclosDelete = useCallback(
    async (id: number) => {
      await api.removeEnclos(id)
      setActiveId(null)
      refresh()
    },
    [refresh]
  )
  const onDragoMove = useCallback(
    async (id: number, enclosId: number | null) => {
      await api.moveDragodinde(id, enclosId)
      refresh()
    },
    [refresh]
  )
  const onDragoDelete = useCallback(
    async (id: number) => {
      await api.removeDragodinde(id)
      refresh()
    },
    [refresh]
  )

  if (me === undefined) return <div className="loading">Loading…</div>
  if (me === null) return <LoginWall />
  if (!state) return <div className="loading">Loading…</div>

  const { enclos, stable, achievements, meta, settings } = state
  const allMounts = [...stable, ...enclos.flatMap((e) => e.mounts)]
  // Species available in the selector: those enabled in settings (dragodinde is always present).
  const enabledSpecies = meta.species.filter(
    (s) => s.species === 'dragodinde' || settings.speciesConfig[s.species]?.enabled
  )

  return (
    <>
      <header>
        <h1>🐉 Élevage</h1>
        {enabledSpecies.length > 1 && (
          <select
            className="species-selector"
            value={species}
            onChange={(e) => setSpecies(e.target.value as Species)}
            title="Espèce active"
          >
            {enabledSpecies.map((s) => (
              <option key={s.species} value={s.species}>
                {s.icon} {s.label}
              </option>
            ))}
          </select>
        )}
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.path}
              className={'tab' + (pathname === t.path ? ' active' : '')}
              onClick={() => navigate(t.path)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="settings">
          <button className="ghost" title="Tutoriel" onClick={() => setWizardOpen(true)}>
            ?
          </button>
          <button className="ghost" title="Espèces" onClick={() => setSettingsSection('species')}>
            🧬 Espèces
          </button>
          <button
            className="ghost"
            title="Webhook Discord"
            onClick={() => setSettingsSection('webhook')}
          >
            🔔 Webhook {settings.webhookConfigured && <span className="cfg-check">✓</span>}
          </button>
          <button className="ghost" title="Clé IA (BYOK)" onClick={() => setSettingsSection('ai')}>
            🤖 IA {settings.aiConfigured && <span className="cfg-check">✓</span>}
          </button>
          {me && <span className="pill">{me.name ?? 'connecté'}</span>}
          <button className="ghost" onClick={() => api.signOut()}>
            Déconnexion
          </button>
        </div>
      </header>

      <Routes>
        <Route
          path="/enclos"
          element={
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
          }
        />
        <Route
          path="/etable"
          element={
            <div className="split">
              <HerdTab enclos={enclos} stable={stable} onChanged={refresh} />
            </div>
          }
        />
        <Route
          path="/assistant"
          element={
            <div className="split">
              <AssistantTab
                enclos={enclos}
                stable={stable}
                speciesConfig={settings.speciesConfig}
                onChanged={refresh}
              />
            </div>
          }
        />
        <Route
          path="/succes"
          element={
            <div className="split">
              <SuccesTab
                species={species}
                achievements={achievements[species] ?? []}
                onChanged={refresh}
              />
            </div>
          }
        />
        <Route
          path="/planificateur"
          element={
            <div className="split">
              <BreedingTree species={species} mounts={allMounts} />
            </div>
          }
        />
        <Route
          path="/probabilites"
          element={
            <div className="split">
              <OddsCalculator species={species} />
            </div>
          }
        />
        <Route
          path="/nommage"
          element={
            <div className="split">
              <NamingTab species={species} />
            </div>
          }
        />
        <Route path="*" element={<Navigate to="/enclos" replace />} />
      </Routes>

      <SettingsDialog
        open={settingsSection !== null}
        section={settingsSection ?? 'webhook'}
        onClose={() => setSettingsSection(null)}
        onConfigured={() => refresh()}
        aiConfigured={settings.aiConfigured}
        webhookUrl={settings.webhookUrl}
        speciesConfig={settings.speciesConfig}
        speciesMeta={meta.species}
      />

      <OnboardingWizard
        open={wizardOpen}
        onClose={closeWizard}
        species={species}
        enclos={enclos}
        onImported={() => {
          refresh()
          setWizardOpen(false)
        }}
      />
    </>
  )
}
