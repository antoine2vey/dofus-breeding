import type { Bar, Enclos, FocusKey, Meta, StatKey, Stats } from './types'

export const FUEL_MAX = 100000

export const FUEL_GRID = [
  { v: 100000, label: '100 000' },
  { v: 90000, label: '90 000' },
  { v: 70000, label: '70 000' },
  { v: 40000, label: '40 000' },
  { v: 0, label: '0' }
]

const MOODS: { min: number; face: string }[] = [
  { min: 3000, face: '😄' },
  { min: 1000, face: '🙂' },
  { min: -1000, face: '😐' },
  { min: -3000, face: '🙁' },
  { min: -Infinity, face: '😠' }
]

export const moodFace = (serenity: number): string => MOODS.find((m) => serenity >= m.min)!.face

export const rateFor = (fuel: number): number => {
  if (fuel > 90000) return 40
  if (fuel > 70000) return 30
  if (fuel > 40000) return 20
  if (fuel > 0) return 10
  return 0
}

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Does any dragodinde still need this bar's goal? (false => the bar should freeze). */
export const barNeeded = (bar: Bar, enclos: Enclos, meta: Meta): boolean =>
  enclos.dragodindes.some((d) => !barGoalReached(bar, d.stats, meta))

export const barGoalReached = (bar: Bar, stats: Stats, meta: Meta): boolean =>
  bar.target === 'serenity'
    ? Math.abs(stats.serenity) <= meta.serenityGoal
    : stats[bar.target] >= meta.statMax

/** A dragodinde is done when every checked (focused) bar has reached its goal. */
export const isDone = (focus: FocusKey[], stats: Stats, meta: Meta): boolean => {
  if (focus.length === 0) return false
  return focus.every((k) => {
    const bar = meta.fuelBars.find((b) => b.key === k)
    return bar ? barGoalReached(bar, stats, meta) : false
  })
}

export const enclosDoneCount = (enclos: Enclos, meta: Meta): number =>
  enclos.dragodindes.filter((d) => isDone(enclos.focus, d.stats, meta)).length

/** Stat targets currently focused (for highlighting the dragodinde's stat bars). */
export const focusedStats = (focus: FocusKey[], meta: Meta): Set<StatKey> =>
  new Set(
    focus
      .map((k) => meta.fuelBars.find((b) => b.key === k)?.target)
      .filter((t): t is StatKey => Boolean(t))
  )

export const focusLabels = (focus: FocusKey[], meta: Meta): string[] =>
  focus.map((k) => meta.fuelBars.find((b) => b.key === k)?.label ?? k)

// ---- ETAs ----

const stepBoundary = (fuel: number): number =>
  fuel > 90000 ? 90000 : fuel > 70000 ? 70000 : fuel > 40000 ? 40000 : 0

export const fmtK = (n: number): string => (n >= 1000 ? `${n / 1000}k` : `${n}`)

/** Seconds until the fuel drains past the next step down (band boundary). */
export const etaNextStepSec = (fuel: number, tickMs: number): number | null => {
  const r = rateFor(fuel)
  if (r <= 0) return null
  const ticks = Math.ceil((fuel - stepBoundary(fuel)) / r)
  return ticks * (tickMs / 1000)
}

export const nextStepLabel = (fuel: number): string => fmtK(stepBoundary(fuel))

/** Seconds to drive `stat` to `goal` (direction dir) as the fuel drains; null if fuel runs out first. */
const etaToGoalSec = (
  fuel: number,
  stat: number,
  goal: number,
  dir: number,
  tickMs: number
): number | null => {
  let f = fuel
  let s = stat
  let ticks = 0
  while (dir > 0 ? s < goal : s > goal) {
    const r = rateFor(f)
    if (r <= 0) return null
    s += dir * r
    f -= r
    if (++ticks > 50000) return null
  }
  return ticks * (tickMs / 1000)
}

/**
 * Seconds until a bar "maxes out" — every dragodinde reaches its goal and the bar freezes.
 * Returns null if nothing needs it, "never" if the fuel is insufficient for the laggiest.
 */
export const barEtaToMaxSec = (
  bar: Bar,
  enclos: Enclos,
  meta: Meta,
  tickMs: number
): number | null | 'never' => {
  const fuel = enclos.fuel[bar.key]
  const dir = bar.sign
  let maxEta: number | null = null
  for (const d of enclos.dragodindes) {
    if (barGoalReached(bar, d.stats, meta)) continue
    let goal: number
    if (bar.target === 'serenity') {
      // Entering the [-goal, +goal] band: raising enters at -goal, lowering at +goal.
      // If serenity is already past the band on the bar's side, it can never enter.
      if (dir * d.stats.serenity > meta.serenityGoal) return 'never'
      goal = -dir * meta.serenityGoal
    } else {
      goal = meta.statMax
    }
    const eta = etaToGoalSec(fuel, d.stats[bar.target], goal, dir, tickMs)
    if (eta == null) return 'never'
    maxEta = maxEta == null ? eta : Math.max(maxEta, eta)
  }
  return maxEta
}

export const fmtEta = (sec: number | null | 'never'): string => {
  if (sec === 'never') return '∞'
  if (sec == null) return '—'
  if (sec < 60) return `${Math.round(sec)}s`
  const totalMin = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  if (totalMin < 60) return s ? `${totalMin}m${s}s` : `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m ? `${h}h${m}m` : `${h}h`
}
