import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ChoiceFilter({ label, value, labels, onChange }: { label: string; value: string; labels: Readonly<Record<number, string>>; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{Object.entries(labels).map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select></div>
}
