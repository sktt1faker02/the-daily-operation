export interface LedgerCategory { value: number; label: string }
export interface LedgerFilters { start: string; end: string; category: string; direction: string; search: string }
export const emptyFilters: LedgerFilters = { start: "", end: "", category: "", direction: "", search: "" }
export interface LedgerRow {
  id: string; date: string; receipt: string; reference: string; direction: "debit" | "credit";
  amount: number; category: number; description: string; version: string;
  periodId: string | null; employeeId: string | null; entryId: string | null;
  periodName: string | null; reopened: boolean; postedOn: string | null; postedBy: string | null;
}
export interface LedgerValues { date: string; receipt: string; reference: string; direction: string; amount: string; category: string; description: string }
export interface LedgerTotals { debit: number; credit: number; net: number; count: number }
export interface LedgerPage {
  rows: LedgerRow[]; totals: LedgerTotals; balance: number; revision: string;
  next: string | null; categories: LedgerCategory[];
}
export interface HistoryPeriod { id: string; name: string; employees: number; missing: number; total: number; error: string | null }
export interface HistoryPreview { periods: HistoryPeriod[]; manual: LedgerRow[]; missing: number; revision: string }
export interface HistoryJob { id: string; status: string; created: number; skipped: number; failed: number; error: string; period: string }
