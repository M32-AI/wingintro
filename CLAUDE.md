# CLAUDE.md — wingintro

@AGENTS.md

WingIntro is the candidate-facing recorder: a Next.js (App Router) app where a
candidate records a short audio/video intro that is uploaded to the AI-Recruiter
backend and (when opened from a recruiter link) attached to their résumé.

## Build & gate

- Package manager: **bun** (`bun install`). A `bun.lock` is committed — don't
  commit incidental lockfile churn from `bun install`.
- The gate before merge: **`bun run build`** (`next build`, Next 16 / Turbopack)
  must be green. Also run `./node_modules/.bin/tsc --noEmit` and
  `./node_modules/.bin/eslint` on changed files.

## Deploy & danger zones

- Work on a branch and open a PR; **the human owns the merge**. Don't push to
  `main` directly, and don't merge your own PR. Confirm the branch-protection /
  auto-deploy model before assuming `main` is safe to push.
- Don't commit or push unless asked.

## Hard rules

- **Backend contract:** this app only talks to the AI-Recruiter backend at
  `NEXT_PUBLIC_API_URL`. Uploads go to `POST /voice-recording/upload` (form
  field `audio`) and `POST /video-recording/upload` (form field `video`), plus
  an optional `token` field that binds the recording to a candidate. Don't add
  fields or endpoints the backend doesn't actually accept — verify against
  `ai-recruiter-backend` first, or the recording silently fails to attach.
- **Surgical changes only** — match existing style, no speculative refactors.
- Heed `AGENTS.md`: this is not the Next.js in your training data — read the
  bundled guide in `node_modules/next/dist/docs/` before writing framework code.

## Architecture

- `app/` — App Router pages. `app/record/page.tsx` reads `mode` (video|audio)
  and an optional `token` from the URL query and renders the recorder.
- `components/RecorderClient.tsx` — the client recorder (getUserMedia +
  MediaRecorder); calls the upload helper and forwards the `token`.
- `lib/recording.ts` — modes, limits, mime handling.
- `lib/api/recording.ts` — `uploadRecording(mode, blob, duration, filename,
  token?)`; endpoint + field selection per mode.
- Key env var: `NEXT_PUBLIC_API_URL` (backend base, e.g. `https://t2.wing.work/api`).

## House style

- TypeScript + React 19, Tailwind v4. Keep components small and match the
  existing recorder patterns; no new state libraries or abstractions.
