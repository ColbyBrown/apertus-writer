// Typed accessor for the Electron preload bridge (window.aiBridge).
// All methods are undefined in a plain browser.

export interface Bridge {
  request(args: {
    url: string; method: string; headers: Record<string, string>; body?: string
  }): Promise<{ ok: boolean; status: number; statusText: string; body: string }>
  chooseOpenPath(): Promise<{ canceled: boolean; filePath?: string }>
  readFile(args: { filePath: string }): Promise<{ ok: boolean; content?: string; error?: string }>
  chooseSavePath(args: { docName: string }): Promise<{ canceled: boolean; filePath?: string }>
  chooseExportPath(args: { docName: string }): Promise<{ canceled: boolean; filePath?: string; format?: 'docx' | 'odt' | 'pdf' }>
  writeFile(args: { filePath: string; base64: string }): Promise<{ ok: boolean; error?: string }>
  exportPdfTo(args: { filePath: string; html: string; css: string }): Promise<{ ok: boolean; error?: string }>
  printDocument(args: { html: string; css: string }): Promise<{ ok: boolean; error?: string }>
  sessionSave(args: { docName: string; filePath: string | null; content: string }): Promise<{ ok: boolean; error?: string }>
  sessionLoad(): Promise<{ ok: boolean; session?: { docName: string; filePath: string | null; content: string } | null }>
  onMenuAction(callback: (action: 'new' | 'open' | 'save' | 'export' | 'print') => void): () => void
}

export function getBridge(): Bridge | undefined {
  return (window as unknown as { aiBridge?: Bridge }).aiBridge
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
