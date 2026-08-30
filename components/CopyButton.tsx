"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard indisponible */
        }
      }}
      className="btn-ghost px-4 py-2 text-xs"
    >
      {copied ? "Copié ✓" : "Copier"}
    </button>
  );
}
