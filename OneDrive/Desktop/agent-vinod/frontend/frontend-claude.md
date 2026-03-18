# DemoAgent: Complete Product Specification
## Admin Console + Demo Stage — Production-Grade

---

## Part 0: Design Philosophy

Before any feature or flow, internalize these rules. Every screen, component, and interaction must pass through these filters.

### The Three Principles

**1. Earn every pixel.**
If an element doesn't directly help the user accomplish their current task, it doesn't exist. No decorative dividers. No "helpful" tooltips that nobody reads. No status badges that don't lead to an action. If you're debating whether something should be on the screen — it shouldn't.

**2. Text is the interface.**
Like Notion: the content IS the UI. Labels are clear enough to not need help text. Inputs are inline, not inside modals. Tables are readable without row striping or heavy borders. Typography hierarchy does the work that color and borders do in lesser products.

**3. Speed is a feature.**
Every page loads instantly or feels like it does. Optimistic updates everywhere — the UI responds before the server confirms. No loading modals. No multi-step wizards with "Next" buttons. One page, one scroll, everything saves automatically.

### Visual Language

```
Surfaces:     White (#FFFFFF) → Light gray (#F8F8F9) → Subtle gray (#F0F0F2)
Text:         Primary (#1A1A1A) → Secondary (#6B6B6E) → Tertiary (#A0A0A5)
Accent:       Single color. Warm amber (#D4963E). Used ONLY for: 
              primary CTAs, active states, the agent's visual identity.
Borders:      1px #E8E8EA. Used sparingly. Prefer spacing over lines.
Radius:       8px default. 12px for cards/containers. 20px for pills/tags.
Shadows:      Almost never. Only on elevated layers (dropdowns, command palette).
              When used: 0 4px 12px rgba(0,0,0,0.08)
Typography:   One sans-serif family. Two weights: Regular (400), Medium (500).
              Never bold. Never uppercase (except tiny labels if absolutely needed).
Spacing:      8px grid. Generous. Let things breathe.
Icons:        16px or 20px. Stroke-style only. Never filled. Never colored 
              (except active/selected states).
```

### Interaction Rules

- **No modals** for data entry. Modals only for destructive confirmations ("Delete this product?").
- **No wizards**. Multi-step processes happen on a single scrollable page with sections.
- **No dropdowns** when there are fewer than 6 options — use inline radio/toggle groups instead.
- **No toggle switches** for critical settings — too easy to accidentally flip. Use explicit radio buttons with labels.
- **Autosave everything.** Show a quiet "Saved" indicator that fades after 2 seconds. Never require a "Save" button.
- **Undo over confirm.** Instead of "Are you sure you want to delete?", delete immediately and show "Deleted. Undo" toast for 5 seconds.
- **Command palette (⌘K)** as the power-user navigation layer. Search across products, settings, sessions, knowledge entries.

---

## Part 1: Core Entities & Data Model

Before designing screens, understand what exists in the system.

### Entity Hierarchy

```
Organization (account)
└── Product (the SaaS being demoed)
    ├── Connection (how the agent accesses the product)
    ├── Knowledge (what the agent knows)
    │   ├── Source (a URL, video, file, or manual entry)
    │   └── Chunk (an individual piece of indexed knowledge)
    ├── Agent (how the agent behaves)
    │   ├── Persona (name, greeting, instructions)
    │   └── Rules (guardrails, escalation, response style)
    ├── Demo Config (session settings, suggested questions, post-session)
    └── Sessions (historical records of demo interactions)
        ├── Messages (conversation transcript)
        └── Events (navigation actions the agent took)
```

### Key Relationships

- One Organization → many Products
- One Product → one Connection (credentials/URL)
- One Product → many Sources → many Chunks
- One Product → one Agent config
- One Product → many Sessions
- One Session → many Messages + Events

### Product States

A product moves through four states:

```
[Draft] → [Configuring] → [Ready] → [Live]
```

- **Draft**: Created but no knowledge added yet.
- **Configuring**: At least one knowledge source added, but agent hasn't been tested.
- **Ready**: Agent tested, knowledge validated. Can go live.
- **Live**: Demo link is active. Prospects can access it.

The state is computed, not manually set. The UI shows what's missing to advance to the next state.

---

## Part 2: Information Architecture

### Navigation Structure

```
┌─ Sidebar (200px, collapsible) ─────────────────┐
│                                                  │
│  [Logo: DemoAgent]                               │
│                                                  │
│  Products                    ← default landing   │
│  Sessions                    ← cross-product     │
│                                                  │
│  ── separator ──                                 │
│                                                  │
│  Settings                                        │
│                                                  │
│  ── bottom ──                                    │
│  [Organization name]                             │
│  [User avatar + name]                            │
│                                                  │
└──────────────────────────────────────────────────┘
```

That's it. Three top-level items. Not five. Not seven. Three.

Why: Products is where 90% of the work happens. Sessions is the monitoring/review layer. Settings is account-level config. Everything else (knowledge, agent config, embed) lives WITHIN a product — not as top-level navigation.

### Inside a Product: Tab Navigation

When you click into a product, you see horizontal tabs (not more sidebar items):

```
[Product Name]                                    [Live ●]  [Share]

Overview    Knowledge    Agent    Sessions    Share
─────────────────────────────────────────────────────
```

Five tabs. Each is a single page, no sub-navigation needed.

---

## Part 3: Screens & Features — Detailed Specification

### Screen 1: Products List (`/products`)

**Purpose:** See all configured products at a glance. Create new ones.

**Layout:** Clean list — not a card grid. Each row is a product.

```
┌──────────────────────────────────────────────────────────┐
│  Products                                    [+ New]     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  🔵 Saleshandy              Live    142 sessions   │  │
│  │     saleshandy.com           ●      Last: 2h ago   │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  ○ TrulyInbox               Draft   0 sessions     │  │
│  │     trulyinbox.com                  Created: Today  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Each row shows:**
- Product name (clickable → goes to product overview)
- URL (subdued text)
- State indicator (Draft / Configuring / Ready / Live)
- Session count (lifetime)
- Last activity timestamp

**Actions:**
- Click row → enter product
- [+ New] button → opens a NEW product inline (not a modal, not a new page)
  - Inline form appears at top of list: Product name + URL. That's it. Hit Enter to create.
  - The product is created in Draft state. User clicks into it to configure.

**Empty state:** Centered illustration + "Add your first product" + single CTA button. Brief one-sentence explanation: "A product is the SaaS application you want your AI agent to demo."

---

### Screen 2: Product Overview (`/products/[id]`)

**Purpose:** The product's home page. Shows setup completeness, key stats, and quick access to everything.

**Layout:** Single scrollable page with clear sections.

**Section A: Product Identity**
Inline-editable fields. No "Edit" button — just click the text and type.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Product name        Saleshandy                     ✎   │
│  Website             saleshandy.com                 ✎   │
│  Description         Cold email and sales engagement ✎   │
│                      platform for B2B outreach           │
│  Target audience     Sales teams, SDRs, agencies    ✎   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Fields:
- **Product name**: Text. Required.
- **Website URL**: URL. Required. Used as the base for agent navigation.
- **One-line description**: Text. Required. Max 120 characters. Becomes the agent's elevator pitch.
- **Target audience**: Text. Optional. Helps agent calibrate language.

**Section B: Setup Progress**
A quiet checklist — NOT a progress bar. Shows what's done and what's remaining.

```
┌──────────────────────────────────────────────────────────┐
│  Setup                                                   │
│                                                          │
│  ✓  Product details added                                │
│  ✓  Demo connection configured                           │
│  ✓  Knowledge base has 47 entries                        │
│  ○  Test your agent (recommended before going live)      │
│                                                          │
│  Status: Ready                          [Go Live]        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Each checklist item links to the relevant tab. "Go Live" generates the demo link and switches state to Live. If already live, this shows the active link and a "Pause" option.

**Section C: Demo Connection**
How the agent accesses the product. Collapsed by default if already configured.

```
┌──────────────────────────────────────────────────────────┐
│  Demo Connection                          [Test ▶]       │
│                                                          │
│  Access type                                             │
│  (●) Login with credentials                              │
│  ( ) Public URL (no login needed)                        │
│                                                          │
│  Login URL         app.saleshandy.com/login         ✎   │
│  Email             demo@saleshandy.com              ✎   │
│  Password          ••••••••••                       ✎   │
│  Start page        /sequences              (optional) ✎ │
│                                                          │
│  Connection status: ✓ Verified 3 hours ago               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Fields:
- **Access type**: Radio toggle. Two options. Determines which fields appear below.
- **Login URL**: URL. Where the agent goes to log in.
- **Email / Username**: Text. Credential field.
- **Password**: Password field. Stored encrypted. Show/hide toggle.
- **Start page**: Optional URL path. Where the agent lands after login (e.g., `/dashboard`). If blank, it stays wherever the login redirects.
- **[Test]** button: Initiates a real login attempt. Shows a mini live-view window (300x200px) so the admin can SEE the agent logging in. Results in ✓ Verified or ✗ Failed with error details.

For "Public URL" access type:
- Only one field: the product URL. No credentials needed.

**Restricted areas** (collapsed subsection under Demo Connection):
```
│  Restricted areas (optional)                             │
│                                                          │
│  Pages the agent should never visit:                     │
│  [/settings/billing                              ] [×]   │
│  [/admin                                         ] [×]   │
│  [+ Add URL pattern]                                     │
```

Simple list of URL patterns. The agent will not navigate to any URL matching these patterns.

**Section D: Quick Stats (only visible when Live)**

```
┌──────────────────────────────────────────────────────────┐
│  Last 30 days                                            │
│                                                          │
│  Sessions     Avg. Duration     Questions Asked          │
│  142          8m 24s            4.2 per session           │
│                                                          │
│  Top asked features                                      │
│  1. Email Sequences (38%)                                │
│  2. Lead Finder (22%)                                    │
│  3. Email Warmup (18%)                                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Three numbers + a ranked list of what prospects ask about most. That's it. No charts. No graphs. Numbers tell the story faster.

---

### Screen 3: Knowledge (`/products/[id]/knowledge`)

**Purpose:** Manage everything the agent knows. The most important screen after the demo itself.

**Layout:** Two-zone layout — source list on the left, content view on the right (like a mail client or Notion's database views).

```
┌──────────────────────────────────────────────────────────┐
│  Knowledge                            [+ Add source]     │
│                                                          │
│  Filter: [All ▾]  Search: [________________]    47 items │
│                                                          │
│  ┌─ Source List (40%) ────┐  ┌─ Content (60%) ────────┐  │
│  │                        │  │                         │  │
│  │  ● Help Center         │  │  Source: Help Center    │  │
│  │    23 entries           │  │  URL: help.saleshandy… │  │
│  │    Synced: 2h ago       │  │  Status: ✓ Synced      │  │
│  │                        │  │  Entries: 23            │  │
│  │  ● Walkthrough Video   │  │                         │  │
│  │    12 entries           │  │  ┌──────────────────┐  │  │
│  │    Processed            │  │  │ How to create a  │  │  │
│  │                        │  │  │ new sequence      │  │  │
│  │  ● Custom Entries       │  │  │ ───────────────  │  │  │
│  │    8 entries            │  │  │ To create a new  │  │  │
│  │    Manual               │  │  │ email sequence,  │  │  │
│  │                        │  │  │ navigate to...   │  │  │
│  │  ● Product PDF          │  │  │                  │  │  │
│  │    4 entries            │  │  │ Source: help...  │  │  │
│  │    Processed            │  │  └──────────────────┘  │  │
│  │                        │  │                         │  │
│  └────────────────────────┘  │  [Edit]  [Delete]       │  │
│                              └─────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Left panel: Source list**
Each source is a collapsible group. Shows:
- Source type icon (subtle, stroke-style)
- Source name/identifier
- Number of knowledge entries extracted
- Sync/processing status
- Click to expand → shows individual entries within that source

**Right panel: Content view**
When a source is selected, shows source metadata and its entries.
When an individual entry is selected, shows the full content with edit capability.

**[+ Add source] flows:**

Clicking "Add source" shows an inline selector (NOT a modal):

```
┌──────────────────────────────────────────────┐
│  What kind of knowledge?                     │
│                                              │
│  ◻ Web pages      Paste URLs to crawl        │
│  ◻ Video          Upload or paste link       │
│  ◻ File           PDF, DOCX, or text file    │
│  ◻ Write manually Q&A entries you write      │
│                                              │
└──────────────────────────────────────────────┘
```

**Flow: Web pages**
```
Step 1 (inline):
┌──────────────────────────────────────────────┐
│  Add web pages                               │
│                                              │
│  Paste URLs (one per line):                  │
│  ┌────────────────────────────────────────┐  │
│  │ https://help.saleshandy.com/sequences │  │
│  │ https://help.saleshandy.com/warmup    │  │
│  │ https://help.saleshandy.com/leads     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ( ) Crawl these pages only                  │
│  (●) Crawl these + linked pages (1 level)    │
│                                              │
│  [Import]                                    │
│                                              │
└──────────────────────────────────────────────┘

Step 2 (processing state):
┌──────────────────────────────────────────────┐
│  Importing 3 URLs...                         │
│                                              │
│  ✓ /sequences — 8 entries extracted          │
│  ◌ /warmup — processing...                   │
│  ○ /leads — queued                           │
│                                              │
└──────────────────────────────────────────────┘

Step 3 (complete):
Source appears in the left panel. Entries are immediately 
searchable and available to the agent.
```

**Flow: Video**
```
┌──────────────────────────────────────────────┐
│  Add video                                   │
│                                              │
│  [Upload file]  or  paste URL:               │
│  ┌────────────────────────────────────────┐  │
│  │ https://youtube.com/watch?v=...       │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [Process]                                   │
│                                              │
└──────────────────────────────────────────────┘

Processing shows:
┌──────────────────────────────────────────────┐
│  Processing video...                         │
│                                              │
│  ✓ Downloaded                                │
│  ✓ Transcribed (14:32 duration)              │
│  ◌ Chunking into knowledge entries...        │
│                                              │
└──────────────────────────────────────────────┘

Once done, entries appear with timestamps:
  [0:00–1:45]  Introduction to Saleshandy dashboard
  [1:45–4:12]  Creating an email sequence
  [4:12–6:30]  Setting up A/B test variants
  ...

Each entry is editable — admin can correct transcription 
errors or add context.
```

**Flow: File upload**
Drag-and-drop zone. Accepts PDF, DOCX, TXT, MD. Processes immediately. Shows extracted entries for review.

**Flow: Manual entry**
```
┌──────────────────────────────────────────────┐
│  Add knowledge entry                         │
│                                              │
│  Topic / Question:                           │
│  ┌────────────────────────────────────────┐  │
│  │ What makes Saleshandy different from  │  │
│  │ Apollo.io?                             │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Answer / Content:                           │
│  ┌────────────────────────────────────────┐  │
│  │ Unlike Apollo which focuses on being  │  │
│  │ a database-first tool, Saleshandy is  │  │
│  │ built for cold email execution. Key   │  │
│  │ differences: built-in email warmup,   │  │
│  │ unified inbox, sender rotation...     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [Save entry]                                │
│                                              │
└──────────────────────────────────────────────┘
```

**Bulk knowledge features:**
- **Search**: Full-text search across all entries from all sources. Fast. Instant results as you type.
- **Filter by source**: Dropdown to show entries from specific sources only.
- **Edit inline**: Click any entry → edit content directly in the right panel. Autosaves.
- **Delete**: Select entries → delete. Undo toast.
- **Re-sync**: For URL sources, a "Re-sync" button re-crawls and updates entries. Shows diff of what changed.

**Test Agent (embedded in Knowledge tab):**

A persistent, collapsible panel at the bottom of the Knowledge screen:

```
┌──────────────────────────────────────────────────────────┐
│  ─── Test Agent ─────────────────────── [Expand ▲]       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  You: How does email warmup work?                  │  │
│  │                                                    │  │
│  │  Agent: Email warmup gradually increases your      │  │
│  │  sending volume over time to build domain          │  │
│  │  reputation. Saleshandy's warmup connects to...    │  │
│  │                                                    │  │
│  │  Confidence: 92%                                   │  │
│  │  Sources used: Help Center → Email Warmup Guide    │  │
│  │                 Video → [4:12–6:30]                │  │
│  │                                                    │  │
│  │  ────────────────────────────────────────────────  │  │
│  │                                                    │  │
│  │  [Ask a question...                        ] [→]   │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

This is knowledge-only testing — the agent answers questions but doesn't navigate the browser. It shows confidence scores and which knowledge chunks were retrieved. This is how the admin validates that their knowledge base is working before going live.

Critical: every test response shows a "Sources used" section. If a response has low confidence or uses no sources, that's a signal to add more knowledge in that area. This feedback loop is the core quality mechanism.

---

### Screen 4: Agent (`/products/[id]/agent`)

**Purpose:** Configure how the agent behaves, speaks, and handles edge cases.

**Layout:** Single scrollable page. Three sections.

**Section A: Persona**

```
┌──────────────────────────────────────────────────────────┐
│  Persona                                                 │
│                                                          │
│  Agent name                                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ (empty — agent won't introduce itself by name)     │  │
│  └────────────────────────────────────────────────────┘  │
│  Leave blank for a nameless guide. Set a name like       │
│  "Sarah" if you want a named persona.                    │
│                                                          │
│  Greeting message                                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Hey! I'm here to walk you through Saleshandy.     │  │
│  │ What would you like to explore?                    │  │
│  └────────────────────────────────────────────────────┘  │
│  First message the prospect sees. Keep it short.         │
│                                                          │
│  Tone                                                    │
│  How formal?       Casual  ○ ○ ● ○ ○  Formal            │
│  How technical?    Simple  ○ ● ○ ○ ○  Technical          │
│                                                          │
│  Custom instructions                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Always mention the 7-day free trial when relevant. │  │
│  │ If asked about competitors, focus on what we do    │  │
│  │ well rather than criticizing others.               │  │
│  │ Emphasize that we're built specifically for cold   │  │
│  │ email, not general CRM.                            │  │
│  └────────────────────────────────────────────────────┘  │
│  Freeform instructions that shape the agent's behavior.  │
│  Write as if you're briefing a new team member.          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Fields:
- **Agent name**: Text. Optional. If set, the agent uses it in greeting. If blank, the agent is a nameless guide.
- **Greeting message**: Textarea. Required. Max 280 characters. What the prospect sees first.
- **Tone — Formality**: 5-point radio scale. Casual ↔ Formal. Affects language register.
- **Tone — Technicality**: 5-point radio scale. Simple ↔ Technical. Affects jargon usage and explanation depth.
- **Custom instructions**: Textarea. Optional. Unlimited. Freeform text injected into the agent's system prompt. This is the power-user escape hatch for any behavioral nuance the structured fields don't cover.

Two sliders instead of three. Dropped "enthusiasm" — it's too subjective and hard to reliably control in an LLM. Formality and technicality are the two axes that actually change output meaningfully.

**Section B: Response Behavior**

```
┌──────────────────────────────────────────────────────────┐
│  Response Behavior                                       │
│                                                          │
│  Answer length                                           │
│  (●) Concise — 2-3 sentences, let the demo do the       │
│      talking                                             │
│  ( ) Balanced — short paragraphs with key details        │
│  ( ) Detailed — thorough explanations with context       │
│                                                          │
│  When the agent doesn't know something                   │
│  (●) Acknowledge honestly and offer to connect with      │
│      your team                                           │
│  ( ) Acknowledge and move on (no escalation offer)       │
│  ( ) Try to answer from general knowledge (less safe)    │
│                                                          │
│  Show navigation in the product                          │
│  (●) Automatically — agent navigates to relevant         │
│      features while explaining                           │
│  ( ) Only when asked — agent explains verbally unless    │
│      the prospect says "show me"                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Three questions. Three radio groups. No toggles, no sliders, no complexity. Each option has a one-line description so the admin understands the tradeoff without needing documentation.

**Section C: Guardrails & Escalation**

```
┌──────────────────────────────────────────────────────────┐
│  Guardrails                                              │
│                                                          │
│  Topics to deflect                                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Custom enterprise pricing                     [×] │  │
│  │ Upcoming features / product roadmap            [×] │  │
│  │ Internal company information                   [×] │  │
│  │                                                    │  │
│  │ [+ Add topic]                                      │  │
│  └────────────────────────────────────────────────────┘  │
│  When a prospect asks about these, the agent will        │
│  acknowledge the question and offer to connect them      │
│  with your team instead.                                 │
│                                                          │
│  ──────────────────────────────────────────────────────  │
│                                                          │
│  Escalation                                              │
│                                                          │
│  When the agent needs to hand off to a human:            │
│                                                          │
│  Booking link (Calendly, Cal.com, etc.)                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ https://calendly.com/saleshandy/demo              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Team email                                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ sales@saleshandy.com                              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Escalation message                                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Great question — I want to make sure you get the  │  │
│  │ best answer. Let me connect you with the team.    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Fields:
- **Topics to deflect**: Editable tag-style list. Freeform text entries.
- **Booking link**: URL. Optional. If set, the agent shows a "Book a call" button during escalation.
- **Team email**: Email. Optional. If set, shown as an alternative contact method.
- **Escalation message**: Textarea. The agent's handoff message. Has a sensible default.

If BOTH booking link and email are empty, the agent simply acknowledges what it doesn't know and moves on — no dead-end CTA pointing nowhere.

---

### Screen 5: Sessions (`/products/[id]/sessions` AND `/sessions`)

**Purpose:** Review what happened in demo sessions. Identify patterns.

Two access points — same data:
- `/sessions` shows ALL sessions across ALL products (global view)
- `/products/[id]/sessions` shows sessions for ONE product (filtered view)

**Layout:** Clean table. Airtable-style.

```
┌──────────────────────────────────────────────────────────┐
│  Sessions                                                │
│                                                          │
│  Filter: [All products ▾]  [Last 30 days ▾]  [Search]   │
│                                                          │
│  Date          Product      Duration  Questions  Handoff │
│  ─────────────────────────────────────────────────────── │
│  Mar 15, 2:40p Saleshandy   12:34     6          No     │
│  Mar 15, 11:02 Saleshandy   4:12      2          Yes    │
│  Mar 14, 9:15a Saleshandy   18:45     11         Yes    │
│  Mar 13, 4:30p Saleshandy   6:02      3          No     │
│                                                          │
│  Showing 4 of 142 sessions              [Load more]      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Columns:
- **Date**: Timestamp, human-readable format
- **Product**: Product name (relevant in global view)
- **Duration**: Session length in mm:ss
- **Questions**: Number of questions the prospect asked
- **Handoff**: Whether escalation was triggered (Yes/No)

Click a row → opens session detail.

**Session Detail (`/sessions/[id]`)**

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to sessions                                      │
│                                                          │
│  Session — Mar 15, 2026, 2:40 PM                         │
│  Product: Saleshandy · Duration: 12:34 · 6 questions     │
│                                                          │
│  ┌─ Transcript ──────────────────────────────────────┐   │
│  │                                                    │   │
│  │  2:40:00  Agent                                    │   │
│  │  Hey! I'm here to walk you through Saleshandy.    │   │
│  │  What would you like to explore?                   │   │
│  │                                                    │   │
│  │  2:40:15  Prospect                                 │   │
│  │  How do I set up email sequences?                  │   │
│  │                                                    │   │
│  │  2:40:18  Agent                                    │   │
│  │  Let me show you the sequence builder.             │   │
│  │  → Navigated to /sequences                         │   │
│  │  → Clicked "Create Sequence"                       │   │
│  │                                                    │   │
│  │  2:40:22  Agent                                    │   │
│  │  This is where you create multi-step outreach      │   │
│  │  campaigns. You can add email steps, set delays    │   │
│  │  between them, and create A/B variants...          │   │
│  │                                                    │   │
│  │  Sources: Help Center → Sequences Guide (92%)      │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Insights ────────────────────────────────────────┐   │
│  │  Features explored: Sequences, Warmup, Lead Finder │  │
│  │  Unanswered questions: 1                           │  │
│  │    "Do you integrate with Pipedrive?"              │  │
│  │  Handoff triggered: No                             │  │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

The transcript is the primary content. It shows:
- Timestamps for each message
- Agent messages with source attribution (which knowledge chunks were used)
- Prospect messages
- Agent navigation events (inline, styled differently — as system events, not messages)

Below the transcript, an "Insights" summary panel:
- Features explored (automatically tagged from navigation events)
- Unanswered questions (questions where confidence was low or agent deflected)
- Whether handoff was triggered

The "Unanswered questions" section is the most actionable — it directly tells the admin what knowledge gaps to fill. Clicking an unanswered question → navigates to Knowledge tab with that question pre-filled as a new custom entry.

---

### Screen 6: Share (`/products/[id]/share`)

**Purpose:** Get the demo link. Configure what prospects see when they arrive.

**Layout:** Simple, focused page.

```
┌──────────────────────────────────────────────────────────┐
│  Share                                                   │
│                                                          │
│  ┌─ Demo Link ───────────────────────────────────────┐   │
│  │                                                    │   │
│  │  https://demo.yourdomain.com/s/sh-abc123          │   │
│  │                                        [Copy]      │   │
│  │                                                    │   │
│  │  Status: Live ●                       [Pause]      │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Starter Questions ───────────────────────────────┐   │
│  │                                                    │   │
│  │  Shown as clickable suggestions in the demo:       │   │
│  │                                                    │   │
│  │  1. How do email sequences work?              [×]  │   │
│  │  2. Show me the lead finder                   [×]  │   │
│  │  3. How does email warmup help deliverability? [×] │   │
│  │  4. What integrations do you support?         [×]  │   │
│  │  5. Can I see the analytics dashboard?        [×]  │   │
│  │                                                    │   │
│  │  [+ Add question]                                  │   │
│  │                                                    │   │
│  │  Show ___3___ questions at a time                  │   │
│  │  Rotate based on conversation context              │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Session Settings ────────────────────────────────┐   │
│  │                                                    │   │
│  │  Session time limit                                │   │
│  │  ( ) 10 minutes                                    │   │
│  │  (●) 20 minutes                                    │   │
│  │  ( ) 30 minutes                                    │   │
│  │  ( ) No limit                                      │   │
│  │                                                    │   │
│  │  When session ends                                 │   │
│  │  (●) Show summary with call-to-action              │   │
│  │  ( ) Redirect to a URL                             │   │
│  │                                                    │   │
│  │  CTA button text    [Book a live demo         ]    │   │
│  │  CTA link           [https://calendly.com/... ]    │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Appearance ──────────────────────────────────────┐   │
│  │                                                    │   │
│  │  Logo          [Upload]  or  ← current logo        │   │
│  │  Accent color  [■ #D4963E]  ← click to change      │   │
│  │                                                    │   │
│  │  Preview                    [Open preview ↗]       │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Everything the prospect experiences is configured here:
- **Demo link**: The shareable URL. Copy button. Pause/resume toggle.
- **Starter questions**: The clickable suggestion pills shown in the demo. Ordered list, draggable to reorder. Admin controls how many show at once.
- **Session settings**: Time limit, end behavior, CTA configuration.
- **Appearance**: Logo and accent color override. Plus a "Preview" button that opens the demo stage exactly as a prospect would see it.

---

### Screen 7: Settings (`/settings`)

**Purpose:** Account-level configuration. Minimal.

```
┌──────────────────────────────────────────────────────────┐
│  Settings                                                │
│                                                          │
│  ┌─ Account ─────────────────────────────────────────┐   │
│  │  Organization name    Saleshandy Inc.         ✎   │   │
│  │  Owner email          malav@saleshandy.com    ✎   │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ API ─────────────────────────────────────────────┐   │
│  │  API Key              sk-••••••••••••••4f2a        │   │
│  │                       [Regenerate]  [Copy]         │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Billing ─────────────────────────────────────────┐   │
│  │  Current plan: Free (POC)                          │   │
│  │  Sessions this month: 12 / 50                      │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Danger Zone ─────────────────────────────────────┐   │
│  │  [Delete account]                                  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Part 4: Demo Stage (Prospect Side) — Detailed Spec

This was covered in the earlier frontend prompt but here are the production-grade additions:

### Pre-Session Loading

When a prospect clicks the demo link, they see:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                                                          │
│              [Product Logo]                               │
│                                                          │
│              Preparing your demo...                       │
│              ═══════════════════ (shimmer line)           │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

The system is:
1. Spinning up a browser session (Browserbase)
2. Logging into the demo account
3. Navigating to the start page
4. Initializing the conversation

This takes 3-8 seconds. The loading screen is calm, branded with the product logo, and uses the shimmer line (not a spinner).

If loading fails (credentials expired, Browserbase down):
```
│  Something went wrong while setting up the demo.         │
│  This usually resolves itself in a few minutes.          │
│                                                          │
│  [Try again]    or    [Contact the team →]               │
```

### During Session

The live demo experience as specified in the frontend prompt. Adding specifics:

**Context bar behavior:**
- Hidden by default
- Appears when agent starts navigating: `Viewing: Sequences → Create New`
- Updates as the agent moves through the product
- Has subtle breadcrumb-style formatting
- Fades out after 3 seconds of no navigation

**Agent behavior during navigation:**
- When the agent navigates, it sends TWO things simultaneously:
  1. A text message to the conversation (the explanation)
  2. Browser actions to the demo screen (the visual)
- The prospect sees the product changing while reading the explanation
- Navigation actions appear as subtle inline events in the conversation:
  `→ Opening Sequences` (styled in --text-tertiary, not as a full message)

**Suggested questions behavior:**
- Show 3 questions below the input at all times
- After each agent response, the suggestions update contextually
- If the agent just showed email sequences, suggestions might be:
  `[How does A/B testing work?]  [Show me analytics]  [What about follow-ups?]`
- Suggestions are NOT the same as the admin's starter questions — the starter questions appear ONLY at the beginning. Subsequent suggestions are generated by the AI based on context.

**Session time warning:**
- At 2 minutes before time limit: The agent naturally mentions "We have a couple more minutes — any final things you'd like to see?"
- At time limit: The agent wraps up gracefully and the UI transitions to the post-session page
- The prospect is NEVER abruptly cut off

### Post-Session

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│              [Product Logo]                               │
│                                                          │
│              Thanks for exploring Saleshandy!             │
│                                                          │
│              During this session, we covered:             │
│              · Email Sequences                            │
│              · Lead Finder                                │
│              · Email Warmup                               │
│                                                          │
│              ┌────────────────────────┐                   │
│              │  Book a live demo  →   │                   │
│              └────────────────────────┘                   │
│                                                          │
│              or start a free trial at saleshandy.com      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Simple. Logo, summary of features covered (auto-generated from navigation events), CTA button (configured by admin in Share settings), and a secondary text link.

---

## Part 5: User Flows (End-to-End Journeys)

### Flow 1: First-Time Setup (Admin)

```
Sign up / Log in
    ↓
Land on Products page (empty state)
    ↓
Click "Add your first product"
    ↓
Enter product name + URL → product created in Draft
    ↓
Redirected to Product Overview
    ↓
Fill in description + target audience (inline editing)
    ↓
Configure Demo Connection (enter credentials, test login)
    ↓
Go to Knowledge tab → Add first source (help center URLs)
    ↓
Wait for processing → Review extracted entries
    ↓
Open Test Agent panel → Ask 5-10 questions → Verify quality
    ↓
Go to Agent tab → Customize greeting + tone (optional)
    ↓
Go to Share tab → Configure starter questions + session settings
    ↓
Click "Go Live" on Overview → Demo link generated
    ↓
Copy link → Share with first prospect
```

Total estimated time: 20-30 minutes for initial setup.

### Flow 2: Ongoing Knowledge Maintenance (Admin)

```
Review Sessions → Find unanswered questions
    ↓
Click unanswered question → Taken to Knowledge tab 
with question pre-filled as new entry
    ↓
Write answer → Save
    ↓
Test Agent → Verify the new entry works
    ↓
Done — agent is immediately smarter
```

This is the core improvement loop. Every session that exposes a gap becomes an improvement opportunity.

### Flow 3: Prospect Experience

```
Receive demo link (email, website, sales outreach)
    ↓
Click link → Loading screen (3-8 seconds)
    ↓
Demo stage loads: Browser stream + Conversation panel
    ↓
Agent greets with configured message
    ↓
Prospect sees starter questions as clickable pills
    ↓
Prospect clicks a question OR types their own
    ↓
Agent responds with text + navigates the product live
    ↓
Prospect watches, asks follow-ups
    ↓
If agent can't answer → Escalation message + CTA
    ↓
Session time warning at 2 minutes remaining
    ↓
Session ends → Post-session page with summary + CTA
```

### Flow 4: Agent can't answer → Knowledge gap → Fix

```
During session: Prospect asks something agent doesn't know
    ↓
Agent responds: "I don't have detailed info on that. 
Let me connect you with the team." + Shows booking CTA
    ↓
Session ends. Session is logged with "unanswered question" flag.
    ↓
Admin reviews sessions → Sees unanswered question
    ↓
Admin adds knowledge entry for that topic
    ↓
Next prospect who asks the same question → Agent answers correctly
```

---

## Part 6: Edge Cases & Error Handling

### Demo Connection Failures
- **Credentials expired**: Agent detects login failure → Shows prospect a graceful message: "The demo environment is being updated. Please try again in a few minutes." → Admin receives email notification: "Your demo credentials for [Product] may have expired."
- **Product is down**: Same graceful message to prospect. Admin notification.
- **Slow loading**: If browser session takes >10 seconds, show additional message: "This is taking a moment — hang tight."

### Agent Edge Cases
- **Prospect asks the same question twice**: Agent recognizes the repeat and offers to go deeper: "We touched on this earlier — would you like me to show you a different aspect of it?"
- **Prospect goes off-topic** (asks about weather, tells jokes): Agent briefly acknowledges and redirects: "Ha! I'm best at talking about [Product] though. What feature would you like to explore?"
- **Prospect is silent for >2 minutes**: Agent gently prompts: "Still there? I'm happy to show you around [popular feature] if you'd like."
- **Prospect asks about a competitor**: Agent uses knowledge base for competitive positioning if available. If not, stays neutral: "I'm best equipped to show you what [Product] does well. Want me to walk you through [relevant feature]?"
- **Multiple rapid questions**: Agent acknowledges the queue: "Great questions — let me tackle them one at a time." Answers in order.

### Admin Edge Cases
- **Deleting a product that's live**: Confirmation dialog (one of the rare cases we use a modal): "This product has an active demo link. Deleting it will immediately disable all demo sessions. Are you sure?"
- **No knowledge added but trying to go live**: Setup checklist blocks "Go Live" with clear message: "Add at least one knowledge source before going live."
- **Video transcription fails**: Show error with retry option. Common reason: unsupported format or too large. Show accepted formats and size limits.

---

## Part 7: What NOT to Build (POC Scope Boundaries)

Explicitly excluded from POC to keep scope tight:

- **Multi-user / team features**: One admin per organization. No roles, no permissions.
- **Widget / embed mode**: Only shareable link mode. No JavaScript widget for embedding on third-party sites.
- **Custom domains**: All demo links use our domain.
- **Session recording / replay**: Store transcripts only. No video replay of the browser session.
- **Analytics dashboard with charts**: Just the three numbers on the product overview. No trends, no time-series, no charts.
- **Billing / payments**: Placeholder page only. No Stripe integration.
- **Email notifications**: No automated emails to admin (session summaries, credential expiry alerts). Just the web UI.
- **A/B testing agent configs**: One agent config per product. No variant testing.
- **Prospect identification**: Sessions are anonymous. No asking for name/email before the demo.
- **Voice input/output**: Text only. Voice is a post-POC feature.
- **Agent "Guide me" mode**: View-only for the prospect. No handing over browser control.
- **Auto-generated knowledge from crawling**: Manual URL input only. No "crawl my entire site" feature.
- **Real-time collaboration**: No "watch a prospect's session live from admin."

These are all valid features for V2/V3. Listing them here ensures nobody accidentally builds them into the POC.