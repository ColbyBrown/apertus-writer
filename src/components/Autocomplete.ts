// TipTap extension: inline ghost-text autocomplete, triggered manually.
// Ctrl-Space requests a suggestion, Tab accepts it, any other key or action
// (typing, cursor move, click, Esc) dismisses it.
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface AutocompleteOptions {
  fetchSuggestion: (context: string) => Promise<string>
}

export const AutocompleteKey = new PluginKey('autocomplete')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    autocomplete: {
      requestSuggestion: () => ReturnType
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
    }
  },

  addCommands() {
    return {
      requestSuggestion:
        () =>
        ({ view, state }) => {
          const { selection } = state
          if (!selection.empty) return false
          const pos = selection.from
          // Gather context: text before cursor (up to ~1500 chars)
          const before = state.doc.textBetween(Math.max(0, pos - 1500), pos, '\n', ' ')
          if (before.trim().length < 10) return false
          // Fire and forget; the suggestion is set as plugin meta when it arrives
          this.options
            .fetchSuggestion(before)
            .then((text) => {
              if (!text) return
              // Only apply if the cursor hasn't moved
              if (view.state.selection.from !== pos) return
              view.dispatch(view.state.tr.setMeta(AutocompleteKey, { set: { text, pos } }))
            })
            .catch(() => { /* ignore */ })
          return true
        },
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
      'Mod-Space': () => this.editor.commands.requestSuggestion(),
      // Tab accepts only when a suggestion is showing; otherwise it falls
      // through to normal Tab behavior.
      Tab: () => this.editor.commands.acceptSuggestion(),
      Escape: () => this.editor.commands.dismissSuggestion(),
    }
  },

  addProseMirrorPlugins() {
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
                  span.title = 'Tab to accept'
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
      }),
    ]
  },
})
