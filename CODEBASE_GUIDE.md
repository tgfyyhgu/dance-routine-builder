# Dance Routine Builder - Complete Codebase Guide

## Overview

This is a Next.js web application for creating and choreographing ballroom dance routines. Users select a dance style, browse available figures, drag them into a builder, and practice with videos.

---

## Architecture Summary

### HIGH LEVEL: App Flow

```
Home Page (/page.tsx)
    ↓ [Select dance style]
    ↓
Figures Page (/[dance]/figures/page.tsx)
    ↓ [View/edit all figures]
    ↓
Choreo Page (CORE) (/[dance]/choreo/page.tsx)
    ├─ Left: FigurePanel (draggable figures)
    ├─ Center: RoutineBuilder (builder workspace)
    └─ Right: RoutinePlayer (video preview)
    ↓ [Save routine]
    ↓
My Routines Page (/my-routines/page.tsx)
    ↓ [View/edit/delete saved routines]
```

---

## PHASE 1: Data Types & Configuration

**File:** `types/routine.ts`

```typescript
Figure {
  id, name, difficulty, note, youtube_url, start_time, end_time
}

RoutineStep {
  stepId (unique per-step ID)
  figure (the Figure at this step)
}

Routine {
  id, name, dance_style, created_at, steps[]
}
```

**Config Files:**
- `tsconfig.json` - TypeScript compiler settings
- `package.json` - Dependencies (Next.js, dnd-kit, Tailwind, uuid, Supabase, file-saver)
- `postcss.config.mjs` - Tailwind CSS pipeline (CRITICAL: don't delete)
- `eslint.config.mjs` - Code linting (optional)
- `next.config.ts` - Next.js customization (currently empty, safe to delete)

---

## PHASE 2: Core Orchestrator - ChoreoPage

**File:** `app/[dance]/choreo/page.tsx`

### Purpose
The "conductor" of the entire choreography builder. Manages:
- Loading figures from Supabase
- Loading existing routines from database
- Managing undo/redo history stacks
- Handling drag & drop
- Saving/exporting/importing routines
- Detecting unsaved changes

### State Management
```
routine: RoutineStep[]           // Current choreography
history: RoutineStep[][]         // Stack for undo
future: RoutineStep[][]          // Stack for redo
routineName: string              // User-given name
routineId: string | null         // Database ID (null = new)
isSaving: boolean                // Is currently saving?
hasUnsavedChanges: boolean       // Warning flag
```

### Key Functions
| Function | Purpose |
|----------|---------|
| `pushHistory()` | Save old state → update to new state → clear future |
| `undo()` | Restore from history, save current to future |
| `redo()` | Restore from future, save current to history |
| `addFigure()` | Create RoutineStep, push to routine |
| `removeStep()` | Filter out step, push to routine |
| `reorderSteps()` | Accept reordered array, push to routine |
| `handleDragEnd()` | Process drop event (add or reorder) |
| `saveRoutine()` | INSERT/UPDATE to Supabase |
| `handleImport()` | Validate and load JSON file |
| `handleExport()` | Download routine as JSON |

### Data Flow
```
User Action → ChoreoPage callback → State update → Child component re-renders
```

---

## PHASE 3: Routine Builder (Center Panel)

**File:** `components/RoutineBuilder.tsx`

### Purpose
Display and manage the choreography sequence in a sortable list with controls.

### Components
- **RoutineStepItem**: Renders one step (draggable, removable)
- **RoutineBuilder**: Renders entire builder panel

### Key Features
- **Droppable Zone**: Accepts figures from left panel
- **SortableContext**: Enables step reordering
- **Control Bar**: Name, Save, New, Export, Import buttons
- **Undo/Redo**: History navigation
- **Visual Feedback**: Blue highlight on drag-over, semi-transparent during drag

### Props (20 total)
Organized into groups:
- **Core Data**: `routine`
- **Mutations**: `onRemoveStep`, `onReorderSteps`
- **History**: `onUndo`, `onRedo`
- **Navigation**: `onJumpToStep`
- **Metadata**: `routineName`, `routineId`
- **Saving**: `saveRoutine`, `handleSaveAs`, `isSaving`, `saveStatus`
- **I/O**: `handleExport`, `handleImport`, `fileInputRef`, `handleNewRoutine`

---

## PHASE 4: Figure Panel (Left Side)

**File:** `components/FigurePanel.tsx`

### Purpose
Display draggable library of all available figures for the dance.

### Components
- **DraggableFigure**: One figure with expand/collapse
- **FigurePanel**: Full panel with resize/collapse controls

### Key Features
- **Draggable**: Use `useDraggable` hook for each figure
- **Expandable**: Click + to show video preview and details
- **Resizable**: Drag right border to change width (120-500px)
- **Collapsible**: Hide panel with ◀ button
- **YouTube API**: Loads API on demand, creates player on expand

### YouTube Player Management
- **EFFECT 1**: Load YouTube API script (once on mount)
- **EFFECT 2**: Create/destroy player (when figure expanded/collapsed)
- Uses `useRef` to store player instance (doesn't trigger re-renders)
- Cleans up old player before creating new one

---

## PHASE 5: Routine Player (Right Side)

**File:** `components/RoutinePlayer.tsx`

### Purpose
Full-featured video player for practicing the choreography with step-by-step progression.

### Key Features
- **YouTube Integration**: Loads videos with start/end timestamps
- **Playback Controls**: Play, Pause, Replay, Fullscreen
- **Navigation**: Next, Previous, Restart buttons
- **Auto-Mode**: Automatically advance to next step when video ends
- **Manual-Mode**: User controls navigation manually
- **Progress Bar**: Visual indicator of routine completion
- **Metadata**: Figure name, difficulty rating, step counter

### Auto-Advance System
Two mechanisms:
1. **onStateChange**: YouTube player fires when video ends (event.data === 0)
2. **Timer Backup**: Separate setTimeout as fallback (duration = end_time - start_time)

### Control Buttons
| Button | Action |
|--------|--------|
| Auto/Manual | Toggle autoplay mode |
| Restart | Jump to first step |
| Play/Pause | Control playback |
| Replay Clip | Restart current video |
| Fullscreen | Toggle fullscreen mode |
| Previous/Next | Navigate between steps |

---

## PHASE 6: Figure Card (Figures Management)

**File:** `components/FigureCard.tsx`

### Purpose
Display one figure as a table row in the Figures management page (/[dance]/figures).

### Structure
- **Collapsed**: Show name, difficulty, notes, video toggle (▼/▶)
- **Expanded**: Show YouTube video iframe embedded below

### Used In
`app/[dance]/figures/page.tsx` - allows viewing/editing all figures for a dance

---

## Pages & Their Roles

### Home Page (`app/page.tsx`)
- Landing page with dance selection grid
- Link to "My Routines"
- 10 ballroom dance styles (waltz, tango, viennese, foxtrot, quickstep, cha, samba, rumba, paso, jive)

### Figures Page (`app/[dance]/figures/page.tsx`)
- Browse, search, filter figures by dance style
- View figure details and YouTube videos
- EDIT MODE: Add, update, delete figures
- Syncs changes to Supabase

### Choreography Page (`app/[dance]/choreo/page.tsx`)
- **The main builder** (PHASE 2-5 components)
- Can load existing routine via URL `?routineId=abc123`
- Saves to Supabase
- Export/import JSON

### My Routines Page (`app/my-routines/page.tsx`)
- List all saved routines grouped by dance style
- Edit: Open routine in choreo page
- Duplicate: Create copy with new name
- Delete: Remove from database
- Click to edit → navigates to choreo page with `?routineId=...`

---

## Utility Libraries

### `lib/supabaseClient.ts`
Database connection with public anon key.
Tables: `figures`, `routines`

### `lib/timeUtils.ts`
Time formatting utilities:
- `parseTimeToSeconds()`: "2:30" → 150, "136" → 96
- `formatSecondsToTime()`: 150 → "2:30", 3661 → "1:01:01"

### `lib/routineExport.ts`
`exportRoutine()`: Convert routine to JSON Blob → download

### `lib/routineImport.ts`
`importRoutine()`: Read JSON file → parse → return Routine object

### `lib/auth.ts`
Currently empty (for future authentication)

---

## Key Patterns & Concepts

### Drag & Drop (dnd-kit)
- **useDraggable**: Makes element draggable (figures in left panel)
- **useDroppable**: Makes element accept drops (builder center)
- **SortableContext + useSortable**: Makes list items reorderable
- **DragEndEvent**: Parent (ChoreoPage) processes drag results

### State Management Strategy
- **ChoreoPage** = "brain" (manages all state)
- **Child components** = "hands" (display state, call callbacks)
- No state in children (all lifted to parent)
- Makes testing & debugging easier

### Undo/Redo Implementation
```
User makes change:
  routine = [step1, step2, step3]
  history = [[step1, step2]]
  future = []

User clicks Undo:
  routine = [step1, step2]
  history = [[step1]]
  future = [[step1, step2, step3]]

User clicks Redo:
  routine = [step1, step2, step3]
  history = [[step1], [step1, step2]]
  future = []
```

### YouTube API Loading
```
ComponentMount:
  1. Create <script src="youtube.com/iframe_api">
  2. Insert into <head> before first script
  3. Set window.onYouTubeIframeAPIReady callback
  4. When API loads, window.YT becomes available

CreatePlayer:
  new window.YT.Player(containerId, options)
  Player embeds iframe, takes control of that DOM element

CleanupPlayer:
  playerInstance.destroy()
  Removes iframe and frees resources
```

### useRef vs useState
- **useRef**: Data that doesn't need re-render on change
  - `playerInstanceRef` (YouTube player)
  - `lastSavedStateRef` (for detecting unsaved changes)
  - `fileInputRef` (reference to hidden file input)
- **useState**: Data that should trigger re-render when changed
  - `routine`, `history`, `future`, `routineName`, etc.

### Conditional Prop Rendering
Many components use optional props (with `?` in interface):
- If parent doesn't provide callback → button doesn't render
- Example: `handleNewRoutine?.()` → only call if function exists

---

## Database Schema (Supabase)

### `figures` table
Columns: `id`, `name`, `difficulty`, `note`, `youtube_url`, `start_time`, `end_time`, `dance_style`

### `routines` table
Columns: `id`, `name`, `dance_style`, `created_at`, `steps` (JSON array of RoutineStep)

---

## Common Questions

### Q: Why is state in ChoreoPage, not in components?
**A:** Single source of truth. Easier to manage history, undo/redo, and cross-component communication.

### Q: Why separate DraggableFigure from FigurePanel?
**A:** The `useDraggable` hook must be on the draggable element itself. Can't use hooks conditionally or in loops without separate component.

### Q: How does drag-drop work?
**A:** 
1. DndContext wraps entire page
2. Figures have `useDraggable`, builder has `useDroppable`
3. User drags figure → DragEndEvent fires in ChoreoPage
4. ChoreoPage checks if dropped in builder → calls `addFigure()`

### Q: What happens when I click Undo?
**A:** ChoreoPage's `undo()` function runs:
1. Pop last item from history (previous state)
2. Push current routine to future (for redo)
3. Set routine to previous state
4. Component re-renders with old data

### Q: Why two auto-advance mechanisms in RoutinePlayer?
**A:** 
- YouTube's onStateChange is unreliable with custom end_time
- Timer ensures auto-advance always works
- Both mechanisms check conditions before advancing

---

## Development Tips

### Adding a New Figure
1. Go to Figures page (/[dance]/figures)
2. Click Edit Mode
3. Click Add Figure
4. Fill name, difficulty, notes, YouTube URL, timing
5. Click Save

### Creating a New Routine
1. Select dance on home page
2. Click choreography button (or navigate to /waltz/choreo)
3. Drag figures from left panel into center builder
4. Click Save → Supabase creates new routine
5. Now visible in "My Routines"

### Common Errors
- **TypeError: Cannot read property 'YT' of undefined** → YouTube API not loaded yet
- **"Failed to load routine"** → routineId not found in database
- **Video preview blank** → YouTube URL format incorrect or API not initialized

---

## File Structure Review

```
/app
  /[dance]
    /choreo/page.tsx        ← PHASE 2 (main orchestrator)
    /figures/page.tsx       ← Figures management
  /my-routines
    /page.tsx               ← Routine dashboard
  /login
    /page.tsx               ← Placeholder
  /signup
    /signup.tsx             ← Placeholder
  layout.tsx                ← Root layout with nav
  page.tsx                  ← Home page
  globals.css               ← Global styles

/components
  RoutineBuilder.tsx        ← PHASE 3 (center panel)
  RoutinePlayer.tsx         ← PHASE 5 (right panel)
  FigurePanel.tsx           ← PHASE 4 (left panel)
  FigureCard.tsx            ← PHASE 6 (table row)
  SavedRoutinesPanel.tsx    ← Empty placeholder

/lib
  supabaseClient.ts         ← Database connection
  routineExport.ts          ← JSON download
  routineImport.ts          ← JSON upload
  timeUtils.ts              ← Time formatting
  auth.ts                   ← Auth (empty)

/types
  routine.ts                ← PHASE 1 (data types)

/public
  (static assets)

Config files:
  tsconfig.json
  package.json
  postcss.config.mjs
  eslint.config.mjs
  next.config.ts
  next-env.d.ts
```

---

## Summary: How Everything Connects

1. **User navigates to waltz/choreo** → ChoreoPage loads
2. **ChoreoPage loads figures** from Supabase (EFFECT 1)
3. **ChoreoPage renders three child components:**
   - FigurePanel (left): Shows figures, enables drag
   - RoutineBuilder (center): Shows steps, accepts drops
   - RoutinePlayer (right): Shows video for current step
4. **User drags figure** → DndContext fires DragEndEvent
5. **ChoreoPage.handleDragEnd()** processes event → calls `addFigure()`
6. **addFigure()** creates RoutineStep → calls `pushHistory()` to save old state → updates routine
7. **RoutineBuilder re-renders** with new step in list
8. **User clicks step** → calls `onJumpToStep(index)` → ChoreoPage updates `currentStep`
9. **RoutinePlayer re-renders** with new step's video
10. **User clicks Save** → `saveRoutine()` → INSERT/UPDATE to Supabase
11. **Routine saved** → now visible in "My Routines"

---

## Next Steps for Enhancement

- [ ] Add user authentication (lib/auth.ts)
- [ ] Add figure search/filter on Figures page
- [ ] Add analytics tracking
- [ ] Add social sharing features
- [ ] Add routine leveling/ranking
- [ ] Add tempo/music support
- [ ] Add offline mode (service worker)
- [ ] Add mobile app (React Native)

---

**Generated:** March 16, 2026
**Version:** 1.0
**Language:** TypeScript + React + Next.js
