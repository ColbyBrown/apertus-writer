/**
 * Split raw markdown into slide chunks on standalone `---` lines.
 *
 * A boundary is a line whose trimmed content is exactly `---` and which is
 * not inside a fenced code block (``` or ~~~). The `---` separators
 * themselves are removed. No separators → the whole input is one slide.
 */
export function splitSlides(markdown: string): string[] {
  const slides: string[] = [];
  let current: string[] = [];
  let fence: "```" | "~~~" | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (fence === null) {
      if (trimmed.startsWith("```")) fence = "```";
      else if (trimmed.startsWith("~~~")) fence = "~~~";
    } else if (trimmed.startsWith(fence)) {
      fence = null;
    }

    if (fence === null && trimmed === "---") {
      slides.push(current.join("\n"));
      current = [];
    } else {
      current.push(line);
    }
  }
  slides.push(current.join("\n"));
  return slides;
}

/**
 * Replace standalone `---` boundary lines (outside fenced code) with a raw
 * `<hr data-type="slideBreak">` marker so `marked` passes it through and the
 * TipTap SlideBreak node picks it up on parse. Used only in slides mode.
 */
export function replaceSlideBreaks(markdown: string): string {
  const out: string[] = [];
  let fence: "```" | "~~~" | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (fence === null) {
      if (trimmed.startsWith("```")) fence = "```";
      else if (trimmed.startsWith("~~~")) fence = "~~~";
    } else if (trimmed.startsWith(fence)) {
      fence = null;
    }
    if (fence === null && trimmed === "---") out.push('<hr data-type="slideBreak">');
    else out.push(line);
  }
  return out.join("\n");
}
