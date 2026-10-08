"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { MusicFile } from "@/lib/types";

/** Signed, short-lived link to a private music file. */
function useSignedUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    supabaseBrowser()
      .storage.from("music")
      .createSignedUrl(path, 60 * 60 * 4)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) setFailed(true);
        else setUrl(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return { url, failed };
}

export function MusicFiles({ files, song }: { files: MusicFile[]; song: string }) {
  return (
    <>
      {files.map((f, i) => (
        <MusicFileView key={f.path} file={f} label={`${song}, file ${i + 1}`} />
      ))}
    </>
  );
}

function MusicFileView({ file, label }: { file: MusicFile; label: string }) {
  const { url, failed } = useSignedUrl(file.path);
  if (failed) return <div className="missing-box">{file.name} couldn’t be opened. Ask for a paper copy.</div>;
  if (!url) return <p className="hint">Loading {file.name}…</p>;
  if (file.type.startsWith("audio/")) {
    return (
      <div className="stack" style={{ gap: 6 }}>
        <span className="label">{file.name}</span>
        <audio controls preload="auto" src={url} aria-label={`Backing track: ${label}`} />
      </div>
    );
  }
  if (file.type === "application/pdf") return <PdfPages url={url} name={file.name} />;
  // eslint-disable-next-line @next/next/no-img-element -- private signed URL, not optimizable
  return <img src={url} alt={`Sheet music: ${label}`} />;
}

/** Renders every page of a PDF as images so it works on iPad, where embedded PDFs show one page. */
function PdfPages({ url, name }: { url: string; name: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    const el = holder.current;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ url }).promise;
        if (!el) return;
        el.replaceChildren();
        const width = Math.min(el.clientWidth || 900, 1400);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= doc.numPages && !cancelled; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${name}, page ${n} of ${doc.numPages}`);
          el.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, name]);

  return (
    <div className="stack" style={{ gap: 10 }}>
      {status === "loading" && <p className="hint">Loading {name}…</p>}
      {status === "failed" && (
        <a className="btn primary self-start" href={url} target="_blank" rel="noopener">Open {name}</a>
      )}
      <div ref={holder} className="stack" style={{ gap: 10 }} />
    </div>
  );
}
