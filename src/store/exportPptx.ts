// PPTX export: split the markdown on `---` into slides, run each chunk through
// the shared block model (markdownToHtml + htmlToBlocks), and render one 16:9
// pptxgen slide per chunk with the active theme's fonts/colors.
import pptxgen from 'pptxgenjs'
import { markdownToHtml } from './markdown'
import { htmlToBlocks, themeFromVars, type Block, type InlineRun } from './exportModel'
import { splitSlides } from './slides'
import type { ThemeVars } from '../components/StylePanel'

const W = 13.333 // LAYOUT_16x9 width (inches)
const M = 0.6 // side margin
const BODY_W = W - 2 * M
const TITLE_Y = 0.35
const BODY_START = 1.5
const BODY_END = 7.1
const LINE = 0.27 // inches per ~14pt line (height estimate only)

const plain = (runs: InlineRun[]): string => runs.map((r) => r.text).join('')

// A single markdown list item must map to exactly ONE pptx bullet. pptxgenjs
// treats any `\n` inside a text run as the start of a NEW paragraph, so a list
// item whose text contains a wrapped/continued line (marked emits `Slide One\n
// details`) would be split into TWO separate bullets — spurious "extra items"
// on the slide. Collapse inner whitespace to a single space and trim edges so
// one item always renders as one bullet.
const plainItem = (runs: InlineRun[]): string =>
  plain(runs).replace(/\s+/g, ' ').trim()

// ponytail: heights are estimated from char counts; overflow just clips at BODY_END,
// no auto new-slide. Good enough for a reasonable-fidelity export.
const est = (text: string, perLine = 95): number =>
  Math.max(1, Math.ceil(text.length / perLine) + text.split('\n').length - 1) * LINE

async function loadImg(src: string): Promise<{ data: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (!src.startsWith('data:image/')) return resolve(null) // browser can't fetch file paths
    const img = new Image()
    img.onload = () => resolve({ data: src, w: img.naturalWidth || 400, h: img.naturalHeight || 300 })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function buildPptx(markdown: string, theme: ThemeVars): Promise<Blob> {
  const t = themeFromVars(theme)
  // "Slide-scaled" typography: body sizes derive from the theme's font size
  // (--doc-font-size → fontSizePt) but are bumped up for slide legibility, and
  // titles/headings scale proportionally. These factors MUST match the slides
  // PDF CSS (electron/main.cjs) so the deck, slides-PDF, and WYSIWYG stay in
  // sync, and so changing the theme rescales all of them together.
  const BASE = Math.max(12, t.fontSizePt * 1.2) // body / paragraph / list / h4
  const TITLE = BASE * 2        // slide title box (first h1/h2)
  const HEAD = BASE * 1.5       // h1/h2 rendered inside the body
  const H3 = BASE * 1.25        // h3
  const SMALL = BASE * 0.8      // code / table cells
  const pres = new pptxgen()
  pres.layout = 'LAYOUT_16x9'

  for (const chunk of splitSlides(markdown)) {
    const slide = pres.addSlide()
    const blocks: Block[] = htmlToBlocks(markdownToHtml(chunk))

    // First #/## heading becomes the slide title; anything else stays in the body.
    const first = blocks.findIndex((b) => b.kind === 'heading' && b.level <= 2)
    if (first >= 0) {
      const title = blocks[first]
      if (title.kind === 'heading')
        slide.addText(plain(title.runs), {
          x: M, y: TITLE_Y, w: BODY_W, h: 0.9,
          fontFace: t.font, fontSize: TITLE, bold: true, color: t.headingColor, valign: 'top',
        })
      blocks.splice(first, 1)
    }

    let y = BODY_START
    for (const b of blocks) {
      if (y > BODY_END - 0.2) break
      switch (b.kind) {
        case 'heading':
        case 'paragraph':
        case 'quote': { // quotes flatten to paragraphs
          const text = plain(b.runs)
          const h = Math.min(est(text), BODY_END - y)
          slide.addText(text, {
            x: M, y, w: BODY_W, h, valign: 'top',
            fontFace: t.font, fontSize: b.kind === 'heading' ? (b.level <= 2 ? HEAD : b.level === 3 ? H3 : BASE) : BASE,
            bold: b.kind === 'heading',
            color: b.kind === 'heading' ? t.headingColor : t.textColor,
          })
          y += h + 0.05
          break
        }
        case 'list': {
          const h = Math.min(b.items.length * LINE, BODY_END - y)
          slide.addText(
            b.items.map((it) => ({
              text: plainItem(it),
              options: { bullet: b.ordered ? { type: 'number' as const } : true, breakLine: true },
            })),
            { x: M, y, w: BODY_W, h, valign: 'top', fontFace: t.font, fontSize: BASE, color: t.textColor },
          )
          y += h + 0.05
          break
        }
        case 'codeBlock': {
          const lines = b.text.split('\n')
          const h = Math.min(lines.length * 0.22 + 0.2, BODY_END - y)
          slide.addText(b.text, {
            x: M, y, w: BODY_W, h, valign: 'top',
            fontFace: t.codeFont, fontSize: SMALL, color: t.textColor, fill: { color: t.codeBg },
          })
          y += h + 0.1
          break
        }
        case 'table': {
          const rows = [
            b.header.map((cell) => ({ text: cell, options: { bold: true, fill: { color: t.codeBg } } })),
            ...b.rows.map((row) => row.map((cell) => ({ text: plain(cell) }))),
          ]
          const h = Math.min(rows.length * 0.32 + 0.1, BODY_END - y)
          slide.addTable(rows, {
            x: M, y, w: BODY_W, h, valign: 'top',
            fontFace: t.font, fontSize: SMALL, color: t.textColor,
            border: { type: 'solid', color: 'D0D7DE', pt: 0.75 },
          })
          y += h + 0.1
          break
        }
        case 'image': {
          const img = await loadImg(b.dataUrl)
          if (!img) break
          const scale = Math.min(11 / img.w, 4.2 / img.h)
          const h = img.h * scale
          const iy = Math.min(y, BODY_END - h)
          slide.addImage({ data: img.data, x: M + (BODY_W - img.w * scale) / 2, y: iy, w: img.w * scale, h })
          y = Math.min(iy + h + 0.1, BODY_END)
          break
        }
        case 'hr': // slide separators don't need a rule on the slide
          break
      }
    }
  }

  const out = await pres.write({ outputType: 'blob' })
  return out as Blob
}
