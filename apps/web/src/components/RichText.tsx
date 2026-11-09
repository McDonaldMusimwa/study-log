import { Placeholder } from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

type Tool = { label: string; title: string; active: (e: Editor) => boolean; run: (e: Editor) => void; className?: string }

const TOOLS: Tool[] = [
  { label: 'B', title: 'Bold', className: 'font-bold', active: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { label: 'I', title: 'Italic', className: 'italic', active: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: 'H', title: 'Heading', className: 'font-display font-bold', active: (e) => e.isActive('heading'), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: '•', title: 'Bullet list', className: 'text-lg', active: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: '1.', title: 'Numbered list', active: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: '</>', title: 'Code block', className: 'font-mono text-xs', active: (e) => e.isActive('codeBlock'), run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { label: '“', title: 'Quote', className: 'font-display text-xl leading-none', active: (e) => e.isActive('blockquote'), run: (e) => e.chain().focus().toggleBlockquote().run() },
]

function Toolbar({ editor }: { editor: Editor }) {
  // Re-render only when the active formatting changes, not on every keystroke.
  const active = useEditorState({ editor, selector: ({ editor: e }) => TOOLS.map((tool) => tool.active(e)) })

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1 border-b border-line px-2 py-1.5">
      {TOOLS.map((tool, i) => (
        <button
          key={tool.title}
          type="button"
          title={tool.title}
          aria-label={tool.title}
          aria-pressed={active[i]}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => tool.run(editor)}
          className={`grid size-10 cursor-pointer place-items-center rounded-lg text-[15px] ${tool.className ?? ''} ${
            active[i] ? 'bg-accent-soft text-accent' : 'text-soft hover:bg-bg'
          }`}
        >
          {tool.label}
        </button>
      ))}
    </div>
  )
}

type EditorProps = {
  initial: JSONContent | null
  placeholder: string
  onChange: (body: JSONContent, text: string) => void
}

// Rich text for notes: headings, lists, code blocks and quotes. Markdown shortcuts work too (## , - , ```).
export function RichTextEditor({ initial, placeholder, onChange }: EditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: initial ?? '',
    autofocus: 'end',
    editorProps: { attributes: { class: 'note-content min-h-40 px-4 py-3 outline-none', 'aria-label': 'Note' } },
    onUpdate: ({ editor: e }) => onChange(e.getJSON(), e.getText({ blockSeparator: '\n' })),
  })

  return (
    <div className="overflow-hidden rounded-xl border border-line-strong bg-surface focus-within:border-accent">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

export function RichTextView({ content }: { content: JSONContent | null }) {
  const editor = useEditor({ extensions: [StarterKit], content: content ?? '', editable: false }, [content])
  return <EditorContent editor={editor} className="note-content" />
}
