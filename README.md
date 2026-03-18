# 🎬 Ballroom Dance Routine Builder

A comprehensive web application for choreographers and dancers to create, manage, share, and practice ballroom dance routines. Features drag-and-drop choreography composition, figure library management, video previews, and routine sharing with attribution.

Supports 10 dance styles: **Waltz, Tango, Viennese, Foxtrot, Quickstep, Cha-cha, Samba, Rumba, Paso Doble, Jive**

---

## ✨ Key Features

### 🎯 Choreography Builder
- **3-Panel Layout**: Figure library (left) | Routine editor (center) | Video preview (right)
- **Drag & Drop Interface**:
  - Drag figures into routine to add steps
  - Reorder steps by dragging
  - Save figures by dragging from routine to library
- **Video Preview**: Embedded YouTube player with start/end time controls
- **Undo/Redo**: Full history support (Ctrl+Z / Ctrl+Shift+Z)
- **Real-Time Composition**: Immediate visual feedback

### 📚 Figure Management
- **Create, Edit, Delete** figures with rich metadata:
  - Difficulty ratings (0-5 stars)
  - YouTube video links with custom start/end times
  - Notes and descriptions
  - Dance style organization
- **Search & Filter**: By name, difficulty, or notes
- **Visibility Control**: Mark figures as Private (creator only) or Public (all users)
- **Smart Save Logic**:
  - Empty figures → Auto-deleted
  - Figures with data but no name → User prompted with identifying info
  - Named figures → Saved immediately
- **Drag-to-Save**: Save figures from shared routines to your library

### 💾 Routine Management
- **Save Routines**: Persist to Supabase with auto-save detection
- **Save As**: Create duplicates with new names
- **Export/Import**: JSON file format for backup and sharing
- **Unsaved Changes**: Warning before navigating away
- **My Routines**: Full routine list with edit/delete/export actions

### 🔗 Sharing System (NEW)
- **Token-Based Links**: 8-char unique URLs for sharing routines
- **Visibility Control**: 
  - Private: Only you can access your routines
  - Public: Visible in discover (future feature) + shareable links
- **Read-Only Access**: Shared routines cannot be edited by viewers
- **Copy-to-Own**: Recipients can duplicate shared routines to their account
- **Attribution Tracking**: `based_on_id` field tracks routine lineage
- **Public Figure Library**: Share figures by making them public

### 👤 User Accounts & Authentication
- **Email/Password Auth**: Via Supabase
- **Account Settings**: View profile info (email, ID, creation date)
- **Account Deletion**: Secure 3-level confirmation with full data cleanup
- **Session Management**: Auto-persist login across browser refreshes

### 🎨 User Experience
- **Dark Mode**: Theme toggle with system preference detection
- **Mobile Responsive**: Optimized layout for phone/tablet browsers
- **Status Feedback**: Save status messages, copy feedback, error alerts
- **Intuitive Navigation**: Clear routing between dance styles, routines, and builder

---

## 🛠️ Technology Stack

### Frontend
- **Next.js 16.1.6** - React framework with App Router
- **React 19.2.3** - UI library
- **TypeScript 5** - Type-safe development
- **Tailwind CSS 4** - Utility-first responsive styling

### Backend & Database
- **Supabase (PostgreSQL)** - Database with Row-Level Security (RLS)
- **Supabase Auth** - User authentication
- **Next.js API Routes** - Backend endpoints (e.g., account deletion)

### Libraries
- **@dnd-kit/core & @dnd-kit/sortable** - Drag-and-drop functionality
- **@supabase/supabase-js** - Database client
- **uuid** - Unique ID generation
- **file-saver** - JSON export/download

---

## 📊 Database Schema

### Tables

#### `auth.users` (Supabase managed)
- User authentication & profiles

#### `routines`
```sql
id (uuid, PK)
user_id (uuid, FK → auth.users)
name (text)
dance_style (text)
steps (jsonb) -- array of RoutineStep objects
visibility (text) -- 'private' | 'public'
based_on_id (uuid) -- tracks copied routines
created_at (timestamp)
```

#### `figures`
```sql
id (uuid, PK)
name (text)
dance_style (text)
difficulty (int, 0-5)
note (text)
youtube_url (text)
start_time (int) -- seconds
end_time (int) -- seconds
created_by (uuid, FK → auth.users)
visibility (text) -- 'private' | 'public'
```

#### `shares`
```sql
id (uuid, PK)
token (varchar 8, unique) -- URL token
type (text) -- 'routine' | 'figure'
resource_id (uuid) -- routines.id or figures.id
created_by (uuid, FK → auth.users)
is_public (boolean)
view_count (int)
created_at (timestamp)
```

### Row-Level Security (RLS)
- **Routines**: Owner read/write; public/shared routines readable by others
- **Figures**: Creator read/write; public figures readable by all
- **Shares**: Public read; creator-only modify

---

## 📁 Project Structure

```
app/
├── page.tsx                      # Home: dance style selection
├── layout.tsx                    # Root layout with navigation
├── account/page.tsx              # Account settings & deletion
├── api/delete-account/route.ts   # Backend account deletion
├── login/page.tsx                # User login
├── signup/page.tsx               # User registration
├── my-routines/page.tsx          # Saved routines list
├── share/[token]/page.tsx        # Public share viewer (read-only)
└── [dance]/
    ├── choreo/page.tsx           # Choreography builder (3-panel)
    └── figures/page.tsx          # Figure management

components/
├── RoutineBuilder.tsx            # Center panel: routine editor
├── RoutinePlayer.tsx             # Right panel: video preview
├── FigurePanel.tsx               # Left panel: figure library + save zone
└── FigureCard.tsx                # Individual figure display

lib/
├── supabaseClient.ts             # Supabase client init
├── AuthContext.tsx               # Global auth state (useAuth hook)
├── ThemeContext.tsx              # Dark mode context
├── sharing.ts                    # Share utility functions
├── routineExport.ts              # JSON export logic
├── routineImport.ts              # JSON import logic
└── timeUtils.ts                  # Time formatting helpers

types/
└── routine.ts                    # TypeScript interfaces

public/                           # Static assets
```

---

## 🔄 Key Workflows

### Creating a Routine
1. Go to home, select dance style
2. Navigate to Choreography Builder (`/waltz/choreo`)
3. Drag figures from left panel into center routine editor
4. Reorder steps by dragging
5. Preview video in right panel
6. Save routine (top of center panel)

### Sharing a Routine
1. Open saved routine in Choreography Builder
2. Click "Create Share Link" button (center panel)
3. Toggle Private ↔ Public visibility as desired
4. Share the generated link or copy it
5. Viewers can access read-only view and copy to their account

### Managing Figures
1. Navigate to Figures page (`/waltz/figures`)
2. Click **Edit** button
3. Add new figures (or delete existing ones)
4. Fill in: Name, Difficulty, Notes, YouTube URL, Video timing
5. Set visibility: Private or Public
6. Click **Save**

### Saving Figures from Shared Routines
1. Open shared routine (from shared link)
2. Copy routine to your account
3. In your routine (Choreography Builder), drag steps into the **"📌 Drop figures here to save"** zone at top of figure library
4. Figures saved to your library with Private visibility by default

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account and project
- Environment variables configured

### Environment Variables
Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For account deletion
```

### Installation & Running
```bash
# Install dependencies
npm install

# Run dev server (localhost:3000)
npm run dev

# Build for production
npm run build
npm start

# Lint code
npm run lint
```

---

## 🗄️ Database Setup

Run the migration SQL in Supabase SQL Editor:
```sql
-- Enable auth & set up sharing
-- See: SHARING_MIGRATION.sql

-- Tables created:
-- - shares (for token-based sharing)
-- - Updated routines (added visibility, based_on_id)
-- - Updated figures (added created_by, visibility)

-- RLS policies enabled on all tables
-- Auth context required for user identification
```

---

## 🔐 Security

### Authentication
- Supabase Auth handles passwords securely (no client-side storage)
- Session tokens auto-managed

### Data Access (RLS)
- Users can only see/edit their own private data
- Public figures/routines visible to everyone
- Share tokens provide one-time link access
- Account deletion cleans up all user data atomically

### Account Deletion
- Requires 3-level confirmation (prevents accidental deletion)
- Backend API endpoint with service role key verification
- Deletes: routines, figures, share links, auth user in single transaction

---

## 📱 Responsive Design

- **Mobile**: Single-column layout, compact buttons, touch-friendly
- **Tablet**: 2-column for moderate spacing
- **Desktop**: Full 3-panel choreography view, optimal working space
- Tailwind breakpoints: `sm`, `md`, `lg`

---

## 🎬 Recent Features (v0.1.0)

- ✅ Token-based routine sharing with public/private toggles
- ✅ Figure save via drag-and-drop from routines
- ✅ Public figure library with visibility control
- ✅ Account management & deletion
- ✅ Mobile-responsive navigation
- ✅ Dark mode support
- ✅ Improved figure naming UX (auto-delete empty, smart prompts)
- ✅ Routine lineage tracking (based_on_id)

---

## 🗺️ Future Roadmap

- 🔜 Figure discovery page (search all public figures)
- 🔜 Creator profiles (view all public routines by choreographer)
- 🔜 Collaborative editing (real-time sync via Supabase Realtime)
- 🔜 Music synchronization (upload music, sync steps to beats)
- 🔜 Performance metrics (practice tracking, progress charts)
- 🔜 Community features (likes, comments, ratings)

---

## 📄 License

This project is open source and available under the MIT License.

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

For issues or questions:
- Check existing GitHub issues
- Create a new issue with detailed description
- Include steps to reproduce and error messages

