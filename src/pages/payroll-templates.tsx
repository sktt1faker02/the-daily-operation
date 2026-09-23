/**
 * Payroll cutoff templates management (Payroll Admin). Lists saved templates
 * with View / Rename / Delete actions. Templates are created from the payroll
 * period page (save from a Paid or Locked cutoff); this page only manages
 * existing ones. Loading / Empty / Error / Success states.
 * Authorization is enforced in Dataverse, not this UI (CLAUDE.md "Security").
 */
import { useState } from "react"
import { toast } from "sonner"
import { AlertCircle, Loader2, LayoutTemplate, Pencil, Trash2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDateTime } from "@/lib/format"
import {
  useTemplates,
  useTemplateLines,
  useRenameTemplate,
  useDeleteTemplate,
} from "@/features/payroll/hooks/use-payroll-templates"
import type { PayrollTemplateSummary } from "@/features/payroll/services/payroll-template-service"

function ViewTemplateDialog({
  template,
  onOpenChange,
}: {
  template: PayrollTemplateSummary | null
  onOpenChange: (open: boolean) => void
}) {
  const lines = useTemplateLines(template?.id ?? "")

  return (
    <Dialog open={template !== null} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template?.name}</DialogTitle>
          <DialogDescription>
            {template?.description || "No description."}
          </DialogDescription>
        </DialogHeader>

        {lines.isPending ? (
          <div className="space-y-2" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : lines.isError ? (
          <p className="text-sm text-destructive">
            {lines.error instanceof Error ? lines.error.message : "Unable to load template lines."}
          </p>
        ) : lines.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">This template has no saved lines.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Basic Pay</TableHead>
                  <TableHead className="text-right">Allowances</TableHead>
                  <TableHead className="text-right">Other Earnings</TableHead>
                  <TableHead className="text-right">Other Deductions</TableHead>
                  <TableHead className="text-right">Unpaid Leave</TableHead>
                  <TableHead className="text-right">Withholding Tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.data.map((line) => (
                  <TableRow key={line.employeeId}>
                    <TableCell className="font-medium">{line.employeeName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(line.inputs.basicPay)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(line.inputs.allowances)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(line.inputs.otherEarnings)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(line.inputs.otherDeductions)}</TableCell>
                    <TableCell className="text-right">{line.inputs.unpaidLeaveDays}</TableCell>
                    <TableCell className="text-right">{formatCurrency(line.inputs.withholdingTax)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RenameTemplateDialog({
  template,
  onOpenChange,
}: {
  template: PayrollTemplateSummary | null
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const rename = useRenameTemplate()

  // Seed the form fields whenever a different template opens, and clear the
  // seed on close so reopening the same template (e.g. after Cancel) shows
  // fresh values instead of a stale edit (derived during render, not via
  // useEffect — CLAUDE.md "React Rules").
  const [seededFor, setSeededFor] = useState<string | null>(null)
  if (template && template.id !== seededFor) {
    setSeededFor(template.id)
    setName(template.name)
    setDescription(template.description ?? "")
    setError(null)
  } else if (!template && seededFor !== null) {
    setSeededFor(null)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!template) return
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    setError(null)
    rename.mutate(
      { id: template.id, name: name.trim(), description: description.trim() || null },
      {
        onSuccess: () => {
          toast.success("Template updated.")
          onOpenChange(false)
        },
        onError: (err) => toast.error("Unable to update template.", { description: err.message }),
      },
    )
  }

  return (
    <Dialog open={template !== null} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename template</DialogTitle>
          <DialogDescription>Update the template's name and description.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">
              Name<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={rename.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={rename.isPending}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={rename.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={rename.isPending}>
              {rename.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function PayrollTemplatesPage() {
  const { data: templates, isPending, isError, error, refetch } = useTemplates()
  const [viewing, setViewing] = useState<PayrollTemplateSummary | null>(null)
  const [renaming, setRenaming] = useState<PayrollTemplateSummary | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PayrollTemplateSummary | null>(null)
  const deleteTemplate = useDeleteTemplate()

  const handleDelete = () => {
    if (!pendingDelete) return
    deleteTemplate.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`Deleted ${pendingDelete.name}.`)
        setPendingDelete(null)
      },
      onError: (err) => toast.error("Unable to delete template.", { description: err.message }),
    })
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <LayoutTemplate className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payroll Templates</h1>
          <p className="text-sm text-muted-foreground">
            Manage saved cutoff templates. Save a new template from a Paid or Locked payroll period.
          </p>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-2 rounded-md border p-4" aria-busy>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <AlertCircle className="size-6 text-destructive" aria-hidden />
          <div>
            <p className="font-medium">Unable to load templates</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Please try again."}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-12 text-center">
          <LayoutTemplate className="size-6 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground">
              Save one from a Paid or Locked period.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.description || "—"}</TableCell>
                  <TableCell className="text-right">{t.lineCount}</TableCell>
                  <TableCell>{formatDateTime(t.createdOn)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewing(t)}
                        aria-label={`View ${t.name}`}
                      >
                        <Eye className="size-3.5" aria-hidden />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRenaming(t)}
                        aria-label={`Rename ${t.name}`}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Rename
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDelete(t)}
                        aria-label={`Delete ${t.name}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ViewTemplateDialog template={viewing} onOpenChange={(o) => !o && setViewing(null)} />
      <RenameTemplateDialog template={renaming} onOpenChange={(o) => !o && setRenaming(null)} />

      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this template?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.name} and its saved lines will be permanently deleted. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleteTemplate.isPending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteTemplate.isPending}>
              {deleteTemplate.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
