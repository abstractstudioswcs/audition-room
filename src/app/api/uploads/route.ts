import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AUDIO_TYPES, MAX_FILES, SHEET_TYPES, maxBytesFor, normalizeType } from "@/lib/types";

// Gives a performer one-time upload links for their music, after checking the
// session code is real and open. Files land at music/<session_id>/<random>/<name>,
// and check_in() only accepts paths inside that session's folder.

type Requested = { name: string; type: string; size: number };

const ALLOWED = new Set([...SHEET_TYPES, ...AUDIO_TYPES]);

function safeName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-80);
  return cleaned.replace(/^[._]+/, "") || "music";
}

export async function POST(request: Request) {
  let body: { code?: unknown; files?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send the check-in code and file details." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
  const files = Array.isArray(body.files) ? (body.files as Requested[]) : [];
  if (!code || files.length === 0) {
    return NextResponse.json({ error: "Send the check-in code and at least one file." }, { status: 400 });
  }
  // Music files plus one optional headshot.
  if (files.length > MAX_FILES + 1) {
    return NextResponse.json({ error: `Upload ${MAX_FILES} files or fewer.` }, { status: 400 });
  }
  for (const f of files) {
    if (typeof f?.name !== "string" || typeof f?.type !== "string" || typeof f?.size !== "number") {
      return NextResponse.json({ error: "File details are incomplete." }, { status: 400 });
    }
    f.type = normalizeType(f.name, f.type);
    if (!ALLOWED.has(f.type)) {
      return NextResponse.json({ error: `${f.name} can't be uploaded. Use a PDF, photo, MP3, M4A or WAV.` }, { status: 400 });
    }
    if (f.size <= 0 || f.size > maxBytesFor(f.type)) {
      return NextResponse.json({ error: `${f.name} is over ${maxBytesFor(f.type) / 1024 / 1024} MB.` }, { status: 400 });
    }
  }

  const admin = supabaseAdmin();
  const { data: session } = await admin
    .from("sessions")
    .select("id, checkin_open")
    .eq("checkin_code", code)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "That check-in link isn't valid." }, { status: 404 });
  if (!session.checkin_open) return NextResponse.json({ error: "Check-in for this session is closed." }, { status: 403 });

  const uploads = [];
  for (const f of files) {
    const path = `${session.id}/${randomUUID()}/${safeName(f.name)}`;
    const { data, error } = await admin.storage.from("music").createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: "Uploads aren't available right now. Try again in a minute." }, { status: 502 });
    }
    uploads.push({ path, token: data.token, name: f.name, type: f.type });
  }
  return NextResponse.json({ uploads });
}
