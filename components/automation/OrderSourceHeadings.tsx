import { sourceOrderHeadings } from '../../utils/orderSourceHeadings';
import type { AgentRunLine } from '../../services/AgentsService';

export function OrderSourceHeadings({ titles, lines }: { titles: unknown; lines: AgentRunLine[] }) {
  const headings = sourceOrderHeadings(titles, lines);
  return <>{headings.map(text => (
    <tr key={text} className="border-t border-[var(--border)] bg-cyan-500/10 align-top">
      <td colSpan={12} className="px-3 py-3">
        <div className="text-xs font-medium text-cyan-800 dark:text-cyan-200">PO description heading / PO 描述标题</div>
        <div className="mt-1 whitespace-pre-wrap font-medium">{text}</div>
        <div className="mt-1 text-xs text-[var(--muted-foreground)]">No Qty / UOM / amount — retained in DO &amp; INV. 无数量、单位或金额，开单时保留。</div>
      </td>
    </tr>
  ))}</>;
}
