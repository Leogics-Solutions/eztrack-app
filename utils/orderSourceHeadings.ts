type SourceHeading = {
  text?: unknown;
  source?: unknown;
  scoped_row?: unknown;
  column?: unknown;
};

type DescriptionLine = {
  name?: string | null;
  more_description?: string | null;
  match?: { en_description?: string | null } | null;
};

const normalized = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

/** Display verified PO headings without turning them into priced/stock rows. */
export function sourceOrderHeadings(titles: unknown, lines: DescriptionLine[] = []): string[] {
  if (!Array.isArray(titles)) return [];
  const represented = new Set(lines.flatMap(line =>
    [line.name, line.more_description, line.match?.en_description]
      .filter((text): text is string => typeof text === 'string')
      .flatMap(text => [text, ...text.split(/\r?\n/)]).map(normalized),
  ));
  const result: string[] = [];
  for (const raw of titles) {
    if (!raw || typeof raw !== 'object') continue;
    const heading = raw as SourceHeading;
    if (heading.source !== 'EXCEL_DESCRIPTION_ROW' || typeof heading.text !== 'string'
      || !Number.isInteger(heading.scoped_row) || Number(heading.scoped_row) < 1
      || !Number.isInteger(heading.column) || Number(heading.column) < 1) continue;
    const text = heading.text.trim();
    const key = normalized(text);
    if (key && !represented.has(key)) {
      result.push(text);
      represented.add(key);
    }
  }
  return result;
}
