"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { isNoteOrEmpty } from "@/lib/music";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  AUDIO_TYPES,
  maxBytesFor,
  normalizeType,
  MAX_FILES,
  SHEET_TYPES,
  type CheckinInfo,
  type MusicFile,
  type MusicType,
} from "@/lib/types";

type Load = { state: "loading" } | { state: "missing" } | { state: "error" } | { state: "ready"; info: CheckinInfo };

const SHEET_ACCEPT = "application/pdf,image/*";
const TRACK_ACCEPT = "audio/*,.mp3,.m4a,.wav,.aac";

export function CheckIn() {
  const code = decodeURIComponent(useParams<{ code: string }>().code ?? "");
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [done, setDone] = useState<{ name: string; slot: number } | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(() => supabaseBrowser().rpc("checkin_info", { code }))
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setLoad({ state: "error" });
        else if (!data) setLoad({ state: "missing" });
        else setLoad({ state: "ready", info: data as CheckinInfo });
      })
      .catch(() => alive && setLoad({ state: "error" }));
    return () => {
      alive = false;
    };
  }, [code]);

  const title = load.state === "ready" ? load.info.production : "Audition check-in";
  const theatre = load.state === "ready" ? load.info.theatre : "Audition Room";

  return (
    <>
      <header className="top">
        <div className="show">
          <small>{theatre}</small>
          <strong>{title}</strong>
        </div>
      </header>
      <main className="page">
        <div className="narrow">
          {load.state === "loading" && <section className="panel"><p className="lede">Loading check-in…</p></section>}
          {load.state === "error" && (
            <section className="panel">
              <h1 style={{ fontSize: 26 }}>Check-in didn’t load</h1>
              <p className="lede">Check your connection, then reload this page.</p>
            </section>
          )}
          {load.state === "missing" && (
            <section className="panel">
              <h1 style={{ fontSize: 26 }}>That code doesn’t match an audition</h1>
              <p className="lede">Check the code on the audition sign and try again.</p>
              <Link className="btn self-start" href="/">Enter a different code</Link>
            </section>
          )}
          {load.state === "ready" && !load.info.open && (
            <section className="panel">
              <h1 style={{ fontSize: 26 }}>Check-in is closed</h1>
              <p className="lede">Ask someone on the audition team for help.</p>
            </section>
          )}
          {load.state === "ready" && load.info.open && done && (
            <section className="panel done-card">
              <p className="lede">You’re checked in, {done.name}.</p>
              <div className="slot">{done.slot}</div>
              <p className="lede">Your audition number. Listen for it in the hallway.</p>
              <button
                className="btn primary big"
                onClick={() => {
                  setDone(null);
                  setFormKey((k) => k + 1);
                  window.scrollTo(0, 0);
                }}
              >
                Check in the next person
              </button>
            </section>
          )}
          {load.state === "ready" && load.info.open && !done && (
            <CheckInForm
              key={formKey}
              code={code}
              info={load.info}
              onDone={(name, slot) => {
                setDone({ name, slot });
                window.scrollTo(0, 0);
              }}
            />
          )}
        </div>
      </main>
    </>
  );
}

function CheckInForm({
  code,
  info,
  onDone,
}: {
  code: string;
  info: CheckinInfo;
  onDone: (name: string, slot: number) => void;
}) {
  const [musicType, setMusicType] = useState<MusicType>("sheet");
  const [files, setFiles] = useState<File[]>([]);
  const [chars, setChars] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const val = (k: string) => String(f.get(k) ?? "").trim();
    const name = val("name"), song = val("song"), tempo = val("tempo"), firstNote = val("first_note");

    if (!name || !song) return setError("Add your name and song title to check in.");
    if (tempo && !(Number(tempo) >= 30 && Number(tempo) <= 300)) return setError("Tempo should be beats per minute, like 112.");
    if (!isNoteOrEmpty(firstNote)) return setError("Write the first note like Bb3 or F#4: letter, sharp or flat, octave number.");
    const uploading = musicType === "sheet" || musicType === "track" ? files : [];
    if (uploading.length > MAX_FILES) return setError(`Upload ${MAX_FILES} files or fewer.`);
    const allowed = musicType === "track" ? AUDIO_TYPES : SHEET_TYPES;
    const typeOf = (x: File) => normalizeType(x.name, x.type);
    const bad = uploading.find((x) => !allowed.includes(typeOf(x)));
    if (bad) return setError(musicType === "track" ? `${bad.name} isn’t an audio file. Use MP3, M4A or WAV.` : `${bad.name} isn’t a PDF or photo.`);
    const big = uploading.find((x) => x.size > maxBytesFor(typeOf(x)));
    if (big) return setError(`${big.name} is over ${maxBytesFor(typeOf(big)) / 1024 / 1024} MB.${typeOf(big) === "audio/wav" ? " Trim the WAV to your cut, or export it as MP3." : ""}`);
    const link = val("track_link");
    if (musicType === "link" && link && !/^https?:\/\//i.test(link)) return setError("Track links start with https://");

    const supabase = supabaseBrowser();
    try {
      const stored: MusicFile[] = [];
      if (uploading.length) {
        setBusy("Preparing upload…");
        const res = await fetch("/api/uploads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, files: uploading.map((x) => ({ name: x.name, type: typeOf(x), size: x.size })) }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Uploads aren’t available right now.");
        const slots = body.uploads as { path: string; token: string; name: string; type: string }[];
        for (let i = 0; i < slots.length; i++) {
          setBusy(`Uploading ${i + 1} of ${slots.length}…`);
          const { error: upErr } = await supabase.storage.from("music").uploadToSignedUrl(slots[i].path, slots[i].token, uploading[i], {
            contentType: slots[i].type,
          });
          if (upErr) throw new Error(`${uploading[i].name} didn’t upload. Check your connection and try again.`);
          stored.push({ path: slots[i].path, name: slots[i].name, type: slots[i].type });
        }
      }
      setBusy("Checking in…");
      const { data, error: ciErr } = await supabase.rpc("check_in", {
        code,
        entry: {
          name,
          song,
          show: val("show"),
          music_type: musicType,
          files: stored,
          track_link: musicType === "link" ? link : "",
          cut_start: val("cut_start"),
          cut_end: val("cut_end"),
          song_key: val("song_key"),
          first_note: firstNote,
          tempo: tempo || "",
          note: val("note"),
          character_ids: chars,
        },
      });
      if (ciErr) throw new Error(ciErr.message.includes("closed") ? "Check-in for this session just closed." : "Check-in didn’t save. Try again.");
      onDone(name, data as number);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Check-in didn’t save. Try again.");
      setBusy(null);
    }
  }

  const needsUpload = musicType === "sheet" || musicType === "track";

  return (
    <section className="panel">
      <h1 style={{ fontSize: 28 }}>Check in for your audition</h1>
      <p className="lede">Tell the pianist what you’re singing and where your cut starts, so your music is ready when you walk in.</p>
      <form onSubmit={submit} noValidate className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="ci-name">Your name</label>
          <input id="ci-name" name="name" autoComplete="name" required maxLength={80} />
        </div>
        <div className="row2 stack-sm">
          <div className="field">
            <label htmlFor="ci-song">Song title</label>
            <input id="ci-song" name="song" required maxLength={160} />
          </div>
          <div className="field">
            <label htmlFor="ci-show">From the show</label>
            <input id="ci-show" name="show" maxLength={160} />
          </div>
        </div>

        <fieldset>
          <legend>Music for the pianist</legend>
          <div className="seg">
            {(
              [
                ["sheet", "Sheet music"],
                ["track", "Upload a track"],
                ["link", "Track link"],
                ["phone", "Track on my phone"],
              ] as const
            ).map(([v, label]) => (
              <label key={v}>
                <input
                  type="radio"
                  name="music_type"
                  value={v}
                  checked={musicType === v}
                  onChange={() => {
                    setMusicType(v);
                    setFiles([]);
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {needsUpload && (
          <div className="field">
            <label htmlFor="ci-files">
              {musicType === "sheet" ? "Upload your marked music (PDF or photos of each page)" : "Upload your backing track (MP3, M4A or WAV)"}
            </label>
            <input
              id="ci-files"
              key={musicType}
              type="file"
              multiple={musicType === "sheet"}
              accept={musicType === "sheet" ? SHEET_ACCEPT : TRACK_ACCEPT}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <p className="hint">
              {musicType === "sheet" ? "Mark your cut on the pages before you upload. Up to 20 MB per file." : "Start the track at your cut. Up to 50 MB, which fits about 5 minutes of WAV."}
            </p>
          </div>
        )}
        {musicType === "link" && (
          <div className="field">
            <label htmlFor="ci-url">Link to your track (Drive, Dropbox, YouTube)</label>
            <input id="ci-url" name="track_link" type="url" inputMode="url" placeholder="https://" maxLength={500} />
          </div>
        )}

        {musicType === "sheet" && (
          <div className="row2">
            <div className="field">
              <label htmlFor="ci-start">Cut starts at</label>
              <input id="ci-start" name="cut_start" placeholder="m. 42" maxLength={40} />
            </div>
            <div className="field">
              <label htmlFor="ci-end">Cut ends at</label>
              <input id="ci-end" name="cut_end" placeholder="m. 58" maxLength={40} />
            </div>
          </div>
        )}

        <div className="row3">
          <div className="field">
            <label htmlFor="ci-key">Key</label>
            <input id="ci-key" name="song_key" placeholder="E♭ major" maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="ci-note">First sung note</label>
            <input id="ci-note" name="first_note" className="mono" placeholder="Bb3" maxLength={8} autoCapitalize="characters" />
          </div>
          <div className="field">
            <label htmlFor="ci-tempo">Tempo (BPM)</label>
            <input id="ci-tempo" name="tempo" className="mono" inputMode="numeric" placeholder="112" maxLength={3} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ci-msg">Note for the pianist (optional)</label>
          <textarea id="ci-msg" name="note" rows={2} maxLength={500} />
        </div>

        {info.characters.length > 0 && (
          <fieldset>
            <legend>Characters you’d like to be considered for</legend>
            <div className="chips">
              {info.characters.map((c) => (
                <label className="chip" key={c.id}>
                  <input
                    type="checkbox"
                    checked={chars.includes(c.id)}
                    onChange={(e) => setChars((cur) => (e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id)))}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <p className="err" role="alert">{error}</p>
        <button className="btn primary big wide" type="submit" disabled={!!busy}>
          {busy ?? "Check in"}
        </button>
      </form>
    </section>
  );
}
