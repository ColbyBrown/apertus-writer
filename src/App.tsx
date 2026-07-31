import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import Toolbar from './components/Toolbar'
import StylePanel, { DEFAULT_THEME, themeToCss, cssToTheme, type ThemeVars } from './components/StylePanel'
import ChatSidebar from './components/ChatSidebar'
import SettingsDialog from './components/SettingsDialog'
import { Autocomplete } from './components/Autocomplete'
import { markdownToHtml, htmlToMarkdown } from './store/markdown'
import { loadSettings, saveSettings, type Settings } from './store/settings'
import { getBridge, blobToBase64 } from './store/bridge'
import { getContextItems, useContextItems } from './store/context'
import ContextPanel from './components/ContextPanel'
import * as ai from './api/openai'

const WELCOME_MD = `# Welcome to Apertus Writer

This is a **WYSIWYG markdown editor** — you edit the rendered document directly, and it saves as markdown.

- Use the toolbar above to format text
- Press **Ctrl-Space** to accept an AI autocomplete suggestion
- Open the **chat sidebar** to talk with AI about your document

Try typing a sentence and pausing — the AI will suggest a continuation.
`

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [docName, setDocName] = useState('untitled.md')
  const [theme, setTheme] = useState<ThemeVars>(DEFAULT_THEME)
  const [themeName, setThemeName] = useState('Default')
  const [showStyles, setShowStyles] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const contextCount = useContextItems().length
  const [dirty, setDirty] = useState(false)
  const openFileRef = useRef<HTMLInputElement>(null)
  const imageFileRef = useRef<HTMLInputElement>(null)
  const styleTagRef = useRef<HTMLStyleElement | null>(null)

  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const [aiError, setAiError] = useState<string | null>(null)

  // Build the completions prompt. Reference documents are wrapped in <s>…</s>
  // — the document boundary token used in Apertus pretraining — so the base
  // model treats them as separate prior documents and continues the current
  // one (the final, unclosed <s>). No instruction text is added, so nothing
  // can leak into suggestions.
  const fetchSuggestion = useCallback(async (context: string) => {
    const refs = getContextItems()
    let prompt = context
    if (refs.length > 0) {
      const wrapped = refs.map((r) => `<s>${r.content.slice(0, 4000)}</s>`).join('')
      prompt = `${wrapped}<s>${context}`
    }
    try {
      const text = await ai.autocomplete(settingsRef.current.autocomplete, prompt)
      setAiError(null)
      return text
    } catch (err) {
      setAiError(`Autocomplete: ${err}`)
      return ''
    }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Start writing… (pause for AI suggestions)' }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Autocomplete.configure({ fetchSuggestion, debounceMs: 900, enabled: settings.autocompleteEnabled }),
    ],
    content: markdownToHtml(WELCOME_MD),
    onUpdate: () => setDirty(true),
    editorProps: {
      attributes: { spellcheck: settings.spellcheckEnabled ? 'true' : 'false' },
    },
  })

  // Live-toggle spellcheck when the setting changes
  useEffect(() => {
    editor?.setOptions({
      editorProps: { attributes: { spellcheck: settings.spellcheckEnabled ? 'true' : 'false' } },
    })
  }, [editor, settings.spellcheckEnabled])

  // Apply theme CSS variables to a live <style> tag
  useEffect(() => {
    if (!styleTagRef.current) {
      styleTagRef.current = document.createElement('style')
      styleTagRef.current.id = 'doc-theme'
      document.head.appendChild(styleTagRef.current)
    }
    styleTagRef.current.textContent = themeToCss(theme)
  }, [theme])

  const getMarkdown = useCallback(() => {
    if (!editor) return ''
    return htmlToMarkdown(editor.getHTML())
  }, [editor])

  // File operations
  const newDocument = () => {
    if (dirty && !window.confirm('Discard unsaved changes and start a new document?')) return
    editor?.commands.setContent('')
    editor?.commands.focus()
    setDocName('untitled.md')
    setDirty(false)
  }

  const openDocument = async (file: File) => {
    const text = await file.text()
    editor?.commands.setContent(markdownToHtml(text))
    setDocName(file.name)
    setDirty(false)
  }

  const saveDocument = () => {
    const md = getMarkdown()
    const blob = new Blob([md], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = docName
    a.click()
    URL.revokeObjectURL(a.href)
    setDirty(false)
  }

  const saveTheme = () => {
    const blob = new Blob([themeToCss(theme)], { type: 'text/css' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${themeName.toLowerCase().replace(/\s+/g, '-')}.css`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const loadThemeFile = async (file: File) => {
    const css = await file.text()
    setTheme(cssToTheme(css))
    setThemeName(file.name.replace(/\.css$/, ''))
  }

  const insertImage = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(file)
    })
    editor?.chain().focus().setImage({ src: dataUrl, alt: file.name }).run()
  }

  // Export: docx/odt are generated in-app with the active theme applied
  // (no external tools); pdf uses Electron printToPDF (or browser print).
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const flash = (msg: string, ms = 6000) => { setExportMsg(msg); setTimeout(() => setExportMsg(null), ms) }

  const downloadBlob = (blob: Blob, filename: string) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const buildExportBlob = async (format: 'docx' | 'odt'): Promise<Blob> => {
    if (!editor) throw new Error('No document')
    if (format === 'docx') {
      const { buildDocx } = await import('./store/exportDocx')
      return buildDocx(editor.getHTML(), theme)
    }
    const { buildOdt } = await import('./store/exportOdt')
    return buildOdt(editor.getHTML(), theme)
  }

  // Browser fallback path (no native dialogs): download for the chosen format
  const exportAs = async (format: 'docx' | 'odt' | 'pdf') => {
    if (!editor) return
    setShowExportMenu(false)
    const base = docName.replace(/\.(md|markdown|txt)$/i, '')
    try {
      if (format === 'pdf') {
        window.print()
        return
      }
      downloadBlob(await buildExportBlob(format), `${base}.${format}`)
      flash(`Exported ${base}.${format}`)
    } catch (err) {
      flash(`Export failed: ${err}`)
    }
  }

  // Main export entry point. In Electron: one save dialog with format filters
  // — the chosen extension selects the format; message only after the file is
  // actually written. In a browser: dropdown of formats → blob download.
  const exportDocument = async () => {
    if (!editor) return
    const bridge = getBridge()
    if (!bridge?.chooseExportPath) {
      setShowExportMenu((v) => !v)
      return
    }
    try {
      const choice = await bridge.chooseExportPath({ docName })
      if (choice.canceled || !choice.filePath || !choice.format) return
      const { filePath, format } = choice
      if (format === 'pdf') {
        const res = await bridge.exportPdfTo({ filePath, html: editor.getHTML(), css: themeToCss(theme) })
        if (!res.ok) { flash(`Export failed: ${res.error}`); return }
      } else {
        const blob = await buildExportBlob(format)
        const base64 = await blobToBase64(blob)
        const res = await bridge.writeFile({ filePath, base64 })
        if (!res.ok) { flash(`Export failed: ${res.error}`); return }
      }
      flash(`Exported to ${filePath}`)
    } catch (err) {
      flash(`Export failed: ${err}`)
    }
  }

  // Print: Electron opens the native print dialog on themed HTML; the browser
  // falls back to window.print() with the @media print stylesheet hiding UI.
  const printDocument = async () => {
    if (!editor) return
    const bridge = getBridge()
    if (bridge?.printDocument) {
      const res = await bridge.printDocument({ html: editor.getHTML(), css: themeToCss(theme) })
      if (!res.ok) flash(`Print failed: ${res.error}`)
    } else {
      window.print()
    }
  }

  // Application-menu actions (Electron): File → Open / Save / Export
  useEffect(() => {
    const bridge = getBridge()
    if (!bridge?.onMenuAction) return
    return bridge.onMenuAction((action) => {
      if (action === 'new') newDocument()
      else if (action === 'open') openFileRef.current?.click()
      else if (action === 'save') saveDocument()
      else if (action === 'export') exportDocument()
      else if (action === 'print') printDocument()
    })
  })

  // Ctrl-S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveDocument()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Apertus Writer</span>
        <button className="tb-btn" onClick={newDocument}>New</button>
        <button className="tb-btn" onClick={() => openFileRef.current?.click()}>Open</button>
        <input ref={openFileRef} type="file" accept=".md,.markdown,.txt" hidden
          onChange={(e) => e.target.files?.[0] && openDocument(e.target.files[0])} />
        <button className="tb-btn" onClick={saveDocument}>Save{dirty ? ' •' : ''}</button>
        <span className="export-wrap">
          <button className="tb-btn" onClick={exportDocument}>Export…</button>
          {showExportMenu && (
            <div className="export-dropdown">
              <button className="tb-btn" onClick={() => exportAs('docx')}>Word (.docx)</button>
              <button className="tb-btn" onClick={() => exportAs('odt')}>OpenDocument (.odt)</button>
              <button className="tb-btn" onClick={() => exportAs('pdf')}>PDF (.pdf)</button>
            </div>
          )}
        </span>
        <span className="spacer" />
        <span className="doc-name">{docName}</span>
        <button className="tb-btn" title="Reference context for chat & autocomplete"
          onClick={() => setShowContext((v) => !v)}>
          📎 Context{contextCount > 0 ? ` (${contextCount})` : ''}
        </button>
        <button className="tb-btn" title="Style themes" onClick={() => setShowStyles((v) => !v)}>🎨 Styles</button>
        <button className="tb-btn" title="Chat with AI" onClick={() => setShowChat((v) => !v)}>💬 Chat</button>
        <button className="tb-btn" title="Settings" onClick={() => setShowSettings(true)}>⚙️</button>
      </header>

      <Toolbar editor={editor} onInsertImage={() => imageFileRef.current?.click()} />
      <input ref={imageFileRef} type="file" accept="image/*" hidden
        onChange={(e) => e.target.files?.[0] && insertImage(e.target.files[0])} />

      {(exportMsg || aiError) && (
        <div className="status-bar">{exportMsg ?? aiError}</div>
      )}

      {showContext && <ContextPanel onClose={() => setShowContext(false)} />}

      <div className="app-body">
        <main className="doc-scroll">
          <div className="doc-page">
            <EditorContent editor={editor} />
          </div>
        </main>

        {showStyles && (
          <aside className="side">
            <StylePanel
              theme={theme}
              themeName={themeName}
              onChange={(v, n) => { setTheme(v); setThemeName(n) }}
              onClose={() => setShowStyles(false)}
            />
            <div className="style-actions">
              <button className="tb-btn" onClick={saveTheme}>Save theme .css</button>
              <label className="tb-btn file-label">
                Load theme…
                <input type="file" accept=".css" hidden
                  onChange={(e) => e.target.files?.[0] && loadThemeFile(e.target.files[0])} />
              </label>
            </div>
          </aside>
        )}

        {showChat && (
          <aside className="side wide">
            <ChatSidebar
              settings={settings}
              getDocumentMarkdown={getMarkdown}
              onClose={() => setShowChat(false)}
            />
          </aside>
        )}
      </div>

      {showSettings && (
        <SettingsDialog
          settings={settings}
          onSave={(s) => { setSettings(s); saveSettings(s); setShowSettings(false) }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
