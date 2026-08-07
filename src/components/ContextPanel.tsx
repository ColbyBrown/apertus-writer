// Dropdown panel for managing shared reference context (files + URLs) used by
// both chat and autocomplete.
import { useRef, useState } from 'react'
import {
  useContextItems, addContextItems, removeContextItem,
  fetchUrlContext, fileToContext,
} from '../store/context'
import { summarizeInBackground } from '../store/summarize'
import type { Settings } from '../store/settings'

export default function ContextPanel({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const items = useContextItems()
  const [urlInput, setUrlInput] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const addFiles = async (files: FileList | null) => {
    if (!files) return
    const results = await Promise.allSettled(Array.from(files).map(fileToContext))
    const added = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    addContextItems(added)
    summarizeInBackground(added, settings.chat)
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failed.length > 0) alert(`Could not read ${failed.length} file(s):\n${failed.map((f) => String(f.reason)).join('\n')}`)
  }

  const addUrl = async () => {
    const url = urlInput.trim()
    if (!url || busy) return
    setUrlInput('')
    setBusy(true)
    try {
      const item = await fetchUrlContext(url)
      addContextItems([item])
      summarizeInBackground([item], settings.chat)
    } catch (err) {
      alert(`Could not fetch ${url}: ${err}`)
    }
    setBusy(false)
  }

  return (
    <div className="context-panel">
      <div className="context-panel-header">
        <strong>Reference context</strong>
        <button className="tb-btn" onClick={onClose}>✕</button>
      </div>
      <p className="context-panel-note">
        Attached files and URLs are included as context for <em>both</em> chat and
        autocomplete, so suggestions match their style and content.
      </p>
      {items.length === 0 && <p className="context-panel-empty">No reference documents attached.</p>}
      <div className="context-panel-items">
        {items.map((ex, i) => (
          <span key={i} className="ctx-chip"
            title={ex.summary === undefined ? `${ex.name} (summarizing…)` : ex.name}>
            {ex.summary === undefined ? '⏳' : ex.kind === 'url' ? '🔗' : '📄'} {ex.name.slice(0, 40)}
            <button onClick={() => removeContextItem(i)}>✕</button>
          </span>
        ))}
      </div>
      <div className="ctx-add">
        <button className="tb-btn" onClick={() => fileRef.current?.click()}>+ File</button>
        <input ref={fileRef} type="file" multiple accept=".md,.txt,.markdown,.pdf,.docx,.odt" hidden
          onChange={(e) => addFiles(e.target.files)} />
        <input placeholder="Add URL…" value={urlInput} disabled={busy}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addUrl()} />
      </div>
    </div>
  )
}
