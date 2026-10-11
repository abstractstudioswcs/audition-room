# Audition Room

Run musical auditions from three devices: performers check in on their phones, the pianist gets their music and a live queue, and the music director logs ranges and casts characters.

## How it works

- **Performers** need no account. They open the session's check-in link (or scan its QR code), add an optional headshot, upload sheet music or a backing track, tap the days they can’t make on the rehearsal calendar, and get an audition number. Key, first note and tempo are optional. Each name checks in once per session.
- **The audition team** signs in. The theatre owner shares a team code so the accompanist and director can join.
- **Every team member can open every stage**: Overview, Accompanist, Vocal, Acting, Casting and Setup. The flow runs check-in → vocal → acting → casting.
- Everything stays in sync live across devices.

## Pages

| Path | Who | What |
| --- | --- | --- |
| `/` | Everyone | Who’s using this device? Enter an audition code or sign in |
| `/c/<code>` | Performers | Check in |
| `/login` | Team | Sign in or create an account |
| `/app` | Team | Theatres, team codes, productions |
| `/app/p/<id>` | Team | Setup: characters with ranges, audition sessions, check-in links and QR codes |
| `/app/p/<id>/cast` | Director | Casting board: Considering, Callback, Cast |
| `/app/p/<id>/schedule` | Director, stage manager | Rehearsal calendar (single days or a repeating schedule), who’s out each day, conflicts by date or person, CSV |
| `/app/s/<id>` | Team | Pick this device’s view |
| `/app/s/<id>/overview` | Stage manager | Every singer’s progress: check-in, room, vocal, acting, casting |
| `/app/s/<id>/accompanist` | Pianist | Live queue, preview anyone’s music, full-screen music stand with page-turn pedal support, downloads |
| `/app/s/<id>/music-director` | MD (Vocal) | Range, character fit, vocal rating and notes, callbacks, their music |
| `/app/s/<id>/acting` | Director (Acting) | Acting rating and notes, place singers on characters |

## Set up

1. **Database.** In your Supabase project, open the SQL Editor, paste all of `supabase/migrations/20261008000000_init.sql`, and run it.
2. **Environment variables.** Copy `.env.example` to `.env.local` and fill in the values from Supabase → Project Settings → API. In Vercel, add the same three under Project → Settings → Environment Variables.
3. **Auth redirect.** In Supabase → Authentication → URL Configuration, set the Site URL to your Vercel address.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # range-fit unit tests
npm run test:db    # schema and access-rule tests (needs a local Postgres; see scripts/test-db.sh)
npm run lint
```

`prototype/index.html` is the original single-file prototype, kept as a reference for behavior and copy.
