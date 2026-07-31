// TipTap extension: inline ghost-text autocomplete.
// Suggestion is rendered as a decoration widget; Ctrl-Space accepts, Esc dismisses.
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface AutocompleteOptions {
  fetchSuggestion: (context: string) => Promise<string>
  debounceMs: number
  enabled: boolean
}

export const AutocompleteKey = new PluginKey('autocomplete')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    autocomplete: {
      acceptSuggestion: () => ReturnType
      dismissSuggestion: () => ReturnType
    }
  }
}

export const Autocomplete = Extension.create<AutocompleteOptions>({
  name: 'autocomplete',

  addOptions() {
    return {
      fetchSuggestion: async () => '',
      debounceMs: 800,
      enabled: true,
    }
  },

  addCommands() {
    return {
      acceptSuggestion:
        () =>
        ({ tr, dispatch }) => {
          const suggestion = AutocompleteKey.getState(this.editor.state)?.suggestion
          if (!suggestion) return false
          if (dispatch) {
            tr.insertText(suggestion.text, suggestion.pos)
            tr.setMeta(AutocompleteKey, { clear: true })
          }
          return true
        },
      dismissSuggestion:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(AutocompleteKey, { clear: true })
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Space': () => this.editor.commands.acceptSuggestion(),
      Escape: () => this.editor.commands.dismissSuggestion(),
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let abort: AbortController | null = null

    return [
      new Plugin({
        key: AutocompleteKey,
        state: {
          init: () => ({ suggestion: null as null | { text: string; pos: number }, decorations: DecorationSet.empty }),
          apply(tr, value) {
            const meta = tr.getMeta(AutocompleteKey)
            if (meta?.set) {
              const { text, pos } = meta.set
              const widget = Decoration.widget(
                pos,
                () => {
                  const span = document.createElement('span')
                  span.className = 'ghost-suggestion'
                  span.textContent = text
                  span.title = 'Ctrl-Space to accept'
                  return span
                },
                { side: 1, key: 'ghost' },
              )
              return {
                suggestion: { text, pos },
                decorations: DecorationSet.create(tr.doc, [widget]),
              }
            }
            if (
              meta?.clear ||
              (tr.docChanged && value.suggestion) ||
              // cursor moved away from the suggestion (click, arrow keys)
              (tr.selectionSet && value.suggestion && tr.selection.from !== value.suggestion.pos)
            ) {
              return { suggestion: null, decorations: DecorationSet.empty }
            }
            return {
              suggestion: value.suggestion,
              decorations: value.decorations.map(tr.mapping, tr.doc),
            }
          },
        },
        props: {
          decorations(state) {
            return AutocompleteKey.getState(state)?.decorations
          },
        },
        view() {
          return {
            update: (view) => {
              if (!options.enabled) return
              const state = AutocompleteKey.getState(view.state)
              if (state?.suggestion) return
              const { selection } = view.state
              if (!selection.empty) return
              if (debounceTimer) clearTimeout(debounceTimer)
              debounceTimer = setTimeout(async () => {
                const pos = selection.from
                // Gather context: text before cursor (up to ~1500 chars)
                const before = view.state.doc.textBetween(
                  Math.max(0, pos - 1500),
                  pos,
                  '\n',
                  ' ',
                )
                if (before.trim().length < 10) return
                if (abort) abort.abort()
                abort = new AbortController()
                try {
                  const text = await options.fetchSuggestion(before)
                  if (!text) return
                  // Only apply if cursor hasn't moved
                  if (view.state.selection.from !== pos) return
                  const tr = view.state.tr.setMeta(AutocompleteKey, { set: { text, pos } })
                  view.dispatch(tr)
                } catch {
                  /* ignore */
                }
              }, options.debounceMs)
            },
            destroy: () => {
              if (debounceTimer) clearTimeout(debounceTimer)
              if (abort) abort.abort()
            },
          }
        },
      }),
    ]
  },
})
