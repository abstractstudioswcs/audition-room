# Audition Room

A web app that runs musical-theatre auditions across three devices at once: singers check in on a phone or kiosk, the accompanist runs a live queue on a tablet, and the music director logs ranges and casts on a laptop.

Owner: Abstract (Kelton Hunt), music director and event-technology lead in LaGrange, GA. First pilot: LSPA (Lafayette Society for Performing Arts) auditions.

## Where things stand

The production app is built: Next.js 16 + Supabase (Postgres, Auth, Realtime, Storage), deployed on Vercel. See README.md for pages and setup.

`prototype/index.html` is the original single-file prototype from Claude's artifact platform. It is the reference for screens, copy and behavior.

## Code map

- `supabase/migrations/` schema, row-level security, `check_in()`, `checkin_info()`, `create_theatre()`, `join_theatre()`, music storage bucket.
- `supabase/tests/` + `scripts/test-db.sh` access-rule tests on plain Postgres with a small Supabase shim.
- `src/lib/music.ts` note parsing and range fit (unit-tested in `music.test.ts`).
- `src/lib/use-production.ts` one hook loads a production's data and keeps it live via Supabase Realtime, polling if the socket drops.
- `src/app/api/uploads/route.ts` issues performers one-time signed upload URLs (service-role key, server only).
- `src/app/c/[code]` performer check-in; `src/app/app/...` staff views.

## Next.js 16 notes

- Route params are read on the client with `useParams()` inside `<Suspense>`, because Cache Components prerenders pages by default.
- `src/proxy.ts` (formerly middleware) refreshes the Supabase session and guards `/app`.
- Fonts are self-hosted via `@fontsource` packages; the PDF.js worker is copied to `public/` on `npm install`.

## Views in the prototype

- **Welcome**: "Who's using this device?" Performer, Accompanist, Music director, Director, Setting up the show. Remembered per device. Performers only ever see check-in.
- **Check in (performer)**: name, song, show; music as sheet upload (PDF/photos), track link, or track on phone; cut start/end, key, first sung note, tempo, note to pianist, characters they'd like to be considered for. Returns an audition number.
- **Accompanist**: live queue (Now / Next / On deck, missing music flagged), big key/first-note/tempo/cut readouts, play starting pitch and 4-beat count-in via Web Audio, sheet music inline, "Done, call next" advances the room. Tap any name to call out of order.
- **Music director**: per-singer voice type, low, high, belt; role-fit bars against every character (Full fit / Low end short by n / Top short by n / Not a fit); 1-5 rating; notes; callback checkboxes; "Consider" puts a singer on the casting board. Auto-follows whoever is singing unless notes are unsaved.
- **Casting board (director)**: one column per character; add singers (best range fits listed first), mark Considering or Cast, per-placement notes; one singer may sit on several characters; unplaced singers listed.
- **Setup**: show title; characters with voice type, optional lowest note, top note, "what you need" notes; clear all session data (characters stay).

Note names use scientific pitch (middle C = C4). Fit logic lives in `fit()` and `midi()` in the prototype; port it as-is with tests.

## Data model (from the prototype)

- `show/config`: `{ title, roles: [{ id, name, voice, low, high, notes }] }`
- `auditioners/{id}`: `{ slot, name, song, show, musicType: sheet|link|phone, files: [{ id, type, name }], trackLink, cutStart, cutEnd, key, firstNote, tempo, note, roles: [roleId], status: waiting|singing|done, createdAt }`
- `state/queue`: `{ currentId }`
- `scores/{auditionerId}`: `{ voice, low, high, belt, rating, notes, callbacks: [roleId], savedAt }`
- `casting/{roleId}__{auditionerId}`: `{ roleId, auditionerId, status: considering|cast, note, addedAt }`

## What the production build fixed (from the prototype)

1. **Public check-in.** On the prototype platform only invited Editors could write, so performers couldn't check in from their own phones. The real app needs a per-audition public check-in link (no account) that can only create its own check-in, while staff views require sign-in.
2. **Audio uploads.** The prototype platform rejected MP3/M4A, so backing tracks were link-only. Support audio uploads with size limits.
3. **Real roles and permissions.** The welcome screen only changes what a device shows. Enforce staff vs performer access server-side.
4. **Multiple theatres and productions.** One account per theatre, many productions per account, many audition sessions per production.
5. **PDF display.** Render PDFs inline in the accompanist view instead of opening a new tab.

Do not host or ship a library of copyrighted backing tracks. Performers upload their own material for their own audition only. Audition data includes minors at school productions, so collect the minimum (first name is enough) and support deleting a session's data.

## Suggested stack (open to change)

Next.js (App Router, TypeScript) + Supabase (Postgres, Auth, Realtime, Storage) + Tailwind, deployed on Vercel. Realtime matters: the queue must update on every device within about a second.

## Business model (for later)

Theatres pay per production (roughly $29-79) or a season pass; performers use it free. Payments are out of scope until after the first real audition test.

## Working agreements

- Keep the prototype's look: IBM Plex Sans body, Space Grotesk headings, IBM Plex Mono for notes/tempo, blue accent #2340C8, amber for warnings, dark-mode tokens included.
- 44px minimum touch targets; must work one-handed on a phone and on a tablet on a piano music stand.
- Plain, sentence-case copy written for theatre people, not developers.
