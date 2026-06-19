import { useEffect, useRef, useState } from "react";
import { api } from "../api";

export function SettingsDialog({
  open,
  onClose,
  onConfigured,
  aiConfigured,
}: {
  open: boolean;
  onClose: () => void;
  onConfigured: (configured: boolean) => void;
  aiConfigured?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [aiMsg, setAiMsg] = useState("");

  const saveAiKey = async () => {
    const r = await api.setAiKey(aiKey.trim());
    setAiKey("");
    setAiMsg(r.aiConfigured ? "✓ Clé OpenAI enregistrée." : "Clé supprimée.");
    onConfigured(r.webhookConfigured); // triggers a refresh so aiConfigured updates
  };

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  const save = async () => {
    const r = await api.setWebhook(url.trim());
    onConfigured(r.webhookConfigured);
    onClose();
  };

  const test = async () => {
    setMsg("Sending…");
    if (url.trim()) {
      const r = await api.setWebhook(url.trim());
      onConfigured(r.webhookConfigured);
    }
    const r = await api.testNotify();
    setMsg(r.ok ? "✓ Message sent to Discord." : "✗ Failed: " + (r.reason ?? "unknown"));
  };

  return (
    <dialog ref={ref} onClose={onClose}>
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

      <h2 style={{ marginTop: 24 }}>Assistant IA (BYOK)</h2>
      <p className="hint">
        Colle ta propre clé OpenAI pour activer le chat de l'assistant. Le planificateur
        déterministe (feuille de route, prochaines actions) fonctionne sans clé.{" "}
        {aiConfigured ? "✓ clé configurée" : "non configurée"}
      </p>
      <input
        type="password"
        placeholder="sk-..."
        value={aiKey}
        onChange={(e) => setAiKey(e.target.value)}
        autoComplete="off"
      />
      <div className="row">
        <button onClick={saveAiKey}>{aiKey.trim() ? "Enregistrer la clé" : "Supprimer la clé"}</button>
      </div>
      {aiMsg && <p className="hint">{aiMsg}</p>}
    </dialog>
  );
}
