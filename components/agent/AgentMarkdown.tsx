'use client';

import React from 'react';

interface AgentMarkdownProps {
  content: string;
  inverted?: boolean;
}

type Block =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'sectionTitle'; text: string }
  | { type: 'hr' }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'blockquote'; lines: string[] };

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|');
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s\-:|]+\|?$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isSectionTitle(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('📄') || /^Document\s+\d+/i.test(trimmed);
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i += 1;
      continue;
    }

    if (isSectionTitle(trimmed)) {
      blocks.push({ type: 'sectionTitle', text: trimmed });
      i += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        rows.push(parseTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      const next = lines[i].trim();
      if (
        isSectionTitle(next) ||
        next.startsWith('>') ||
        isTableRow(next) ||
        /^[-*]\s+/.test(next) ||
        /^\d+[.)]\s+/.test(next) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(next) ||
        /^(#{1,4})\s+/.test(next)
      ) {
        break;
      }
      paragraphLines.push(lines[i]);
      i += 1;
    }
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', lines: paragraphLines });
    }
  }

  return blocks;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `${keyPrefix}-${partIndex}`;

    if (match[2] !== undefined) {
      nodes.push(
        <strong key={key} className="agent-md-strong">
          {match[2]}
        </strong>
      );
    } else if (match[3] !== undefined) {
      nodes.push(<em key={key}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      nodes.push(
        <code key={key} className="agent-md-code">
          {match[4]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
    partIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

function isKeyValueTable(headers: string[]): boolean {
  if (headers.length < 2) return false;
  const h0 = headers[0]?.toLowerCase() ?? '';
  const h1 = headers[1]?.toLowerCase() ?? '';
  return h0 === 'field' && h1 === 'value';
}

export function AgentMarkdown({ content, inverted = false }: AgentMarkdownProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={`agent-markdown${inverted ? ' agent-markdown--inverted' : ''}`}>
      {blocks.map((block, index) => {
        const key = `block-${index}`;

        if (block.type === 'hr') {
          return <hr key={key} className="agent-md-hr" />;
        }

        if (block.type === 'heading') {
          const Tag = `h${Math.min(block.level, 4)}` as 'h1' | 'h2' | 'h3' | 'h4';
          return (
            <Tag key={key} className={`agent-md-heading agent-md-h${block.level}`}>
              {renderInline(block.text, key)}
            </Tag>
          );
        }

        if (block.type === 'sectionTitle') {
          return (
            <div key={key} className="agent-md-section-title">
              {renderInline(block.text, key)}
            </div>
          );
        }

        if (block.type === 'blockquote') {
          const isWarning = block.lines.some((l) => l.includes('⚠️') || l.includes('Warning'));
          return (
            <blockquote
              key={key}
              className={`agent-md-blockquote${isWarning ? ' agent-md-blockquote--warning' : ''}`}
            >
              {block.lines.map((line, lineIndex) => (
                <p key={lineIndex} className="agent-md-blockquote-line">
                  {renderInline(line, `${key}-q-${lineIndex}`)}
                </p>
              ))}
            </blockquote>
          );
        }

        if (block.type === 'table') {
          const columnCount = Math.max(
            block.headers.length,
            ...block.rows.map((row) => row.length),
            1
          );
          const kvTable = isKeyValueTable(block.headers);
          const showHeader = block.headers.some((h) => h.length > 0);

          return (
            <div
              key={key}
              className={`agent-md-table-wrap${kvTable ? ' agent-md-table-wrap--kv' : ''}`}
            >
              <table className={`agent-md-table${kvTable ? ' agent-md-table--kv' : ''}`}>
                {showHeader && (
                  <thead>
                    <tr>
                      {Array.from({ length: columnCount }).map((_, col) => (
                        <th key={col}>
                          {renderInline(block.headers[col] ?? '', `${key}-h-${col}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {Array.from({ length: columnCount }).map((_, col) => (
                        <td
                          key={col}
                          className={kvTable && col === 0 ? 'agent-md-table-label' : undefined}
                        >
                          {renderInline(row[col] ?? '', `${key}-r-${rowIndex}-${col}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === 'ul') {
          return (
            <ul key={key} className="agent-md-list agent-md-list--ul">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item, `${key}-li-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ol') {
          return (
            <ol key={key} className="agent-md-list agent-md-list--ol">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item, `${key}-oli-${itemIndex}`)}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={key} className="agent-md-paragraph">
            {block.lines.map((line, lineIndex) => (
              <React.Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `${key}-p-${lineIndex}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
