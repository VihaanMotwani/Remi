# Remi Electron App

React + Electron (Forge + Vite) desktop application for the Remi assistant.

## Development

```powershell
cd electron-app
npm install
npm run dev
```
Electron Forge will build main & preload, start Vite dev server for the renderer, and launch the app.

## Production Build / Packaging

```powershell
cd electron-app
npm run make   # creates installers/packages in the out/ folder
```

## Project Structure

- `src/main.ts` – Electron main process (window lifecycle, IPC handlers)
- `src/preload.ts` – Secure bridge exposing limited API via `window.api`
- `src/renderer/` – React UI (Figma-generated components adapted for desktop)
- `forge.config.ts` – Electron Forge + Vite plugin configuration
- `vite.*.config.ts` – Separate Vite configs for main, preload, renderer

## Secure Preload API

The preload uses `contextIsolation: true` and exposes a secure API surface:
```ts
window.api.platform // string - returns OS platform
await window.api.ping() // 'pong' - test IPC connection
await window.api.orchestrate() // spawns Python orchestrator workflow
// { success: true, output: string } | { success: false, error: string }
```
Extend by adding IPC handlers in `main.ts` and methods on `preload.ts`.

## Adding More IPC
1. In `src/main.ts`:
```ts
ipcMain.handle('get-version', () => app.getVersion());
```
2. In `src/preload.ts`:
```ts
getVersion: () => ipcRenderer.invoke('get-version')
```
3. Use in renderer:
```ts
const version = await window.api.getVersion();
```

## Environment Variables
Vite exposes variables via `import.meta.env`. Add declarations to `forge.env.d.ts`.

**Required Environment Variables:**
```env
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_KEY=<your-supabase-anon-key>
```

Create a `.env` file in the `electron-app/` directory with these values for local development.

## Lint / Typecheck
```powershell
npm run lint
```
(Uses TypeScript's compiler for type checking.)

## Troubleshooting
- Black screen: ensure dev server URL loads (`MAIN_WINDOW_VITE_DEV_SERVER_URL`); restart with `rs` in terminal.
- Preload types not found: confirm `global.d.ts` is included in `tsconfig.json`.
- Permissions: mic/camera allowed by handler in `main.ts`; adjust for stricter control.

## Next Steps
- Implement richer IPC (meeting controls, notifications)
- Add auto-update flow
- Harden security (enable fuses already configured, audit dependencies)

## Backend Integration

The Electron app integrates with a Python backend and Supabase database:

### Architecture

```
┌─────────────────────────────────────────┐
│         Electron Renderer (React)       │
│  - MeetingsView (fetch/display)         │
│  - CommunicationView (email triage)     │
│  - CalendarView (events/tasks)          │
└─────────────────┬───────────────────────┘
                  │
                  │ Supabase Client API
                  ↓
┌─────────────────────────────────────────┐
│         Supabase Backend                │
│  Tables: events, meeting_notes, emails  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      Main Process (IPC Handlers)        │
│  - run-orchestrator → spawns Python     │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│         Python Backend                  │
│  - orchestrator.py (workflow)           │
│  - meeting_agent.py (processing)        │
│  - server.py (WebSocket state)          │
└─────────────────────────────────────────┘
```

### Data Flow

**Meetings Integration:**
- `MeetingsView.tsx` → `fetchTodaysMeetings()` → Supabase `events` + `meeting_notes` tables
- Displays: time, title, attendees, prep notes, meeting notes, action items
- Loading/error states with graceful fallbacks

**Email Integration:**
- `CommunicationView.tsx` → `fetchUnrespondedEmails()` → Supabase `emails` table
- User can edit AI-suggested responses and send
- `updateEmailResponse()` marks email as replied and stores response
- Automatically removes from triage list after sending

**Calendar Integration:**
- `CalendarView.tsx` → `fetchTodaysEvents()` → Supabase `events` table (filtered by `is_task`)
- Supports create, update, delete operations via `googleCalendarClient.ts`

**Python Orchestrator:**
- IPC handler `run-orchestrator` spawns `../backend/orchestrator.py`
- Captures stdout/stderr and returns structured result
- Used for daily workflow automation and voice interface

### API Contracts

**Supabase Tables:**

```typescript
// events table
{
  id: string;
  title: string;
  start_time: timestamp;
  end_time: timestamp;
  is_task: boolean;
  attendees: string[];
  agenda: string;
  location: string;
  // ... other fields
}

// meeting_notes table
{
  id: string;
  meeting_id: string; // FK to events.id
  preparation_notes: string;
  notes: string;
  action_items: string;
  // ... other fields
}

// emails table
{
  id: string;
  from_email: string;
  to_email: string[];
  subject: string;
  body: string;
  summary: string;
  replied_to: boolean;
  response: string;
  thread_id: string;
  // ... other fields
}
```

**IPC Methods:**

```typescript
// Orchestrator workflow
const result = await window.api.orchestrate();
// Returns: { success: true, output: string } | { success: false, error: string }
```

### Adding New Backend Integration

1. **Create API client** in `src/api/`:
```typescript
// src/api/myFeatureClient.ts
import { supabase } from './supabaseClient';

export async function fetchMyData() {
  const { data, error } = await supabase.from('my_table').select('*');
  if (error) throw error;
  return data;
}
```

2. **Use in React component**:
```typescript
import { fetchMyData } from 'src/api/myFeatureClient';

const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchMyData()
    .then(setData)
    .catch(console.error)
    .finally(() => setLoading(false));
}, []);
```

3. **For Python backend calls**, add IPC handler in `main.ts`:
```typescript
ipcMain.handle('run-my-script', async () => {
  const python = spawn('python', ['../backend/my_script.py']);
  // ... capture output and return
});
```

Then expose in `preload.ts`:
```typescript
myScript: () => ipcRenderer.invoke('run-my-script')
```

### Testing Backend Integration

Open DevTools console in the running app:
```javascript
// Test orchestrator
await window.api.orchestrate()

// Test Supabase connection (if exposed)
// Check Network tab for Supabase API calls when navigating views
```

---
Created as part of adapting Figma-generated React components to Electron.
