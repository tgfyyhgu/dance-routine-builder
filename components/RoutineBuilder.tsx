/**
 * Center panel: displays choreography sequence with drag-to-reorder, save/export controls.
 * Sub-component RoutineStepItem renders individual steps.
 * This is a presentation component that receives all state from parent (ChoreoPage).
 */
"use client"

// Drag & drop library - dnd-kit enables drag-to-reorder functionality
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
// Types
import { RoutineStep } from "@/types/routine"

interface Props {
  readonly routine: RoutineStep[]
  readonly onRemoveStep: (stepId: string) => void
  readonly onUndo: () => void
  readonly onRedo: () => void
  readonly onJumpToStep?: (index: number) => void
  readonly routineName?: string
  readonly setRoutineName?: (name: string) => void
  readonly routineId?: string | null
  readonly saveRoutine?: () => void
  readonly handleSaveAs?: () => void
  readonly handleExport?: () => void
  readonly handleImport?: (event: React.ChangeEvent<HTMLInputElement>) => void
  readonly handleNewRoutine?: () => void
  readonly isSaving?: boolean
  readonly saveStatus?: string | null
  readonly fileInputRef?: React.RefObject<HTMLInputElement | null>
  // Sharing
  readonly visibility?: 'private' | 'shared' | 'public'
  readonly shareToken?: string | null
  readonly onVisibilityChange?: (visibility: 'private' | 'shared' | 'public') => Promise<void>
  readonly onCreateShare?: () => Promise<void>
  readonly onRevokeShare?: () => Promise<void>
  readonly shareUrl?: string | null
  readonly isSharing?: boolean
}

/**
 * Renders single step in routine with drag handle, name, and remove button.
 * DnD-kit's useSortable hook enables drag-to-reorder functionality.
 */
function RoutineStepItem({
  step,
  index,
  onRemove,
  onJump,
}: {
  readonly step: RoutineStep
  readonly index: number
  readonly onRemove: (stepId: string) => void
  readonly onJump: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: step.stepId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onRemove(step.stepId)
  }

  const handleJump = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onJump(index)
  }
  return (
    // Outer container: Has transform applied (for smooth drag animation)
    // ref={setNodeRef}: Connects this div to dnd-kit so it can track position changes
    // style={style}: Applies CSS transform and opacity during drag
    <div
      ref={setNodeRef}  // dnd-kit magic: monitors mouse/touch on this element
      style={style}  // Changes during drag: { transform: "translate(20px, 50px)", opacity: 0.5 }
      className="mb-2"  // Bottom margin for spacing between steps
    >
      {/* Inner container: The visual step card */}
      <div
        // Visual feedback: Border and background change when dragging
        className={`border p-2 flex justify-between items-center bg-white dark:bg-gray-900 dark:border-gray-700 rounded shadow-sm hover:shadow-md transition-all ${
          isDragging ? "border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950" : ""  // Blue highlight while dragging
        }`}
      >
        {/* DRAG HANDLE: ⋮⋮ icon */}
        {/* 
          This visual indicator shows user "grab here to drag"
          pointer-events-none: This element doesn't capture clicks (lets clicks pass through)
          cursor-grab: When hovering, cursor shows "grab" hand icon
          active:cursor-grabbing: While dragging, shows "grabbing" hand icon
        */}
        <span className="text-gray-400 mr-2 cursor-grab active:cursor-grabbing pointer-events-none text-xs">⋮⋮</span>
        
        {/* DRAGGABLE AREA: Step number and figure name */}
        {/* 
          {...attributes} and {...listeners} are dnd-kit magic:
          - attributes: Spreads accessibility attributes (role, aria-* labels)
          - listeners: Spreads mouse/touch event handlers (mousedown, touchstart, mousemove, etc.)
          
          By spreading these, we tell dnd-kit: "this div is draggable, watch these events"
          Without {...listeners}, dragging wouldn't work.
        */}
        <div
          {...attributes}  // Accessibility attributes from dnd-kit
          {...listeners}  // Mouse/touch event handlers from dnd-kit
          className="flex-1 cursor-grab active:cursor-grabbing"  // flex-1 = take remaining space
        >
          {/* 
            Button that shows step number and figure name
            w-full: Take full width
            onClick={handleJump}: Clicking jumps to this step's video preview
          */}
          <button
            onClick={handleJump}  // User clicks to preview this step
            className="w-full text-left hover:bg-blue-50 dark:hover:bg-gray-800 rounded px-1 py-0.5 transition-colors font-medium text-gray-700 dark:text-gray-300 text-sm"
          >
            {/* Step counter: "1.", "2.", "3.", etc. (index + 1 because index is 0-based) */}
            <span className="font-bold text-gray-700 dark:text-gray-400">{index + 1}.</span>
            {/* Figure name: "Feather Step", "Natural Turn", etc. */}
            {step.figure.name}
          </button>
        </div>
        
        {/* REMOVE BUTTON: Delete this step */}
        {/* pointer-events-auto: Make sure clicks on this button aren't ignored */}
        <button
          onClick={handleRemove}  // User clicked Remove → delete this step
          className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium ml-2 whitespace-nowrap pointer-events-auto text-xs"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

/**
 * ============ MAIN COMPONENT: RoutineBuilder ============
 * 
 * PURPOSE: Render the entire center panel of the choreography editor
 * 
 * This component receives all props from parent (ChoreoPage) and:
 * 1. Displays the routine name in an editable text field
 * 2. Shows control buttons (New, Save, Save As, Export, Import)
 * 3. Shows undo/redo buttons
 * 4. Renders the droppable area where user adds figures
 * 5. Displays all routine steps as sortable list items
 * 
 * LAYOUT:
 * ┌──────────────────────────────────────┐
 * │ Name: [Input] | New | Save | Export  │  ← Control bar (if routineName provided)
 * ├──────────────────────────────────────┤
 * │ Undo | Redo                          │  ← History buttons
 * ├──────────────────────────────────────┤
 * │ [1. Feather Step]         [Remove]   │
 * │ [2. Natural Turn]         [Remove]   │  ← Sortable steps (can drag to reorder)
 * │ [3. Chase]                [Remove]   │
 * │                                      │
 * │ Drag figures from left panel here ➡ │  ← Empty state message or drop feedback
 * │                                      │
 * └──────────────────────────────────────┘
 */
export default function RoutineBuilder({
  routine,
  onRemoveStep,
  onUndo,
  onRedo,
  onJumpToStep,
  routineName,
  setRoutineName,
  saveRoutine,
  handleSaveAs,
  handleExport,
  handleImport,
  isSaving,
  saveStatus,
  routineId,
  handleNewRoutine,
  fileInputRef,
  visibility,
  shareToken,
  onVisibilityChange,
  onCreateShare,
  onRevokeShare,
  shareUrl,
  isSharing,
}: Props) {
  // ============ dnd-kit: MAKE THIS A DROP ZONE ============
  // This component is the DROP TARGET for figures dragged from FigurePanel
  
  const { setNodeRef, isOver } = useDroppable({
    id: "routine-droppable",  // Unique ID for this drop zone (parent ChoreoPage checks for this)
  })
  
  // Destructured values:
  // - setNodeRef: Function to connect React ref to dnd-kit
  // - isOver: boolean "is something currently being dragged over this zone?"
  // 
  // We use isOver to change the visual appearance (blue highlight) when user drags a figure here

  return (
    // ============ OUTER CONTAINER ============
    // flex flex-col h-full: Vertical flex layout, full height of parent
    // This stacks:
    // 1. Control bar (name, buttons)
    // 2. Undo/redo buttons
    // 3. Drop zone with steps (flex-1 = takes remaining space)
    <div className="flex flex-col h-full">
      {/* ============ SECTION 1: CONTROL BAR ============ */}
      {/* 
        Shows routine name input and action buttons
        Only renders if routineName prop is provided (parent must supply it)
        
        This section is optional because RoutineBuilder can be used in different ways:
        - With name/save controls (most common use in ChoreoPage)
        - Without controls (if embedded elsewhere)
      */}
      {routineName !== undefined && (
        // Background: light blue with border (consistent with form design)
        <div className="bg-blue-50 dark:bg-gray-800 border-b border-blue-200 dark:border-gray-700 p-2 mb-2 rounded">
          {/* Flex row: name label + input + buttons */}
          <div className="flex gap-2 items-center flex-wrap text-xs">
            {/* Label for routine name input */}
            <label htmlFor="rb-routine-name" className="font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Name:</label>
            
            {/* Editable routine name field */}
            {/* 
              User can type here to rename the routine
              onChange: Every keystroke calls setRoutineName (parent updates state)
              placeholder: Shows hint text if name is empty
            */}
            <input
              id="rb-routine-name"
              type="text"
              value={routineName}  // The current routine name (from parent state)
              onChange={(e) => setRoutineName?.(e.target.value)}  // Call parent callback as user types
              placeholder="Untitled Routine"  // Hint text
              className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-32 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {handleNewRoutine && (
              <button
                onClick={handleNewRoutine}
                className="bg-gray-600 dark:bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
                title="Start a new routine"
              >
                New
              </button>
            )}
            {saveRoutine && (
              <button
                onClick={saveRoutine}
                disabled={isSaving}
                className="bg-gray-600 dark:bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors font-medium text-xs"
              >
                {isSaving ? "..." : "Save"}
              </button>
            )}
            {routineId && handleSaveAs && (
              <button
                onClick={handleSaveAs}
                disabled={isSaving}
                className="bg-gray-600 dark:bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors font-medium text-xs"
              >
                Save As
              </button>
            )}
            {handleExport && (
              <button
                onClick={handleExport}
                className="bg-gray-600 dark:bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
              >
                Export
              </button>
            )}
            {handleImport && fileInputRef && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gray-600 dark:bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
                >
                  Import
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </>
            )}
            {saveStatus && (
              <span className="text-xs text-green-600 dark:text-green-400 font-semibold ml-auto">{saveStatus}</span>
            )}
          </div>
        </div>
      )}

      {/* ============ SECTION 2: SHARING CONTROLS ============ */}
      {routineId && (
        <div className="bg-purple-50 dark:bg-gray-800 border-b border-purple-200 dark:border-gray-700 p-2 mb-2 rounded">
          <div className="flex gap-2 items-center flex-wrap text-xs">
            <span className="font-semibold text-gray-700 dark:text-gray-300">Share:</span>
            
            {/* Visibility toggle */}
            <button
              onClick={() => onVisibilityChange?.(visibility === 'private' ? 'public' : 'private')}
              disabled={isSharing}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                visibility === 'private'
                  ? 'bg-gray-600 dark:bg-gray-700 text-white hover:bg-gray-700'
                  : 'bg-green-600 dark:bg-green-700 text-white hover:bg-green-700'
              } disabled:opacity-50`}
            >
              {visibility === 'private' ? '🔒 Private' : '🌍 Public'}
            </button>

            {/* Create/Revoke Share button */}
            {!shareUrl ? (
              <button
                onClick={onCreateShare}
                disabled={isSharing}
                className="bg-blue-600 dark:bg-blue-700 text-white px-3 py-1 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-xs font-medium disabled:opacity-50"
              >
                🔗 Create Share Link
              </button>
            ) : (
              <>
                <div className="flex gap-2 items-center min-w-fit">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-shrink min-w-48"
                  />
                  <button
                    onClick={async () => {
                      const { copyToClipboard } = await import('@/lib/sharing')
                      await copyToClipboard(shareUrl)
                      alert('Link copied!')
                    }}
                    className="bg-blue-600 dark:bg-blue-700 text-white px-2 py-1 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-xs font-medium whitespace-nowrap"
                  >
                    📋 Copy
                  </button>
                  {onRevokeShare && (
                    <button
                      onClick={onRevokeShare}
                      disabled={isSharing}
                      className="bg-red-600 dark:bg-red-700 text-white px-2 py-1 rounded hover:bg-red-700 dark:hover:bg-red-600 transition-colors text-xs font-medium whitespace-nowrap disabled:opacity-50"
                    >
                      🗑️ Revoke
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <button
          onClick={onUndo}
          className="bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm text-gray-900 dark:text-white font-medium"
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={onRedo}
          className="bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm text-gray-900 dark:text-white font-medium"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 border p-3 overflow-y-auto transition-all rounded ${
          isOver ? "bg-blue-50 dark:bg-blue-950 border-blue-400 dark:border-blue-600 border-2" : "bg-white dark:bg-gray-900 dark:border-gray-700"
        }`}
      >
        {routine.length === 0 && !isOver && (
          <p className="text-gray-400 dark:text-gray-600 text-center py-8 text-sm">
            Drag figures from the left panel to build your routine
          </p>
        )}

        {routine.length === 0 && isOver && (
          <p className="text-blue-400 dark:text-blue-300 text-center py-8 animate-pulse font-medium text-sm">
            Drop a figure here to add it to your routine
          </p>
        )}

        <SortableContext
          items={routine.map(s => s.stepId)}
          strategy={verticalListSortingStrategy}
        >
          {routine.map((step, index) => (
            <RoutineStepItem
              key={step.stepId}
              step={step}
              index={index}
              onRemove={onRemoveStep}
              onJump={onJumpToStep || (() => {})}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
