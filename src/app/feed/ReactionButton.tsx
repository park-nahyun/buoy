"use client";

import { useState, useTransition } from "react";
import { toggleReaction } from "../actions";

export default function ReactionButton({
  draftId,
  kind,
  label,
  initialActive,
}: {
  draftId: string;
  kind: string;
  label: string;
  initialActive: boolean;
}) {
  const [active, setActive] = useState(initialActive);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={`reaction-btn${active ? " active" : ""}`}
      onClick={() => {
        const next = !active;
        setActive(next);
        startTransition(async () => {
          try {
            await toggleReaction(draftId, kind);
          } catch {
            setActive(!next);
          }
        });
      }}
    >
      {label}
    </button>
  );
}
