// Per-document chat persistence. One message thread per document, keyed by
// filePath (or 'untitled:<docName>' for never-saved docs). Electron stores a
// JSON map in userData (chats.json); a plain browser falls back to localStorage.
import type { ChatMessage } from '../api/openai'
import type { ExtraContext } from './context'
import { getBridge } from './bridge'

export function chatKey(filePath: string | null, docName: string): string {
  return filePath ?? `untitled:${docName}`
}

const PREFIX = 'apertus-writer-chat:'
const CONTEXT_PREFIX = 'apertus-writer-context:'

export async function loadChat(key: string): Promise<ChatMessage[]> {
  const bridge = getBridge()
  if (bridge?.chatLoad) {
    const res = await bridge.chatLoad({ key })
    return res.ok ? (res.messages as ChatMessage[]) : []
  }
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as ChatMessage[]) : []
  } catch {
    return []
  }
}

export function saveChat(key: string, messages: ChatMessage[]): void {
  const bridge = getBridge()
  if (bridge?.chatSave) {
    void bridge.chatSave({ key, messages })
    return
  }
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(messages))
  } catch { /* ignore quota / private mode */ }
}

export async function loadContext(key: string): Promise<ExtraContext[]> {
  const bridge = getBridge()
  let raw: ExtraContext[]
  if (bridge?.contextLoad) {
    const res = await bridge.contextLoad({ key })
    raw = res.ok ? (res.items as ExtraContext[]) : []
  } else {
    try {
      const stored = localStorage.getItem(CONTEXT_PREFIX + key)
      raw = stored ? (JSON.parse(stored) as ExtraContext[]) : []
    } catch {
      raw = []
    }
  }
  // A summary of undefined means summarization was still pending when the item
  // was saved; on restore we won't re-run it, so treat as "no summary" ('')
  // rather than leaving the chip stuck on ⏳ forever.
  return raw.map((it) => ({ ...it, summary: it.summary === undefined ? '' : it.summary }))
}

export function saveContext(key: string, items: ExtraContext[]): void {
  const bridge = getBridge()
  if (bridge?.contextSave) {
    void bridge.contextSave({ key, items })
    return
  }
  try {
    localStorage.setItem(CONTEXT_PREFIX + key, JSON.stringify(items))
  } catch { /* ignore quota / private mode */ }
}

