import type { ReactNode } from 'react';

import { cx, styles } from './helpers';

/**
 * Minimal, dependency-free, XSS-safe Markdown → React renderer.
 *
 * Supports the constructs the Foundry renderers actually emit: ATX headings
 * (#/##/###), paragraphs, nested unordered lists, `**bold**`, `_italic_` /
 * `*italic*`, `` `inline code` ``, blockquotes and horizontal rules. Output is
 * built from React elements only — never `dangerouslySetInnerHTML`.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g;
  let lastIndex = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-i${i}`;
    if (tok.startsWith('`')) nodes.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('**')) nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('_')) nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    lastIndex = m.index + tok.length;
    i++;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

interface ListItem {
  level: number;
  text: string;
}

function renderList(items: ListItem[], from: number, level: number, keyPrefix: string): [ReactNode, number] {
  const lis: ReactNode[] = [];
  let i = from;
  while (i < items.length && (items[i]?.level ?? 0) >= level) {
    const cur = items[i];
    if (!cur) break;
    i++;
    let child: ReactNode = null;
    if (i < items.length && (items[i]?.level ?? 0) > level) {
      const [ul, next] = renderList(items, i, level + 1, `${keyPrefix}-${i}`);
      child = ul;
      i = next;
    }
    lis.push(
      <li key={`${keyPrefix}-li${i}`}>
        {renderInline(cur.text, `${keyPrefix}-li${i}`)}
        {child}
      </li>,
    );
  }
  return [<ul key={`${keyPrefix}-ul${from}`} className={cx(styles.bullets)}>{lis}</ul>, i];
}

function parseBlocks(md: string): ReactNode[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (para.length > 0) {
      blocks.push(<p key={`p${key++}`}>{renderInline(para.join(' '), `p${key}`)}</p>);
      para = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (/^\s*$/.test(line)) {
      flushPara();
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      const level = heading[1]?.length ?? 1;
      const content = heading[2] ?? '';
      const inner = renderInline(content, `h${key}`);
      if (level <= 1) blocks.push(<h1 key={`h${key++}`}>{inner}</h1>);
      else if (level === 2) blocks.push(<h2 key={`h${key++}`}>{inner}</h2>);
      else blocks.push(<h3 key={`h${key++}`}>{inner}</h3>);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      flushPara();
      blocks.push(<hr key={`hr${key++}`} />);
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
        quote.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(<blockquote key={`bq${key++}`}>{renderInline(quote.join(' '), `bq${key}`)}</blockquote>);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      const items: ListItem[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        const raw = lines[i] ?? '';
        const indent = (/^(\s*)/.exec(raw)?.[1] ?? '').length;
        const text = raw.replace(/^\s*[-*]\s+/, '');
        items.push({ level: Math.floor(indent / 2), text });
        i++;
      }
      const [ul] = renderList(items, 0, 0, `l${key++}`);
      blocks.push(ul);
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flushPara();
  return blocks;
}

export function MarkdownPreview({ markdown }: { markdown: string }) {
  return <div className={cx(styles.md)}>{parseBlocks(markdown)}</div>;
}
