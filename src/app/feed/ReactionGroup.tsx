"use client";

import { useState, useTransition } from "react";
import { setReaction } from "../actions";
import { REACTIONS } from "@/lib/buoy";

export default function ReactionGroup({
  draftId,
  initialKind,
}: {
  draftId: string;
  initialKind: string | null;
}) {
  const [active, setActive] = useState<string | null>(initialKind);
  const [, startTransition] = useTransition();

  return (
    <div className="reaction-row">
      {REACTIONS.map((r) => (
        <button
          key={r.kind}
          type="button"
          className={`reaction-btn reaction-${r.kind}${active === r.kind ? " active" : ""}`}
          onClick={() => {
            const prev = active;
            const next = active === r.kind ? null : r.kind;
            setActive(next);
            startTransition(async () => {
              try {
                await setReaction(draftId, r.kind);
              } catch {
                setActive(prev);
              }
            });
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
