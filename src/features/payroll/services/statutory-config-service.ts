/**
 * Loads statutory configuration from Dataverse and maps it to the engine's
 * `StatutoryConfig`, resolving the rules effective at a given date. All Dataverse
 * access stays behind this service (CLAUDE.md "Dataverse Rules"); the pure engine
 * (`payroll-calculation.ts`) never touches Dataverse.
 */
import { dataClient } from "@/lib/power/data-client"
import { resolveEffective } from "./statutory-config-resolve"
import type {
  StatutoryConfig,
  SssBracket,
  PhilHealthConfig,
  HdmfConfig,
  TaxBracket,
} from "./payroll-calculation"

const SSS_TABLE = "a365_ssscontributions"
const PHILHEALTH_TABLE = "a365_philhealthcontributions"
const HDMF_TABLE = "a365_hdmfcontributions"
const TAX_TABLE = "a365_taxbrackets"

interface DatedRow {
  a365_effectivefrom: string
  a365_effectiveuntil?: string
}
interface SssRow extends DatedRow {
  a365_compensationfrom?: number
  a365_compensationto?: number
  a365_msc?: number
  a365_employeeamount?: number
  a365_employeramount?: number
  a365_ecamount?: number
}
interface PhilHealthRow extends DatedRow {
  a365_premiumrate?: number
  a365_employeeshare?: number
  a365_incomefloor?: number
  a365_incomeceiling?: number
}
interface HdmfRow extends DatedRow {
  a365_employeerate?: number
  a365_employerrate?: number
  a365_compensationcap?: number
}
interface TaxRow extends DatedRow {
  a365_sequence?: number
  a365_incomefrom?: number
  a365_incometo?: number
  a365_basetax?: number
  a365_marginalrate?: number
}

async function fetchRows<T>(table: string, select: string[]): Promise<T[]> {
  const result = await dataClient.retrieveMultipleRecordsAsync<T>(table, { select })
  if (!result.success) throw result.error ?? new Error(`Unable to load ${table}.`)
  return result.data ?? []
}

/** Filter Dataverse rows (whose window is a365_effectivefrom/until) to those in force at `asOf`. */
function inForce<T extends DatedRow>(rows: T[], asOf: string): T[] {
  const adapted = rows.map((r) => ({ ...r, effectiveFrom: r.a365_effectivefrom, effectiveUntil: r.a365_effectiveuntil ?? null }))
  return resolveEffective(adapted, asOf)
}

export async function getStatutoryConfig(asOf: string): Promise<StatutoryConfig> {
  const [sssRows, phRows, hdmfRows, taxRows] = await Promise.all([
    fetchRows<SssRow>(SSS_TABLE, [
      "a365_effectivefrom", "a365_effectiveuntil", "a365_compensationfrom", "a365_compensationto",
      "a365_msc", "a365_employeeamount", "a365_employeramount", "a365_ecamount",
    ]),
    fetchRows<PhilHealthRow>(PHILHEALTH_TABLE, [
      "a365_effectivefrom", "a365_effectiveuntil", "a365_premiumrate", "a365_employeeshare",
      "a365_incomefloor", "a365_incomeceiling",
    ]),
    fetchRows<HdmfRow>(HDMF_TABLE, [
      "a365_effectivefrom", "a365_effectiveuntil", "a365_employeerate", "a365_employerrate", "a365_compensationcap",
    ]),
    fetchRows<TaxRow>(TAX_TABLE, [
      "a365_effectivefrom", "a365_effectiveuntil", "a365_sequence", "a365_incomefrom",
      "a365_incometo", "a365_basetax", "a365_marginalrate",
    ]),
  ])

  const sss: SssBracket[] = inForce(sssRows, asOf)
    .map((r) => ({
      compensationFrom: r.a365_compensationfrom ?? 0,
      compensationTo: r.a365_compensationto ?? null,
      msc: r.a365_msc ?? 0,
      employeeAmount: r.a365_employeeamount ?? 0,
      employerAmount: r.a365_employeramount ?? 0,
      ecAmount: r.a365_ecamount ?? 0,
    }))
    .sort((a, b) => a.compensationFrom - b.compensationFrom)
  if (sss.length === 0) throw new Error(`No SSS contribution configuration effective on ${asOf}.`)

  const ph = inForce(phRows, asOf)[0]
  if (!ph) throw new Error(`No PhilHealth configuration effective on ${asOf}.`)
  const philhealth: PhilHealthConfig = {
    premiumRate: ph.a365_premiumrate ?? 0,
    employeeShare: ph.a365_employeeshare ?? 0,
    incomeFloor: ph.a365_incomefloor ?? 0,
    incomeCeiling: ph.a365_incomeceiling ?? 0,
  }

  const hd = inForce(hdmfRows, asOf)[0]
  if (!hd) throw new Error(`No HDMF configuration effective on ${asOf}.`)
  const hdmf: HdmfConfig = {
    employeeRate: hd.a365_employeerate ?? 0,
    employerRate: hd.a365_employerrate ?? 0,
    compensationCap: hd.a365_compensationcap ?? 0,
  }

  const taxBrackets: TaxBracket[] = inForce(taxRows, asOf)
    .map((r) => ({
      sequence: r.a365_sequence ?? 0,
      incomeFrom: r.a365_incomefrom ?? 0,
      incomeTo: r.a365_incometo ?? null,
      baseTax: r.a365_basetax ?? 0,
      marginalRate: r.a365_marginalrate ?? 0,
    }))
    .sort((a, b) => a.sequence - b.sequence)
  if (taxBrackets.length === 0) throw new Error(`No withholding-tax brackets effective on ${asOf}.`)

  return { sss, philhealth, hdmf, taxBrackets }
}
