import { useState } from 'react'

const STEPS = 2

/** First-run guide, focused on getting data in. Shell only (intro + naming convention); the
 *  roster-builder and import steps are wired in by #10. `open`/`onClose` are controlled by App
 *  (auto-opens on an empty stock, dismissible, re-openable from the header). */
export function OnboardingWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0)
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
              Deux écrans pour voir comment.
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
              Pas besoin de mémoriser les codes : l'onglet <b>Nommage</b> génère les noms pour toi
              (et contient la table des 66 couleurs).
            </p>
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
            {last ? (
              <button type="button" onClick={onClose}>
                Compris ✓
              </button>
            ) : (
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
