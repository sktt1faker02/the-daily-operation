# Ledger Chart of Account choices

Updated 2026-11-03 with owner-confirmed requirements. Supports [the plan](../PLANS.md).
Documentation only: no choices or records have been created.

## Owner-confirmed approach

Chart of Account is a single-select **Dataverse Choice** field in Ledger Management,
with simple categories such as **Utilities**, **Payroll** and **Government Contributions**.
Payroll Admin selects a category when creating a manual record. An internet payment
uses Utilities; an automatic employee net-pay row uses Payroll.

This replaces the earlier proposed numbered account catalog, account lookups and
separate Chart of Accounts page. Category choices are application classifications,
not a claim that the cashbook implements a balanced general ledger. Detailed tax,
liability and expense recognition policies are not inferred from these labels.

## Choices and source-description mappings

The following nine category labels are confirmed by the owner. Numeric Dataverse choice values/logical names
must be discovered or defined during approved schema work; none are guessed here.

| Chart of Account choice | Screenshot descriptions / use | Mapping detail |
| --- | --- | --- |
| Utilities | PLDT - Internet Subscription, including month variants | Internet payment; embedded-charge handling requires confirmation. |
| Payroll | Payroll | Owner confirmed: Mark as Paid generates a separate Debit record for each employee's saved net pay. Employees with existing payroll entries, including zero/negative net pay; actual Paid On date. Admin may edit/delete rows; re-payment updates/recreates them without conflict prompts. No exclusion workflow: source deletion removes the linked row on re-payment, while zero net pay retains a zero row. Historical posting skips existing linked rows, including reviewed manual matches linked before the run. |
| Government Contributions | SSS Contribution March/April 2025; PHIC Compliance April 2025; HDMF Compliance April 2025 | SSS, PhilHealth/PHIC and Pag-IBIG/HDMF. Retain agency/period in Description; embedded-charge handling requires confirmation. |
| Taxes | BIR Withholding; identified tax portion of BIR Compliance April 2025 | BIR and other identified business taxes; other business payments use their relevant category. Confirm the actual tax/payment; "Compliance" alone does not establish a tax rather than a service fee. |
| Software and Licenses | Microsoft Power App Premium License; Microsoft Licenses; MS Licenses | Preserve vendor/license and coverage details in Description. |
| Rent and Coworking | Co working Space 2 hours pass; Co Working Space Rent Dedicated 1 month | Preserve duration and any deposit/prepayment detail for review. |
| Capital Deposits | Starting Capital; Additional Capital | Owner funds entering the business use Credit. Recorded deposits supply opening funds; no separate opening adjustment; this label does not determine equity versus loan treatment. |
| Capital Withdrawals | Withdraw Capital | Owner funds taken out use Debit. Covers the requested outgoing capital movement without a separate Distributions choice; legal/accounting treatment remains separate. |
| Client Payments | Payment From Client, including OR 0001-0004 | Category records receipt purpose; it does not automatically recognize revenue rather than settle an invoice or record an advance. |

The catalog now contains **9 choices**. Latest owner decision removes **Office
Supplies** and restores incoming/outgoing capital movements. Use **Capital Deposits**
and **Capital Withdrawals** as clear cashbook labels; no separate Capital
Distributions choice is proposed. The screenshot's Office Supplies row is excluded
from this scope and must not be forced into another category. Restored capital
choices do not authorize importing historical rows.

Bank and Payment Fees is also excluded by owner decision. Standalone checkbook,
merchant and bank-transfer charges from the image have no category mapping in
this scope; do not force them into Payroll or Utilities. No automatic bank/payment
fee rows are requested. **Registration and Filing Fees** is also excluded by owner decision. The sample
government registration payment has no category mapping in the current scope; do
not force it into Taxes or another category. For payments containing embedded Maya/BPI charges,
confirm the amount/category handling before implementation; do not silently remove
charges from recorded cash amounts or invent another category.

## One category per record - owner confirmed

| Source payment | Recording approach | Check |
| --- | --- | --- |
| BIR + PhilHealth Quarterly Payments | Separate Taxes and Government Contributions records for verified component amounts | Do not also record the combined payment total. No allocation lines or Mixed category. |
| BIR Compliance April 2025 | Taxes only if a verified tax; filing charges remain excluded | Do not relabel filing/professional-service charges as tax. |

Every record has exactly one category. Retain original narrative and use optional
Reference text to relate separate component records if useful. No supporting-document
upload or link feature is included. Historical payroll and Excel export use the same
nine choices; missing historical Paid On periods are skipped/reported.

## Choice governance and access

Only Payroll Admin can access/view ledger records and select these choices in the
application. Choice configuration lives in Dataverse metadata; an account-maintenance
screen is not required. Adding/retiring labels is a later controlled schema change,
not an ordinary transaction edit. Preserve used values and historical meaning.

No final accounting/tax treatment or statutory rate is implied. Background context
from the earlier review remains available in the [IFRS Conceptual Framework](https://www.ifrs.org/issued-standards/list-of-standards/conceptual-framework/)
and [IAS 7](https://www.ifrs.org/issued-standards/list-of-standards/ias-7-statement-of-cash-flows/);
these sources do not define the owner's application category choices.
