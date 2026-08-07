import type { Editor } from '@tiptap/react'

interface Props {
  editor: Editor | null
  onInsertImage: () => void
  codeView: boolean
  onToggleCodeView: () => void
}

export default function Toolbar({ editor, onInsertImage, codeView, onToggleCodeView }: Props) {
  if (!editor) return null
  const btn = (active: boolean) => 'tb-btn' + (active ? ' active' : '')

  return (
    <div className="toolbar">
      {!codeView && (
        <>
          <select
            className="tb-select"
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1'
              : editor.isActive('heading', { level: 2 }) ? 'h2'
              : editor.isActive('heading', { level: 3 }) ? 'h3'
              : editor.isActive('heading', { level: 4 }) ? 'h4'
              : 'p'
            }
            onChange={(e) => {
              const v = e.target.value
              if (v === 'p') editor.chain().focus().setParagraph().run()
              else editor.chain().focus().setHeading({ level: Number(v[1]) as 1|2|3|4 }).run()
            }}
          >
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
          </select>

          <span className="tb-sep" />
          <button className={btn(editor.isActive('bold'))} title="Bold (Ctrl-B)"
            onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
          <button className={btn(editor.isActive('italic'))} title="Italic (Ctrl-I)"
            onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
          <button className={btn(editor.isActive('strike'))} title="Strikethrough"
            onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></button>
          <button className={btn(editor.isActive('code'))} title="Inline code"
            onClick={() => editor.chain().focus().toggleCode().run()}>{'<>'}</button>

          <span className="tb-sep" />
          <button className={btn(editor.isActive('bulletList'))} title="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
          <button className={btn(editor.isActive('orderedList'))} title="Numbered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
          <button className={btn(editor.isActive('blockquote'))} title="Blockquote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝ Quote</button>
          <button className={btn(editor.isActive('codeBlock'))} title="Code block"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{'{ }'}</button>

          <span className="tb-sep" />
          <button className="tb-btn" title="Insert table"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦ Table</button>
          {editor.isActive('table') && (
            <>
              <button className="tb-btn" onClick={() => editor.chain().focus().addColumnAfter().run()}>+Col</button>
              <button className="tb-btn" onClick={() => editor.chain().focus().addRowAfter().run()}>+Row</button>
              <button className="tb-btn" onClick={() => editor.chain().focus().deleteTable().run()}>✕ Table</button>
            </>
          )}
          <button className="tb-btn" title="Insert image" onClick={onInsertImage}>🖼 Image</button>
          <button className="tb-btn" title="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</button>

          <span className="tb-sep" />
          <button className="tb-btn" title="Undo" onClick={() => editor.chain().focus().undo().run()}>↶</button>
          <button className="tb-btn" title="Redo" onClick={() => editor.chain().focus().redo().run()}>↷</button>

          <span className="tb-sep" />
        </>
      )}
      <button className={btn(codeView)} title="Toggle raw markdown code view (Ctrl+Shift+M)"
        onClick={onToggleCodeView}>{'</> Code'}</button>
    </div>
  )
}
