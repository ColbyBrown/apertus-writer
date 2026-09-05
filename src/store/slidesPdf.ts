import { splitSlides } from './slides'
import { markdownToHtml } from './markdown'

// One 16:9 slide div per `---` section. Each slide is sized to the same
// physical dimensions as the @page (13.333in x 7.5in) so Chromium prints it
// at 1:1. Sizing it in CSS pixels (e.g. 1920px ≈ 20in) would force the print
// engine to scale the whole slide down to fit the 13.333in page — shrinking
// every font and producing the "tiny text" bug.
export function slidesToHtml(markdown: string): string {
  return splitSlides(markdown)
    .map((slide) => `<div class="slide">${markdownToHtml(slide)}</div>`)
    .join('')
}

export const slidesToPdfHtml = slidesToHtml
