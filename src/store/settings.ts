import type { EndpointConfig } from '../api/openai'

export interface Settings {
  autocomplete: EndpointConfig
  chat: EndpointConfig
  spellcheckEnabled: boolean
  autoSuggestEnabled: boolean
}

// Defaults point at a local LM Studio server. Any OpenAI-compatible endpoint
// works — just make sure it allows cross-origin (CORS) browser requests.
export const DEFAULT_SETTINGS: Settings = {
  autocomplete: {
    baseUrl: 'http://localhost:1234/v1',
    apiKey: '',
    model: 'apertus-v1.1-4b',
  },
  chat: {
    baseUrl: 'http://localhost:1234/v1',
    apiKey: '',
    model: 'apertus-v1.1-4b-instruct',
  },
  spellcheckEnabled: true,
  autoSuggestEnabled: false,
}

const KEY = 'apertus-writer-settings-v6'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        autocomplete: { ...DEFAULT_SETTINGS.autocomplete, ...parsed.autocomplete },
        chat: { ...DEFAULT_SETTINGS.chat, ...parsed.chat },
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}
