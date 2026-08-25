import { useEffect, useState } from 'react'

// CSS theme model: a set of editable custom properties
export interface ThemeVars {
  '--doc-font': string
  '--doc-font-size': string
  '--doc-text-color': string
  '--doc-bg': string
  '--doc-heading-color': string
  '--doc-accent': string
  '--doc-code-font': string
  '--doc-code-bg': string
  '--doc-max-width': string
}

export const DEFAULT_THEME: ThemeVars = {
  '--doc-font': "Georgia, 'Times New Roman', serif",
  '--doc-font-size': '17px',
  '--doc-text-color': '#1f2328',
  '--doc-bg': '#ffffff',
  '--doc-heading-color': '#111111',
  '--doc-accent': '#0969da',
  '--doc-code-font': "'Cascadia Code', Consolas, monospace",
  '--doc-code-bg': '#f3f4f6',
  '--doc-max-width': '760px',
}

const BUILTIN_THEMES: Record<string, ThemeVars> = {
  'Default': DEFAULT_THEME,
  'Dark': {
    ...DEFAULT_THEME,
    '--doc-text-color': '#e6e6e6',
    '--doc-bg': '#1b1d21',
    '--doc-heading-color': '#ffffff',
    '--doc-accent': '#58a6ff',
    '--doc-code-bg': '#2a2d33',
  },
  'Compact Sans': {
    ...DEFAULT_THEME,
    '--doc-font': "'Segoe UI', system-ui, sans-serif",
    '--doc-font-size': '14px',
    '--doc-max-width': '900px',
  },
}

// Curated list of specific fonts, grouped by category. Each entry maps to a
// full CSS font-family stack with sensible fallbacks.
const FONT_GROUPS: { label: string; fonts: { name: string; stack: string }[] }[] = [
  {
    label: 'Serif',
    fonts: [
      { name: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
      { name: 'Times New Roman', stack: "'Times New Roman', Times, serif" },
      { name: 'Garamond', stack: "Garamond, 'Palatino Linotype', serif" },
      { name: 'Palatino Linotype', stack: "'Palatino Linotype', 'Book Antiqua', serif" },
      { name: 'Book Antiqua', stack: "'Book Antiqua', Palatino, serif" },
      { name: 'Cambria', stack: "Cambria, Georgia, serif" },
    ],
  },
  {
    label: 'Sans-serif',
    fonts: [
      { name: 'Segoe UI', stack: "'Segoe UI', system-ui, sans-serif" },
      { name: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
      { name: 'Helvetica', stack: "Helvetica, Arial, sans-serif" },
      { name: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
      { name: 'Tahoma', stack: 'Tahoma, Geneva, sans-serif' },
      { name: 'Trebuchet MS', stack: "'Trebuchet MS', sans-serif" },
      { name: 'Calibri', stack: 'Calibri, Candara, sans-serif' },
    ],
  },
  {
    label: 'Monospace',
    fonts: [
      { name: 'Cascadia Code', stack: "'Cascadia Code', Consolas, monospace" },
      { name: 'Consolas', stack: "Consolas, 'Courier New', monospace" },
      { name: 'Courier New', stack: "'Courier New', Courier, monospace" },
      { name: 'JetBrains Mono', stack: "'JetBrains Mono', Consolas, monospace" },
      { name: 'Fira Code', stack: "'Fira Code', Consolas, monospace" },
    ],
  },
]

const CUSTOM = '__custom__'

// Curated palette for the inline color picker — a spread of neutrals and
// accents that covers the common text/heading/accent/background choices
// without dragging in a full color-wheel widget (or the native picker,
// whose controlled-value reopen bug is what this replaces).
const PRESET_COLORS = [
  '#111111', '#1f2328', '#3b3f45', '#57606a', '#8c959f', '#c9d1d9',
  '#ffffff', '#f6f8fa', '#f3f4f6', '#e2e5e9', '#d0d7de', '#1b1d21',
  '#0969da', '#58a6ff', '#1a7f37', '#2da44e', '#bf3989', '#cf222e',
  '#8250df', '#6e7781', '#9e6a03', '#bf8700', '#0a3069', '#6e40c9',
]

// Validates a 3- or 6-digit hex string; returns a normalized #rrggbb or null.
function normalizeHex(input: string): string | null {
  const m = input.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{6}$/.test(m)) return `#${m}`
  if (/^[0-9a-f]{3}$/.test(m)) return `#${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`
  return null
}

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <div className="color-field">
      <button
        type="button"
        className="color-swatch"
        style={{ background: value }}
        title={value}
      />
      <div className="color-presets">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={'color-dot' + (c.toLowerCase() === value.toLowerCase() ? ' active' : '')}
            style={{ background: c }}
            onClick={() => onChange(c)}
            title={c}
          />
        ))}
      </div>
      <input
        className="color-hex"
        value={draft}
        onChange={(e) => {
          const raw = e.target.value
          setDraft(raw)
          const norm = normalizeHex(raw)
          if (norm) onChange(norm)
        }}
        onBlur={() => setDraft(value)}
      />
    </div>
  )
}

function FontSelect({ value, onChange }: { value: string; onChange: (stack: string) => void }) {
  const known = FONT_GROUPS.flatMap((g) => g.fonts).some((f) => f.stack === value)
  const [customMode, setCustomMode] = useState(!known)
  const [customValue, setCustomValue] = useState(value)

  useEffect(() => {
    const isKnown = FONT_GROUPS.flatMap((g) => g.fonts).some((f) => f.stack === value)
    setCustomMode(!isKnown)
    if (!isKnown) setCustomValue(value)
  }, [value])

  return (
    <>
      <select
        value={customMode ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustomMode(true)
            onChange(customValue)
          } else {
            setCustomMode(false)
            onChange(e.target.value)
          }
        }}
      >
        {FONT_GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.fonts.map((f) => (
              <option key={f.name} value={f.stack} style={{ fontFamily: f.stack }}>
                {f.name}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM}>Custom…</option>
      </select>
      {customMode && (
        <input
          value={customValue}
          placeholder="e.g. 'My Font', sans-serif"
          onChange={(e) => { setCustomValue(e.target.value); onChange(e.target.value) }}
        />
      )}
    </>
  )
}

export function themeToCss(vars: ThemeVars): string {
  return `:root {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`
}

export function cssToTheme(css: string): ThemeVars {
  const vars = { ...DEFAULT_THEME }
  for (const key of Object.keys(vars) as (keyof ThemeVars)[]) {
    const m = css.match(new RegExp(`${key}\\s*:\\s*([^;]+);`))
    if (m) vars[key] = m[1].trim()
  }
  return vars
}

interface Props {
  theme: ThemeVars
  themeName: string
  onChange: (vars: ThemeVars, name: string) => void
  onClose: () => void
}

export default function StylePanel({ theme, themeName, onChange, onClose }: Props) {
  const [vars, setVars] = useState(theme)
  useEffect(() => setVars(theme), [theme])

  const set = (k: keyof ThemeVars, v: string) => {
    const next = { ...vars, [k]: v }
    setVars(next)
    onChange(next, themeName)
  }

  return (
    <div className="style-panel">
      <div className="panel-header">
        <strong>Style Theme</strong>
        <button className="tb-btn" onClick={onClose}>✕</button>
      </div>
      <label>Theme preset
        <select
          value={themeName}
          onChange={(e) => {
            const name = e.target.value
            if (BUILTIN_THEMES[name]) {
              setVars(BUILTIN_THEMES[name])
              onChange(BUILTIN_THEMES[name], name)
            }
          }}
        >
          {Object.keys(BUILTIN_THEMES).map((n) => <option key={n}>{n}</option>)}
          {!BUILTIN_THEMES[themeName] && <option>{themeName}</option>}
        </select>
      </label>
      <label>Body font
        <FontSelect value={vars['--doc-font']} onChange={(v) => set('--doc-font', v)} />
      </label>
      <label>Code font
        <FontSelect value={vars['--doc-code-font']} onChange={(v) => set('--doc-code-font', v)} />
      </label>
      <label>Font size
        <input value={vars['--doc-font-size']} onChange={(e) => set('--doc-font-size', e.target.value)} />
      </label>
      <label>Text color
        <ColorField value={vars['--doc-text-color']} onChange={(v) => set('--doc-text-color', v)} />
      </label>
      <label>Background
        <ColorField value={vars['--doc-bg']} onChange={(v) => set('--doc-bg', v)} />
      </label>
      <label>Heading color
        <ColorField value={vars['--doc-heading-color']} onChange={(v) => set('--doc-heading-color', v)} />
      </label>
      <label>Accent (links)
        <ColorField value={vars['--doc-accent']} onChange={(v) => set('--doc-accent', v)} />
      </label>
      <label>Code background
        <ColorField value={vars['--doc-code-bg']} onChange={(v) => set('--doc-code-bg', v)} />
      </label>
      <label>Page width
        <input value={vars['--doc-max-width']} onChange={(e) => set('--doc-max-width', e.target.value)} />
      </label>
      <details>
        <summary>Generated CSS</summary>
        <pre className="css-preview">{themeToCss(vars)}</pre>
      </details>
    </div>
  )
}
