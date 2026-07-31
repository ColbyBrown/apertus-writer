import { marked } from 'marked'
import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
})

// Keep tables as HTML in markdown output (common practice)
turndown.addRule('table', {
  filter: ['table'],
  replacement: (_content, node) => {
    return '\n\n' + (node as HTMLElement).outerHTML + '\n\n'
  },
})

export function markdownToHtml(md: string): string {
  return marked.parse(md, { async: false }) as string
}

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html)
}
