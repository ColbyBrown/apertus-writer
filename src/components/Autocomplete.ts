// TipTap extension: inline ghost-text autocomplete.
// Ctrl-Space requests a suggestion manually; when auto-suggest is enabled a
// request also fires after a short typing pause. Tab accepts the suggestion,
// any other key or action (typing, cursor move, click, Esc) dismisses it.
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// Pause (ms) after the last keystroke before an auto-suggest request fires.
const AUTO_SUGGEST_DELAY = 750

export interface AutocompleteOptions {
  fetchSuggestion: (context: string) => Promise<string>
  // Checked on every edit, so the toolbar toggle takes effect immediately.
  shouldAutoSuggest: () => boolean
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
      shouldAutoSuggest: () => false,
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
    // Debounce timer for auto-suggest-on-pause; shared by apply/destroy below.
    let autoTimer: number | null = null
    const clearAutoTimer = () => {
      if (autoTimer != null) {
        window.clearTimeout(autoTimer)
        autoTimer = null
      }
    }
    const shouldAutoSuggest = () => this.options.shouldAutoSuggest()
    const request = () => this.editor.commands.requestSuggestion()

    return [
      new Plugin({
        key: AutocompleteKey,
        state: {
          init: () => ({ suggestion: null as null | { text: string; pos: number }, decorations: DecorationSet.empty }),
          apply(tr, value) {
            const meta = tr.getMeta(AutocompleteKey)
            let next: { suggestion: null | { text: string; pos: number }; decorations: DecorationSet }
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
              next = {
                suggestion: { text, pos },
                decorations: DecorationSet.create(tr.doc, [widget]),
              }
            } else if (
              meta?.clear ||
              (tr.docChanged && value.suggestion) ||
              // cursor moved away from the suggestion (click, arrow keys)
              (tr.selectionSet && value.suggestion && tr.selection.from !== value.suggestion.pos)
            ) {
              next = { suggestion: null, decorations: DecorationSet.empty }
            } else {
              next = {
                suggestion: value.suggestion,
                decorations: value.decorations.map(tr.mapping, tr.doc),
              }
            }
            // Auto-suggest on typing pause: any user edit resets the timer.
            // Transactions carrying our own meta are skipped — in particular
            // acceptSuggestion inserts text AND clears in one tr, and without
            // this guard each accepted suggestion would immediately queue the
            // next one, chaining suggestions forever while the user is idle.
            if (tr.docChanged && !meta && shouldAutoSuggest() && tr.selection.empty) {
              clearAutoTimer()
              autoTimer = window.setTimeout(() => {
                autoTimer = null
                request()
              }, AUTO_SUGGEST_DELAY)
            }
            return next
          },
        },
        props: {
          decorations(state) {
            return AutocompleteKey.getState(state)?.decorations
          },
        },
        destroy() {
          clearAutoTimer()
        },
      }),
    ]
  },
})
