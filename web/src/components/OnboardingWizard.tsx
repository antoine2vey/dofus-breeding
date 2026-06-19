import { useState } from 'react'
import type { Enclos } from '../types'
import { ImportByName } from './ImportByName'
import { RosterBuilder } from './RosterBuilder'

const STEPS = 4

/** First-run guide, focused on getting data in: intro → convention → roster builder → import.
 *  The builder generates the in-game names (which the user sets in Dofus); the paste-back import
 *  is the real data entry (the name stays the source of truth). A successful import closes the
 *  wizard. Controlled by App (auto-opens on an empty stock, dismissible, re-openable). */
export function OnboardingWizard({
  open,
  onClose,
  enclos,
  onImported
}: {
  open: boolean
  onClose: () => void
  enclos: Enclos[]
  onImported: () => void
}) {
  const [step, setStep] = useState(0)
  const [names, setNames] = useState('')
  if (!open) return null

  const last = step === STEPS - 1
  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1))
  const prev = () => setStep((s) => Math.max(0, s - 1))

  return (
    <div className="onboarding-backdrop" onClick={onClose}>
      <div className="onboarding-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="onboarding-skip" onClick={onClose}>
          Passer
        </button>

        {step === 0 && (
          <div className="onboarding-step">
            <h2>👋 Bienvenue</h2>
            <p>
              Cette appli suit ta <b>reproduction de dragodindes</b> vers la collection des 66
              couleurs.
            </p>
            <p>
              Pour démarrer, on importe ton stock <b>par le nom en jeu</b> : tu renommes tes
              montures avec une petite convention, et l'appli en déduit couleur, sexe et lignée.
              Quatre étapes pour y arriver.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-step">
            <h2>La convention de nom</h2>
            <div className="conv-diagram">
              <code className="conv-name">
                <span className="seg-color">i</span>-<span className="seg-sex">f</span>-
                <span className="seg-gp">e</span>-<span className="seg-gp">ei</span>
              </code>
            </div>
            <ul className="conv-legend">
              <li>
                <b className="seg-color">i</b> — couleur (Indigo) · 1 lettre = monocolore, 2 =
                bicolore
              </li>
              <li>
                <b className="seg-sex">f</b> — sexe · <code>f</code> femelle / <code>m</code> mâle
              </li>
              <li>
                <b className="seg-gp">e · ei</b> — grands-parents · 0 à 2 codes couleur
              </li>
              <li>
                <b>K</b> — keeper (exemplaire à garder), juste après la couleur : <code>i-K-f</code>
              </li>
            </ul>
            <p className="muted small">
              Pas besoin de mémoriser les codes : l'étape suivante les génère pour toi.
            </p>
          </div>
        )}

        {/* The builder stays mounted (display toggle) so the roster survives back/forward nav. */}
        <div className="onboarding-step" style={{ display: step === 2 ? 'block' : 'none' }}>
          <h2>Construis ton stock</h2>
          <p className="muted small">
            Ajoute tes montures par lot. <b>Copie</b> les noms générés et <b>renomme-les en jeu</b>{' '}
            sur tes dragodindes — puis passe à l'import.
          </p>
          <RosterBuilder onNamesChange={setNames} />
        </div>

        {step === 3 && (
          <div className="onboarding-step">
            <h2>Importe ton stock</h2>
            <p className="muted small">
              Les noms du constructeur sont pré-remplis. Vérifie qu'ils sont bien posés en jeu, puis{' '}
              <b>Analyser</b> et <b>Importer</b> — c'est la liste en jeu qui fait foi.
            </p>
            <ImportByName enclos={enclos} onImported={onImported} initialText={names} />
          </div>
        )}

        <div className="onboarding-nav">
          <span className="muted small">
            Étape {step + 1}/{STEPS}
          </span>
          <div className="onboarding-actions">
            {step > 0 && (
              <button type="button" className="ghost" onClick={prev}>
                ← Précédent
              </button>
            )}
            {!last && (
              <button type="button" onClick={next}>
                Suivant →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
