# site

Operator-facing CMS interface for the Haderach platform. A React/Vite app that lives in the left rail of the Haderach shell, giving content operators a purpose-built workflow UI for managing structured site content without needing direct access to the Payload admin panel.

## What it does

- **Collections** — browse all content collections with per-collection workflow status badges
- **Collection home** — landing page per collection showing shared content blocks (Intro, Closing) and a Listings entry as separate clickable items
- **Item editor** — inline form for all schema fields; 6-state workflow toolbar (Save / Submit / Publish / New Version / History / Close); rich text editing with Tiptap (ProseMirror JSON storage)
- **Approval diff** — before/after diff view for items under review; handles new items (no prior published version) and shared content blocks
- **Version history** — full version list with Current/Live badges; one-click restore; most-recent version navigates back to editor
- **Content type manager** — draft/commit lifecycle for schema management; additive-only changes once committed
- **Scheduling panel** — named schedules with publish dates; managed via agent chat
- **Permissions matrix** — collection × role grid for editor/approver/publisher/admin assignments

## Tech stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Tiptap (rich text, ProseMirror JSON storage)
- Firebase Auth (ID token → agent service → Payload CMS)

## Architecture

Data flows through the agent service — the site app never calls Payload directly.

```
Site app (Firebase Hosting /site/**)
  │
  ├─ read-only Payload REST  →  /cms/api/**  (public collection data)
  │
  └─ authenticated mutations  →  /agent/api/cms/**  (Firebase ID token)
       │
       ▼
  Agent service (Cloud Run)
       │
       ▼
  Payload CMS (Cloud Run / haderach-cms Postgres)
```

See `agent/docs/architecture.md` for the agent service and CMS proxy endpoint details.
See `haderach-cms/docs/architecture.md` for the Payload schema and collections.
Workspace-level Cursor rule coverage is tracked in
`../haderach-platform/docs/cursor-rule-matrix.md`.

## Local dev

**Prerequisites:** agent service running on port 8080, Payload CMS running locally.

```sh
# Install dependencies
npm install

# Start dev server (auth bypass mode — no agent needed)
VITE_AUTH_BYPASS=true npx vite --port 5177

# Start dev server (real auth mode — agent + Firebase sign-in required)
VITE_AUTH_BYPASS=false npx vite --port 5177
```

See `haderach-platform/.cursor/rules/local-dev-testing.mdc` for the full local dev setup guide.

## Content workflow

```
draft → needs_approval → approved → live
              ↘ changes_requested → (editor edits) → needs_approval
                                    approved → scheduled → live
                                                    live → (Deactivate) → draft
```

- **Editor** submits via the Submit button (ArrowBigRight icon) or agent chat
- **Approver** reviews the diff screen; Approve or Request Changes
- **Publisher** publishes approved items via the Publish button (Send/paper-plane icon)
- **Live items** can be:
  - **Deactivated** (Undo icon) — removes from public API and returns to draft for editing
  - **Cloned** via "New Version" (FilePlus2 icon) — creates editable draft while keeping original live

## Shared content blocks

Collections can define shared content blocks (e.g. Intro, Closing) in their content type schema under `shared_blocks`. These are stored as regular `content_items` with a `data.role` field (e.g. `shared_intro`, `shared_closing`) and appear on the collection home page alongside the Listings entry. They go through the full workflow lifecycle.

## Rich text storage

Rich text fields use Tiptap with ProseMirror JSON storage (`JSONContent`). The `tiptapConfig.ts` module provides:

- `tiptapExtensions` — shared extension list used by both editor and renderer
- `renderContentToHtml(value)` — accepts JSON or legacy HTML strings (backward compatible)
- `isContentEmpty(value)` — handles both formats for required-field validation
