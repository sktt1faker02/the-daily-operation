/** Shared sender for Leave and payslip notifications, including manual retries. */
export const notificationMailboxAddress = "thedailyoperation@automations365.com"

/** Shared email-safe layout for operational notifications. */
export const notificationEmailStyle = {
  page: "#f3f5f8", card: "#ffffff", border: "#e3e6ea", title: "#3b3b6b",
  text: "#1f2937", muted: "#667085", footer: "#f0f1f3", balance: "#f4f5fb",
  font: "Arial, Helvetica, sans-serif", width: 600, bodySize: 13, titleSize: 19,
  footerText: "This is an automated notification from The Daily Operation.",
} as const

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)
}

/** One stored Work Email only; never accepts a recipient list or header input. */
export function storedWorkEmail(value: string | null | undefined): string | null {
  const email = value?.trim()
  return email && email.length <= 100 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) ? email : null
}

export interface NotificationEmailContent {
  title: string
  greeting: string
  introduction: string
  detailsHeading: string
  details: readonly (readonly [string, string])[]
  highlight?: string | null
  asOf: string
}

export function buildNotificationEmail(content: NotificationEmailContent): string {
  const s = notificationEmailStyle
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(content.title)}</title></head>
<body bgcolor="${s.page}" style="margin:0;padding:0;background-color:${s.page};color:${s.text};font-family:${s.font};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${s.page}" style="background-color:${s.page};color:${s.text};"><tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="${s.width}" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${s.card}" style="width:100%;max-width:${s.width}px;background-color:${s.card};color:${s.text};border:1px solid ${s.border};border-radius:8px;">
<tr><td bgcolor="${s.card}" style="padding:28px 24px 24px;background-color:${s.card};color:${s.text};font-family:${s.font};font-size:${s.bodySize}px;line-height:1.6;">
<h1 style="margin:0 0 24px;color:${s.title};font-size:${s.titleSize}px;line-height:1.4;">${escapeHtml(content.title)}</h1>
<p style="margin:0 0 12px;">${escapeHtml(content.greeting)}</p>
<p style="margin:0 0 20px;">${escapeHtml(content.introduction)}</p>
<p style="margin:0 0 8px;"><strong>${escapeHtml(content.detailsHeading)}:</strong></p>
<ul style="margin:0;padding-left:20px;">${content.details.map(([label, value]) => `<li style="padding:3px 0;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join("")}</ul>
${content.highlight ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr><td bgcolor="${s.balance}" style="padding:16px;background-color:${s.balance};color:${s.title};border-radius:6px;">${escapeHtml(content.highlight)}</td></tr></table>` : ""}
</td></tr>
<tr><td align="center" bgcolor="${s.footer}" style="padding:16px 24px;background-color:${s.footer};color:${s.muted};font-family:${s.font};font-size:11px;line-height:1.6;border-top:1px solid ${s.border};">© ${escapeHtml(content.asOf.slice(0, 4))} Automations 365<br>${s.footerText}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
}
