import { Excalidraw, exportToSvg, serializeAsJSON } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useImperativeHandle, useMemo, useState, type Ref } from 'react'

export type WhiteboardHandle = {
  // The drawing as an Excalidraw scene (to edit later) and an SVG snapshot (to show), or null if it's empty.
  exportDrawing: () => Promise<{ json: string; svg: string } | null>
}

// An Excalidraw whiteboard. Loaded on demand (it's large), so import it with React.lazy.
export default function Whiteboard({ initial, ref }: { initial: string | null; ref: Ref<WhiteboardHandle> }) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const initialData = useMemo(() => {
    if (!initial) return null
    const scene = JSON.parse(initial)
    return { elements: scene.elements ?? [], appState: { ...scene.appState, collaborators: new Map() } }
  }, [initial])

  useImperativeHandle(
    ref,
    () => ({
      exportDrawing: async () => {
        if (!api) return null
        const elements = api.getSceneElements()
        if (elements.length === 0) return null
        const appState = api.getAppState()
        const svg = await exportToSvg({
          elements,
          appState: { ...appState, exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
          files: api.getFiles(),
          exportPadding: 16,
          // Embedded fonts would make each snapshot hundreds of KB; text falls back to a system font instead.
          skipInliningFonts: true,
        })
        return { json: serializeAsJSON(elements, appState, api.getFiles(), 'database'), svg: svg.outerHTML }
      },
    }),
    [api],
  )

  return (
    <div className="h-[55dvh] min-h-80 overflow-hidden rounded-xl border border-line-strong">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        UIOptions={{
          // Images would bloat the database; shapes, arrows, text and freehand cover study sketches.
          tools: { image: false },
          canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false },
        }}
      />
    </div>
  )
}
