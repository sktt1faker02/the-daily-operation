# Automations 365 Daily Operation — Design System
> Ramp-inspired financial operations UI adapted to the Automations 365 brand: cool neutral surfaces, precise data presentation, hairline borders, and a single disciplined Automations Blue interaction signal.

**Theme:** light

The Daily Operation adapts Ramp's restrained financial-interface language to Automations 365. The system is predominantly neutral: a cool off-white application canvas, white cards, hairline cool-gray borders, and deep navy-charcoal text. Automations Blue (`#1850a0`) is the primary interaction signal and should be concentrated on primary actions, links, selected navigation, focus states, and important active states rather than used as a large decorative fill. Pale blue surfaces provide selection and informational emphasis without overwhelming dense payroll data.

Typography uses Inter as the primary typeface with practical 400/500/600 weights. Financial tables and operational forms favor clarity over editorial display styling. Components remain flat and shadow-light: cards rely on 1px borders, with 8–12px radii for most application surfaces. Density is compact-comfortable, following a 4px base grid with common 8/12/16/24px rhythms. Motion is subtle and utility-focused.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Automations Blue | `#1850a0` | `--color-primary` | Primary actions, active navigation, links, focus accents |
| Blue Hover | `#123f82` | `--color-primary-hover` | Hover/pressed treatment for primary actions |
| Blue Soft | `#e8f0fb` | `--color-primary-soft` | Selected rows, active sidebar item, informational emphasis |
| Blue Subtle | `#f2f6fc` | `--color-primary-subtle` | Very light branded wash and low-emphasis information surfaces |
| Ink | `#172033` | `--color-ink` | Primary text, headings, financial values |
| Slate | `#667085` | `--color-slate` | Secondary text and supporting labels |
| Muted | `#98a2b3` | `--color-muted` | Placeholder text and low-emphasis metadata |
| Paper | `#ffffff` | `--color-paper` | Cards, dialogs, inputs, table surfaces |
| Canvas | `#f6f7f9` | `--color-canvas` | Main application background |
| Surface Subtle | `#f9fafb` | `--color-surface-subtle` | Table headers, grouped sections, read-only fields |
| Hairline | `#e2e6ec` | `--color-hairline` | Borders and dividers |
| Input Border | `#d0d5dd` | `--color-input-border` | Default form control outline |
| Success | `#16845b` | `--color-success` | Paid, completed, successful state |
| Success Soft | `#eaf7f1` | `--color-success-soft` | Success badge/background |
| Warning | `#b7791f` | `--color-warning` | Processing, attention-required state |
| Warning Soft | `#fff7e6` | `--color-warning-soft` | Warning badge/background |
| Danger | `#c9362b` | `--color-danger` | Destructive actions and errors |
| Danger Soft | `#fdf0ef` | `--color-danger-soft` | Error/destructive background |
| Locked | `#475467` | `--color-locked` | Locked/finalized financial state |

**Color principle:** keep roughly 80% of the interface neutral, 15% subtle blue surfaces, and 5% strong Automations Blue. Do not turn the entire application blue.

## Tokens — Typography

### Inter — Primary application typeface · `--font-sans`
- **Stack:** Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- **Weights:** 400 body, 500 labels/navigation, 600 headings and key financial values
- **Role:** Clear enterprise UI typography optimized for tables, forms, dashboards, and financial data.
- **Numeric data:** use `font-variant-numeric: tabular-nums` for payroll and monetary columns.

### Type Scale

| Role | Size | Line Height | Weight | Token |
|------|------|-------------|--------|-------|
| caption | 12px | 1.4 | 500 | `--text-caption` |
| table / UI | 14px | 1.45 | 400 | `--text-ui` |
| body | 14px | 1.5 | 400 | `--text-body` |
| label | 14px | 1.4 | 500 | `--text-label` |
| subheading | 18px | 1.35 | 600 | `--text-subheading` |
| heading | 24px | 1.25 | 600 | `--text-heading` |
| page title | 30px | 1.2 | 600 | `--text-page-title` |
| metric | 28px | 1.15 | 600 | `--text-metric` |

Large marketing-style 64px display typography is intentionally removed from the internal operations application. Prioritize information density and scanning.

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** compact-comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 32 | 32px | `--spacing-32` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 64 | 64px | `--spacing-64` |
| 128 | 128px | `--spacing-128` |
| 156 | 156px | `--spacing-156` |

### Border Radius

| Element | Value |
|---------|-------|
| tags / badges | 6px |
| buttons | 8px |
| inputs | 8px |
| cards | 12px |
| dialogs / large panels | 16px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| subtle | `0 1px 2px rgba(16, 24, 40, 0.04)` | `--shadow-subtle` |

Use shadows sparingly. Borders and surface contrast remain the primary elevation mechanism.

### Layout

- **Application shell:** full viewport
- **Sidebar:** 240–264px desktop, collapsible when appropriate
- **Content max-width:** 1440px where a constrained width helps; payroll tables may use available width
- **Page padding:** 24–32px desktop, 16px smaller screens
- **Section gap:** 24–32px
- **Card padding:** 20–24px
- **Element gap:** 8–16px
- **Table row height:** approximately 44–52px

## Components

### Primary Button
**Role:** Highest-priority action such as `New Payroll`, `Calculate Payroll`, `Save`, or `Finalize`.

8px radius, `#1850a0` fill, white text, no heavy shadow. Hover uses `#123f82`. Prefer a 40px control height.

### Secondary / Outlined Button
**Role:** Secondary actions such as `Export`, `Save Draft`, `Cancel`.

White or transparent fill, 1px `#d0d5dd` border, `#172033` text, 8px radius.

### Ghost / Link Button
**Role:** Tertiary row actions and navigation.

Transparent fill, no border. Use `#1850a0` for links and `#172033` for neutral ghost actions. Hover may use `#f2f6fc`.

### Content / Metric Card
12px radius, white fill, 1px `#e2e6ec` border, 20–24px padding, normally no shadow. Key financial values use 26–30px semibold text with tabular numerals.

### Table
Tables are a primary interface primitive for Payroll.

- white surface
- subtle horizontal separators
- minimal/no vertical rules
- `#f9fafb` header
- 14px body text
- right-align currency and numeric columns
- use tabular numerals
- subtle row hover
- selected rows use `#e8f0fb`
- sticky header for long payroll lists when useful

### Input
8px radius, white fill, 1px `#d0d5dd` border. Focus treatment uses Automations Blue. Labels are 14px/500.

### Read-only / Calculated Input
Use `#f9fafb` or `#f2f6fc` fill and a clear `Auto` or `Calculated` indicator. Calculated payroll values must be visually distinct from editable inputs.

### Status Badge
Use semantic color rather than making every status blue.

- Draft: neutral gray
- Processing: warning amber
- Ready: Automations Blue
- Paid: success green
- Locked: slate/dark gray

Keep badge fills pale and text colors dark enough for accessibility.

### Sidebar Navigation
Prefer a white/light sidebar. Default items use neutral text. Active item uses `#e8f0fb` background with `#1850a0` text/icon. Avoid a full saturated-blue sidebar unless intentionally used for a special brand moment.

### Dialog
White surface, 16px radius, hairline border, restrained shadow only when needed for separation. Destructive/financial confirmations must clearly state impact.

## Do's and Don'ts

### Do
- Use `#1850a0` deliberately for primary actions, links, focus states, and active navigation.
- Keep most application surfaces neutral so payroll figures remain visually dominant.
- Use Inter 400/500/600 to create clear enterprise hierarchy.
- Use tabular numerals for money, totals, deductions, and payroll tables.
- Express most elevation with 1px borders and surface shifts rather than heavy shadows.
- Use semantic green/amber/red/slate for financial workflow states.
- Differentiate editable payroll inputs from automatically calculated values.
- Use 8px controls, 12px cards, and 16px large panels/dialogs consistently.
- Keep body and table text compact enough for operational data.

### Don't
- Don't use `#1850a0` as the background of every card, sidebar, badge, and section.
- Don't reintroduce Ramp's chartreuse `#e4f222`; Automations Blue is the brand signal.
- Don't use blue for success, warning, and destructive states when semantic colors communicate meaning better.
- Don't use heavy Material-style shadows.
- Don't use oversized marketing typography inside payroll/admin screens.
- Don't use decorative gradients, illustrations, or stock photography in operational workflows.
- Don't center dense form/table content.
- Don't rely on color alone to communicate status.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 1 | Canvas | `#f6f7f9` | Main application background |
| 2 | Card | `#ffffff` | Cards, tables, forms, dialogs |
| 3 | Subtle | `#f9fafb` | Table headers, grouped areas, read-only controls |
| 4 | Brand Soft | `#f2f6fc` | Informational/brand wash |
| 5 | Selected | `#e8f0fb` | Active navigation and selected rows |
| 6 | Action | `#1850a0` | Primary action surface |

## Elevation

Elevation is primarily expressed through 1px `#e2e6ec` borders and tonal surface changes (`#f6f7f9` → `#ffffff`). Use only a very subtle shadow when an overlay, popover, dropdown, or dialog needs additional separation. Dense payroll cards and tables should remain visually flat and precise.

## Iconography & Imagery

Use Lucide icons for application actions and navigation. Keep icons small, simple, and mostly neutral; active icons may use Automations Blue. Do not use emoji as interface icons.

Operational screens should not depend on decorative imagery. Charts are appropriate only when they answer a real operational question. Payroll tables, totals, statuses, and forms should carry the visual hierarchy.

## Layout

Use an application-shell layout rather than Ramp's marketing-page layout:

- light sidebar navigation
- compact top/header area
- neutral `#f6f7f9` canvas
- white data surfaces
- left-aligned page titles and controls
- responsive metric cards
- full-width or wide payroll tables
- clear page-level primary action in the upper-right where appropriate

Keep important actions predictable across Payroll, future Leave Management, and Accounting.

## Agent Prompt Guide

Quick Color Reference:
- primary action / active: `#1850a0`
- primary hover: `#123f82`
- primary soft: `#e8f0fb`
- primary subtle: `#f2f6fc`
- text: `#172033`
- secondary text: `#667085`
- muted text: `#98a2b3`
- background: `#f6f7f9`
- card: `#ffffff`
- subtle surface: `#f9fafb`
- border: `#e2e6ec`
- input border: `#d0d5dd`
- success: `#16845b`
- warning: `#b7791f`
- danger: `#c9362b`

### Example Component Prompts

1. **Payroll metric card:** white fill, 1px `#e2e6ec` border, 12px radius, 20–24px padding. 12px/500 muted uppercase or concise label and 28px/600 `#172033` metric using tabular numerals. No heavy shadow.
2. **Primary button:** `#1850a0` fill, white 14px/500 text, 8px radius, approximately 40px height. Hover `#123f82`.
3. **Payroll table:** white surface, `#f9fafb` header, 1px horizontal `#e2e6ec` dividers, 14px Inter. Right-align PHP currency values and use tabular numerals. Row hover is subtle; selected row uses `#e8f0fb`.
4. **Sidebar:** white background with subtle right border. Active item uses `#e8f0fb` with `#1850a0` icon/text. Inactive items use `#667085`.
5. **Calculated payroll field:** `#f9fafb` background, 1px `#e2e6ec` border, 8px radius, tabular numeric value, with a subtle `Auto` label to distinguish it from editable white inputs.

## Signature Design Choices

1. **One brand signal:** Automations Blue `#1850a0` is concentrated on actions and active states.
2. **Neutral-first financial UI:** white and cool-gray surfaces dominate so money and status are easy to scan.
3. **Hairline borders over shadows:** data surfaces remain flat, precise, and enterprise-friendly.
4. **Tabular financial numerals:** all payroll currency columns align visually.
5. **Editable vs calculated distinction:** users can immediately see what they can change and what the system calculated.
6. **Semantic workflow color:** Paid is green, Processing is amber, errors/destructive actions are red, and Locked is slate.
7. **Consistent application shell:** the same sidebar/table/form language should scale to Leave Management and Accounting.

## Motion Philosophy

Motion is utility-focused and restrained. Prefer 150–250ms transitions for color, background, border, and opacity. Avoid decorative movement. Motion should communicate hover, selection, loading, expansion, or state changes.

Respect `prefers-reduced-motion`.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Brand */
  --color-primary: #1850a0;
  --color-primary-hover: #123f82;
  --color-primary-soft: #e8f0fb;
  --color-primary-subtle: #f2f6fc;

  /* Text */
  --color-ink: #172033;
  --color-slate: #667085;
  --color-muted: #98a2b3;

  /* Surfaces */
  --color-paper: #ffffff;
  --color-canvas: #f6f7f9;
  --color-surface-subtle: #f9fafb;

  /* Structure */
  --color-hairline: #e2e6ec;
  --color-input-border: #d0d5dd;

  /* Semantic */
  --color-success: #16845b;
  --color-success-soft: #eaf7f1;
  --color-warning: #b7791f;
  --color-warning-soft: #fff7e6;
  --color-danger: #c9362b;
  --color-danger-soft: #fdf0ef;
  --color-locked: #475467;

  /* Typography */
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;

  --text-caption: 12px;
  --text-ui: 14px;
  --text-body: 14px;
  --text-label: 14px;
  --text-subheading: 18px;
  --text-heading: 24px;
  --text-page-title: 30px;
  --text-metric: 28px;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;

  /* Radius */
  --radius-badge: 6px;
  --radius-control: 8px;
  --radius-card: 12px;
  --radius-panel: 16px;

  /* Shadow */
  --shadow-subtle: 0 1px 2px rgba(16, 24, 40, 0.04);

  /* Surfaces */
  --surface-canvas: #f6f7f9;
  --surface-card: #ffffff;
  --surface-subtle: #f9fafb;
  --surface-brand-soft: #f2f6fc;
  --surface-selected: #e8f0fb;
  --surface-action: #1850a0;
}
```

### Tailwind v4

```css
@theme {
  --color-primary: #1850a0;
  --color-primary-hover: #123f82;
  --color-primary-soft: #e8f0fb;
  --color-primary-subtle: #f2f6fc;

  --color-ink: #172033;
  --color-slate: #667085;
  --color-muted: #98a2b3;

  --color-paper: #ffffff;
  --color-canvas: #f6f7f9;
  --color-surface-subtle: #f9fafb;

  --color-hairline: #e2e6ec;
  --color-input-border: #d0d5dd;

  --color-success: #16845b;
  --color-success-soft: #eaf7f1;
  --color-warning: #b7791f;
  --color-warning-soft: #fff7e6;
  --color-danger: #c9362b;
  --color-danger-soft: #fdf0ef;
  --color-locked: #475467;

  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;

  --radius-badge: 6px;
  --radius-control: 8px;
  --radius-card: 12px;
  --radius-panel: 16px;

  --shadow-subtle: 0 1px 2px rgba(16, 24, 40, 0.04);
}
```

## Payroll-Specific UI Rules

### Monetary Values
- Use Philippine Peso formatting.
- Right-align monetary columns.
- Use tabular numerals.
- Give Net Pay stronger typographic emphasis than individual deductions.
- Never use color alone to indicate positive/negative financial meaning.

### Editable vs Automatic
- Editable values: white input surface.
- Calculated values: subtle gray/blue surface with `Auto`/`Calculated` indication.
- Locked payroll: controls become read-only and the page clearly displays the locked state.

### Status Mapping

| Status | Treatment |
|--------|-----------|
| Draft | neutral gray |
| Processing | warning amber |
| Ready | Automations Blue |
| Paid | success green |
| Locked | slate |

### Destructive Financial Actions
Use Danger `#c9362b` only for destructive or error states. Destructive actions should not visually compete with the normal primary action until the user enters the relevant confirmation context.

---

## Design Intent Summary

The goal is **not to reproduce Ramp literally**. Preserve its strongest principles—financial precision, restrained color, hairline borders, minimal shadows, and strong hierarchy—while replacing its marketing/editorial characteristics with a practical Automations 365 operations system.

The resulting visual identity should feel:

**Precise · Trustworthy · Modern · Financial · Enterprise · Calm · Automations 365**
