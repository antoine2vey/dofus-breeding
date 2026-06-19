import { useState } from 'react'
import type { Enclos } from '../types'
import { ImportByName } from './ImportByName'
import { RosterBuilder } from './RosterBuilder'

const STEPS = 4

/** Prompt the user feeds to an AI (with a screenshot of their in-game list) to extract names. */
const AI_PROMPT = `Voici une capture d'écran de ma liste de dragodindes dans Dofus. Donne-moi uniquement la liste des NOMS des montures, un nom par ligne, sans numéro ni aucun autre texte. Les noms suivent le format couleur-[K]-sexe-gp1-gp2 (ex. i-f-e-ei, ad-K-f-d-a). Réponds avec la liste brute uniquement.`

/** First-run guide, focused on getting data in: intro → convention → name & extract → import.
 *  Recommended flow: name the mounts in-game, screenshot the list filtered by repro state, and use
 *  an AI to extract the names from the image — then import one batch per state. The name stays the
 *  source of truth. A successful import closes the wizard. */
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
  const [promptCopied, setPromptCopied] = useState(false)
  if (!open) return null

  const last = step === STEPS - 1
  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1))
  const prev = () => setStep((s) => Math.max(0, s - 1))
  const copyPrompt = () => {
    navigator.clipboard?.writeText(AI_PROMPT).then(() => {
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 1400)
    })
  }

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
              Pas besoin de mémoriser les codes : l'étape suivante peut les générer pour toi.
            </p>
          </div>
        )}

        {/* Kept mounted (display toggle) so the optional builder survives back/forward nav. */}
        <div className="onboarding-step" style={{ display: step === 2 ? 'block' : 'none' }}>
          <h2>Récupère tes noms</h2>
          <ol className="onboarding-howto">
            <li>
              <b>Renomme tes dragodindes en jeu</b> avec la convention (besoin d'aide pour les codes
              ? le constructeur en bas les génère).
            </li>
            <li>
              En jeu, <b>filtre par état</b> — féconde, puis fertile, puis stérile — et fais une{' '}
              <b>capture d'écran</b> de chaque liste.
            </li>
            <li>
              Donne la capture à une <b>IA</b> (ChatGPT, Claude…) avec ce prompt pour en extraire
              les noms :
            </li>
          </ol>
          <div className="ai-prompt">
            <textarea className="import-area" readOnly value={AI_PROMPT} rows={4} />
            <button type="button" className="mini" onClick={copyPrompt}>
              {promptCopied ? 'copié ✓' : '📋 copier le prompt'}
            </button>
          </div>
          <p className="muted small">
            À l'étape suivante, colle les noms obtenus et choisis l'<b>état</b> correspondant — un
            lot par état.
          </p>
          <details className="onboarding-builder">
            <summary>🔧 Constructeur de noms (aide aux codes couleur)</summary>
            <RosterBuilder />
          </details>
        </div>

        {step === 3 && (
          <div className="onboarding-step">
            <h2>Importe ton stock</h2>
            <p className="muted small">
              Colle les noms (extraits par l'IA, ou copiés du constructeur), choisis la{' '}
              <b>destination</b> et l'<b>état</b>, puis <b>Analyser</b> et <b>Importer</b> — c'est
              la liste en jeu qui fait foi.
            </p>
            <ImportByName enclos={enclos} onImported={onImported} />
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
