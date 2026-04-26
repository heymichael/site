# site — Architecture

## Overview

The `site` app is the operator-facing CMS interface for the Haderach platform. It is a React + Vite SPA that lives at `/site/` in the Firebase Hosting domain and gives content operators a purpose-built workflow UI for managing structured content stored in Payload CMS — without exposing the Payload admin panel directly.

It is the visible client for content collections: editors browse and edit content items, approvers review diffs, publishers ship them live. All mutations flow through the agent service so they can be governed by RBAC, audit logging, and tool-call validation. Reads come straight from Payload's REST API.

## Cursor Rules

Workspace-level Cursor rule coverage and `alwaysApply` settings are tracked in
`../haderach-platform/docs/cursor-rule-matrix.md`.

## Repo Layout

```text
site/
├── .cursor/
│   ├── rules/
│   │   ├── architecture-pointer.mdc
│   │   ├── branch-safety-reminder.mdc
│   │   ├── cross-repo-status.mdc
│   │   ├── local-dev-testing.mdc
│   │   ├── pr-conventions.mdc
│   │   ├── repo-hygiene.mdc
│   │   ├── service-oriented-data-access.mdc
│   │   └── todo-conventions.mdc
│   └── skills/
│       └── brand-guidelines/
│           └── SKILL.md
├── .github/
│   ├── pull_request_template.md
│   └── workflows/
│       ├── ci.yml                    # PR checks (lint + build)
│       └── publish-artifact.yml      # Push to main → build → upload to GCS
├── docs/
│   └── architecture.md               # this file
├── scripts/
│   ├── generate-manifest.mjs         # Writes artifact manifest.json (app_id=site, contract v1)
│   └── package-artifacts.sh          # Tars dist/ → runtime.tar.gz + checksums.txt
├── src/                              # React + Vite SPA (TypeScript)
│   ├── auth/                         # Firebase Auth gate (platform-delegated sign-in)
│   │   ├── AuthGate.tsx              # Bypass-aware sign-in flow + dev sign-in button
│   │   ├── AuthUserContext.ts        # AuthUser context + isCmsAdmin helper
│   │   └── accessPolicy.ts           # Re-exports shared RBAC helpers; sets APP_ID="site"
│   ├── components/
│   │   ├── ConfirmDialog.tsx         # Generic confirmation modal
│   │   ├── RichTextEditor.tsx        # Tiptap editor wrapper (ProseMirror JSON)
│   │   └── tiptapConfig.ts           # Shared Tiptap extensions + render/empty helpers
│   ├── views/
│   │   ├── ApprovalDiff.tsx          # Before/after diff for items in needs_approval
│   │   ├── CmsWorkPane.tsx           # Mode router (browse | collection | edit | diff | …)
│   │   ├── CollectionHome.tsx        # Collection landing — Listings + shared blocks
│   │   ├── CollectionsList.tsx       # All collections w/ workflow badge counts
│   │   ├── ContentTypeManager.tsx    # Schema draft/commit lifecycle UI
│   │   ├── ItemEditor.tsx            # Inline form + 6-state workflow toolbar
│   │   ├── ItemsList.tsx             # Listings within a collection
│   │   ├── PermissionsMatrix.tsx     # Collection × role grid editor
│   │   ├── SchedulingPanel.tsx       # Read-only view of named publish schedules
│   │   └── VersionHistory.tsx        # Version list + restore
│   ├── App.tsx                       # AppRail + PaneToolbar + PaneLayout (chat | data)
│   ├── index.css                     # Tailwind v4 @theme tokens (Tier 2 app palette)
│   ├── main.tsx                      # React mount + AuthGate wrapper
│   └── vite-env.d.ts
├── .env.example                      # VITE_FIREBASE_*, VITE_AUTH_BYPASS, VITE_HOME_DEV_PORT
├── .gitignore
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json                      # @haderach/shared-ui via file: protocol
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts                    # base: '/site/', outDir: dist/site, dev proxies
```

## Data Flow

The site app is a **two-API consumer**:

- **Reads** — Payload CMS REST API at `/cms/api/**`, served by the `cms-api` Cloud Run service in production and proxied to `localhost:3000` in dev. Payload returns content items, content types, schedules, and CMS roles directly. No auth is required for read paths because the CMS REST API is treated as public catalog data.
- **Writes / workflow / chat** — agent service at `/agent/api/cms/**`, served by the `agent-api` Cloud Run service in production and proxied to `localhost:8080` in dev. Every write requires a Firebase ID token in `Authorization: Bearer <idToken>`. The agent enforces RBAC (CMS roles), validates payloads against the content type schema, manages versioning, and writes back to Payload's underlying Postgres via Payload's HTTP API.

```
Browser (site SPA at /site/)
   │
   ├── GET /cms/api/content-items/:id        ─►  cms-api (Payload)        ─►  Postgres
   ├── GET /cms/api/content-types?…          ─►  cms-api (Payload)        ─►  Postgres
   │
   └── POST/PATCH /agent/api/cms/…           ─►  agent-api (CMS handlers) ─►  Payload REST  ─►  Postgres
       (with Firebase ID token)
```

### Read paths (no auth)

| Endpoint | Used by |
|---|---|
| `GET /cms/api/content-items?…` | `CollectionsList`, `CollectionHome`, `ItemsList`, `ItemEditor`, `ApprovalDiff` |
| `GET /cms/api/content-items/:id?depth=1` | `ItemEditor`, `ApprovalDiff`, `VersionHistory` |
| `GET /cms/api/content-types?…` | `CollectionsList`, `PermissionsMatrix` |
| `GET /cms/api/content-types/:id` | `CollectionHome`, `ItemEditor`, `ContentTypeManager`, `ApprovalDiff` |
| `GET /cms/api/schedules?…` | `SchedulingPanel` |
| `GET /cms/api/cms-roles?…` | `PermissionsMatrix` |

### Write paths (Firebase ID token required)

| Endpoint | Used by | Purpose |
|---|---|---|
| `POST /agent/api/cms/items` | `ItemsList` | Create new content item (agent assigns `data.role` for shared blocks) |
| `PATCH /agent/api/cms/items/:id` | `ItemEditor`, `ApprovalDiff` | Save edits, transition workflow status, request changes, etc. |
| `POST /agent/api/cms/items/:id/versions/:versionId/restore` | `VersionHistory` | Restore a prior version as the current draft |
| `POST /agent/api/cms/content-types/:id/commit` | `ContentTypeManager` | Commit a draft content type (additive-only thereafter) |
| `DELETE /agent/api/cms/content-types/:id` | `ContentTypeManager` | Delete a draft content type (rejected for committed types) |
| `GET /agent/api/cms/items/:id/versions` | `VersionHistory`, `ApprovalDiff` | List all versions of an item (auth required because versions can include draft state) |
| `POST/PATCH/DELETE /cms/api/cms-roles[/:id]` | `PermissionsMatrix` | Assign/revoke CMS roles (admin-only — currently calls Payload directly; see Tech Debt) |

### Chat

The chat pane embeds `ChatPanel` from `@haderach/shared-ui` with `appContext="cms"` and an `extraContext` object that always reflects the current CMS mode (`browse | collection | edit | diff | history | content-types | permissions | schedules`) and the current `itemId` and `contentTypeSlug` if applicable. The agent uses this context to scope tool calls (e.g. "publish this item" knows which item is open).

All chat traffic flows through `/agent/api/chat`. The agent's CMS domain tools mutate content via the same agent CMS handlers listed above, so chat-driven changes follow the same RBAC and validation as UI-driven changes.

## Workflow

```
draft ──submit──► needs_approval ──approve──► approved ──publish──► live
                       │                          │                   │
                       │ request_changes          │ schedule          │ new_version
                       ▼                          ▼                   ▼
                changes_requested          scheduled              draft (clone)
                       │                          │
                       └──────── edit ────────────┘
                                 │
                                 ▼
                            needs_approval
```

States are stored on each content item as `workflow_status`. The `ItemEditor` toolbar surfaces only the transitions valid for the current state and the user's CMS role(s):

- **Editor** — Save, Submit
- **Approver** — Approve, Request Changes (on `needs_approval`)
- **Publisher** — Publish (on `approved`)
- **All roles** — New Version (on `live`), History, Close

Approver-driven `request_changes` carries an optional `workflow_comment` that surfaces to the editor.

## Shared content blocks

Collections can declare `shared_blocks` in their content type schema (e.g. an Intro and Closing block for a marketing page). Shared blocks are stored as regular `content_items` with a `data.role` discriminator (`shared_intro`, `shared_closing`, …) and appear on the `CollectionHome` view next to the Listings entry. They go through the full workflow lifecycle independently from the listings.

## Rich text storage

Rich text fields use Tiptap with **ProseMirror JSON** storage (`JSONContent`), not HTML. The `tiptapConfig.ts` module is the single source of truth:

- `tiptapExtensions` — extension list shared by editor and renderer (StarterKit + Link)
- `renderContentToHtml(value)` — accepts JSON or legacy HTML strings (backward compat with pre-migration data)
- `isContentEmpty(value)` — handles both formats for required-field validation

## UI Layout

The app uses the standard platform shell from `@haderach/shared-ui`:

- **AppRail** — left rail with domain navigation, feedback popover, user avatar. `activeAppId="site"`.
- **PaneToolbar** — top toolbar with chat and data pane toggles. Site exposes only `chat` and `data` (no `analytics`).
- **PaneLayout** — resizable two-pane area driven by `react-resizable-panels`.
  - **Chat pane** — `ChatPanel` from shared-ui, `mode="panel"`, `appContext="cms"`.
  - **Data pane** — `CmsWorkPane`, which dispatches to one of the views above based on the current `CmsMode`.

Mode and selection state live in `App.tsx` and are passed both into `CmsWorkPane` (to render the right view) and into `ChatPanel.extraContext` (to give the agent context about what the user is looking at).

## Authentication

Auth is centralized at the platform level. The site app uses Firebase Auth via `@haderach/shared-ui` primitives:

- `AuthGate` (local) wraps the app and decides between bypass mode, dev sign-in, and platform redirect.
- In **production**, unauthenticated users are redirected to `/?returnTo=/site/` for platform sign-in at the home origin.
- In **local dev** (`import.meta.env.DEV`), the app shows a dev-only "Sign in with Google" button on its own origin (port 5177) so haderach-home doesn't need to be running.
- `AuthUser` extends `BaseAuthUser` from shared-ui with site-specific fields (notably `isCmsAdmin`, derived from CMS roles).
- All mutating requests include `Authorization: Bearer <idToken>`. The token is obtained via `authUser.getIdToken()` and attached by each `fetch` call (the site app calls `fetch` directly rather than `agentFetch` because it talks to two services; see Tech Debt).

When `VITE_AUTH_BYPASS=true` is set in `.env`, `AuthGate` skips sign-in and renders with mock user data. Bypass mode is suitable for UI-only changes; backend-dependent changes need real auth mode.

## Routing

| Path | Target |
|---|---|
| `/site/**` | Firebase Hosting → static SPA `hosting/public/site/index.html` (rewrite in platform `firebase.json`) |
| `/cms/api/**` | Firebase Hosting rewrite → Cloud Run `cms-api` (Payload) |
| `/agent/api/**` | Firebase Hosting rewrite → Cloud Run `agent-api` |

Site does not own a Cloud Run service. Its production runtime is purely static assets in GCS, served by Firebase Hosting through the rewrite above.

## Build and Deploy

Site follows the platform's standard GCS artifact pattern (same as `vendors`, `card`, `expenses`, `stocks`, `admin-system`, `admin-vendors`).

### Build (publish-artifact workflow, push to `main`)

1. Checkout site repo.
2. Clone `haderach-home` (for `@haderach/shared-ui` workspace dependency, via `CROSS_REPO_PAT`).
3. `npm install --prefix ../haderach-home` then `npm ci` in site.
4. `npm run build` — runs `tsc -b && vite build` with all `VITE_FIREBASE_*` secrets injected so shared-ui's `runtime-config.ts` picks them up via `import.meta.env`. Output: `dist/site/`.
5. `scripts/package-artifacts.sh` — tars from `dist/` (preserves the `site/` prefix) into `artifacts/publish/runtime.tar.gz` + `checksums.txt`.
6. `scripts/generate-manifest.mjs` — writes `manifest.json` with `app_id: "site"`, semver+build version, commit SHA, runtime URI, sha256, and `platform_contract_version: v1`.
7. Authenticate to GCP via Workload Identity Federation as `site-artifact-publisher`.
8. `gsutil -m cp` uploads the three files to `gs://haderach-app-artifacts/site/versions/<commit_sha>/`.

### Deploy (platform `deploy.yml` or `batch-deploy.yml`, manual dispatch)

The platform's `platform-deploy` workflow (in `haderach-platform`) is the only thing that actually deploys to Firebase Hosting. To deploy site:

1. From the platform repo's Actions tab, run `platform-deploy` with `app_id=site`.
2. Platform downloads `manifest.json`, `runtime.tar.gz`, and `checksums.txt` from GCS.
3. Validates manifest (`app_id`, `platform_contract_version`, `commit_sha`).
4. Verifies sha256 checksum.
5. Extracts `runtime.tar.gz` into `hosting/public/` — the tarball contains a `site/` subdirectory so files land under `hosting/public/site/`.
6. Restores all other onboarded apps from their `latest-deployed.json` markers in GCS.
7. Runs `firebase deploy --only hosting --project haderach-ai`.
8. Writes a new `latest-deployed.json` marker for site.

`redeploy-all.yml` and `batch-deploy.yml` follow the same pattern across all onboarded apps.

## CI

`.github/workflows/ci.yml` runs on every PR against `main`:

1. Checkout + clone haderach-home (same as build).
2. `npm ci`.
3. `npm run lint` (eslint).
4. `npm run build` (with `VITE_FIREBASE_*` secrets — needed because tsc and Vite resolve shared-ui's runtime-config types/imports during build).

## Service Account and Secrets

| What | Where | Notes |
|---|---|---|
| `site-artifact-publisher@haderach-ai.iam.gserviceaccount.com` | GCP service account | Has `roles/storage.objectAdmin` on `haderach-app-artifacts` bucket. Used by GitHub Actions via WIF — no JSON key. |
| Workload Identity binding | `haderach-platform/infra/workload-identity.tf` | Allows `heymichael/site` repo to impersonate the publisher SA. |
| `CROSS_REPO_PAT` | site repo secret | GitHub PAT used to clone `haderach-home` for the workspace dep. |
| `VITE_FIREBASE_*` (7 vars) | site repo secrets | Inlined into the build by Vite. Mirror the values in haderach-home and other apps. |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | site repo variable | WIF provider resource name. |
| `GCP_SERVICE_ACCOUNT` | site repo variable | `site-artifact-publisher@…`. |
| `GCS_ARTIFACT_BUCKET` | site repo variable | `haderach-app-artifacts`. |

See `haderach-platform/docs/sa-matrix.md` for the canonical service account inventory.

## Local Development

Detailed procedure: `haderach-platform/.cursor/rules/local-dev-testing.mdc`. Site-specific summary:

1. Copy `.env.example` to `.env` and fill in `VITE_FIREBASE_*` (mirror `haderach-home/.env.local`).
2. Decide on mode:
   - **UI-only** — set `VITE_AUTH_BYPASS=true` in `.env`. No agent or CMS service needed.
   - **Backend-dependent** — set `VITE_AUTH_BYPASS=false`. Start agent (port 8080) and Payload CMS (port 3000).
3. Start dev server: `npx vite --port 5177`.

Vite proxies `/agent/api` to `localhost:8080` and `/cms/api` to `localhost:3000` (rewriting `/cms/api` → `/api` to match Payload's path). The custom `platformAuthDev` plugin serves a synthesized `/__/firebase/init.json` from the same `VITE_FIREBASE_*` env vars used at build time, so dev sign-in works without Firebase Hosting emulator.

## Cross-repo references

- **`haderach-cms`** — Payload CMS service (`cms-api`). Owns the schema for `content-items`, `content-types`, `cms-roles`, `schedules`. See `haderach-cms/docs/architecture.md`.
- **`agent`** — agent service (`agent-api`). Owns the `/agent/api/cms/**` handlers, the CMS domain tools used in chat, and RBAC enforcement. See `agent/docs/architecture.md`.
- **`haderach-home`** — provides `@haderach/shared-ui` (chat panel, app rail, pane layout, auth helpers, brand tokens) consumed via the `file:` protocol.
- **`haderach-platform`** — owns `firebase.json` (the `/site/**` rewrite), the platform deploy workflows, Terraform for the site SA and IAM, and the canonical local-dev / branch-safety / cross-repo-status rules.

## Tech Debt and Follow-ups

- **Direct `/cms/api/cms-roles` writes from `PermissionsMatrix`** — admin role assignments currently call Payload directly with the Firebase ID token rather than going through `/agent/api/cms/**`. Inconsistent with the rest of the app and not subject to agent-level audit logging. Should be migrated to an agent endpoint.
- **`fetch` instead of `agentFetch`** — site uses raw `fetch` with manual `Authorization` header construction. The shared `agentFetch` helper from `@haderach/shared-ui` would be cleaner but currently assumes `/agent/api` paths; would need a small extension to support `/cms/api` reads.
- **No `docs/<sub-system>.md` breakdown** — this is the single architecture doc. If the workflow logic, schema, or RBAC grow more complex, consider splitting into separate docs and linking from here.
