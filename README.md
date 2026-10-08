# Audition Room

Run musical auditions from three devices: performers check in on their phones, the pianist gets their music and a live queue, and the music director logs ranges and casts characters.

## How it works

- **Performers** need no account. They open the session's check-in link (or scan its QR code), upload sheet music or a backing track, and get an audition number.
- **The audition team** signs in. The theatre owner shares a team code so the accompanist and director can join.
- **Each device picks a view**: check-in kiosk, accompanist, music director, director (casting board) or setup.
- Everything stays in sync live across devices.

## Pages

| Path | Who | What |
| --- | --- | --- |
| `/` | Everyone | Who’s using this device? Enter an audition code or sign in |
| `/c/<code>` | Performers | Check in |
| `/login` | Team | Sign in or create an account |
| `/app` | Team | Theatres, team codes, productions |
| `/app/p/<id>` | Team | Setup: characters with ranges, audition sessions, check-in links and QR codes |
| `/app/p/<id>/cast` | Director | Casting board |
| `/app/s/<id>` | Team | Pick this device’s view |
| `/app/s/<id>/accompanist` | Pianist | Live queue, key, first note, tempo, cut, music |
| `/app/s/<id>/music-director` | MD | Range, role fit, rating, notes, callbacks |

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
