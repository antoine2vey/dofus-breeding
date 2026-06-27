import type {
  ArbiterAction,
  ArbiterResult,
  AssistantPlan,
  BreedAction,
  CaptureNeed,
  CloneAction,
  ExtractionCandidate,
  RaiseAction,
  Species,
  SpeciesConfig
} from '@dd/core'
import { byNameOf, colorsOf, genColorOf, inGameCompare, SPECIES, SPECIES_LIST } from '@dd/core'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { Dragodinde, Enclos, ReproStatus, Sex } from '../types'
import { useMutation } from '../useMutation'
import { useBoolParam, useIntParam, useStringParam } from '../useSearchParamState'

const STATUS_LABEL: Record<ReproStatus, string> = {
  feconde: 'féconde',
  fertile: 'fertile',
  sterile: 'stérile'
}

// ── Next-step rows (each owns its local pickers) ───────────────────────────
// Per-species rows take a `species` so colour/gen lookups are scoped to that mount's tree.
function BreedRow({
  species,
  a,
  busy,
  onApply
}: {
  species: Species
  a: BreedAction
  busy: boolean
  onApply: (color: string, sex: Sex) => void
}) {
  const races = colorsOf(species).map((c) => c.name)
  const genColor = genColorOf(species)
  // Default to the colour the cross is FOR (the score-driver), not the most probable outcome —
  // a lineage-tainted parent can make an already-owned by-product the likeliest result.
  const [color, setColor] = useState(a.intended || a.top[0]?.race || '')
  const [sex, setSex] = useState<Sex>('F')
  return (
    <div className="step-row">
      <span className="sr-main">
        {a.aLabel} × {a.bLabel}
      </span>
      <span className="sr-odds">
        {a.top.map((o) => (
          <span
            key={o.race}
            style={{ marginRight: 8 }}
            className={o.race === a.intended ? 'sr-intended' : undefined}
          >
            <b style={{ color: genColor[o.gen] }}>{Math.round(o.prob * 100)}%</b> {o.race}
            {o.race === a.intended && (
              <span className="clone-tag" style={{ marginLeft: 4 }}>
                visé
              </span>
            )}
          </span>
        ))}
      </span>
      <span className="sr-act">
        <select value={color} onChange={(e) => setColor(e.target.value)} title="couleur obtenue">
          {races.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
          <option value="F">♀</option>
          <option value="M">♂</option>
        </select>
        <button className="mini" disabled={busy || !color} onClick={() => onApply(color, sex)}>
          ✓ enregistrer
        </button>
      </span>
    </div>
  )
}

function CloneRow({
  a,
  names,
  busy,
  onApply
}: {
  a: CloneAction
  names: [string, string]
  busy: boolean
  onApply: (survivorId: number) => void
}) {
  // Two same-gen steriles, one survives (refreshed to fertile, keeps its own attributes); the user
  // picks which one stays — the other is consumed.
  const [survivorId, setSurvivorId] = useState<number>(a.aId)
  return (
    <div className="step-row">
      <span className="sr-main">
        ♻{' '}
        <span className="muted small">
          {names[0]}, {names[1]}
        </span>
      </span>
      <span className="sr-odds muted small">{a.reason}</span>
      <span className="sr-act">
        <select
          title="survivante"
          value={survivorId}
          onChange={(e) => setSurvivorId(Number(e.target.value))}
        >
          <option value={a.aId}>{names[0]}</option>
          <option value={a.bId}>{names[1]}</option>
        </select>
        <button className="mini" disabled={busy} onClick={() => onApply(survivorId)}>
          ♻ cloner
        </button>
      </span>
    </div>
  )
}

function CaptureRow({
  species,
  need,
  busy,
  onApply
}: {
  species: Species
  need: CaptureNeed
  busy: boolean
  onApply: (count: number, sex: Sex) => void
}) {
  const genColor = genColorOf(species)
  const gen = byNameOf(species).get(need.color)?.gen ?? 0
  const [count, setCount] = useState(need.count)
  const [sex, setSex] = useState<Sex>('F')
  // Re-seed when the planner's remaining count changes (e.g. after a partial capture).
  useEffect(() => setCount(need.count), [need.count])
  return (
    <div className="step-row">
      <span className="sr-main" style={{ color: genColor[gen] }}>
        {need.color}
      </span>
      <span className="sr-odds muted small">à capturer en jeu, puis enregistrer ici</span>
      <span className="sr-act">
        <input
          type="number"
          min={1}
          max={50}
          value={count}
          style={{ width: 56 }}
          onChange={(e) =>
            setCount(Math.max(1, Math.min(50, Math.floor(Number(e.target.value) || 1))))
          }
        />
        <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
          <option value="F">♀</option>
          <option value="M">♂</option>
        </select>
        <button className="mini" disabled={busy} onClick={() => onApply(count, sex)}>
          + enregistrer
        </button>
      </span>
    </div>
  )
}

// ── Cross-species arbiter action row ───────────────────────────────────────
// One ranked action over the SHARED enclos slot pool. The action carries its own species, so the
// badge + any colour lookup is scoped per-ROW to `a.species`.
function ArbiterRow({
  a,
  busy,
  onBreed,
  onClone,
  onCapture
}: {
  a: ArbiterAction
  busy: boolean
  onBreed: (a: ArbiterAction, color: string, sex: Sex) => void
  onClone: (a: ArbiterAction, survivorId: number) => void
  onCapture: (a: ArbiterAction, count: number, sex: Sex) => void
}) {
  const meta = SPECIES[a.species]
  const genColor = genColorOf(a.species)
  const driverGen = byNameOf(a.species).get(a.driver)?.gen ?? 0
  const races = colorsOf(a.species).map((c) => c.name)

  // Per-kind local apply state.
  const [color, setColor] = useState(a.breed?.intended || a.breed?.top[0]?.race || a.driver || '')
  const [sex, setSex] = useState<Sex>('F')
  const [count, setCount] = useState(a.capture?.count ?? a.slots)
  const [survivorId, setSurvivorId] = useState<number>(a.recycle?.ids[0] ?? 0)
  useEffect(() => setCount(a.capture?.count ?? a.slots), [a.capture?.count, a.slots])

  const kindLabel =
    a.kind === 'breed' ? '⚥ croiser' : a.kind === 'clone' ? '♻ cloner' : '🎯 capturer'

  return (
    <div className="step-row">
      <span className="sr-main">
        <span title={meta.label} style={{ marginRight: 6 }}>
          {meta.icon}
        </span>
        {kindLabel} <b style={{ color: genColor[driverGen] }}>{a.driver}</b>{' '}
        <span className="muted small">gen {driverGen}</span>
      </span>

      {a.kind === 'breed' && a.breed && (
        <>
          <span className="sr-odds">
            <span className="muted small">
              {a.breed.aLabel} × {a.breed.bLabel} —{' '}
            </span>
            {a.breed.top.map((o) => (
              <span
                key={o.race}
                style={{ marginRight: 8 }}
                className={o.race === a.breed!.intended ? 'sr-intended' : undefined}
              >
                <b style={{ color: genColor[o.gen] }}>{Math.round(o.prob * 100)}%</b> {o.race}
              </span>
            ))}
          </span>
          <span className="sr-act">
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              title="couleur obtenue"
            >
              {races.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
              <option value="F">♀</option>
              <option value="M">♂</option>
            </select>
            <button
              className="mini"
              disabled={busy || !color}
              onClick={() => onBreed(a, color, sex)}
            >
              ✓ enregistrer
            </button>
          </span>
        </>
      )}

      {a.kind === 'clone' && a.recycle && (
        <>
          <span className="sr-odds muted small">{a.recycle.reason}</span>
          <span className="sr-act">
            <select
              title="survivante"
              value={survivorId}
              onChange={(e) => setSurvivorId(Number(e.target.value))}
            >
              {a.recycle.ids.map((id) => (
                <option key={id} value={id}>
                  #{id}
                </option>
              ))}
            </select>
            <button className="mini" disabled={busy} onClick={() => onClone(a, survivorId)}>
              ♻ cloner
            </button>
          </span>
        </>
      )}

      {a.kind === 'capture' && a.capture && (
        <>
          <span className="sr-odds muted small">
            {a.capture.reason} — à capturer en jeu, puis enregistrer ici
          </span>
          <span className="sr-act">
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              style={{ width: 56 }}
              onChange={(e) =>
                setCount(Math.max(1, Math.min(50, Math.floor(Number(e.target.value) || 1))))
              }
            />
            <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
              <option value="F">♀</option>
              <option value="M">♂</option>
            </select>
            <button className="mini" disabled={busy} onClick={() => onCapture(a, count, sex)}>
              + enregistrer
            </button>
          </span>
        </>
      )}
    </div>
  )
}

// ── Extraction: sacrifice surplus "done" mounts for the species' reward item ──
// Per-colour count stepper (the server resolves WHICH mounts, steriles-first). Opt-in: nothing is
// selected by default, and "Extraire" asks for an inline confirm before deleting.
function ExtractionSection({
  species,
  candidates,
  busy,
  onExtract
}: {
  species: Species
  candidates: ReadonlyArray<ExtractionCandidate>
  busy: boolean
  onExtract: (items: { color: string; count: number }[]) => void
}) {
  const reward = SPECIES[species].reward
  const genColor = genColorOf(species)
  const [sel, setSel] = useState<Record<string, number>>({})
  const [confirming, setConfirming] = useState(false)

  // Reset the selection whenever the candidate set changes (params, species, after an extraction).
  const sig = candidates.map((c) => `${c.color}:${c.surplus}`).join('|')
  useEffect(() => {
    setSel({})
    setConfirming(false)
  }, [sig])

  if (candidates.length === 0) return null

  const setCount = (color: string, n: number, max: number) =>
    setSel((s) => ({ ...s, [color]: Math.max(0, Math.min(max, Math.floor(n) || 0)) }))
  const totalMounts = candidates.reduce((n, c) => n + (sel[c.color] ?? 0), 0)
  const totalReward = candidates.reduce((n, c) => n + (sel[c.color] ?? 0) * c.rewardEach, 0)
  const selectAll = () => setSel(Object.fromEntries(candidates.map((c) => [c.color, c.surplus])))

  const submit = () => {
    const items = candidates
      .map((c) => ({ color: c.color, count: sel[c.color] ?? 0 }))
      .filter((it) => it.count > 0)
    if (items.length === 0) return
    onExtract(items)
    setConfirming(false)
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="policy-head">
        <span>
          ♻ Extraction
          <img
            src={reward.image}
            alt={reward.item}
            title={reward.item}
            style={{ width: 16, height: 16, verticalAlign: 'text-bottom', margin: '0 4px' }}
          />
        </span>
        <span className="muted">
          {candidates.length} couleur(s) extractible(s) ·{' '}
          {candidates.reduce((n, c) => n + c.surplus * c.rewardEach, 0)} {reward.item} possible(s)
        </span>
      </div>
      <div className="muted small" style={{ margin: '4px 0 8px' }}>
        Surplus de couleurs déjà obtenues (succès) que le moteur n'utilise pas comme reproducteur.
        Récompense = génération de la monture. Les montures gardées et la gen 1 sont exclues.
      </div>
      <table className="roadmap-table">
        <tbody>
          {candidates.map((c) => {
            const n = sel[c.color] ?? 0
            return (
              <tr key={c.color}>
                <td style={{ color: genColor[c.gen] }}>
                  {c.color} <span className="muted small">gen {c.gen}</span>
                </td>
                <td className="muted small">
                  surplus {c.surplus}/{c.owned}
                </td>
                <td className="sr-act">
                  <button
                    className="mini"
                    disabled={busy || n <= 0}
                    onClick={() => setCount(c.color, n - 1, c.surplus)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={c.surplus}
                    value={n}
                    style={{ width: 48, textAlign: 'center' }}
                    onChange={(e) => setCount(c.color, Number(e.target.value), c.surplus)}
                  />
                  <button
                    className="mini"
                    disabled={busy || n >= c.surplus}
                    onClick={() => setCount(c.color, n + 1, c.surplus)}
                  >
                    +
                  </button>
                </td>
                <td className="rm-count" style={{ color: n > 0 ? genColor[c.gen] : undefined }}>
                  {n > 0 ? `${n * c.rewardEach}` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="step-row" style={{ marginTop: 8 }}>
        <span className="sr-main">
          {totalMounts > 0 ? (
            <>
              Extraire <b>{totalMounts}</b> monture(s) →{' '}
              <b>
                {totalReward} {reward.item}
              </b>
            </>
          ) : (
            <span className="muted small">Choisis combien extraire par couleur.</span>
          )}
        </span>
        <span className="sr-act">
          <button className="ghost" disabled={busy} onClick={selectAll}>
            tout sélectionner
          </button>
          {confirming ? (
            <>
              <button className="mini" disabled={busy} onClick={submit}>
                ✓ confirmer
              </button>
              <button className="mini" disabled={busy} onClick={() => setConfirming(false)}>
                annuler
              </button>
            </>
          ) : (
            <button
              className="mini"
              disabled={busy || totalMounts === 0}
              onClick={() => setConfirming(true)}
            >
              ♻ Extraire
            </button>
          )}
        </span>
      </div>
    </div>
  )
}

export function AssistantTab({
  enclos,
  stable,
  speciesConfig,
  onChanged
}: {
  enclos: Enclos[]
  stable: Dragodinde[]
  speciesConfig: SpeciesConfig
  onChanged: () => void
}) {
  // ── Per-species roadmap controls (the read-only Layer A/B plan is single-species) ──
  // Roadmap controls live in the URL query string — refresh / shared link reproduces the same plan.
  const [roadmapSpecies, setRoadmapSpecies] = useStringParam<Species>('sp', 'dragodinde')
  // Seed the roadmap controls from the SAVED per-species config — the same source the cross-species
  // arbiter (global next-step) reads — so the single-species plan matches the global one by default
  // instead of contradicting it. A URL param still wins when the user tweaks a control to explore a
  // what-if; switching species re-seeds from that species' config (the fallbacks are read live).
  const cfg = speciesConfig[roadmapSpecies]
  const [targetGen, setTargetGen] = useIntParam('gen', cfg?.targetGen ?? 10)
  const [level, setLevel] = useIntParam('level', cfg?.level ?? 100)
  const [optimakina, setOptimakina] = useBoolParam('optima', cfg?.optimakina ?? true)
  const [plan, setPlan] = useState<AssistantPlan | null>(null)
  const [planErr, setPlanErr] = useState<string | null>(null)
  const [planLoading, setPlanLoading] = useState(false) // the (read-only) plan recompute is busy
  const [openGens, setOpenGens] = useState<Set<number>>(new Set())

  // ── Cross-species next step (the arbiter ranks one action list over the shared slot pool) ──
  const [arb, setArb] = useState<ArbiterResult | null>(null)
  const [arbErr, setArbErr] = useState<string | null>(null)

  // Chat (SSE streaming)
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)

  // Species-scoped helpers for the roadmap section.
  const roadmapGenColor = genColorOf(roadmapSpecies)

  const refetchPlan = useCallback(async () => {
    setPlanLoading(true)
    try {
      const [p, a] = await Promise.all([
        api.assistantPlan({ species: roadmapSpecies, targetGen, level, optimakina }),
        api.arbiter({})
      ])
      setPlan(p)
      setPlanErr(null)
      setArb(a)
      setArbErr(null)
    } catch {
      setPlanErr('Échec du calcul du plan — le serveur tourne-t-il ?')
      setArbErr('Échec du calcul des priorités cross-espèces.')
    } finally {
      setPlanLoading(false)
    }
  }, [roadmapSpecies, targetGen, level, optimakina])

  // Debounced so dragging the level input doesn't POST a plan on every keystroke.
  useEffect(() => {
    const t = setTimeout(refetchPlan, 350)
    return () => clearTimeout(t)
  }, [refetchPlan])

  // Mutations cross the shared mutation seam (latch + busy + refresh). After each one we refresh the
  // herd and recompute the plan; `busy` the JSX disables on is either a plan recompute or a mutation.
  const { busy: mutBusy, run } = useMutation(async () => {
    onChanged()
    await refetchPlan()
  })
  const busy = planLoading || mutBusy
  const act = async (p: Promise<{ error?: string } | unknown>) => {
    // refetchPlan (run by the seam) clears planErr on success — surface any action error AFTER it.
    const r = await run(p)
    if (r && typeof r === 'object' && 'error' in r && (r as { error?: string }).error) {
      setPlanErr((r as { error: string }).error)
    }
  }
  const applyRaise = (a: RaiseAction) => act(api.bulkMove([...a.mountIds], a.enclosId))
  const applyBreed = (a: BreedAction, color: string, sex: Sex) =>
    act(api.breed({ parentAId: a.aId, parentBId: a.bId, color, sex }))
  const applyClone = (a: CloneAction, survivorId: number) =>
    act(api.clone({ survivorId, consumedId: survivorId === a.aId ? a.bId : a.aId }))
  const applyExtract = (items: { color: string; count: number }[]) =>
    act(api.extract({ species: roadmapSpecies, targetGen, level, optimakina, items }))
  const applyCapture = (species: Species, color: string, count: number, sex: Sex) =>
    act(
      api.importMounts(
        Array.from({ length: count }, () => ({
          color,
          sex,
          status: 'fertile' as ReproStatus
        })),
        null,
        species
      )
    )

  // ── Cross-species apply handlers (each carries the action's own species) ──
  const applyArbiterBreed = (a: ArbiterAction, color: string, sex: Sex) => {
    if (!a.breed) return
    act(api.breed({ parentAId: a.breed.aId, parentBId: a.breed.bId, color, sex }))
  }
  const applyArbiterClone = (a: ArbiterAction, survivorId: number) => {
    if (!a.recycle) return
    const consumedId = a.recycle.ids.find((id) => id !== survivorId) ?? a.recycle.ids[0]
    act(api.clone({ survivorId, consumedId }))
  }
  const applyArbiterCapture = (a: ArbiterAction, count: number, sex: Sex) =>
    applyCapture(a.species, a.driver, count, sex)

  const sendChat = async () => {
    const text = input.trim()
    if (!text || streaming) return
    const history = [...chat, { role: 'user' as const, content: text }]
    setChat([...history, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          species: roadmapSpecies,
          targetGen,
          level,
          optimakina
        })
      })
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({ error: 'Erreur réseau' }))
        setChat([...history, { role: 'assistant', content: `⚠️ ${e.error ?? 'Erreur'}` }])
        return
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = '',
        acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let i: number
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const line = buf.slice(0, i)
          buf = buf.slice(i + 2)
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') continue
          try {
            const obj = JSON.parse(payload) as { text?: string; error?: string }
            if (obj.text) acc += obj.text
            if (obj.error) acc += `\n⚠️ ${obj.error}`
            setChat([...history, { role: 'assistant', content: acc }])
          } catch {
            /* partial */
          }
        }
      }
    } catch {
      setChat([...history, { role: 'assistant', content: '⚠️ Connexion interrompue' }])
    } finally {
      setStreaming(false)
      onChanged() // the AI may have mutated state via tools
      await refetchPlan()
    }
  }

  const toggleGen = (g: number) =>
    setOpenGens((s) => {
      const n = new Set(s)
      n.has(g) ? n.delete(g) : n.add(g)
      return n
    })

  // Live context (from props — always fresh via the 3s poll)
  const stableByStatus = (st: ReproStatus) => stable.filter((m) => m.status === st).length
  const ns = plan?.nextStep
  // The newest next-step fields can lag during a dev reload (server still on older core) — default
  // them so a stale API response missing fillCaptures/idleSlots can never crash the tab.
  const fillCaptures = ns?.fillCaptures ?? []
  const idleSlots = ns?.idleSlots ?? 0
  // Resolve mount ids to their in-game (convention) names so steps are findable in the game.
  const nameById = new Map(
    [...stable, ...enclos.flatMap((e) => e.mounts)].map((m) => [m.id, m.name])
  )
  const nm = (id: number) => nameById.get(id) ?? `#${id}`

  // The arbiter's allocated actions fill the shared slots; fall back to the full ranked list when
  // there are no free slots so the user still sees what to prioritise.
  const arbActions: ReadonlyArray<ArbiterAction> =
    arb && arb.allocated.length > 0 ? arb.allocated : (arb?.ranked ?? [])

  // The cross-species arbiter only earns its place when ≥2 species compete for the shared enclos
  // pool. With a single enabled species its output is identical to the per-species next-step below,
  // so hide it and let that be the primary view.
  const enabledCount = Object.values(speciesConfig).filter((c) => c.enabled).length

  return (
    <div className="pane planner assistant-v2">
      <div className="assistant-split">
        <div className="assistant-main">
          {/* Cross-species arbiter — shown only when ≥2 species compete for the shared enclos pool.
              With one enabled species it duplicates the per-species next-step below, so it's hidden. */}
          {enabledCount >= 2 && (
            <>
              <div className="policy-head">
                <span>▶ Prochaine étape (toutes espèces)</span>
                <span className="muted">
                  {arb
                    ? `${arb.usedSlots}/${arb.freeSlots} emplacements utilisés`
                    : 'classement des actions par priorité × valeur'}
                </span>
              </div>
              {arbErr && <div className="decode-err">✗ {arbErr}</div>}
              {arb && arbActions.length === 0 && (
                <div className="muted small">
                  Rien à appliquer directement — capture des bases ou monte des montures.
                </div>
              )}
              {arbActions.length > 0 && (
                <div className="step-group">
                  {arbActions.map((a, i) => (
                    <ArbiterRow
                      key={`${a.species}-${a.kind}-${a.driver}-${a.breed?.aId ?? a.recycle?.ids[0] ?? i}`}
                      a={a}
                      busy={busy}
                      onBreed={applyArbiterBreed}
                      onClone={applyArbiterClone}
                      onCapture={applyArbiterCapture}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {planErr && <div className="decode-err">✗ {planErr}</div>}

          {/* Live context bar */}
          <div className="ctx-bar">
            <div className="ctx-block">
              <div className="ctx-label">
                🏠 Étable <span className="muted">({stable.length})</span>
              </div>
              <div className="ctx-pills">
                <span className="pill ok">{stableByStatus('feconde')} féconde</span>
                <span className="pill">{stableByStatus('fertile')} fertile</span>
                <span className="pill bad">{stableByStatus('sterile')} stérile</span>
              </div>
            </div>
            <div className="ctx-block">
              <div className="ctx-label">Enclos</div>
              <div className="ctx-pills">
                {enclos.map((e) => (
                  <span
                    key={e.id}
                    className={
                      'pill' + (e.mounts.length >= 10 ? ' bad' : e.mounts.length === 0 ? ' ok' : '')
                    }
                    title={
                      e.mounts.map((d) => `${d.name} (${STATUS_LABEL[d.status]})`).join(', ') ||
                      'vide'
                    }
                  >
                    {e.name}: {e.mounts.length}/10
                  </span>
                ))}
              </div>
            </div>
          </div>

          {plan && (
            <>
              {/* Progress cards */}
              <div className="plan-cards">
                <div className="card big">
                  <div className="card-label">Couleurs obtenues (gen {plan.roadmap.targetGen})</div>
                  <div className="card-value">
                    {plan.roadmap.obtainedColors}/{plan.roadmap.totalColors}
                  </div>
                  <div className="card-sub">
                    <span>{plan.roadmap.reached ? 'objectif atteint 🎉' : ns?.summary}</span>
                  </div>
                </div>
                <div className="card">
                  <div className="card-label">Captures restantes</div>
                  <div className="card-value">
                    {Object.values(plan.roadmap.baseCaptures).reduce((a, b) => a + b, 0)}
                  </div>
                </div>
                <div className="card">
                  <div className="card-label">Croisements restants</div>
                  <div className="card-value">{plan.roadmap.totalCrosses}</div>
                </div>
              </div>

              {/* ── Layer B: next step (single-species detail for the picked espèce) ── */}
              <div className="policy-head">
                <span>
                  ▶ Prochaine étape — {SPECIES[roadmapSpecies].icon} {SPECIES[roadmapSpecies].label}
                </span>
                <span className="muted">{ns?.summary}</span>
              </div>
              {ns &&
                !ns.done &&
                ns.raise.length +
                  ns.breed.length +
                  ns.clone.length +
                  ns.capture.length +
                  fillCaptures.length ===
                  0 && (
                  <div className="muted small">
                    Rien à appliquer directement — capture des bases ou monte des montures.
                  </div>
                )}

              {ns && ns.raise.length > 0 && (
                <div className="step-group">
                  <div className="step-title">
                    ⬆ Élever vers féconde <span className="muted small">déplacement auto</span>
                  </div>
                  {ns.raise.map((a) => (
                    <div className="step-row" key={a.enclosId}>
                      <span className="sr-main">
                        {a.enclosName} <span className="muted small">({a.mountIds.length})</span>
                      </span>
                      <span className="sr-odds small">
                        {a.mountIds.map(nm).sort(inGameCompare).join(', ')}
                      </span>
                      <span className="sr-act">
                        <button className="mini" disabled={busy} onClick={() => applyRaise(a)}>
                          → déplacer
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {ns && ns.breed.length > 0 && (
                <div className="step-group">
                  <div className="step-title">
                    ⚥ Croiser (féconde){' '}
                    <span className="muted small">choisis la couleur réellement obtenue</span>
                  </div>
                  {ns.breed.map((a) => (
                    <BreedRow
                      key={`${a.aId}-${a.bId}`}
                      species={roadmapSpecies}
                      a={a}
                      busy={busy}
                      onApply={(c, s) => applyBreed(a, c, s)}
                    />
                  ))}
                </div>
              )}

              {ns && ns.clone.length > 0 && (
                <div className="step-group">
                  <div className="step-title">♻ Cloner (stériles)</div>
                  {ns.clone.map((a) => (
                    <CloneRow
                      key={`${a.aId}-${a.bId}`}
                      a={a}
                      names={[nm(a.aId), nm(a.bId)]}
                      busy={busy}
                      onApply={(s) => applyClone(a, s)}
                    />
                  ))}
                </div>
              )}

              {ns && ns.capture.length > 0 && (
                <div className="step-group">
                  <div className="step-title">🎯 Capturer (Gen 1)</div>
                  {ns.capture.map((need) => (
                    <CaptureRow
                      key={need.color}
                      species={roadmapSpecies}
                      need={need}
                      busy={busy}
                      onApply={(c, s) => applyCapture(roadmapSpecies, need.color, c, s)}
                    />
                  ))}
                </div>
              )}

              {/* Capacity-fill: extra catchable bases to occupy idle enclos slots (optional). */}
              {fillCaptures.length > 0 && (
                <div className="step-group">
                  <div className="step-title">
                    🎯 Remplir les enclos{' '}
                    <span className="muted small">
                      optionnel — {idleSlots} emplacement(s) libre(s) après élevage : capture pour
                      les occuper et paralléliser la montée
                    </span>
                  </div>
                  {fillCaptures.map((need) => (
                    <CaptureRow
                      key={`fill-${need.color}`}
                      species={roadmapSpecies}
                      need={need}
                      busy={busy}
                      onApply={(c, s) => applyCapture(roadmapSpecies, need.color, c, s)}
                    />
                  ))}
                </div>
              )}

              {/* ── Layer A: roadmap ── */}
              <div className="policy-head" style={{ marginTop: 16 }}>
                <span>🗺 Feuille de route</span>
                <span className="muted">
                  besoins restants, du bas vers la gen {plan.roadmap.targetGen}
                </span>
              </div>
              {plan.roadmap.gens.map((g) => {
                const open = openGens.has(g.gen)
                const remaining = g.rows.reduce((n, r) => n + r.need, 0)
                return (
                  <div className="roadmap-gen" key={g.gen}>
                    <button className="rg-head" onClick={() => toggleGen(g.gen)}>
                      <span style={{ color: roadmapGenColor[g.gen], fontWeight: 700 }}>
                        {open ? '▾' : '▸'} Gen {g.gen}
                      </span>
                      <span className="muted small">
                        {g.rows.length} couleur(s) · {remaining} à produire
                      </span>
                    </button>
                    {open && (
                      <table className="roadmap-table">
                        <tbody>
                          {g.rows.map((r) => {
                            const total = r.owned + r.need
                            const frac = total > 0 ? r.owned / total : 1
                            return (
                              <tr key={r.color}>
                                <td style={{ color: roadmapGenColor[r.gen] }}>
                                  {r.done ? '🏆 ' : ''}
                                  {r.color}
                                </td>
                                <td className="rm-recipe muted small">
                                  {r.recipe ? r.recipe.join(' + ') : 'capture'}
                                  {r.done && r.need > 0 ? ' · succès, mais parent requis' : ''}
                                </td>
                                <td className="rm-prog">
                                  {r.done && r.need === 0 ? (
                                    <span className="muted small">succès ✓</span>
                                  ) : (
                                    <div className="hmeter">
                                      <div
                                        className="hfill"
                                        style={{
                                          width: `${frac * 100}%`,
                                          background: roadmapGenColor[r.gen]
                                        }}
                                      />
                                    </div>
                                  )}
                                </td>
                                <td className="rm-count">
                                  {r.done && r.need === 0 ? '—' : `${r.owned}/${total}`}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}

              {/* ── Extraction: sacrifice surplus done mounts for the reward ── */}
              <ExtractionSection
                species={roadmapSpecies}
                candidates={plan.extraction}
                busy={busy}
                onExtract={applyExtract}
              />
            </>
          )}

          {/* Roadmap controls — placed below the plan so the actionable next-step leads the panel. */}
          <div className="plan-controls" style={{ marginTop: 16 }}>
            <label>
              Espèce
              <select
                value={roadmapSpecies}
                onChange={(e) => setRoadmapSpecies(e.target.value as Species)}
              >
                {SPECIES_LIST.map((s) => (
                  <option key={s} value={s}>
                    {SPECIES[s].icon} {SPECIES[s].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Objectif
              <select value={targetGen} onChange={(e) => setTargetGen(Number(e.target.value))}>
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((g) => (
                  <option key={g} value={g}>
                    Atteindre Gen {g}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Niveau
              <input
                type="number"
                min={1}
                max={200}
                value={level}
                onChange={(e) =>
                  setLevel(Math.min(200, Math.max(1, Math.floor(Number(e.target.value) || 1))))
                }
              />
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={optimakina}
                onChange={(e) => setOptimakina(e.target.checked)}
              />{' '}
              Optimakina
            </label>
            <button className="ghost" disabled={busy} onClick={refetchPlan}>
              {busy ? 'calcul…' : '↻ Recalculer'}
            </button>
          </div>
        </div>

        <aside className="assistant-chat">
          {/* Chat side-channel */}
          <div className="policy-head">
            <span>💬 IA</span>
            <span className="muted">
              demande, ajuste, ou laisse-le agir (« croise 3 et 4 », « j'ai capturé 5 Amande »)
            </span>
          </div>
          <div className="chat-log">
            {chat.length === 0 && (
              <div className="muted small">
                Ex. « Que faire en priorité ? », « Mets mes Amande fertiles en enclos 2 », « J'ai
                capturé 4 Rousse ».
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} className={'chat-msg ' + m.role}>
                <span className="chat-who">{m.role === 'user' ? 'toi' : '🤖'}</span>
                <span className="chat-text">
                  {m.content || (streaming && i === chat.length - 1 ? '…' : '')}
                </span>
              </div>
            ))}
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={input}
              placeholder="Pose ta question ou donne un ordre…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendChat()
              }}
              disabled={streaming}
            />
            <button onClick={sendChat} disabled={streaming || !input.trim()}>
              {streaming ? '…' : 'Envoyer'}
            </button>
          </div>
        </aside>
      </div>

      <p className="plan-note muted">
        Le plan est <b>déterministe</b> (feuille de route + prochaine étape calculées depuis ton
        stock réel) ; les déplacements s'appliquent direct, les croisements/clonages se confirment.
        L'<b>IA</b> lit le même plan, répond aux questions et peut agir sur ta demande.
      </p>
    </div>
  )
}
