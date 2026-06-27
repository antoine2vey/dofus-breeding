import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Species, SpeciesConfig, SpeciesMeta } from '../types'

/** One dialog, one section at a time — opened from the dedicated header buttons (Webhook / IA /
 *  Espèces). */
export function SettingsDialog({
  open,
  section,
  onClose,
  onConfigured,
  aiConfigured,
  webhookUrl,
  speciesConfig,
  speciesMeta
}: {
  open: boolean
  section: 'webhook' | 'ai' | 'species'
  onClose: () => void
  onConfigured: (configured: boolean) => void
  aiConfigured?: boolean
  webhookUrl?: string
  speciesConfig: SpeciesConfig
  speciesMeta: SpeciesMeta[]
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [url, setUrl] = useState('')
  const [msg, setMsg] = useState('')
  const [aiKey, setAiKey] = useState('')
  const [aiMsg, setAiMsg] = useState('')
  // Local, editable copy of the per-species config so number/checkbox edits feel instant; saved on
  // each change (the parent refresh via onConfigured re-seeds it when the dialog re-opens).
  const [cfg, setCfg] = useState<SpeciesConfig>(speciesConfig)
  const [speciesMsg, setSpeciesMsg] = useState('')

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
  }, [open])

  // Pre-fill the webhook field with the saved URL each time the webhook dialog opens.
  useEffect(() => {
    if (open && section === 'webhook') setUrl(webhookUrl ?? '')
  }, [open, section, webhookUrl])

  // Re-seed the editable species config whenever the dialog (re)opens on that section.
  useEffect(() => {
    if (open && section === 'species') setCfg(speciesConfig)
  }, [open, section, speciesConfig])

  const save = async () => {
    const r = await api.setWebhook(url.trim())
    onConfigured(r.webhookConfigured)
    onClose()
  }
  const test = async () => {
    setMsg('Sending…')
    if (url.trim()) {
      const r = await api.setWebhook(url.trim())
      onConfigured(r.webhookConfigured)
    }
    const r = await api.testNotify()
    setMsg(r.ok ? '✓ Message sent to Discord.' : '✗ Failed: ' + (r.reason ?? 'unknown'))
  }
  const saveAiKey = async () => {
    const r = await api.setAiKey(aiKey.trim())
    setAiKey('')
    setAiMsg(r.aiConfigured ? '✓ Clé OpenAI enregistrée.' : 'Clé supprimée.')
    onConfigured(r.webhookConfigured) // triggers a refresh so aiConfigured updates
  }
  const deleteAiKey = async () => {
    const r = await api.setAiKey('')
    setAiMsg('Clé supprimée — saisis-en une nouvelle.')
    onConfigured(r.webhookConfigured)
  }

  // Patch one species' settings in the local copy and persist the whole config immediately.
  const patchSpecies = async (
    sp: Species,
    patch: Partial<SpeciesConfig[Species]>
  ): Promise<void> => {
    const updated: SpeciesConfig = { ...cfg, [sp]: { ...cfg[sp], ...patch } }
    setCfg(updated)
    const r = await api.setSpeciesConfig(updated)
    if (r.speciesConfig) setCfg(r.speciesConfig)
    setSpeciesMsg('✓ Enregistré')
    onConfigured(r.webhookConfigured)
  }

  return (
    <dialog ref={ref} onClose={onClose} className={section === 'species' ? 'wide' : undefined}>
      {section === 'webhook' && (
        <>
          <h2>Discord webhook</h2>
          <p className="hint">
            Discord channel → Settings → Integrations → Webhooks → New Webhook → Copy URL.
          </p>
          <input
            type="url"
            placeholder="https://discord.com/api/webhooks/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="row">
            <button onClick={save}>Save</button>
            <button className="ghost" onClick={test}>
              Test
            </button>
            <button className="ghost" onClick={onClose}>
              Close
            </button>
          </div>
          {msg && <p className="hint">{msg}</p>}
        </>
      )}
      {section === 'ai' && (
        <>
          <h2>Assistant IA (BYOK)</h2>
          <p className="hint">
            Colle ta propre clé OpenAI pour activer le chat de l'assistant. Le planificateur
            déterministe (feuille de route, prochaines actions) fonctionne sans clé.
          </p>
          {aiConfigured ? (
            <>
              <input type="text" value="sk-••••••••••••••••" disabled />
              <div className="row">
                <button onClick={deleteAiKey}>Supprimer la clé</button>
                <button className="ghost" onClick={onClose}>
                  Close
                </button>
              </div>
              <p className="hint">
                Clé enregistrée (masquée). Supprime-la pour en saisir une autre.
              </p>
            </>
          ) : (
            <>
              <input
                type="password"
                placeholder="sk-..."
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                autoComplete="off"
              />
              <div className="row">
                <button onClick={saveAiKey} disabled={!aiKey.trim()}>
                  Enregistrer la clé
                </button>
                <button className="ghost" onClick={onClose}>
                  Close
                </button>
              </div>
            </>
          )}
          {aiMsg && <p className="hint">{aiMsg}</p>}
        </>
      )}
      {section === 'species' && (
        <>
          <h2>Espèces & objectifs</h2>
          <p className="hint">
            Active les espèces que tu élèves et règle, pour chacune, la génération visée, le niveau,
            l'optimakina et la priorité (poids de l'arbitre cross-espèces).
          </p>
          <div className="species-settings">
            {speciesMeta.map((sm) => {
              const sp = sm.species
              const s = cfg[sp]
              return (
                <fieldset
                  key={sp}
                  className={`species-settings-row${s.enabled ? '' : ' off'}`}
                  style={{ borderColor: sm.accent }}
                >
                  <legend>
                    <label className="species-enable">
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) => patchSpecies(sp, { enabled: e.target.checked })}
                      />
                      <span style={{ color: sm.accent }}>
                        {sm.icon} {sm.label}
                      </span>
                    </label>
                  </legend>
                  <div className="plan-controls">
                    <label>
                      Génération visée
                      <input
                        type="number"
                        min={1}
                        value={s.targetGen}
                        onChange={(e) =>
                          patchSpecies(sp, { targetGen: Number(e.target.value) || 0 })
                        }
                      />
                    </label>
                    <label>
                      Niveau
                      <input
                        type="number"
                        min={1}
                        value={s.level}
                        onChange={(e) => patchSpecies(sp, { level: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <label>
                      Priorité
                      <input
                        type="number"
                        min={0}
                        value={s.priority}
                        onChange={(e) =>
                          patchSpecies(sp, { priority: Number(e.target.value) || 0 })
                        }
                      />
                    </label>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={s.optimakina}
                        onChange={(e) => patchSpecies(sp, { optimakina: e.target.checked })}
                      />
                      Optimakina
                    </label>
                  </div>
                </fieldset>
              )
            })}
          </div>
          <div className="row">
            <button className="ghost" onClick={onClose}>
              Close
            </button>
          </div>
          {speciesMsg && <p className="hint">{speciesMsg}</p>}
        </>
      )}
    </dialog>
  )
}
