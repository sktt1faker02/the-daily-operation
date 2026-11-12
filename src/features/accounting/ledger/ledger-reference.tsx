import { ExternalLink } from "lucide-react"

export function LedgerReference({ value }: { value: string }) {
  const text = value.trim()
  let href: string | undefined
  if (/^https:\/\//i.test(text) && !/\s/.test(text)) {
    try {
      const url = new URL(text)
      if (url.protocol === "https:" && url.hostname) href = url.href
    } catch { /* Invalid URLs remain ordinary reference text. */ }
  }
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${text} (opens in a new tab)`} className="text-primary underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    {value}<ExternalLink className="ml-1 inline size-3 shrink-0" aria-hidden="true" />
  </a> : <>{value || "—"}</>
}
