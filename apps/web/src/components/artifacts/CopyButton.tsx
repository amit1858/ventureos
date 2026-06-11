'use client';

import { useState } from 'react';

import { cx, styles } from './helpers';

/** Copies text to the clipboard with brief "Copied!" feedback. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cx(styles.btn, styles.btnGhost)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — no-op */
        }
      }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}
