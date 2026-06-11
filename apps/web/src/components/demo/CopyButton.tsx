'use client';

import { useState } from 'react';

import styles from './demo.module.css';

interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label = 'Copy markdown' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className={styles.btn} onClick={handleCopy} aria-live="polite">
      {copied ? '✓ Copied' : label}
    </button>
  );
}
