// Shared store for extra reference context (files / URLs) attached by the
// user. Both the chat sidebar and autocomplete read from this list, so items
// added in one place apply to both features.
import { useSyncExternalStore } from 'react'

export interface ExtraContext {
  kind: 'file' | 'url'
  name: string
  content: string
}

let items: ExtraContext[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function getContextItems(): ExtraContext[] {
  return items
}

export function addContextItems(added: ExtraContext[]) {
  items = [...items, ...added]
  emit()
}

export function removeContextItem(index: number) {
  items = items.filter((_, i) => i !== index)
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useContextItems(): ExtraContext[] {
  return useSyncExternalStore(subscribe, getContextItems)
}

// Fetch a URL and extract readable text (shared by chat + context panel)
export async function fetchUrlContext(url: string): Promise<ExtraContext> {
  const res = await fetch(url)
  const text = await res.text()
  const clean = text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 20000)
  return { kind: 'url', name: url, content: clean }
}

export async function fileToContext(f: File): Promise<ExtraContext> {
  return { kind: 'file', name: f.name, content: await f.text() }
}
