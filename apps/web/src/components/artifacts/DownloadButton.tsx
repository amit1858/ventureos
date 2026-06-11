'use client';

import { cx, styles } from './helpers';

/** Triggers a client-side download of arbitrary text content (markdown, JSON). */
export function DownloadButton({
  filename,
  content,
  mime = 'text/plain',
  label = 'Download',
}: {
  filename: string;
  content: string;
  mime?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={cx(styles.btn, styles.btnGhost)}
      onClick={() => {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }}
    >
      {label}
    </button>
  );
}
