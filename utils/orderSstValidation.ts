export function sstSaveBlocker(disabled: boolean, busy: boolean, note: string, date: string, status: string, confirmed: boolean): string | null {
  if (disabled) return '请先保存客户／开票公司修改；已开票的单据不能修改 SST。';
  if (busy) return '正在保存 SST 确认…';
  if (!date) return '请填写核查日期。';
  if (!note.trim()) return '请填写核查依据／备注（必填），例如实际查询到的 MySST 结果。';
  if (status !== 'UNVERIFIED' && !confirmed) return '请勾选已核对客户身份及本单 SST 处理。';
  return null;
}
