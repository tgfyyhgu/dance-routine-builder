/**
 * PHASE 2: CHOREO PAGE (MAIN ORCHESTRATOR)
 * 
 * This is the CORE component that manages the entire choreography builder experience.
 * 
 * Think of it like the "conductor" in a band:
 * - It doesn't play music itself (that's what the UI components do)
 * - But it coordinates everything: data flow, state changes, database operations
 * - It passes data to child components and listens to their events
 * 
 * This page handles:
 * ├─ Loading figures from Supabase
 * ├─ Loading existing routines from Supabase
 * ├─ Managing undo/redo history
 * ├─ Drag & drop interactions
 * ├─ Adding/removing/reordering routine steps
 * ├─ Saving routines to Supabase
 * ├─ Exporting/importing routines as JSON
 * └─ Detecting unsaved changes
 */

"use client"

// ============ IMPORTS ============

// React hooks for state management and side effects
import { useEffect, useState, useRef } from "react"

// Next.js hooks for reading URL parameters
// useParams: reads dynamic route params like [dance]
// useSearchParams: reads query string params like ?routineId=123
import { useParams, useSearchParams } from "next/navigation"

// Next.js Link component for navigation
import Link from "next/link"

// Drag-and-drop library from dnd-kit
import { DndContext, DragEndEvent, pointerWithin } from "@dnd-kit/core"

// Database client from Supabase
import { supabase } from "@/lib/supabaseClient"

// Child components that render the UI
import RoutineBuilder from "@/components/RoutineBuilder"
import RoutinePlayer from "@/components/RoutinePlayer"
import FigurePanel from "@/components/FigurePanel"

// Data types (interfaces) from Phase 1
import { Figure, RoutineStep } from "@/types/routine"

// UUID library for generating unique IDs
import { v4 as uuid } from "uuid"

// Import/export utilities
import { exportRoutine } from "@/lib/routineExport"
import { importRoutine } from "@/lib/routineImport"

/**
 * MAIN COMPONENT: ChoreoPage
 * 
 * This component:
 * 1. Fetches data from Supabase (figures, existing routine)
 * 2. Manages all state (routine, undo/redo stack, UI state)
 * 3. Renders 3 child components in a 3-panel layout:
 *    - Left: FigurePanel (list of draggable figures)
 *    - Center: RoutineBuilder (where user builds the routine)
 *    - Right: RoutinePlayer (video preview of current step)
 */
export default function ChoreoPage() {
  // ============ URL PARAMETERS ============
  
  // Extract the dance style from URL route (/waltz/choreo, /tango/choreo, etc.)
  // Example: If URL is "localhost:3000/waltz/choreo", then dance = "waltz"
  const params = useParams()
  const searchParams = useSearchParams()
  const dance = params.dance as string
  
  // Extract routine ID from query string (/choreo?routineId=abc123)
  // If user is editing an existing routine, this will be set
  // If creating new routine, this will be null
  const routineIdFromUrl = searchParams.get("routineId")

  // ============ STATE: DATA FROM DATABASE ============
  
  /**
   * figures: All available figures for this dance style
   * Example for waltz: [
   *   { id: "1", name: "Feather Step", difficulty: 3, ... },
   *   { id: "2", name: "Natural Turn", difficulty: 2, ... },
   *   ...
   * ]
   * Loaded from Supabase "figures" table on first mount
   */
  const [figures, setFigures] = useState<Figure[]>([])
  
  // ============ STATE: UI PANELS ============
  
  /**
   * expanded: Which figure's video preview is expanded (or null if none)
   * In FigurePanel on the left, user can click a figure to expand its video
   * Only ONE figure can be expanded at a time
   * Example: expanded = "fig-123" means video for figure "fig-123" is showing
   */
  const [expanded, setExpanded] = useState<string | null>(null)
  
  /**
   * panelWidth: Width of the left FigurePanel in pixels
   * Default: 300px
   * User can drag the panel border to resize it to 120-500px
   * Why? So user can make the figure list narrower or wider based on preference
   */
  const [panelWidth, setPanelWidth] = useState(300)
  
  /**
   * collapsed: Is the FigurePanel completely hidden?
   * When panelWidth < 120px, automatically collapse the panel
   * User can toggle this to hide/show the entire figures list
   */
  const [collapsed, setCollapsed] = useState(false)

  // ============ STATE: THE ROUTINE (CORE DATA) ============
  
  /**
   * routine: The user's choreography sequence
   * This is the CURRENT state of what the user is building
   * 
   * Structure: Array of RoutineSteps in order
   * [
   *   { stepId: "step-1", figure: { id: "fig-1", name: "Feather", ... } },
   *   { stepId: "step-2", figure: { id: "fig-2", name: "Natural Turn", ... } },
   *   ...
   * ]
   * 
   * When user drags a figure into the builder, a new RoutineStep is added here
   * When user removes a step, it's deleted from here
   * When user reorders steps, this array is reordered
   * When user clicks Undo, this is replaced with value from history[]
   */
  const [routine, setRoutine] = useState<RoutineStep[]>([])
  
  /**
   * history: Stack of PAST routine states (for Undo)
   * 
   * Think of it like a "save points" system in a video game:
   * Every time user makes a change, the OLD state is saved here
   * 
   * Example:
   * User starts:         routine = []                    history = []
   * User adds step 1:    routine = [step1]               history = [[]]
   * User adds step 2:    routine = [step1, step2]        history = [[], [step1]]
   * User clicks Undo:    routine = [step1]               history = [[]]
   * 
   * When user undoes:
   *   Take the LAST item from history (previous state)
   *   Put current routine into future[] (for redo)
   *   Replace routine with the previous state
   */
  const [history, setHistory] = useState<RoutineStep[][]>([])
  
  /**
   * future: Stack of FORWARD routine states (for Redo)
   * 
   * After user undoes, Redo lets them go forward again
   * 
   * Example:
   * User is at:          routine = [step1]
   * User had added step2, then undone it
   * 
   * User clicks Redo:    
   *   - Take first item from future (which is [step1, step2])
   *   - Put current routine into history
   *   - Replace routine with the future state
   */
  const [future, setFuture] = useState<RoutineStep[][]>([])
  
  /**
   * currentStep: Which step is being previewed in the RoutinePlayer video?
   * Example: currentStep = 1 means "show the video for step at index 1"
   * User can click on a step in the builder to jump to it
   * Or RoutinePlayer can auto-advance when a video ends
   */
  const [currentStep, setCurrentStep] = useState(0)

  // ============ STATE: ROUTINE METADATA ============
  
  /**
   * routineName: User-given name for this routine
   * Default: "Untitled Routine"
   * Can be edited in the RoutineBuilder text input
   * Example: "Argentine Tango - Competition 2026"
   */
  const [routineName, setRoutineName] = useState("Untitled Routine")
  
  /**
   * routineId: Database ID of THIS routine (if it's been saved)
   * null = This is a NEW routine that hasn't been saved yet
   * string = This routine exists in Supabase with this ID
   * 
   * If user clicks "Save":
   *   - If routineId === null: Create new routine in Supabase, set routineId to the new ID
   *   - If routineId !== null: Update existing routine in Supabase
   */
  const [routineId, setRoutineId] = useState<string | null>(null)

  // ============ STATE: SAVING STATUS ============
  
  /**
   * isSaving: Is currently saving to Supabase?
   * true = "Save" button is disabled, loading spinner shows
   * false = Save operation finished (success or error)
   * 
   * Why? Prevent user from clicking Save multiple times while saving
   */
  const [isSaving, setIsSaving] = useState(false)
  
  /**
   * saveStatus: Message to show user after save attempt
   * "Saving..." = Currently saving
   * "✓ Saved" = Success (auto-clears after 2 seconds)
   * "Failed to save" = Error occurred
   * null = Nothing to show
   */
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  
  /**
   * hasUnsavedChanges: Has user modified the routine since last save?
   * true = Routine differs from last saved state, warning will show if they leave
   * false = All changes are saved
   * 
   * Used to:
   * - Show visual indicator to user ("unsaved changes")
   * - Warn if user tries to leave page without saving
   */
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // ============ REFS (Non-state data) ============
  
  /**
   * fileInputRef: Reference to hidden <input type="file"> element
   * Used for importing: fileInputRef.current.click() triggers file picker
   * Why useRef instead of state? Because we're not re-rendering when it changes
   * We just need to access the DOM element
   */
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  /**
   * lastSavedStateRef: What was the routine when we LAST saved to Supabase?
   * Used to detect if user has made unsaved changes
   * 
   * Logic:
   * - After save: lastSavedStateRef.current = routine
   * - User adds step: routine != lastSavedStateRef.current → hasUnsavedChanges = true
   * - User clicks save: lastSavedStateRef.current = routine again
   * 
   * We use useRef (not useState) because changing this doesn't need to re-render
   */
  const lastSavedStateRef = useRef<RoutineStep[]>([])

  // ============ EFFECT #1: Load Figures from Supabase on Page Mount ============
  
  /**
   * This effect runs ONCE when the page first loads (and when 'dance' changes)
   * 
   * Job: Fetch all available figures for the selected dance style
   * 
   * Dependency: [dance]
   * - If dance changes (user navigates to /tango/choreo from /waltz/choreo)
   * - This effect runs again with the new dance style
   * 
   * IMPROVED: Added error handling and loading state feedback
   */
  useEffect(() => {
    // Define async function (useEffect can't be async directly)
    async function load() {
      try {
        setFigures([])  // Clear old figures (visual loading state)
        setSaveStatus("Loading figures...")  // User feedback
        
        // IMPROVED ERROR HANDLING: Query with proper error checking
        const { data, error } = await supabase
          .from("figures")                        // Select "figures" table
          .select("*")                            // Get all columns
          .eq("dance_style", dance)               // Filter: only this dance style
          .order("name", { ascending: true })     // Sort alphabetically by name

        // Handle database errors
        if (error) {
          console.error("Error loading figures:", error)
          setSaveStatus("❌ Failed to load figures")
          setFigures([])
          return
        }

        // Success: save the results
        if (data) {
          setFigures(data)  // Now FigurePanel can display these
          setSaveStatus(null)  // Clear status message
        }
      } catch (err) {
        // Catch unexpected errors (network timeouts, JSON parsing, etc.)
        console.error("Unexpected error loading figures:", err)
        setSaveStatus("❌ Error loading figures")
        setFigures([])
      }
    }

    // Call the async function
    load()
  }, [dance])  // Re-run if dance parameter changes

  // ============ EFFECT #2: Load Existing Routine from Supabase (if editing) ============
  
  /**
   * This effect runs ONCE when page loads and routineIdFromUrl is available
   * 
   * Job: If user is editing an existing routine (URL has ?routineId=123),
   *      fetch that routine from Supabase and populate the builder
   * 
   * Dependency: [routineIdFromUrl]
   * - Only runs if routineIdFromUrl is set (not null)
   * - If user creates NEW routine, routineIdFromUrl is null, this doesn't run
   * 
   * IMPROVED: Added error handling and loading state feedback
   */
  useEffect(() => {
    async function loadRoutineFromDatabase() {
      // Exit early if no routine ID in URL (creating new routine)
      if (!routineIdFromUrl) return

      try {
        setSaveStatus("Loading routine...")  // User feedback
        
        // IMPROVED ERROR HANDLING: Query with proper error checking
        const { data, error } = await supabase
          .from("routines")                      // Select "routines" table
          .select("*")                           // Get all columns
          .eq("id", routineIdFromUrl)            // Filter: only matching ID
          .single()                              // Expect exactly 1 result (not an array)

        // If database query failed
        if (error) {
          console.error("Error loading routine:", error)
          setSaveStatus("❌ Failed to load routine")
          // Provide specific error message based on error type
          const errorMsg = error.code === "PGRST116" 
            ? "Routine not found - it may have been deleted" 
            : error.message || "Unknown error loading routine"
          alert(`Error loading routine: ${errorMsg}`)
          return
        }

        // If routine found, populate the builder with its data
        if (data) {
          setRoutineId(data.id)                          // Store the ID for updates
          setRoutineName(data.name)                      // Show the routine name
          setRoutine(data.steps || [])                   // Load the sequence of steps
          lastSavedStateRef.current = data.steps || []   // Mark this as "last saved"
          setHistory([])                                 // Clear undo history
          setFuture([])                                  // Clear redo history
          setCurrentStep(0)                              // Start at first step
          setHasUnsavedChanges(false)                    // No unsaved changes yet
          setSaveStatus("✓ Routine loaded")              // Success feedback
          setTimeout(() => setSaveStatus(null), 2000)    // Auto-clear message
        }
      } catch (error) {
        // Catch unexpected errors (network timeouts, JSON parsing, etc.)
        console.error("Unexpected error loading routine:", error)
        setSaveStatus("❌ Unexpected error loading routine")
        alert(`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    loadRoutineFromDatabase()
  }, [routineIdFromUrl])  // Only run if routineIdFromUrl changes

  // ============ EFFECT #3: Detect Unsaved Changes ============
  
  /**
   * This effect runs EVERY TIME routine changes
   * 
   * Job: Compare current routine with last saved state
   *      Set hasUnsavedChanges flag so we can warn user if they leave
   * 
   * How it works:
   * - JSON.stringify: Convert objects to strings to compare
   * - If strings don't match, user has made unsaved changes
   */
  useEffect(() => {
    // Compare current routine with what was last saved
    // JSON.stringify converts complex objects to strings (deep comparison)
    // Example: [step1, step2] becomes '[{"stepId":"123",...}...]'
    const routineChanged = JSON.stringify(routine) !== JSON.stringify(lastSavedStateRef.current)
    setHasUnsavedChanges(routineChanged)
  }, [routine])  // Re-run whenever routine changes

  // ============ EFFECT #4: Warn Before Leaving with Unsaved Changes ============
  
  /**
   * This effect runs EVERY TIME hasUnsavedChanges changes
   * 
   * Job: Show browser warning if user tries to close tab/navigate away with unsaved changes
   * Example: "You have unsaved changes. Leave anyway?"
   * 
   * How it works:
   * - Browser fires "beforeunload" event when user closes tab or navigates away
   * - We listen to this event and prevent default (show confirmation dialog)
   * - Cleanup: Remove listener when component unmounts
   */
  useEffect(() => {
    // Define the warning handler
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges) {
        e.preventDefault()  // Show browser confirmation
      }
    }

    // Register the handler to listen for page exit attempts
    globalThis.addEventListener("beforeunload", handleBeforeUnload)
    
    // Cleanup: Remove listener when component unmounts or effect re-runs
    // Why? Don't want multiple listeners stacking up
    return () => globalThis.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedChanges])  // Re-run if unsaved changes flag changes

  // ============ UNDO/REDO SYSTEM ============
  
  /**
   * Function: pushHistory
   * 
   * Purpose: Save the CURRENT state to history, then switch to the NEW state
   * Called every time user makes a change
   * 
   * Why separate? Because we always want:
   *   1. Save old state before changing
   *   2. Clear redo stack (user made a new change, old future is invalid)
   * 
   * Example flow:
   * Before: routine = [step1, step2], history = []
   * User adds step3:
   *   pushHistory([step1, step2, step3])
   * After:  routine = [step1, step2, step3], history = [[step1, step2]]
   */
  function pushHistory(newState: RoutineStep[]) {
    // Save current routine to history
    // Why prev => [...prev, routine]? Because we want to APPEND without mutating
    setHistory(prev => [...prev, routine])
    
    // Switch to the new state
    setRoutine(newState)
    
    // Clear future (user made a new change, old undone states are no longer valid)
    // Example: User did A, then B, undone to A, then did C
    // The "do B again" option is no longer valid
    setFuture([])
  }

  /**
   * Function: undo
   * 
   * Purpose: Go back one step in history
   * 
   * Steps:
   * 1. Get the LAST (most recent) item from history
   * 2. Move current routine to future (for redo)
   * 3. Replace routine with the historical state
   * 
   * Example:
   * Before undo:  routine = [step1, step2, step3],  history = [[step1], [step1, step2]],  future = []
   * After undo:   routine = [step1, step2],         history = [[step1]],                    future = [[step1, step2, step3]]
   * 
   * (User now sees the state BEFORE they added step3)
   */
  function undo() {
    // Can't undo if no history (already at the beginning)
    if (history.length === 0) return
    
    // Get the LAST item from history array
    // .at(-1) means "last element" (same as history[history.length - 1])
    const previous = history.at(-1)
    if (!previous) return  // Shouldn't happen, but safety check
    
    // Save current routine to future (user might redo)
    setFuture(f => [routine, ...f])
    
    // Remove that last history item (we're using it now)
    // .slice(0, -1) means "all items except the last one"
    // Example: [a, b, c].slice(0, -1) = [a, b]
    setHistory(h => h.slice(0, -1))
    
    // Switch to the previous state
    setRoutine(previous)
  }

  /**
   * Function: redo
   * 
   * Purpose: Go forward one step in history (opposite of undo)
   * Only works if user previously undone something
   * 
   * Steps:
   * 1. Get the FIRST item from future
   * 2. Move current routine to history (for undo)
   * 3. Replace routine with the future state
   * 
   * Example (continuing from undo example):
   * Before redo: routine = [step1, step2],  history = [[step1]],  future = [[step1, step2, step3]]
   * After redo:  routine = [step1, step2, step3],  history = [[step1], [step1, step2]],  future = []
   * 
   * (User sees step3 again after undoing)
   */
  function redo() {
    // Can't redo if no future (nothing to redo)
    if (future.length === 0) return
    
    // Get the FIRST item from future array
    // This is the next state to restore
    const next = future[0]
    
    // Remove it from future
    // .slice(1) means "everything except first element"
    // Example: [a, b, c].slice(1) = [b, c]
    setFuture(f => f.slice(1))
    
    // Add current routine to history (user might undo again)
    setHistory(h => [...h, routine])
    
    // Switch to the next state
    setRoutine(next)
  }

  // ============ STEP MANIPULATION ============
  
  /**
   * Function: addFigure
   * 
   * Purpose: Add a figure to the routine as a new step
   * Called when user drags a figure from FigurePanel into RoutineBuilder
   * 
   * What happens:
   * 1. Create a new RoutineStep wrapping the figure
   * 2. Give it a unique ID using uuid()
   * 3. Append to routine array
   * 4. Save old routine to history (for undo)
   * 
   * Example:
   * User has routine: [step1: "Feather"]
   * User drags "Natural Turn" figure, addFigure called with that figure
   * Result:   routine: [step1: "Feather", step2: "Natural Turn"]
   */
  function addFigure(fig: Figure) {
    // Create new RoutineStep:
    // - stepId: Unique identifier for this step (uuid() generates random unique ID)
    // - figure: The figure being added
    // Example: { stepId: "e4d11e57-3c72-42ae-a2a0-1c2932e9dac5", figure: { ...} }
    
    // Create new array with the new step appended
    // [...routine, newStep] creates array without modifying original
    const newRoutine = [...routine, { stepId: uuid(), figure: fig }]
    
    // Call pushHistory to:
    // - Save current routine to history (for undo)
    // - Switch to new routine
    // - Clear future (user made new change)
    pushHistory(newRoutine)
  }

  /**
   * Function: removeStep
   * 
   * Purpose: Remove a step from the routine by its stepId
   * Called when user clicks "Remove" button on a step
   * 
   * What happens:
   * 1. Filter out the step with matching stepId
   * 2. Save old routine to history (for undo)
   * 
   * Example:
   * User has routine: [step1: "Feather", step2: "Natural Turn", step3: "Chase"]
   * User clicks Remove on step2
   * Result: routine: [step1: "Feather", step3: "Chase"]
   * 
   * Note: step3 stays as step3; the stepId doesn't change
   * Only the position in the array changes
   */
  function removeStep(stepId: string) {
    // Filter creates new array with only steps that DON'T match this ID
    // s.stepId !== stepId means "keep if stepId is different"
    // Example: If removing step2 from [step1, step2, step3]
    //          Filter keeps: step1 (✓), step2 (✗), step3 (✓)
    //          Result: [step1, step3]
    const newRoutine = routine.filter(s => s.stepId !== stepId)
    
    // Save to history and switch to new state
    pushHistory(newRoutine)
  }

  /**
   * Function: reorderSteps
   * 
   * Purpose: Update routine with reordered steps (from drag & drop)
   * Called when user reorders steps in RoutineBuilder
   * 
   * What happens:
   * 1. Accept new routine with different order
   * 2. Save to history (for undo)
   * 
   * Example:
   * User has: [step1, step2, step3]
   * User drags step2 below step3
   * Result:   [step1, step3, step2]
   * 
   * Note: Unlike addFigure/removeStep, we just accept new order
   * The drag-drop logic already figured out the new positions
   */
  function reorderSteps(newRoutine: RoutineStep[]) {
    // Just pass the reordered array to pushHistory
    // We don't need to manipulate it; drag & drop already did that
    pushHistory(newRoutine)
  }

  // ============ DRAG & DROP HANDLER ============
  
  /**
   * Function: handleDragEnd
   * 
   * Purpose: Process drag-drop event from DndContext
   * This is the CORE of the user interaction logic
   * 
   * Two scenarios:
   * 1. User is REORDERING existing steps (dragging step to new position)
   * 2. User is ADDING new figure (dragging from FigurePanel into builder)
   * 
   * How we tell the difference:
   * - If draggedId matches a step's stepId → it's reordering
   * - If draggedId matches a figure's ID → it's adding
   */
  function handleDragEnd(event: DragEndEvent) {
    // Destructure the drag event
    // active: What was being dragged (id = stepId or figure.id)
    // over: Where it was dropped (id = target step or "routine-droppable" drop zone)
    const { active, over } = event
    const draggedId = active.id as string

    // ============ SCENARIO 1: IS THIS AN INTERNAL REORDER? ============
    // Check if the dragged item is already a step in the routine
    
    // Find which index has this stepId
    // findIndex returns -1 if not found (meaning it's not a step)
    // findIndex returns 0+ if found (meaning it IS a step in routine)
    const draggedIndex = routine.findIndex(s => s.stepId === draggedId)
    
    // If draggedIndex !== -1, this is a step being reordered
    if (draggedIndex !== -1) {
      // User is dragging an existing step to a new position
      // over?.id is either a step's stepId or "routine-droppable"
      
      // If over?.id is "routine-droppable" (generic drop zone), don't reorder
      // This happens if user drags step outside the list (but above/below nothing specific)
      if (over?.id && over.id !== "routine-droppable") {
        // Find the target step's index (where user wants to drop)
        const targetIndex = routine.findIndex(s => s.stepId === over.id)
        
        // Only reorder if:
        // - Target found (targetIndex !== -1)
        // - Target is different from current position
        if (targetIndex !== -1 && draggedIndex !== targetIndex) {
          // Create a copy of routine (don't mutate original)
          const newRoutine = [...routine]
          
          // Remove the dragged step from its position
          // .splice(draggedIndex, 1) removes 1 item at draggedIndex
          // It also RETURNS the removed item in an array
          // [removed] destructures to get the first (only) item
          // Example: removing index 1 from [a, b, c] → returns [b], newRoutine becomes [a, c]
          const [removed] = newRoutine.splice(draggedIndex, 1)
          
          // Calculate where to INSERT the removed step
          // If we moved the step DOWN (dragging from 1 to 3):
          //   - Original: [a, b, c, d] (step at index 1)
          //   - After remove: [a, c, d]
          //   - Insert at index 2 (targetIndex 3 - 1)
          //   - Result: [a, c, b, d] ✓
          //
          // If we moved the step UP (dragging from 3 to 1):
          //   - Original: [a, b, c, d] (step at index 3)
          //   - After remove: [a, b, c]
          //   - Insert at index 1 (targetIndex 1, no adjustment needed)
          //   - Result: [a, d, b, c] ✓
          const insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex
          
          // Insert the step at the new position
          // .splice(insertIndex, 0, removed) inserts at insertIndex without removing
          newRoutine.splice(insertIndex, 0, removed)
          
          // Update state with reordered routine
          reorderSteps(newRoutine)
        }
      }
      // Exit the function (don't try scenario 2)
      return
    }

    // ============ SCENARIO 2: ADDING A NEW FIGURE FROM PANEL ============
    // If we reach here, draggedId is a figure.id, not a step.id
    // 
    // IMPROVED DROP DETECTION:
    // Using pointerWithin collision detection means DROP SUCCEEDS if cursor is over the builder,
    // regardless of whether the entire figure box is within bounds.
    // 
    // This makes drag-drop more forgiving and intuitive:
    // - User doesn't need to drag entire figure box into middle area
    // - Just needs to have cursor pointer over the builder zone
    // - Works even if figure card extends partially outside the drop zone
    
    // Check if drop was over the main drop zone "routine-droppable"
    if (over?.id === "routine-droppable") {
      // Get the figure from the figures list
      const figureId = draggedId
      const figure = figures.find(f => f.id === figureId)
      
      // If figure found, add it to routine
      if (figure) {
        addFigure(figure)
      }
    }
  }

  // ============ UI INTERACTION HANDLERS ============
  
  /**
   * Function: toggleExpand
   * 
   * Purpose: Show/hide the video preview for a specific figure in FigurePanel
   * Only one figure's video can be expanded at a time
   * 
   * Logic:
   * - If clicking a figure that's ALREADY expanded, collapse it
   * - If clicking a figure that's NOT expanded, expand it (& collapse others)
   * 
   * Example:
   * expanded = null
   * User clicks figure "abc" → toggleExpand("abc") → expanded = "abc"
   * User clicks figure "abc" again → toggleExpand("abc") → expanded = null
   * User clicks figure "def" → toggleExpand("def") → expanded = "def" (abc auto-closes)
   */
  function toggleExpand(id: string) {
    // If clicking the SAME figure that's already expanded, close it
    if (expanded === id) {
      setExpanded(null)
    } else {
      // Otherwise, open this one (automatically closing the previous one)
      setExpanded(id)
    }
  }

  /**
   * Function: startResize
   * 
   * Purpose: Handle the drag-to-resize behavior for the left FigurePanel
   * User clicks and drags the vertical border to change panel width
   * 
   * Steps:
   * 1. Record starting mouse position (e.clientX)
   * 2. Record current panel width
   * 3. Listen to mousemove: update width based on how far mouse moved
   * 4. Listen to mouseup: stop listening when user releases
   * 
   * Behavior:
   * - If width < 120px, auto-collapse the panel
   * - Max width is 500px
   */
  function startResize(e: React.MouseEvent) {
    // Record starting position
    // e.clientX = mouse X position (in pixels from left edge of screen)
    const startX = e.clientX
    
    // Record current panel width
    const startWidth = panelWidth

    // ============ MOUSE MOVE EVENT ============
    // This function runs EVERY time mouse moves (hundreds of times per second)
    function onMove(e: MouseEvent) {
      // Calculate how far mouse moved horizontally
      // (e.clientX - startX) = positive if moved RIGHT, negative if moved LEFT
      // Examples:
      //   - Moved 50px right: 50 + 300 = 350
      //   - Moved 100px left: -100 + 300 = 200
      const newWidth = startWidth + (e.clientX - startX)

      // If width too small (< 120px), auto-collapse
      if (newWidth < 120) {
        setCollapsed(true)
      } else {
        // Width is acceptable, expand and set width
        setCollapsed(false)
        // Math.min(newWidth, 500) ensures width never exceeds 500px
        // Examples:
        //   - newWidth = 350 → Math.min(350, 500) = 350 ✓
        //   - newWidth = 600 → Math.min(600, 500) = 500 (capped)
        setPanelWidth(Math.min(newWidth, 500))
      }
    }

    // ============ MOUSE UP EVENT ============
    // This function runs when user releases the mouse button
    function stop() {
      // Stop listening to mousemove
      globalThis.removeEventListener("mousemove", onMove)
      // Stop listening to mouseup
      globalThis.removeEventListener("mouseup", stop)
      // Now user can release mouse without any more size changes
    }

    // Start listening to mousemove and mouseup at global level
    // Why globalThis? Because if user drags VERY fast outside the panel,
    // we still want to track the mouse position
    globalThis.addEventListener("mousemove", onMove)
    globalThis.addEventListener("mouseup", stop)
  }

  // ============ SAVE/LOAD OPERATIONS ============
  
  /**
   * Function: saveRoutine
   * 
   * Purpose: Save the current routine to Supabase database
   * Creates NEW routine if routineId is null
   * Updates EXISTING routine if routineId is set
   * 
   * Flow:
   * 1. Validate routine name is not empty
   * 2. Warn if saving with default "Untitled Routine" name
   * 3. Prepare routine data object
   * 4. Call Supabase:
   *    - If new: INSERT with generated UUID
   *    - If existing: UPDATE where id matches
   * 5. Update local state:
   *    - Set routineId (if new)
   *    - Clear unsaved changes flag
   *    - Show success message for 2 seconds
   */
  async function saveRoutine() {
    // Validate: routine name must not be empty or whitespace
    const trimmedName = routineName.trim()
    if (!trimmedName) {
      // IMPROVED ERROR HANDLING: Use saveStatus instead of alert for inline feedback
      setSaveStatus("❌ Name required")
      setTimeout(() => setSaveStatus(null), 3000)
      return  // Exit early if validation fails
    }

    // Warn if user is saving with the default "Untitled Routine" name
    // This is a courtesy to remind them they should use a real name
    if (trimmedName === "Untitled Routine") {
      // confirm() shows a dialog with OK/Cancel buttons
      // Returns true if user clicks OK, false if Cancel
      const confirmed = confirm(
        "Your routine is still named 'Untitled Routine'. Are you sure you want to save it with this name?"
      )
      if (!confirmed) return  // User clicked Cancel, abort save
    }

    // Show saving status to user
    setIsSaving(true)
    setSaveStatus("Saving...")

    try {
      // Prepare the data object to send to Supabase
      const routineData = {
        name: routineName,           // User-given name
        dance_style: dance,          // waltz, tango, etc. (from URL)
        steps: routine,              // The choreography sequence
        created_at: new Date().toISOString(),  // Timestamp
      }

      // Check if this is a NEW routine or UPDATE to existing
      if (routineId === null) {
        // ============ NEW ROUTINE: INSERT ============
        // Generate a unique ID for this new routine
        const newId = uuid()
        
        // Insert into Supabase "routines" table
        const { error } = await supabase.from("routines").insert([
          {
            id: newId,           // Use generated ID
            ...routineData,      // Spread operator: add all properties from routineData
          },
        ])

        // IMPROVED ERROR HANDLING: Provide specific error messages based on error type
        if (error) {
          console.error("Error saving routine:", error)
          setSaveStatus("❌ Failed to save")
          // Parse error and show user-friendly message
          const errorMsg = error.message?.includes("duplicate") 
            ? "A routine with this name already exists" 
            : error.message || "Unknown error occurred"
          alert(`Error saving routine: ${errorMsg}`)
          return
        }

        // Success! Update local state
        setRoutineId(newId)  // Now this routine has an ID (for future updates)
        setSaveStatus("✓ Saved")
      } else {
        // ============ EXISTING ROUTINE: UPDATE ============
        // Update the existing routine in Supabase
        const { error } = await supabase
          .from("routines")
          .update(routineData)
          .eq("id", routineId)  // Filter: only update where id matches

        // IMPROVED ERROR HANDLING: Network and database error handling
        if (error) {
          console.error("Error updating routine:", error)
          setSaveStatus("❌ Failed to save")
          const errorMsg = error.message || "Failed to update routine"
          alert(`Error updating routine: ${errorMsg}`)
          return
        }

        // Success!
        setSaveStatus("✓ Saved")
      }

      // Both new and update succeeded
      // Update "last saved" reference so unsaved changes detection works
      lastSavedStateRef.current = routine
      setHasUnsavedChanges(false)

      // Auto-clear the success message after 2 seconds
      // Why? So it doesn't clutter the UI permanently
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (err) {
      // IMPROVED ERROR HANDLING: Catch unexpected errors (network timeouts, JSON parsing, etc.)
      console.error("Unexpected error saving routine:", err)
      setSaveStatus("❌ Unexpected error")
      alert(`Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      // Always run this, whether save succeeded or failed
      // Cleanup: stop showing "saving" state
      setIsSaving(false)
    }
  }

  /**
   * Function: handleSaveAs
   * 
   * Purpose: Save current routine as a NEW routine (duplicate)
   * Similar to "Save As" in desktop apps
   * 
   * Flow:
   * 1. Prompt user for new name
   * 2. Generate new ID
   * 3. INSERT into Supabase (always insert, never update)
   * 4. Update local state (set new routineId, name)
   * 
   * Difference from saveRoutine:
   * - saveRoutine: Updates existing or creates new based on routineId
   * - handleSaveAs: ALWAYS creates new, current routine stays in memory
   */
  async function handleSaveAs() {
    // Validate current name before proceeding
    if (!routineName.trim()) {
      alert("Please enter a routine name")
      return
    }

    // Prompt user for NEW name
    // prompt() returns the input string or null if user clicks Cancel
    // Default suggestion: current name + " (Copy)"
    const newName = prompt("Save routine with a new name:", routineName + " (Copy)")
    if (newName === null) return // User clicked Cancel

    // Validate the new name
    if (!newName.trim()) {
      alert("Please enter a routine name")
      return
    }

    // Similar to saveRoutine, show saving status
    setIsSaving(true)
    setSaveStatus("Saving as new...")

    try {
      // Generate ID for new routine
      const newId = uuid()
      
      // Prepare data for new routine
      const routineData = {
        id: newId,
        name: newName,               // Use the new name user entered
        dance_style: dance,
        steps: routine,
        created_at: new Date().toISOString(),
      }

      // INSERT as new routine (never update)
      const { error } = await supabase.from("routines").insert([routineData])

      // IMPROVED ERROR HANDLING: Specific error messages
      if (error) {
        console.error("Error saving routine:", error)
        setSaveStatus("❌ Failed to save")
        const errorMsg = error.message?.includes("duplicate")
          ? "A routine with this name already exists"
          : error.message || "Unknown error"
        alert(`Error saving routine: ${errorMsg}`)
        return
      }

      // Success! Update local state so future edits update this new routine
      setRoutineId(newId)
      setRoutineName(newName)
      setSaveStatus("✓ Saved as new")

      // Auto-clear success message
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (err) {
      // IMPROVED ERROR HANDLING: Catch unexpected errors
      console.error("Unexpected error saving routine:", err)
      setSaveStatus("❌ Unexpected error")
      alert(`Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Function: handleNewRoutine
   * 
   * Purpose: Start a brand new routine (clear everything)
   * Called when user clicks "New" button
   * 
   * Behavior:
   * - If there are unsaved changes, ask user for confirmation
   * - Reset all state to defaults
   * - Clear history/future stacks
   * 
   * Example scenario:
   * User was editing "Waltz Variation 1"
   * Click "New" → "Are you sure?" confirmation
   * If yes → everything clears, ready to build new routine
   */
  function handleNewRoutine() {
    // Check for unsaved changes
    if (hasUnsavedChanges) {
      // Ask user if they REALLY want to lose their work
      const confirmed = confirm(
        "You have unsaved changes. Are you sure you want to start a new routine?"
      )
      if (!confirmed) return  // User said "no", abort
    }

    // Reset everything to defaults
    setRoutineName("Untitled Routine")
    setRoutineId(null)                  // Not linked to any routine in database
    setRoutine([])                      // Empty choreography
    setHistory([])                      // Clear undo stack
    setFuture([])                       // Clear redo stack
    setCurrentStep(0)                   // Start at first step
    lastSavedStateRef.current = []      // Nothing has been "saved" yet
    setHasUnsavedChanges(false)         // No changes yet
  }

  /**
   * Function: handleExport
   * 
   * Purpose: Download the current routine as a JSON file
   * User can share this file with others or back it up
   * 
   * Flow:
   * 1. Check if routine is empty (can't export nothing)
   * 2. Call exportRoutine() from lib/routineExport.ts
   * 3. Browser downloads file named "{routineName}.json"
   * 
   * File content:
   * {
   *   "name": "My Waltz",
   *   "dance_style": "waltz",
   *   "steps": [...],
   *   "created_at": "2026-03-16T..."
   * }
   * 
   * User can later import this file to restore the routine
   */
  function handleExport() {
    // Prevent exporting empty routines (not useful)
    if (routine.length === 0) {
      alert("Routine is empty. Add some figures before exporting.")
      return
    }

    // Call the export utility function
    // It will create a Blob and trigger browser download
    exportRoutine({
      name: routineName || "Routine",
      dance_style: dance,
      steps: routine,
      created_at: new Date().toISOString(),
    })
    // Browser automatically downloads file as "{routineName}.json"
  }

  /**
   * Function: handleImport
   * 
   * Purpose: Load a routine from a JSON file the user selects
   * User uploads a previously exported routine
   * 
   * Flow:
   * 1. Get the file user selected (from file input)
   * 2. Parse JSON using importRoutine() utility
   * 3. Validate the imported data:
   *    - Must have "steps" array
   *    - All figures must exist in this dance's figures library
   * 4. Load into builder or show error
   * 
   * Why validation? 
   * - JSON might be corrupted or from wrong dance style
   * - Figures might not exist in current dance database
   * 
   * After import:
   * - Routine loaded into builder
   * - routineId set to null (saves as NEW, not updating existing)
   * - User can edit and save
   */
  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    // Get the file from the file input element
    // event.target.files = list of files user selected
    // ?.[0] = first file (safe access, returns undefined if none)
    const file = event.target.files?.[0]
    if (!file) return  // User clicked cancel, no file selected

    try {
      setSaveStatus("Loading file...")  // LOADING STATE: User feedback
      
      // Parse the JSON file using utility function
      const importedRoutine = await importRoutine(file)
      
      // ============ VALIDATION #1: Check structure ============
      // Imported data MUST have steps array
      if (!importedRoutine.steps || !Array.isArray(importedRoutine.steps)) {
        setSaveStatus("❌ Invalid file format")
        alert("Invalid routine file: missing steps data")
        return
      }

      // ============ VALIDATION #2: Check all figures exist ============
      // Every figure in the routine must exist in current dance's figures
      const importedSteps = importedRoutine.steps as RoutineStep[]
      const missingFigures: string[] = []

      // Loop through each step and check if its figure exists
      for (const step of importedSteps) {
        // figures.some(f => f.id === step.figure.id)
        // Is there ANY figure in our library with this ID?
        // If no, add to missing list
        if (!figures.some(f => f.id === step.figure.id)) {
          missingFigures.push(step.figure.name)
        }
      }

      // If ANY figures are missing, tell user and abort
      if (missingFigures.length > 0) {
        setSaveStatus("❌ Missing figures")
        alert(
          `The following figures are not available in this dance style:\n${missingFigures.join("\n")}\n\nPlease add them to the figures library first.`
        )
        return
      }

      // ============ ALL VALIDATIONS PASSED: LOAD THE ROUTINE ============
      // Load the imported routine into the builder
      setRoutineName(importedRoutine.name || "Imported Routine")
      setRoutine(importedSteps)
      setHistory([])                    // Clear undo history
      setFuture([])                     // Clear redo history
      setCurrentStep(0)                 // Start at first step
      setRoutineId(null)                // Set to null so "Save" creates new routine
      
      // IMPROVED FEEDBACK: Use status message instead of alert
      setSaveStatus("✓ Imported successfully")
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      // IMPROVED ERROR HANDLING: If anything goes wrong (invalid JSON, file read error, etc.)
      console.error("Error importing routine:", error)
      setSaveStatus("❌ Import failed")
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      alert(`Error importing routine: ${errorMsg}`)
    } finally {
      // Cleanup: Reset the file input
      // Why? So user can select the SAME file again if they want
      // Without this, selecting same file twice wouldn't trigger change event
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // ============ RENDER: UI LAYOUT ============
  
  /**
   * This is the final return statement that renders the entire choreography builder UI
   * 
   * Layout structure (visual):
   * ┌─────────────────────────────────────────────────┐
   * │          Navigation Header                       │  <- Shows dance name, links
   * ├────────┬──────────────────────────────────────┤
   * │        │                                        │
   * │ Figure │      CENTER CONTENT (2-column)       │
   * │ Panel  │  ┌─────────────┬────────────────────┐ │
   * │ LEFT   │  │   Builder   │     Video          │ │
   * │        │  │   (steps)   │    Preview         │ │
   * │ ←drag  │  │             │    (player)        │ │
   * │        │  └─────────────┴────────────────────┘ │
   * └────────┴──────────────────────────────────────┘
   * 
   * Component tree:
   * - DndContext (provides drag-drop functionality for entire page)
   *   - div (outer container, flex layout, full screen height)
   *     - Header navigation bar
   *     - div (flex container for panels)
   *       - FigurePanel (left side, draggable figures)
   *       - div (flex container, center+right)
   *         - RoutineBuilder (center, where user builds)
   *         - RoutinePlayer (right, video preview)
   */
  return (
    // ============ DRAG & DROP CONTEXT ============
    // DndContext enables drag-drop functionality for the entire page
    // collisionDetection={pointerWithin}: Algorithm for detecting if cursor is within drop zone
    //   - pointerWithin checks if the CURSOR POINTER is inside droppable boundaries
    //   - More lenient than closestCenter (which required element center to be near center)
    //   - Now users can drop anywhere the cursor is over the builder, even if figure box extends outside
    // onDragEnd={handleDragEnd}: Callback function when user finishes dragging
    <DndContext collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      {/* OUTER CONTAINER: Full screen flex layout (vertical) */}
      <div className="flex h-screen flex-col">
        
        {/* ============ HEADER SECTION ============ */}
        {/* 
          Shows the dance style name and navigation links
          border-b: Bottom border separator
          bg-white: White background
          px-6 py-3: Padding inside
        */}
        <div className="border-b bg-white px-6 py-3">
          <div className="flex justify-between items-center">
            {/* Left: Dance name (waltz, tango, etc.) */}
            <h1 className="text-lg font-bold">{dance.toUpperCase()} - Choreography Builder</h1>
            
            {/* Right: Navigation buttons */}
            <div className="flex gap-2">
              {/* Button to view all saved routines */}
              <Link 
                href="/my-routines"
                className="bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600 transition-colors font-medium text-xs"
              >
                📖 My Routines
              </Link>
              
              {/* Button to manage figures for this dance */}
              <Link 
                href={`/${dance}/figures`}
                className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors font-medium text-xs"
              >
                📚 Manage Figures
              </Link>
            </div>
          </div>
        </div>

        {/* ============ MAIN CONTENT AREA ============ */}
        {/* 
          flex flex-1: Take remaining space after header
          overflow-hidden: Hide scrollbars, let child components handle scrolling
        */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* ============ LEFT PANEL: FIGURES ============ */}
          {/* 
            FigurePanel shows the library of figures user can drag
            Props:
            - figures: List of available figures for this dance
            - panelWidth: Current width in pixels (can be resized)
            - collapsed: Is panel hidden?
            - expanded: Which figure's video preview is expanded (if any)
            - onToggleExpand: Callback when user clicks to expand/collapse a video
            - onAddFigure: Callback when user drags a figure (not used here, drag-drop handles it)
            - onStartResize: Callback when user starts dragging panel border to resize
            - onCollapse: Callback to toggle panel visibility
          */}
          <FigurePanel
            figures={figures}
            panelWidth={panelWidth}
            collapsed={collapsed}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            onAddFigure={addFigure}
            onStartResize={startResize}
            onCollapse={() => setCollapsed(!collapsed)}
          />

          {/* ============ CENTER & RIGHT PANELS ============ */}
          {/* 
            flex-1: Take all remaining horizontal space
            flex flex-col: Layout children vertically
          */}
          <div className="flex-1 flex flex-col">
            {/* 
              Grid: 2 columns (builder on left, preview on right)
              gap-3: Space between columns
              p-4: Padding inside
              flex-1: Take remaining vertical space
              overflow-hidden: Let child components handle scrolling
            */}
            <div className="grid grid-cols-2 gap-3 p-4 flex-1 overflow-hidden">
              
              {/* ============ CENTER PANEL: ROUTINE BUILDER ============ */}
              {/* 
                flex flex-col: Stack items vertically
                min-w-0: Allow text overflow instead of pushing column wider
              */}
              <div className="flex flex-col min-w-0">
                {/* 
                  RoutineBuilder: The choreography editor
                  Props explained:
                  
                  State data:
                  - routine: Array of steps user has added
                  - routineName: Name of the routine (editable)
                  - routineId: ID if saved, null if new
                  - isSaving: Is currently saving?
                  - saveStatus: "Saving...", "✓ Saved", etc.
                  
                  Callbacks:
                  - onRemoveStep: User clicked remove button on a step
                  - onReorderSteps: User reordered steps via drag
                  - onUndo/onRedo: User clicked undo/redo
                  - onJumpToStep: User clicked a step to preview it
                  - setRoutineName: User edited the name
                  - saveRoutine: User clicked Save button
                  - handleSaveAs: User clicked Save As button
                  - handleExport/handleImport: User clicked export/import buttons
                  - handleNewRoutine: User clicked New button
                  - fileInputRef: Hidden file input element
                */}
                <RoutineBuilder
                  routine={routine}
                  onRemoveStep={removeStep}
                  onReorderSteps={reorderSteps}
                  onUndo={undo}
                  onRedo={redo}
                  onJumpToStep={setCurrentStep}
                  routineName={routineName}
                  setRoutineName={setRoutineName}
                  saveRoutine={saveRoutine}
                  handleSaveAs={handleSaveAs}
                  handleExport={handleExport}
                  handleImport={handleImport}
                  isSaving={isSaving}
                  saveStatus={saveStatus}
                  routineId={routineId}
                  handleNewRoutine={handleNewRoutine}
                  fileInputRef={fileInputRef}
                />
              </div>

              {/* ============ RIGHT PANEL: VIDEO PREVIEW ============ */}
              {/* 
                Shows the YouTube video for the currently selected step
                User can watch the video and auto-play through all steps
              */}
              <div className="flex flex-col min-w-0">
                {/* Section title */}
                <h2 className="font-bold mb-2 text-sm">Preview</h2>
                
                {/* 
                  RoutinePlayer: YouTube video player
                  Props:
                  - steps: The routine steps (needed to get figure/video for current step)
                  - currentStep: Which step to show video for (0 = first, 1 = second, etc.)
                  - onStepChange: Callback when user changes step (from player controls or auto-advance)
                */}
                <RoutinePlayer
                  steps={routine}
                  currentStep={currentStep}
                  onStepChange={setCurrentStep}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  )
}