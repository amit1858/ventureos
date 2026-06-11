/**
 * Strip secrets / tokens before logs, traces, or outbound model prompts touch them.
 * Conservative by design: false positives are acceptable, false negatives are not.
 */
const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'openai', regex: /sk-[A-Za-z0-9_\-]{20,}/g },
  { name: 'anthropic', regex: /sk-ant-[A-Za-z0-9_\-]{20,}/g },
  { name: 'github-pat', regex: /\b(ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/g },
  { name: 'aws-akid', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'jwt', regex: /\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g },
  { name: 'pem', regex: /-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----/g },
  { name: 'pg-url', regex: /\bpostgres(?:ql)?:\/\/[^\s'"]+/gi },
  { name: 'azure-key', regex: /\b[A-Za-z0-9]{84,88}\b/g },
];

export interface Redactor {
  redact(text: string): string;
}

export class PatternRedactor implements Redactor {
  redact(text: string): string {
    if (!text) return text;
    let out = text;
    for (const { name, regex } of PATTERNS) {
      out = out.replace(regex, `[REDACTED:${name}]`);
    }
    return out;
  }
}

export const defaultRedactor: Redactor = new PatternRedactor();
