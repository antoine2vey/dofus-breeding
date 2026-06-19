import { useMemo, useState } from 'react'
import { GEN_COLOR } from '@dd/core'
import {
  BASE_LETTER,
  COLOR_CODES,
  buildName,
  colorCode,
  genOf,
  parseName,
  validateInGame,
  type Sex
} from '@dd/core'

const SEXES: { key: Sex; label: string }[] = [
  { key: 'F', label: '♀ femelle' },
  { key: 'M', label: '♂ mâle' }
]

export function NamingTab() {
  // Generator
  const [color, setColor] = useState('Pourpre')
  const [sex, setSex] = useState<Sex>('F')
  const [keeper, setKeeper] = useState(false)
  const [copied, setCopied] = useState(false)
  // Decoder / validator
  const [probe, setProbe] = useState('')

  const name = buildName({ color, sex, keeper })
  const nameValid = validateInGame(name)

  const probeVal = probe.length ? validateInGame(probe) : null
  const probeParsed = probe.length ? parseName(probe) : null

  // Illustrative sorted run for the selected colour (shows the grouping order).
  const sample = useMemo(() => {
    const cc = colorCode(color)
    return [`${cc}-K-f`, `${cc}-K-m`, `${cc}-f`, `${cc}-m`]
  }, [color])

  const copy = () => {
    navigator.clipboard?.writeText(name).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  const byGen = useMemo(() => {
    const m = new Map<number, typeof COLOR_CODES>()
    for (const c of COLOR_CODES) (m.get(c.gen) ?? m.set(c.gen, []).get(c.gen)!).push(c)
    return m
  }, [])

  return (
    <div className="pane planner">
      <div className="pane-head">
        <h2>🏷️ Nommage des dragodindes</h2>
        <span className="muted">code couleur · sexe · numéro — triable et sans accent</span>
      </div>

      {/* Generator */}
      <div className="policy-head">
        <span>Générateur de nom</span>
        <span className="muted">construis un nom valide à coller en jeu</span>
      </div>
      <div className="plan-controls">
        <label>
          Couleur
          <select value={color} onChange={(e) => setColor(e.target.value)}>
            {[...byGen.keys()]
              .sort((a, b) => a - b)
              .map((g) => (
                <optgroup key={g} label={`Génération ${g}`}>
                  {(byGen.get(g) ?? []).map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} — {c.code}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        </label>
        <label>
          Sexe
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            {SEXES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="chk">
          <input type="checkbox" checked={keeper} onChange={(e) => setKeeper(e.target.checked)} />
          Keeper (exemplaire à garder)
        </label>
      </div>

      <div className="name-output">
        <code className="name-big">{name}</code>
        <span className={'pill ' + (nameValid.valid ? 'ok' : 'bad')}>
          {name.length}/20 {nameValid.valid ? '✓' : '✗'}
        </span>
        <button className="mini" onClick={copy}>
          {copied ? 'copié ✓' : 'copier'}
        </button>
        <span className="muted small">
          {color} (gen {genOf(color)}), {sex === 'F' ? 'femelle' : 'mâle'}
          {keeper ? ', keeper' : ''}
        </span>
      </div>
      <div className="name-sample muted small">
        Tri en jeu pour {colorCode(color)} :{' '}
        {sample.map((s, i) => (
          <span key={s}>
            <code>{s}</code>
            {i < sample.length - 1 ? ' ‹ ' : ''}
          </span>
        ))}{' '}
        — keepers en tête, ♀ avant ♂.
      </div>

      {/* Decoder / validator */}
      <div className="policy-head" style={{ marginTop: 18 }}>
        <span>Décodeur / validateur</span>
        <span className="muted">colle un nom pour le vérifier et le décoder</span>
      </div>
      <div className="plan-controls">
        <label style={{ flex: 1 }}>
          Nom à tester
          <input
            type="text"
            value={probe}
            placeholder="ex. um-K-f"
            onChange={(e) => setProbe(e.target.value)}
          />
        </label>
      </div>
      {probeVal && (
        <div className="decode-panel">
          <div>
            <span className={'pill ' + (probeVal.valid ? 'ok' : 'bad')}>
              {probeVal.valid ? 'valide en jeu ✓' : 'invalide ✗'}
            </span>{' '}
            <span className="muted small">{probeVal.length}/20 caractères</span>
          </div>
          {probeVal.errors.map((e, i) => (
            <div key={i} className="decode-err">
              ✗ {e}
            </div>
          ))}
          {probeParsed ? (
            <div className="decode-ok">
              <span
                className="tree-dot"
                style={{ background: GEN_COLOR[genOf(probeParsed.color)] }}
              />
              <b>{probeParsed.color}</b> (gen {genOf(probeParsed.color)}) ·{' '}
              {probeParsed.sex === 'F' ? '♀ femelle' : '♂ mâle'}
              {probeParsed.keeper && <span className="tree-tag">keeper</span>}
            </div>
          ) : (
            probeVal.valid && (
              <div className="muted small">Nom valide, mais hors convention (non décodable).</div>
            )
          )}
        </div>
      )}

      {/* Legend */}
      <div className="policy-head" style={{ marginTop: 18 }}>
        <span>Légende</span>
        <span className="muted">
          &lt;code&gt;-[K-]&lt;sexe&gt;[-gp…] · 1 lettre = monocolore, 2 = bicolore (ordre du nom)
        </span>
      </div>
      <div className="letter-grid">
        {Object.entries(BASE_LETTER).map(([cname, ltr]) => (
          <div className="letter-cell" key={ltr}>
            <span className="letter-code" style={{ color: GEN_COLOR[genOf(cname)] }}>
              {ltr}
            </span>
            <span>{cname}</span>
          </div>
        ))}
      </div>
      <p className="plan-note muted">
        Avant le premier tiret = couleur (1 lettre monocolore, 2 lettres bicolore dans l'ordre « X
        et Y »). Ensuite chaque champ est un segment : un <b>K</b> majuscule si c'est un keeper
        (sinon rien), puis le sexe (<b>f</b>/<b>m</b> minuscule), puis jusqu'à 2 codes couleur des
        grands-parents. Pas de numéro de copie : deux dragodindes de même couleur, sexe et
        grands-parents portent le même nom. La génération n'est pas écrite (déduite de la couleur).
        Attention : « m » est à la fois Emeraude (couleur, avant le tiret) et mâle (sexe) — la
        position le distingue.
      </p>

      {/* Reference */}
      <div className="policy-head" style={{ marginTop: 6 }}>
        <span>Table des 66 codes</span>
      </div>
      <div className="map-grid">
        {[...byGen.keys()]
          .sort((a, b) => a - b)
          .map((g) => (
            <div className="map-gen" key={g}>
              <div className="map-gen-label" style={{ color: GEN_COLOR[g] }}>
                Gen {g}
              </div>
              <div className="map-chips">
                {(byGen.get(g) ?? []).map((c) => (
                  <span className="code-chip" key={c.name} title={c.name}>
                    <b style={{ color: GEN_COLOR[g] }}>{c.code}</b> {c.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
