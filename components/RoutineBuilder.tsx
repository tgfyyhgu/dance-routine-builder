/**
 * PHASE 3: ROUTINE BUILDER COMPONENT
 * 
 * FILE PURPOSE: RoutineBuilder is the CENTER PANEL of the choreography editor.
 * 
 * High-level role:
 * - Display the user's choreography sequence as a list of steps
 * - Allow reordering steps via drag & drop (using @dnd-kit/sortable)
 * - Provide control buttons (Save, Export, Import, New, Undo, Redo)
 * - Show routine metadata (name, save status)
 * - Handle drag-over visual feedback when user adds figures
 * 
 * Component structure:
 * - RoutineStepItem (internal sub-component): Renders ONE step in the routine
 * - RoutineBuilder (main export): The full center panel
 * 
 * Data flow:
 * Parent (ChoreoPage) → passes state & callbacks → RoutineBuilder renders
 * User interacts → RoutineBuilder calls callbacks → Parent updates state
 * 
 * This is a VISUAL/PRESENTATION component. It does NOT manage state.
 * All state lives in ChoreoPage (the orchestrator).
 */
"use client"

// ============ IMPORTS ============

// Drag & Drop Kit (dnd-kit) - Library for handling drag/drop and sorting
import { useDroppable } from "@dnd-kit/core"  // useDroppable: Makes a container a drop target
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"  // For sortable items
import { useSortable } from "@dnd-kit/sortable"  // useSortable: Makes an item draggable/sortable
import { CSS } from "@dnd-kit/utilities"  // CSS: Helper to convert transform data to CSS

// TypeScript types from Phase 1
import { RoutineStep } from "@/types/routine"

/**
 * ============ PROPS INTERFACE ============
 * 
 * RoutineBuilder receives ~20 props from parent (ChoreoPage).
 * These are organized in groups by functionality.
 * 
 * WHY SO MANY PROPS?
 * Because RoutineBuilder doesn't manage state—it's a "dumb" presentation component.
 * All state logic lives in ChoreoPage. RoutineBuilder just:
 * 1. Receives the current state via props
 * 2. Calls callback functions when user interacts
 * 3. Let parent handle updates
 * 
 * This pattern is called "lifting state up" and makes testing/debugging easier.
 */
interface Props {
  // ============ GROUP 1: CORE ROUTINE DATA ============
  // The actual choreography sequence being built/displayed
  readonly routine: RoutineStep[]  // Array of steps user has added (from ChoreoPage state)
  
  // ============ GROUP 2: STEP MANIPULATION CALLBACKS ============
  // Functions called when user changes the routine
  readonly onRemoveStep: (stepId: string) => void  // User clicked Remove on a step
  readonly onReorderSteps: (steps: RoutineStep[]) => void  // User dragged step to new position
  
  // ============ GROUP 3: HISTORY CALLBACKS ============
  // Functions for undo/redo
  readonly onUndo: () => void  // User clicked Undo button
  readonly onRedo: () => void  // User clicked Redo button
  readonly onJumpToStep?: (index: number) => void  // User clicked step to preview video
  
  // ============ GROUP 4: ROUTINE METADATA ============
  // Information about the routine itself
  readonly routineName?: string  // User-given name (e.g., "Waltz Competition 2026")
  readonly setRoutineName?: (name: string) => void  // User edited the name in input field
  readonly routineId?: string | null  // Database ID if routine is saved, null if new
  
  // ============ GROUP 5: SAVE/LOAD OPERATIONS ============
  // Callbacks for saving, exporting, importing
  readonly saveRoutine?: () => void  // User clicked Save button
  readonly handleSaveAs?: () => void  // User clicked Save As (duplicate) button
  readonly handleExport?: () => void  // User clicked Export (download JSON) button
  readonly handleImport?: (event: React.ChangeEvent<HTMLInputElement>) => void  // User selected JSON file to import
  readonly handleNewRoutine?: () => void  // User clicked New button (start fresh)
  
  // ============ GROUP 6: UI STATE FOR SAVE FEEDBACK ============
  // Visual feedback while saving
  readonly isSaving?: boolean  // true = currently saving to database, disable buttons
  readonly saveStatus?: string | null  // "Saving...", "✓ Saved", etc.
  
  // ============ GROUP 7: FILE INPUT REFERENCE ============
  // Hidden file input for selecting JSON files to import
  readonly fileInputRef?: React.RefObject<HTMLInputElement | null>  // Ref to hidden <input type="file">
}

/**
 * ============ SUB-COMPONENT: RoutineStepItem ============
 * 
 * PURPOSE: Render a SINGLE step in the routine
 * 
 * This is a separate component because each step needs to be:
 * - Draggable: User can click and drag to reorder
 * - Droppable: Other steps can be dropped onto it
 * - Interactive: User can click to preview, or click Remove to delete
 * 
 * WHY SEPARATE COMPONENT?
 * Because @dnd-kit requires useSortable hook on each draggable item.
 * If step rendering was inline in the main component, we couldn't use the hook.
 * 
 * WHAT IT RENDERS:
 * ┌─────────────────────────────────────┐
 * │ ⋮⋮  │ 1. Feather Step │ Remove  │  ← Dark bar = this is one step
 * └─────────────────────────────────────┘
 * 
 * Interaction:
 * - User drags ⋮⋮ handle → step moves to new position
 * - User clicks text → jumps to this step in preview video
 * - User clicks Remove → step deleted from routine
 */
function RoutineStepItem({
  step,  // The RoutineStep object for this item
  index,  // Position in routine (0 = first, 1 = second, etc.)
  total,  // Total number of steps (not used currently, but available)
  onRemove,  // Callback: user clicked Remove button
  onJump,  // Callback: user clicked step to preview
}: {
  step: RoutineStep
  index: number
  total: number
  onRemove: (stepId: string) => void
  onJump: (index: number) => void
}) {
  // ============ dnd-kit SETUP ============
  // useSortable hook makes this step draggable and droppable
  // It's the key to enabling drag-to-reorder functionality
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: step.stepId,  // Unique ID for this step (dnd-kit uses this to track it)
  })
  
  // Destructured values explained:
  // - attributes: DOM attributes (role, aria-* for accessibility)
  // - listeners: mouse/touch event handlers for dragging
  // - setNodeRef: function to connect React ref to dnd-kit
  // - transform: { x, y, scaleX, scaleY } position changes during drag
  // - isDragging: boolean "is this item currently being dragged?"
  
  // Build CSS styles for visual feedback during drag
  const style = {
    // CSS.Transform.toString converts { x: 20, y: 50 } to "translate(20px, 50px)"
    // This smoothly shows the step moving as user drags
    transform: CSS.Transform.toString(transform),
    
    // When user is dragging THIS step, make it semi-transparent (50% opacity)
    // So user can see what's "underneath" (what they're dragging over)
    opacity: isDragging ? 0.5 : 1,
  }

  // ============ EVENT HANDLERS ============
  
  // handleRemove: Delete this step from the routine
  // Why e.preventDefault() and e.stopPropagation()?
  // - preventDefault: Don't do the browser's default action
  // - stopPropagation: Don't let this click "bubble up" to parent elements
  // Why important? Because this button is inside a draggable container.
  // Without stopping propagation, clicking Remove might also drag the step.
  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault()  // Prevent browser default
    e.stopPropagation()  // Don't let parent elements hear this click
    onRemove(step.stepId)  // Call parent callback with this step's ID
  }

  // handleJump: Clicking the step number or name jumps to preview video
  // Same stop-propagation logic as handleRemove (prevent drag interference)
  const handleJump = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onJump(index)  // Tell parent: "jump to this index (0, 1, 2, etc.)"
  }

  // ============ RENDER: STEP ITEM UI ============
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
        className={`border p-2 flex justify-between items-center bg-white rounded shadow-sm hover:shadow-md transition-all ${
          isDragging ? "border-blue-400 bg-blue-50" : ""  // Blue highlight while dragging
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
            className="w-full text-left hover:bg-blue-50 rounded px-1 py-0.5 transition-colors font-medium text-gray-700 text-sm"
          >
            {/* Step counter: "1.", "2.", "3.", etc. (index + 1 because index is 0-based) */}
            <span className="font-bold text-gray-700">{index + 1}.</span>
            {/* Figure name: "Feather Step", "Natural Turn", etc. */}
            {step.figure.name}
          </button>
        </div>
        
        {/* REMOVE BUTTON: Delete this step */}
        {/* pointer-events-auto: Make sure clicks on this button aren't ignored */}
        <button
          onClick={handleRemove}  // User clicked Remove → delete this step
          className="text-red-500 hover:text-red-700 font-medium ml-2 whitespace-nowrap pointer-events-auto text-xs"
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
  onReorderSteps,
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
        <div className="bg-blue-50 border-b border-blue-200 p-2 mb-2 rounded">
          {/* Flex row: name label + input + buttons */}
          <div className="flex gap-2 items-center flex-wrap text-xs">
            {/* Label for routine name input */}
            <label htmlFor="rb-routine-name" className="font-semibold text-gray-700 whitespace-nowrap">Name:</label>
            
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
              className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-32"
            />
            {/* NEW BUTTON: Start a fresh routine */}
            {/* 
              Only shows if handleNewRoutine callback was provided (ChoreoPage supplies it)
              Conditional rendering: {...handleNewRoutine && ()} means "only render if callback exists"
            */}
            {handleNewRoutine && (
              <button
                onClick={handleNewRoutine}  // User clicked: start new routine
                className="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors font-medium text-xs"
                title="Start a new routine"  // Tooltip on hover
              >
                New
              </button>
            )}
            {/* SAVE BUTTON: Save routine to Supabase (create or update) */}
            {/* 
              isSaving prop:
              - true: Disable button & show "..." (loading state)
              - false: Enable button & show "Save"
              
              disabled: When saving, button won't accept clicks (prevent double-save)
              className disabled:bg-gray-400: Gray out button when disabled
            */}
            {saveRoutine && (
              <button
                onClick={saveRoutine}  // User clicked: save routine to database
                disabled={isSaving}  // Disable while saving to prevent double-clicks
                className="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 disabled:bg-gray-400 transition-colors font-medium text-xs"
              >
                {isSaving ? "..." : "Save"}  {/* Show spinner emoji or "Save" text */}
              </button>
            )}
            {/* SAVE AS BUTTON: Save routine as a NEW copy */}
            {/* 
              Only shows if:
              1. routineId exists (routine is already saved)
              2. handleSaveAs callback provided
              
              Used for: Creating duplicate with different name
              Example workflow: Save "My Waltz" → Click Save As → Create "My Waltz (Copy)"
            */}
            {routineId && handleSaveAs && (
              <button
                onClick={handleSaveAs}  // User clicked: save as new routine
                disabled={isSaving}  // Disable while saving
                className="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 disabled:bg-gray-400 transition-colors font-medium text-xs"
              >
                Save As
              </button>
            )}
            {/* EXPORT BUTTON: Download routine as JSON file */}
            {/* 
              Creates a JSON file containing the entire routine
              User can share this file or back it up
              
              Example export content:
              {
                "name": "My Waltz",
                "dance_style": "waltz",
                "steps": [...],
                "created_at": "2026-03-16T..."
              }
            */}
            {handleExport && (
              <button
                onClick={handleExport}  // User clicked: download routine as JSON
                className="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors font-medium text-xs"
              >
                Export
              </button>
            )}
            {/* IMPORT BUTTON: Load routine from JSON file */}
            {/* 
              Two-part system:
              1. Hidden file input: User can't see it, but it opens file picker
              2. Visible "Import" button: Clicking it triggers the hidden file input
              
              Flow:
              1. User clicks "Import" button
              2. fileInputRef.current?.click() triggers hidden input
              3. Browser shows file picker dialog
              4. User selects JSON file
              5. onChange fires handleImport callback
              6. Parent (ChoreoPage) validates and loads the routine
            */}
            {handleImport && fileInputRef && (
              <>
                {/* Visible button that opens file picker */}
                <button
                  onClick={() => fileInputRef.current?.click()}  // Trigger hidden file input
                  className="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors font-medium text-xs"
                >
                  Import
                </button>
                
                {/* Hidden file input element */}
                {/* 
                  type="file": File picker input
                  accept=".json": Only show JSON files in file picker
                  ref={fileInputRef}: Parent stores this reference to .click() it
                  onChange={handleImport}: When file selected, call parent callback
                  className="hidden": Don't display this input (we use Import button instead)
                */}
                <input
                  ref={fileInputRef}  // Parent stores this reference
                  type="file"
                  accept=".json"  // File picker shows only .json files
                  onChange={handleImport}  // Called when user selects a file
                  className="hidden"  // Hide the default file input UI
                />
              </>
            )}
            {/* SAVE STATUS MESSAGE */}
            {/* 
              Shows feedback after save operation:
              - "Saving..." = currently saving
              - "✓ Saved" = success (auto-clears after 2 seconds in ChoreoPage)
              - "Failed to save" = error occurred
              
              ml-auto: Push this to the right side of the bar
            */}
            {saveStatus && (
              <span className="text-xs text-green-600 font-semibold ml-auto">{saveStatus}</span>
            )}
          </div>
        </div>
      )}

      {/* ============ SECTION 2: UNDO/REDO BUTTONS ============ */}
      {/* 
        Simple row of two buttons for history navigation
        Parent (ChoreoPage) manages the history stack, these buttons just call callbacks
      */}
      <div className="flex gap-2 mb-2">
        {/* UNDO BUTTON: Go back to previous state */}
        {/* 
          onUndo callback:
          - Parent checks if history.length > 0
          - If yes: moves current routine to future[], restores previous from history
          - If no: do nothing (can't undo if there's no history)
        */}
        <button
          onClick={onUndo}  // User clicked: undo last change
          className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300 transition-colors text-xs"
        >
          Undo
        </button>
        
        {/* REDO BUTTON: Go forward to next state */}
        {/* 
          onRedo callback:
          - Parent checks if future.length > 0
          - If yes: first item from future becomes current, current moves to history
          - If no: do nothing (can't redo if there's no future)
          
          Note: Future is cleared whenever user makes a new change
          Example: User does A, undoes to pre-A, does B
          At this point, "redo A again" is no longer possible
        */}
        <button
          onClick={onRedo}  // User clicked: redo last undone change
          className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300 transition-colors text-xs"
        >
          Redo
        </button>
      </div>

      {/* ============ SECTION 3: DROP ZONE & STEPS LIST ============ */}
      {/* 
        This is the main choreography workspace:
        - Drop zone: Where user drags figures from left panel
        - Steps list: Shows all figures in the routine with reorder capability
        
        Visual states:
        - Empty + not dragging: Gray text "Drag figures..."
        - Empty + dragging over: Blue highlight + "Drop here" message
        - Has steps: List of RoutineStepItem components (sortable)
      */}
      <div
        ref={setNodeRef}  // dnd-kit magic: This is the drop target
        // Visual feedback: Blue highlight when something is dragged over this zone
        className={`flex-1 border p-3 overflow-y-auto transition-all rounded ${
          isOver ? "bg-blue-50 border-blue-400 border-2" : "bg-white"  // isOver comes from useDroppable
        }`}
      >
        {/* ============ EMPTY STATE #1: No steps & not dragging ============ */}
        {/* Shows helpful hint to user */}
        {routine.length === 0 && !isOver && (
          <p className="text-gray-400 text-center py-8 text-sm">
            Drag figures from the left panel to build your routine
          </p>
        )}

        {/* ============ EMPTY STATE #2: No steps & dragging over ============ */}
        {/* Shows animated encouragement when user is dragging */}
        {routine.length === 0 && isOver && (
          <p className="text-blue-400 text-center py-8 animate-pulse font-medium text-sm">
            Drop a figure here to add it to your routine
          </p>
        )}

        {/* ============ STEPS LIST: Sortable container ============ */}
        {/* 
          SortableContext enables drag-to-reorder for all items inside
          
          Props:
          - items: Array of IDs that can be sorted (we pass stepIds)
          - strategy: How to arrange items during drag (verticalListSortingStrategy = vertical list)
          
          How it works:
          1. SortableContext watches for drag events on children
          2. When user drags step #2 below step #3
          3. Parent (ChoreoPage) gets handleDragEnd event
          4. Parent reorders array and calls onReorderSteps
          5. Component re-renders with new order
        */}
        <SortableContext
          items={routine.map(s => s.stepId)}  // IDs of sortable items
          strategy={verticalListSortingStrategy}  // Vertical list layout
        >
          {/* Render each step as a RoutineStepItem */}
          {routine.map((step, index) => (
            <RoutineStepItem
              key={step.stepId}  // React key: unique identifier for re-renders
              step={step}  // The RoutineStep object
              index={index}  // Position (0, 1, 2, etc.)
              total={routine.length}  // Total steps (for future features)
              onRemove={onRemoveStep}  // Callback: user clicked Remove
              onJump={onJumpToStep || (() => {})}  // Callback: user clicked step to preview
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
