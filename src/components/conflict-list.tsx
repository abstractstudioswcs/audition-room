import { conflictSummary, formatConflict, sortConflicts } from "@/lib/conflicts";
import type { Auditioner } from "@/lib/types";

/** A singer's rehearsal conflicts, as a short list. */
export function ConflictList({ a, compact = false }: { a: Auditioner; compact?: boolean }) {
  const list = sortConflicts(a.conflicts ?? []);
  if (!list.length && !a.conflict_notes) {
    return <p className="hint">{a.no_conflicts ? "No conflicts." : "Didn’t list any conflicts."}</p>;
  }
  return (
    <div className="stack" style={{ gap: 4 }}>
      {list.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: compact ? 16 : 20 }}>
          {list.map((c, i) => (
            <li key={`${c.date}-${i}`}>{formatConflict(c)}</li>
          ))}
        </ul>
      )}
      {a.conflict_notes && <p style={{ whiteSpace: "pre-wrap" }}>{a.conflict_notes}</p>}
      {compact && <span className="hint">{conflictSummary(a)}</span>}
    </div>
  );
}
