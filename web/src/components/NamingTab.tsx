import {
  colorCodesOf,
  genColorOf,
  genOf,
  lettersOf,
  parseName,
  SPECIES,
  type Species,
  validateInGame
} from '@dd/core'
import { useMemo, useState } from 'react'
import { RosterBuilder } from './RosterBuilder'

export function NamingTab({ species }: { species: Species }) {
  // Decoder / validator
  const [probe, setProbe] = useState('')

  const probeVal = probe.length ? validateInGame(probe) : null
  const probeParsed = probe.length ? parseName(species, probe) : null

  const colorCodes = useMemo(() => colorCodesOf(species), [species])
  const genColor = useMemo(() => genColorOf(species), [species])
  const baseLetters = useMemo(() => lettersOf(species), [species])

  const byGen = useMemo(() => {
    const m = new Map<number, typeof colorCodes>()
    for (const c of colorCodes) (m.get(c.gen) ?? m.set(c.gen, []).get(c.gen)!).push(c)
    return m
  }, [colorCodes])

  return (
    <div className="pane planner">
      <div className="pane-head">
        <h2>🏷️ Nommage des {SPECIES[species].label.toLowerCase()}s</h2>
        <span className="muted">code couleur · sexe · numéro — triable et sans accent</span>
      </div>

      {/* Roster builder */}
      <div className="policy-head">
        <span>Constructeur de noms</span>
        <span className="muted">ajoute tes montures par lot → noms à coller en jeu</span>
      </div>
      <RosterBuilder species={species} />

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
                style={{ background: genColor[genOf(species, probeParsed.color)] }}
              />
              <b>{probeParsed.color}</b> (gen {genOf(species, probeParsed.color)}) ·{' '}
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
        {Object.entries(baseLetters).map(([cname, ltr]) => (
          <div className="letter-cell" key={ltr}>
            <span className="letter-code" style={{ color: genColor[genOf(species, cname)] }}>
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
        grands-parents. Pas de numéro de copie : deux montures de même couleur, sexe et
        grands-parents portent le même nom. La génération n'est pas écrite (déduite de la couleur).
        Attention : « m » est à la fois Emeraude (couleur, avant le tiret) et mâle (sexe) — la
        position le distingue.
      </p>

      {/* Reference */}
      <div className="policy-head" style={{ marginTop: 6 }}>
        <span>Table des {colorCodes.length} codes</span>
      </div>
      <div className="map-grid">
        {[...byGen.keys()]
          .sort((a, b) => a - b)
          .map((g) => (
            <div className="map-gen" key={g}>
              <div className="map-gen-label" style={{ color: genColor[g] }}>
                Gen {g}
              </div>
              <div className="map-chips">
                {(byGen.get(g) ?? []).map((c) => (
                  <span className="code-chip" key={c.name} title={c.name}>
                    <b style={{ color: genColor[g] }}>{c.code}</b> {c.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
