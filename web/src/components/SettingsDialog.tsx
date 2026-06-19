import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

/** One dialog, one section at a time — opened from the dedicated header buttons (Webhook / IA). */
export function SettingsDialog({
  open,
  section,
  onClose,
  onConfigured,
  aiConfigured,
  webhookUrl
}: {
  open: boolean
  section: 'webhook' | 'ai'
  onClose: () => void
  onConfigured: (configured: boolean) => void
  aiConfigured?: boolean
  webhookUrl?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [url, setUrl] = useState('')
  const [msg, setMsg] = useState('')
  const [aiKey, setAiKey] = useState('')
  const [aiMsg, setAiMsg] = useState('')

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

  return (
    <dialog ref={ref} onClose={onClose}>
      {section === 'webhook' ? (
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
      ) : (
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
    </dialog>
  )
}
