# Frontend

## Purpose

The frontend has two distinct jobs:

1. give admins a product-first console to configure and review demos
2. give buyers a public demo surface that can switch from chat into a live browser walkthrough

The frontend is intentionally thin in terms of architecture. Most page state is local to each route, and almost all business logic still lives in the backend.

## Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS with a custom `globals.css` design system layer
- LiveKit client for realtime media
- Vitest + Testing Library for component/page tests
- Playwright for end-to-end tests

Important frontend entry files:

- `frontend/src/app/layout.tsx`
- `frontend/src/app/globals.css`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/api-v2.ts`

## App Shape

### Admin routes

- `/admin`
- `/admin/login`
- `/admin/products`
- `/admin/products/[id]`
- `/admin/sessions`
- `/admin/embed-share`
- `/admin/branding`
- `/admin/settings`

Compatibility routes still exist under `/admin/workspaces/*` and point back to the product-first experience.

### Public routes

- `/demo/[token]`: classic demo chat + optional live browser attach
- `/meet/[token]`: V2 immersive live meeting experience
- `/`: root landing page

## Folder Map

### `frontend/src/app`

Route files for App Router pages.

Important screens:

- admin shell pages
- public demo page
- public live meeting page

### `frontend/src/components`

Reusable view building blocks. The most important one today is `admin-shell.tsx`, which wraps the admin console layout and authentication check.

### `frontend/src/lib`

Client-side helpers:

- `api.ts`: legacy/admin REST client
- `api-v2.ts`: V2 meeting REST client

### `frontend/src/types`

TypeScript interfaces that mirror backend payloads:

- `types/api.ts`
- `types/v2.ts`

## Routing and API Strategy

The frontend talks to the backend over plain REST and WebSocket. There is no GraphQL layer, no global query library, and no Redux-style store.

Important implementation detail:

- Next.js rewrites `/api/:path*` to the backend URL in `frontend/next.config.js`

That means local development can work in two modes:

- same-origin via Next.js rewrite
- explicit `NEXT_PUBLIC_API_URL` if needed

This keeps page code simple because components can call `/api/...` through the shared clients without manually juggling CORS in the browser.

## Design System and Styling

The visual system is mostly defined in `frontend/src/app/globals.css`.

The file does more than base styles. It defines:

- global CSS variables for the public dark theme
- an admin theme override through `.admin-theme`
- utility classes for:
  - buttons
  - inputs
  - cards
  - badges
  - segmented controls
  - stage/live-demo controls

Fonts:

- `Instrument Sans` and `JetBrains Mono` are loaded in `layout.tsx`
- `globals.css` also imports additional families for display/admin presentation

Technical decision:

- the project uses Tailwind for layout speed, but the actual visual language lives in CSS variables and component classes
- this makes large visual restyling possible without rewriting every page

## Admin Console Architecture

The admin console is product-first even though the backend still stores products as `Workspace`.

Core shell:

- `frontend/src/components/admin-shell.tsx`

The shell does three things:

1. loads the current admin session via `adminApi.me()`
2. redirects unauthenticated users toward `/admin/login`
3. provides a consistent left navigation and page header

Current main sections:

- Products
- Sessions
- Settings

The admin experience is intentionally compact. Most advanced product configuration is nested inside a product detail page rather than spread across many top-level routes.

## Product Detail Page Structure

`frontend/src/app/admin/products/[id]/page.tsx`

This page is effectively the operating surface for a product.

Current tabs:

- `overview`
- `knowledge`
- `agent`
- `sessions`
- `share`

### Overview

Used for:

- basic product identity
- product URL and allowed domains
- auth mode
- readiness indicators

### Knowledge

Used for:

- listing all knowledge sources
- filtering by source type
- adding:
  - help docs
  - custom entries
  - file uploads
  - video uploads
- running the admin-side test agent

### Agent

Used for:

- agent name and greeting
- warmth, enthusiasm, formality
- answer length
- citation mode
- navigation mode
- guardrails and escalation setup

### Sessions

Used for:

- product-scoped session list
- transcript view
- summary and insight chips
- citations used
- recording status

### Share

Used for:

- demo link
- live meeting link
- iframe embed snippet
- starter prompts
- welcome and post-session messaging

## Public Demo Page: `/demo/[token]`

File:

- `frontend/src/app/demo/[token]/page.tsx`

This is the legacy but still-supported buyer flow.

Behavior:

1. create a classic `DemoSession`
2. let the buyer text-chat with the agent
3. optionally start the live browser session
4. connect to:
   - LiveKit room
   - runtime event WebSocket
5. render browser video in a separate panel when live mode starts

State is fully local to the page:

- `session`
- `messages`
- `status`
- `liveInfo`
- `browserTrackReady`
- `audioReady`

Why this matters:

- the page is intentionally self-contained
- it is easy to reason about in tests
- but it is not currently broken into many subcomponents

## Public Meeting Page: `/meet/[token]`

File:

- `frontend/src/app/meet/[token]/page.tsx`

This is the more advanced live-demo experience.

Bootstrap flow:

1. create meeting
2. update preferences such as language
3. prepare browser plan
4. prepare voice/live runtime
5. start live meeting
6. connect WebSocket event stream
7. connect LiveKit room
8. attach browser video and agent audio

This page carries more runtime complexity than any other frontend screen.

Important concerns it handles directly:

- live setup phases and progress UI
- browser stage health
- LiveKit room lifecycle
- autoplay/audio unlock behavior
- browser video brightness checks
- fallback between direct video rendering and canvas rendering
- late runtime events such as stale `attaching` states

Technical decision:

- the page keeps explicit refs for WebSocket, room, video, canvas, and timers instead of hiding that logic behind abstraction
- that makes media bugs easier to debug in one place

## Browser Video Rendering Decisions

The V2 meeting page contains defensive rendering logic because a subscribed track is not enough to guarantee a useful visual stage.

Current checks include:

- track subscribed
- video dimensions
- brightness sampling
- black-frame detection
- canvas mirror fallback

Why this exists:

- a track can be present but still render black frames
- the UI needs to distinguish "attached but unhealthy" from "not attached"

This is one of the most important frontend implementation decisions in the repo.

## State Management Philosophy

The frontend does not use a centralized store.

Instead it uses:

- `useState`
- `useEffect`
- `useMemo`
- `useRef`

Why:

- pages are route-local and workflow-heavy
- most state is tightly coupled to one screen
- backend remains the source of truth for persistent state

Tradeoff:

- large pages can get long
- some repeated fetch/update patterns are hand-written

If the app grows much further, the first good refactor would be extracting a small set of page-specific hooks, not jumping immediately to a global store.

## Type Discipline

The TypeScript interfaces in `frontend/src/types` mirror backend payloads closely.

This gives two benefits:

1. pages are easy to wire because request/response shapes are explicit
2. when backend payloads change, TypeScript failures make the break obvious

Important caution:

- there is no generated client today
- the types are manually mirrored
- if you change backend schemas, update these files in the same PR

## Testing Strategy

Unit and integration-like page tests:

- Vitest
- Testing Library
- `jsdom`

Config:

- `frontend/vitest.config.ts`
- `frontend/vitest.setup.ts`

Current page tests cover key flows such as:

- admin dashboard and product pages
- session review screens
- classic demo route
- V2 meeting route

End-to-end:

- Playwright
- config in `frontend/playwright.config.ts`

Important detail:

- Playwright uses dedicated backend/frontend test servers on ports `8100` and `3100`
- that avoids colliding with the default local dev ports

## Running Locally

### Frontend only

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:

- `http://localhost:3000`

### With backend

Backend should be reachable at the URL used by `frontend/next.config.js`.

Default rewrite target:

- `http://127.0.0.1:8000`

If you need to bypass rewrites and call a different backend, set:

```powershell
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000"
```

Then run:

```powershell
cd frontend
npm run dev
```

### Useful scripts

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run test`
- `npm run test:integration`
- `npm run test:e2e`

## Recommended Build Order If Rebuilding

If another engineer had to rebuild this frontend cleanly, the safest order is:

1. define API types and clients
2. build the public `/demo/[token]` chat flow
3. add the live browser panel and basic room attach
4. build the V2 `/meet/[token]` experience with setup phases
5. build the admin shell and login flow
6. build products list and product detail
7. add sessions review
8. add settings, branding, and embed/share
9. refine visual language and test coverage

That order mirrors dependency pressure:

- public runtime flows depend on backend session/meeting APIs
- admin pages depend on a more complete data model and settings surface

## Technical Decisions and Tradeoffs

### Keep page logic close to the route

Pros:

- easier debugging
- easy regression tests per page
- fewer invisible abstractions around media and WebSocket behavior

Tradeoff:

- some files are large, especially the meeting page

### Use two API clients

- `api.ts` for legacy/admin surfaces
- `api-v2.ts` for the newer meeting flow

Pros:

- V2 meeting code stays isolated
- older session API can evolve more slowly

Tradeoff:

- some overlap in helper logic

### Product-first UI on top of workspace-first backend

Pros:

- better admin UX language
- no backend token breakage

Tradeoff:

- frontend code and type names sometimes need to translate the old mental model

### CSS-variable theming over pure utility styling

Pros:

- broad visual rework is easier
- admin and public surfaces can diverge cleanly

Tradeoff:

- more custom CSS to maintain than a strict utility-only approach

## Known Constraints

- several route files are intentionally large and would benefit from extraction into hooks/components
- there is no shared query cache layer; repeated fetch logic is local
- media lifecycle code is necessarily imperative because LiveKit/video APIs are imperative
- design tokens live in CSS, so visual refactors should start there before editing many page files

## Where To Extend Safely

Good extension points:

- new admin section: add route under `frontend/src/app/admin/*` and wire to `AdminShell`
- new admin backend payloads: update `frontend/src/types/api.ts` and `frontend/src/lib/api.ts`
- new V2 meeting behavior: extend `frontend/src/types/v2.ts` and `frontend/src/lib/api-v2.ts`
- visual changes: start in `frontend/src/app/globals.css`
- admin layout/navigation changes: `frontend/src/components/admin-shell.tsx`

Areas to change carefully:

- `/meet/[token]` media lifecycle
- track attach/detach behavior
- WebSocket event parsing
- anything that changes the assumptions around browser stage health detection
