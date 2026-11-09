import type { HoldStatus } from '../../api/admission'

const DESCRIPTIONS: Record<HoldStatus, string> = {
  HELD: 'ফি দেওয়ার অপেক্ষায়',
  CONFIRMED: 'ভর্তি নিশ্চিত',
  EXPIRED: 'মেয়াদ শেষ',
  CANCELLED: 'বাতিল করা হয়েছে',
}

export function StatusBadge({ status }: { status: HoldStatus }) {
  return (
    <span className="status-line">
      <span className={`status status-${status.toLowerCase()}`}>{status}</span>
      <span className="status-description">{DESCRIPTIONS[status]}</span>
    </span>
  )
}
