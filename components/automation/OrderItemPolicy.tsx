import type { OrderItemPolicyMode } from '@/utils/orderItemPolicy';

export function OrderItemPolicy({ mode, disabled, onChange }: {
  mode: OrderItemPolicyMode;
  disabled: boolean;
  onChange: (mode: OrderItemPolicyMode) => void;
}) {
  return <section className="rounded-lg border border-cyan-300 bg-cyan-50 p-4 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100">
    <label className="block text-sm font-semibold" htmlFor="order-item-policy">本单库存处理 / Stock handling for this Review</label>
    <select id="order-item-policy" value={mode} disabled={disabled}
      onChange={event => onChange(event.target.value as OrderItemPolicyMode)}
      className="mt-2 w-full max-w-xl rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] disabled:opacity-60">
      <option value="COMPANY_DEFAULT">使用公司默认库存规则 / Company default</option>
      <option value="FOLLOW_PO_FREE_TEXT">按 PO 描述开单，不进库存 / PO descriptions without stock</option>
    </select>
    <p className="mt-2 text-sm">{mode === 'FOLLOW_PO_FREE_TEXT'
      ? '已选择：本单全部按 PO 描述开单，原 code 保留在描述，不匹配或新增库存品项。'
      : '需要使用库存 code 时保留公司默认规则；只按 PO 描述开单时，选择上方「不进库存」。'}</p>
    <p className="mt-1 text-xs">选择后会保存当前修改。仅影响此 Review，不影响其他 SET 或公司的默认库存规则。</p>
  </section>;
}
