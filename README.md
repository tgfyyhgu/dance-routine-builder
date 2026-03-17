This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Project Overview

**Ballroom Dance Routine Builder** is a comprehensive web application that helps choreographers and dancers create, manage, and practice ballroom dance routines. It supports 10 dance styles: Waltz, Tango, Viennese, Foxtrot, Quickstep, Cha-cha, Samba, Rumba, Paso Doble, and Jive.

## Key Features

### Figure Management
- Add, edit, and delete dance figures with detailed metadata
- Difficulty ratings (0-5 stars)
- YouTube video references with customizable start/end times
- Notes and descriptions for each figure
- Search and filter by name, difficulty, or notes

### Choreography Builder
- Drag-and-drop interface to create routines
- Reorder steps easily
- Undo/redo functionality for editing
- Visual preview of each step with YouTube videos
- Real-time routine composition

### Routine Player
- Embedded YouTube player for each figure in the routine
- Auto-play mode for continuous learning
- Manual playback controls (play, pause, replay)
- Fullscreen video support
- Progress bar showing routine progress
- Step-by-step navigation

### Routine Management
- Save routines to Supabase database
- Export routines as JSON files
- Import previously saved routines
- "Save As" feature for duplicating routines
- Unsaved changes warnings

### My Routines Page
- View and manage all saved routines
- Organized by dance style
- Quick access to edit, delete, or export routines

## Technology Stack

### Frontend
- **Next.js 16.1.6** - React framework with App Router
- **React 19.2.3** - UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling

### Libraries & Dependencies
- `@dnd-kit/*` - Drag-and-drop library for routine reordering
- `supabase-js` - Backend database client
- `uuid` - Unique identifier generation
- `file-saver` - File export/download functionality

### Backend
- **Supabase** - PostgreSQL database with authentication ready
- YouTube IFrame API for video embedding

## Data Models

### Figure
```typescript
{
  id: string
  name: string
  difficulty: number (0-5)
  note: string
  youtube_url: string
  start_time: number (seconds)
  end_time: number (seconds)
  dance_style: string
}
```

### RoutineStep
```typescript
{
  stepId: string
  figure: Figure
}
```

### Routine
```typescript
{
  id: string
  name: string
  dance_style: string
  created_at: string
  steps: RoutineStep[]
}
```

## Project Structure

```
/app
  /[dance]
    /choreo/page.tsx          # Choreography builder
    /figures/page.tsx         # Figure management
  /my-routines/page.tsx       # Saved routines list
  /login/page.tsx             # Authentication (prepared)
  /signup/page.tsx            # Registration (prepared)
  page.tsx                    # Home page
  layout.tsx                  # Root layout

/components
  RoutineBuilder.tsx          # Drag-drop list with undo/redo
  RoutinePlayer.tsx           # Video player with controls
  FigurePanel.tsx             # Left panel with figure list
  FigureCard.tsx              # Individual figure display
  SavedRoutinesPanel.tsx      # Routines management

/lib
  supabaseClient.ts           # Supabase initialization
  routineExport.ts            # JSON export logic
  routineImport.ts            # JSON import logic
  timeUtils.ts                # Time formatting utilities
  auth.ts                     # Authentication logic (prepared)

/types
  routine.ts                  # TypeScript interfaces

/public                       # Static assets
```

## Key Components

| Component | Purpose |
|-----------|---------|
| **RoutineBuilder** | Sortable list of routine steps with drag-drop reordering, undo/redo controls |
| **RoutinePlayer** | YouTube video player with playback controls, auto-advance, fullscreen |
| **FigurePanel** | Left sidebar with draggable figures filtered by dance style |
| **FigureCard** | Table row component showing figure details and video preview toggle |

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Home page with dance style selection |
| `/[dance]/figures` | Figure management interface (admin view) |
| `/[dance]/choreo` | Choreography builder and routine player |
| `/my-routines` | View, edit, and manage saved routines |
| `/login` | User login (prepared for implementation) |
| `/signup` | User registration (prepared for implementation) |

## Database Tables

- **figures** - Dance figures with metadata (name, difficulty, video URL, timing, notes)
- **routines** - Saved user routines (name, dance style, steps, timestamp)

*Note: Ready for `user_id` field integration for multi-user support*
