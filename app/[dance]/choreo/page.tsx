/**
 * Main choreography builder orchestrator.
 * Manages state (routine, undo/redo, figures), Supabase operations, and 3-panel layout.
 */

"use client"

// React hooks
import { useEffect, useState, useRef } from "react"
// Next.js routing
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
// Drag & drop
import { DndContext, DragEndEvent, pointerWithin, useSensor, useSensors, MouseSensor, TouchSensor } from "@dnd-kit/core"
// Database
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/lib/AuthContext"
// Components
import RoutineBuilder from "@/components/RoutineBuilder"
import RoutinePlayer from "@/components/RoutinePlayer"
import FigurePanel from "@/components/FigurePanel"
import Header from "@/components/Header"
// Types & utilities
import { Figure, RoutineStep } from "@/types/routine"
import { v4 as uuid } from "uuid"
import { exportRoutine } from "@/lib/routineExport"
import { importRoutine } from "@/lib/routineImport"
import { createShareLink, revokeShare, updateRoutineVisibility } from "@/lib/sharing"

/**
 * 3-panel choreography editor: left (figures), center (builder), right (player).
 */
export default function ChoreoPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const dance = params.dance as string
  const routineIdFromUrl = searchParams.get("routineId")
  const { user } = useAuth()

  // State: UI & data
  const [figures, setFigures] = useState<Figure[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [panelWidth, setPanelWidth] = useState(300)
  const [collapsed, setCollapsed] = useState(false)
  // State: routine & history
  const [routine, setRoutine] = useState<RoutineStep[]>([])
  const [history, setHistory] = useState<RoutineStep[][]>([])
  const [future, setFuture] = useState<RoutineStep[][]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [repeatMode, setRepeatMode] = useState<'repeat1' | 'repeatAll'>('repeatAll')

  // Routine metadata
  const [routineName, setRoutineName] = useState("Untitled Routine")
  const [routineId, setRoutineId] = useState<string | null>(null)  // null = new routine, string = saved to Supabase
  
  // Sharing state
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isSharing, setIsSharing] = useState(false)

  // Saving status
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)  // "Saving...", "✓ Saved", or error message
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)  // Tracks if routine differs from last saved state

  // Refs for direct DOM and state tracking
  const fileInputRef = useRef<HTMLInputElement>(null)  // Hidden file input for import
  const lastSavedStateRef = useRef<RoutineStep[]>([])  // Tracks last saved state for unsaved changes detection

  // Load figures for selected dance style
  useEffect(() => {
    async function load() {
      try {
        setFigures([])
        setSaveStatus("Loading figures...")
        
        const { data, error } = await supabase
          .from("figures")
          .select("*")
          .eq("dance_style", dance)
          .order("name", { ascending: true })

        if (error) {
          console.error("Error loading figures:", error)
          setSaveStatus("❌ Failed to load figures")
          setFigures([])
          return
        }
        if (data) {
          setFigures(data)
          setSaveStatus(null)
        }
      } catch (err) {
        console.error("Unexpected error loading figures:", err)
        setSaveStatus("❌ Error loading figures")
        setFigures([])
      }
    }
    load()
  }, [dance])

  // Load existing routine if editing
  useEffect(() => {
    async function loadRoutineFromDatabase() {
      if (!routineIdFromUrl) return
      try {
        setSaveStatus("Loading routine...")
        const { data, error } = await supabase
          .from("routines")
          .select("*")
          .eq("id", routineIdFromUrl)
          .single()

        if (error) {
          console.error("Error loading routine:", error)
          setSaveStatus("❌ Failed to load routine")
          const errorMsg = error.code === "PGRST116" 
            ? "Routine not found - it may have been deleted" 
            : error.message || "Unknown error loading routine"
          alert(`Error loading routine: ${errorMsg}`)
          return
        }
        if (data) {
          setRoutineId(data.id)
          setRoutineName(data.name)
          setRoutine(data.steps || [])
          setVisibility(data.visibility || 'private')
          lastSavedStateRef.current = data.steps || []
          setHistory([])
          setFuture([])
          setCurrentStep(0)
          setHasUnsavedChanges(false)
          
          // Load existing share token if it exists
          try {
            const { data: shareData } = await supabase
              .from('shares')
              .select('token')
              .eq('resource_id', data.id)
              .eq('type', 'routine')
              .single()
            
            if (shareData) {
              setShareToken(shareData.token)
              setShareUrl(`${window.location.origin}/share/${shareData.token}`)
            }
          } catch (err) {
            // No share exists, that's fine
            setShareToken(null)
            setShareUrl(null)
          }
          
          setSaveStatus("✓ Routine loaded")
          setTimeout(() => setSaveStatus(null), 2000)
        }
      } catch (error) {
        console.error("Unexpected error loading routine:", error)
        setSaveStatus("❌ Unexpected error loading routine")
        alert(`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }
    loadRoutineFromDatabase()
  }, [routineIdFromUrl])

  // Detect unsaved changes
  useEffect(() => {
    const routineChanged = JSON.stringify(routine) !== JSON.stringify(lastSavedStateRef.current)
    setHasUnsavedChanges(routineChanged)
  }, [routine])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges) {
        e.preventDefault()
      }
    }
    globalThis.addEventListener("beforeunload", handleBeforeUnload)
    return () => globalThis.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Check if Ctrl (or Cmd on Mac) is pressed
      const isMod = e.ctrlKey || e.metaKey
      
      if (isMod && e.key === 'z' && !e.shiftKey) {
        // Ctrl+Z or Cmd+Z: Undo
        e.preventDefault()
        undo()
      } else if (isMod && (e.key === 'z' && e.shiftKey || e.key === 'y')) {
        // Ctrl+Shift+Z or Ctrl+Y: Redo
        e.preventDefault()
        redo()
      }
    }
    
    globalThis.addEventListener("keydown", handleKeyDown)
    return () => globalThis.removeEventListener("keydown", handleKeyDown)
  }, [history, future, routine])

  // Undo/redo: Save state before change, clear redo stack
  function pushHistory(newState: RoutineStep[]) {
    setHistory(prev => [...prev, routine])
    setRoutine(newState)
    setFuture([])
  }

  // Go back one step in history
  function undo() {
    if (history.length === 0) return
    const previous = history.at(-1)
    if (!previous) return
    setFuture(f => [routine, ...f])
    setHistory(h => h.slice(0, -1))
    setRoutine(previous)
  }

  // Go forward one step in history (redo)
  function redo() {
    if (future.length === 0) return
    const next = future[0]
    setFuture(f => f.slice(1))
    setHistory(h => [...h, routine])
    setRoutine(next)
  }

  // Add figure to routine (called on drag)
  function addFigure(fig: Figure) {
    const newRoutine = [...routine, { stepId: uuid(), figure: fig }]
    pushHistory(newRoutine)
  }

  // Add figure to routine at a specific index
  function addFigureAtIndex(fig: Figure, index: number) {
    const newRoutine = [...routine]
    newRoutine.splice(index, 0, { stepId: uuid(), figure: fig })
    pushHistory(newRoutine)
  }

  // Remove step from routine
  function removeStep(stepId: string) {
    const newRoutine = routine.filter(s => s.stepId !== stepId)
    pushHistory(newRoutine)
  }

  // Update routine with reordered steps
  function reorderSteps(newRoutine: RoutineStep[]) {
    pushHistory(newRoutine)
  }

  // Handle drag-drop (reorder steps, add figures, or save figure)
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    const draggedId = active.id as string
    const draggedIndex = routine.findIndex(s => s.stepId === draggedId)

    // Scenario 1: Save figure from routine to library (drag step → figures-save-zone)
    if (draggedIndex !== -1 && over?.id === "figures-save-zone") {
      saveFigureFromRoutine(routine[draggedIndex].figure)
      return
    }

    // Scenario 2: Reordering existing steps
    if (draggedIndex !== -1) {
      if (over?.id && over.id !== "routine-droppable" && over.id !== "figures-save-zone") {
        const targetIndex = routine.findIndex(s => s.stepId === over.id)
        if (targetIndex !== -1 && draggedIndex !== targetIndex) {
          const newRoutine = [...routine]
          const [removed] = newRoutine.splice(draggedIndex, 1)
          const insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex
          newRoutine.splice(insertIndex, 0, removed)
          reorderSteps(newRoutine)
        }
      }
      return
    }

    // Scenario 3: Adding new figure from panel
    const figure = figures.find(f => f.id === draggedId)
    if (figure) {
      // If dropped over a step, insert before that step
      if (over?.id && over.id !== "routine-droppable" && over.id !== "figures-save-zone") {
        const targetIndex = routine.findIndex(s => s.stepId === over.id)
        if (targetIndex !== -1) {
          addFigureAtIndex(figure, targetIndex)
          return
        }
      }
      // If dropped in empty space or on the droppable zone, add at the end
      if (over?.id === "routine-droppable") {
        addFigure(figure)
      }
    }
  }

  // Toggle figure video preview expansion
  function toggleExpand(id: string) {
    setExpanded(expanded === id ? null : id)
  }

  // Handle panel resize (drag border to change width)
  function startResize(e: React.MouseEvent) {
    const startX = e.clientX
    const startWidth = panelWidth

    function onMove(e: MouseEvent) {
      const newWidth = startWidth + (e.clientX - startX)
      if (newWidth < 120) {
        setCollapsed(true)
      } else {
        setCollapsed(false)
        setPanelWidth(Math.min(newWidth, 500))
      }
    }

    function stop() {
      globalThis.removeEventListener("mousemove", onMove)
      globalThis.removeEventListener("mouseup", stop)
    }

    globalThis.addEventListener("mousemove", onMove)
    globalThis.addEventListener("mouseup", stop)
  }



  async function saveRoutine() {
    const trimmedName = routineName.trim()
    if (!trimmedName) {
      setSaveStatus("❌ Name required")
      setTimeout(() => setSaveStatus(null), 3000)
      return
    }
    if (trimmedName === "Untitled Routine") {
      const confirmed = confirm(
        "Your routine is still named 'Untitled Routine'. Are you sure you want to save it with this name?"
      )
      if (!confirmed) return
    }
    setIsSaving(true)
    setSaveStatus("Saving...")

    try {
      const routineData = {
        name: routineName,
        dance_style: dance,
        steps: routine,
        created_at: new Date().toISOString(),
      }

      if (routineId === null) {
        const newId = uuid()
        const { error } = await supabase.from("routines").insert([
          { id: newId, user_id: user?.id, ...routineData },
        ])
        if (error) {
          console.error("Error saving routine:", error)
          setSaveStatus("❌ Failed to save")
          const errorMsg = error.message?.includes("duplicate") 
            ? "A routine with this name already exists" 
            : error.message || "Unknown error occurred"
          alert(`Error saving routine: ${errorMsg}`)
          return
        }
        setRoutineId(newId)
        setSaveStatus("✓ Saved")
      } else {
        const { error } = await supabase
          .from("routines")
          .update(routineData)
          .eq("id", routineId)
        if (error) {
          console.error("Error updating routine:", error)
          setSaveStatus("❌ Failed to save")
          const errorMsg = error.message || "Failed to update routine"
          alert(`Error updating routine: ${errorMsg}`)
          return
        }
        setSaveStatus("✓ Saved")
      }

      lastSavedStateRef.current = routine
      setHasUnsavedChanges(false)
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (err) {
      console.error("Unexpected error saving routine:", err)
      setSaveStatus("❌ Unexpected error")
      alert(`Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsSaving(false)
    }
  }


  async function handleSaveAs() {
    if (!routineName.trim()) {
      alert("Please enter a routine name")
      return
    }
    const newName = prompt("Save routine with a new name:", routineName + " (Copy)")
    if (newName === null) return
    if (!newName.trim()) {
      alert("Please enter a routine name")
      return
    }
    setIsSaving(true)
    setSaveStatus("Saving as new...")

    try {
      const newId = uuid()
      const routineData = {
        id: newId,
        user_id: user?.id,
        name: newName,
        dance_style: dance,
        steps: routine,
        created_at: new Date().toISOString(),
      }
      const { error } = await supabase.from("routines").insert([routineData])
      if (error) {
        console.error("Error saving routine:", error)
        setSaveStatus("❌ Failed to save")
        const errorMsg = error.message?.includes("duplicate")
          ? "A routine with this name already exists"
          : error.message || "Unknown error"
        alert(`Error saving routine: ${errorMsg}`)
        return
      }
      setRoutineId(newId)
      setRoutineName(newName)
      setSaveStatus("✓ Saved as new")
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (err) {
      console.error("Unexpected error saving routine:", err)
      setSaveStatus("❌ Unexpected error")
      alert(`Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsSaving(false)
    }
  }


  function handleNewRoutine() {
    if (hasUnsavedChanges) {
      const confirmed = confirm(
        "You have unsaved changes. Are you sure you want to start a new routine?"
      )
      if (!confirmed) return
    }
    setRoutineName("Untitled Routine")
    setRoutineId(null)
    setRoutine([])
    setHistory([])
    setFuture([])
    setCurrentStep(0)
    lastSavedStateRef.current = []
    setHasUnsavedChanges(false)
  }

  function handleExport() {
    if (routine.length === 0) {
      alert("Routine is empty. Add some figures before exporting.")
      return
    }
    exportRoutine({
      name: routineName || "Routine",
      dance_style: dance,
      steps: routine,
      created_at: new Date().toISOString(),
    })
  }


  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const importedRoutine = await importRoutine(file)
      if (!importedRoutine.steps || !Array.isArray(importedRoutine.steps)) {
        alert("Invalid routine file: missing steps data")
        return
      }
      const importedSteps = importedRoutine.steps as RoutineStep[]
      const missingFigures: string[] = []
      for (const step of importedSteps) {
        if (!figures.some(f => f.id === step.figure.id)) {
          missingFigures.push(step.figure.name)
        }
      }
      if (missingFigures.length > 0) {
        alert(
          `The following figures are not available in this dance style:\n${missingFigures.join("\n")}\n\nPlease add them to the figures library first.`
        )
        return
      }
      setRoutineName(importedRoutine.name || "Imported Routine")
      setRoutine(importedSteps)
      setHistory([])
      setFuture([])
      setCurrentStep(0)
      setRoutineId(null)
      alert(`Routine "${importedRoutine.name}" imported successfully!`)
    } catch (error) {
      console.error("Error importing routine:", error)
      alert(`Error importing routine: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  async function saveFigureFromRoutine(figureData: Figure) {
    try {
      const newFigure = {
        ...figureData,
        id: uuid(), // New ID for the saved figure
        created_by: user?.id,
        visibility: 'private' as const,
      }

      const { error } = await supabase
        .from('figures')
        .insert([newFigure])

      if (error) {
        console.error('Error saving figure:', error)
        setSaveStatus('❌ Failed to save figure')
        setTimeout(() => setSaveStatus(null), 3000)
        return
      }

      // Update local figures list
      setFigures([...figures, newFigure])
      setSaveStatus('✓ Figure saved to your library')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error('Error saving figure:', error)
      setSaveStatus('❌ Failed to save figure')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }

  async function handleVisibilityChange(newVisibility: 'private' | 'public') {
    if (!routineId) {
      alert("Save the routine first before sharing")
      return
    }
    try {
      setIsSharing(true)
      await updateRoutineVisibility(routineId, newVisibility)
      setVisibility(newVisibility)
      setSaveStatus(`✓ Visibility changed to ${newVisibility}`)
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error("Error changing visibility:", error)
      setSaveStatus("❌ Failed to change visibility")
      setTimeout(() => setSaveStatus(null), 3000)
    } finally {
      setIsSharing(false)
    }
  }

  async function handleCreateShare() {
    if (!routineId) {
      alert("Save the routine first before sharing")
      return
    }
    try {
      setIsSharing(true)
      const { token, url } = await createShareLink(routineId, user?.id || "", visibility === 'public')
      setShareToken(token)
      setShareUrl(url)
      setSaveStatus("✓ Share link created")
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error("Error creating share link:", error)
      setSaveStatus("❌ Failed to create share link")
      setTimeout(() => setSaveStatus(null), 3000)
    } finally {
      setIsSharing(false)
    }
  }

  async function handleRevokeShare() {
    if (!shareToken) {
      alert("No share link to revoke")
      return
    }
    try {
      setIsSharing(true)
      await revokeShare(shareToken)
      setShareToken(null)
      setShareUrl(null)
      setSaveStatus("✓ Share link revoked")
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error("Error revoking share:", error)
      setSaveStatus("❌ Failed to revoke share")
      setTimeout(() => setSaveStatus(null), 3000)
    } finally {
      setIsSharing(false)
    }
  }

  // Configure dnd-kit sensors to require 5px drag before activation
  // This lets clicks on buttons pass through without triggering drag
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  return (
    <DndContext 
      collisionDetection={pointerWithin} 
      onDragEnd={handleDragEnd}
      sensors={sensors}
      autoScroll={false}
    >
      <div className="flex flex-col bg-white dark:bg-gray-950">
        {/* Header */}
        <Header danceName={dance} currentPage="choreo" />

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden bg-white dark:bg-gray-950">
          {/* Left panel: Figures */}
          <FigurePanel
            figures={figures}
            panelWidth={panelWidth}
            collapsed={collapsed}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            onAddFigure={addFigure}
            onSaveFigure={saveFigureFromRoutine}
            onStartResize={startResize}
            onCollapse={() => setCollapsed(!collapsed)}
          />

          {/* Center + right panels */}
          <div className="flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-3 p-4 flex-1 overflow-hidden">
              {/* Center panel: Routine Builder */}
              <div className="flex flex-col min-w-0">
                <RoutineBuilder
                  routine={routine}
                  onRemoveStep={removeStep}
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
                  visibility={visibility}
                  shareToken={shareToken}
                  onVisibilityChange={handleVisibilityChange}
                  onCreateShare={handleCreateShare}
                  onRevokeShare={handleRevokeShare}
                  shareUrl={shareUrl}
                  isSharing={isSharing}
                />
              </div>

              {/* Right panel: Video Preview */}
              <div className="flex flex-col min-w-0">
                <h2 className="font-bold mb-2 text-sm">Preview</h2>
                <RoutinePlayer
                  steps={routine}
                  currentStep={currentStep}
                  onStepChange={setCurrentStep}
                  repeatMode={repeatMode}
                  onRepeatModeChange={setRepeatMode}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  )
}