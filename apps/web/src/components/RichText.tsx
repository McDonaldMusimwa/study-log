import Highlight from '@tiptap/extension-highlight'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { ReactNode } from 'react'

// One set of extensions for editing and for display, so anything written renders the same everywhere.
function extensions(placeholder?: string) {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
    Highlight,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    CharacterCount,
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ]
}

// Small stroke icons for the toolbar, in the same style as the rest of the app.
const icon = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
const ICONS = {
  undo: icon(<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />),
  redo: icon(<path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />),
  bold: icon(<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />),
  italic: icon(<path d="M19 5h-9M14 19H5M15 5 9 19" />),
  underline: icon(<path d="M7 4v6a5 5 0 0 0 10 0V4M5 20h14" />),
  strike: icon(<path d="M16 6a4 4 0 0 0-4-2c-2.5 0-4 1.3-4 3.2 0 1.2.7 2.1 2 2.8M4 12h16M9 18a4 4 0 0 0 3 1.5c2.6 0 4.5-1.4 4.5-3.5 0-.7-.2-1.3-.6-1.8" />),
  highlight: icon(<path d="m9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />),
  bullet: icon(<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />),
  ordered: icon(<path d="M10 6h10M10 12h10M10 18h10M4 4h1v4M4 8h2M4 14.5c0-.8.7-1.5 1.5-1.5S7 13.7 7 14.5 4 17 4 18h3" />),
  task: icon(<path d="m3 7 2 2 4-4M13 7h8M3 17l2 2 4-4M13 17h8" />),
  alignLeft: icon(<path d="M3 6h18M3 12h12M3 18h16" />),
  alignCenter: icon(<path d="M3 6h18M6 12h12M4 18h16" />),
  alignRight: icon(<path d="M3 6h18M9 12h12M5 18h16" />),
  link: icon(<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />),
  quote: icon(<path d="M6 17c-1.7 0-3-1.3-3-3V9a3 3 0 0 1 3-3h1M17 17c-1.7 0-3-1.3-3-3V9a3 3 0 0 1 3-3h1M3 13h4M14 13h4" />),
  code: icon(<path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />),
  rule: icon(<path d="M3 12h18" />),
  table: icon(<path d="M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14" />),
  clear: icon(<path d="M4 7V4h16v3M9 20h6M12 4v16M3 3l18 18" />),
}

type ToolState = ReturnType<typeof readState>

function readState(e: Editor) {
  return {
    block: e.isActive('heading', { level: 1 })
      ? 'h1'
      : e.isActive('heading', { level: 2 })
        ? 'h2'
        : e.isActive('heading', { level: 3 })
          ? 'h3'
          : 'p',
    bold: e.isActive('bold'),
    italic: e.isActive('italic'),
    underline: e.isActive('underline'),
    strike: e.isActive('strike'),
    highlight: e.isActive('highlight'),
    bullet: e.isActive('bulletList'),
    ordered: e.isActive('orderedList'),
    task: e.isActive('taskList'),
    left: e.isActive({ textAlign: 'left' }),
    center: e.isActive({ textAlign: 'center' }),
    right: e.isActive({ textAlign: 'right' }),
    link: e.isActive('link'),
    quote: e.isActive('blockquote'),
    code: e.isActive('codeBlock'),
    inTable: e.isActive('table'),
    canUndo: e.can().undo(),
    canRedo: e.can().redo(),
    words: e.storage.characterCount.words() as number,
  }
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the editor's selection when the toolbar is clicked.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-sm font-semibold disabled:cursor-default disabled:opacity-35 ${
        active ? 'bg-accent-soft text-accent' : 'text-soft hover:bg-bg'
      }`}
    >
      {children}
    </button>
  )
}

const Divider = () => <span aria-hidden="true" className="mx-0.5 h-6 w-px shrink-0 self-center bg-line" />

function Toolbar({ editor, state }: { editor: Editor; state: ToolState }) {
  const chain = () => editor.chain().focus()

  const setBlock = (value: string) => {
    if (value === 'p') chain().setParagraph().run()
    else chain().setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run()
  }

  const editLink = () => {
    const current = editor.getAttributes('link').href as string | undefined
    const href = window.prompt('Link address (leave empty to remove)', current ?? 'https://')
    if (href === null) return
    if (!href.trim() || href.trim() === 'https://') chain().extendMarkRange('link').unsetLink().run()
    else chain().extendMarkRange('link').setLink({ href: href.trim() }).run()
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-line bg-field px-1.5 py-1.5">
      <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        {ICONS.undo}
      </ToolButton>
      <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        {ICONS.redo}
      </ToolButton>
      <Divider />
      <label className="sr-only" htmlFor={`block-${editor.instanceId}`}>
        Text style
      </label>
      <select
        id={`block-${editor.instanceId}`}
        value={state.block}
        onChange={(e) => setBlock(e.target.value)}
        className="h-9 cursor-pointer rounded-md border border-line bg-surface px-2 text-sm text-ink"
      >
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <Divider />
      <ToolButton label="Bold (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
        {ICONS.bold}
      </ToolButton>
      <ToolButton label="Italic (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        {ICONS.italic}
      </ToolButton>
      <ToolButton label="Underline (Ctrl+U)" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        {ICONS.underline}
      </ToolButton>
      <ToolButton label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        {ICONS.strike}
      </ToolButton>
      <ToolButton label="Highlight" active={state.highlight} onClick={() => chain().toggleHighlight().run()}>
        {ICONS.highlight}
      </ToolButton>
      <Divider />
      <ToolButton label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
        {ICONS.bullet}
      </ToolButton>
      <ToolButton label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
        {ICONS.ordered}
      </ToolButton>
      <ToolButton label="Checklist" active={state.task} onClick={() => chain().toggleTaskList().run()}>
        {ICONS.task}
      </ToolButton>
      <Divider />
      <ToolButton label="Align left" active={state.left} onClick={() => chain().setTextAlign('left').run()}>
        {ICONS.alignLeft}
      </ToolButton>
      <ToolButton label="Align centre" active={state.center} onClick={() => chain().setTextAlign('center').run()}>
        {ICONS.alignCenter}
      </ToolButton>
      <ToolButton label="Align right" active={state.right} onClick={() => chain().setTextAlign('right').run()}>
        {ICONS.alignRight}
      </ToolButton>
      <Divider />
      <ToolButton label="Link" active={state.link} onClick={editLink}>
        {ICONS.link}
      </ToolButton>
      <ToolButton label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
        {ICONS.quote}
      </ToolButton>
      <ToolButton label="Code block" active={state.code} onClick={() => chain().toggleCodeBlock().run()}>
        {ICONS.code}
      </ToolButton>
      <ToolButton label="Divider line" onClick={() => chain().setHorizontalRule().run()}>
        {ICONS.rule}
      </ToolButton>
      <ToolButton
        label="Insert table"
        active={state.inTable}
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        {ICONS.table}
      </ToolButton>
      <ToolButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        {ICONS.clear}
      </ToolButton>

      {state.inTable && (
        <div className="flex w-full flex-wrap gap-1 border-t border-line pt-1.5 text-xs">
          {[
            ['+ Row', () => chain().addRowAfter().run()],
            ['+ Column', () => chain().addColumnAfter().run()],
            ['− Row', () => chain().deleteRow().run()],
            ['− Column', () => chain().deleteColumn().run()],
            ['Delete table', () => chain().deleteTable().run()],
          ].map(([label, run]) => (
            <button
              key={label as string}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={run as () => void}
              className="min-h-8 cursor-pointer rounded-md border border-line bg-surface px-2.5 font-semibold text-soft hover:border-accent hover:text-accent"
            >
              {label as string}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type EditorProps = {
  initial: JSONContent | null
  placeholder: string
  onChange: (body: JSONContent, text: string) => void
  autoFocus?: boolean
  // Minimum height of the writing area, as a Tailwind class.
  minHeight?: string
}

// A Word-style editor: text styles, marks, lists and checklists, alignment, links, quotes, code, tables.
// Markdown shortcuts work too (# heading, - list, [] checklist, ``` code, > quote, --- divider).
export function RichTextEditor({ initial, placeholder, onChange, autoFocus = false, minHeight = 'min-h-40' }: EditorProps) {
  const editor = useEditor({
    extensions: extensions(placeholder),
    content: initial ?? '',
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: `note-content ${minHeight} px-4 py-3 outline-none`, 'aria-label': placeholder } },
    // The plain-text copy feeds summaries and post drafts, so empty blocks don't leave runs of blank lines.
    onUpdate: ({ editor: e }) =>
      onChange(
        e.getJSON(),
        e
          .getText({ blockSeparator: '\n' })
          .replace(/\n{3,}/g, '\n\n')
          .trim(),
      ),
  })
  const state = useEditorState({ editor, selector: ({ editor: e }) => (e ? readState(e) : null) })

  return (
    <div className="overflow-hidden rounded-xl border border-line-strong bg-surface text-ink focus-within:border-accent">
      {editor && state && <Toolbar editor={editor} state={state} />}
      <EditorContent editor={editor} />
      {state && (
        <p className="border-t border-line px-4 py-1.5 text-right text-xs text-muted" aria-live="polite">
          {state.words} {state.words === 1 ? 'word' : 'words'}
        </p>
      )}
    </div>
  )
}

export function RichTextView({ content }: { content: JSONContent | null }) {
  const editor = useEditor({ extensions: extensions(), content: content ?? '', editable: false }, [content])
  return <EditorContent editor={editor} className="note-content" />
}
