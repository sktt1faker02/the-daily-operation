"""
seed_statutory_config.py — Seed The Daily Operation's statutory configuration
tables with the verified 2025 Philippine rates and the BIR semi-monthly
withholding-tax brackets.

Idempotent: each row is keyed by (a365_name, a365_effectivefrom); existing rows
are left untouched. Safe to re-run. Reproducible source of the Dev config;
production loading is Phase 13.

Rates verified 2025 (see docs/superpowers/specs/2026-09-06-phase-5-payroll-
calculation-engine-design.md §2):
  SSS        — 15% of MSC; employee 5%, employer 10%; MSC floor 5,000 /
               ceiling 35,000 (₱500 MSC steps); EC 10 (<15k) / 30 (>=15k).
               The EMPLOYEE amount (used by the payroll engine) is exactly
               5% x MSC and reproduces the client payslip (43,000 -> 1,750).
               Employer/EC amounts follow the 2025 structure and should be
               spot-checked against the official SSS PDF before any employer
               remittance feature (not used in V1 net-pay calc).
  PhilHealth — premium 5%, employee half (2.5%), floor 10,000 / ceiling 100,000.
  HDMF       — employee 2%, employer 2%, compensation cap 10,000.
  BIR tax    — semi-monthly brackets, TRAIN 2023-> (RR 11-2018 Annex E).

Usage:  python scripts/seed_statutory_config.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.getcwd(), "scripts"))
from auth import get_client  # noqa: E402

EFFECTIVE_FROM = "2025-01-01"
VERSION = "2025"

client = get_client("dv-data")


def ensure(table, name, data):
    """Create the row unless one with this (name, effectivefrom) already exists."""
    existing = client.records.list(
        table,
        filter=f"a365_name eq '{name}' and a365_effectivefrom eq {EFFECTIVE_FROM}",
        select=["a365_name"],
        top=1,
    )
    first = existing.first() if hasattr(existing, "first") else (list(existing)[0] if existing else None)
    if first is not None:
        print(f"  = exists: {name}")
        return
    payload = {"a365_name": name, "a365_effectivefrom": EFFECTIVE_FROM, "a365_version": VERSION}
    payload.update(data)
    client.records.create(table, payload)
    print(f"  + created: {name}")


def seed_sss():
    print("SSS contribution brackets (MSC 5,000..35,000, EE 5% / ER 10%):")
    mscs = list(range(5000, 35001, 500))  # 5000, 5500, ..., 35000
    for i, msc in enumerate(mscs):
        if i == 0:
            comp_from, comp_to = 0, 5249.99
        elif i == len(mscs) - 1:
            comp_from, comp_to = 34750, None  # open-ended top
        else:
            comp_from, comp_to = msc - 250, msc + 249.99
        ee = round(0.05 * msc, 2)
        er = round(0.10 * msc, 2)
        ec = 10 if msc < 15000 else 30
        data = {
            "a365_compensationfrom": comp_from,
            "a365_msc": msc,
            "a365_employeeamount": ee,
            "a365_employeramount": er,
            "a365_ecamount": ec,
        }
        if comp_to is not None:
            data["a365_compensationto"] = comp_to
        ensure("a365_ssscontribution", f"SSS 2025 MSC {msc}", data)


def seed_philhealth():
    print("PhilHealth (5% premium, EE half):")
    ensure("a365_philhealthcontribution", "PhilHealth 2025", {
        "a365_premiumrate": 0.05,
        "a365_employeeshare": 0.5,
        "a365_incomefloor": 10000,
        "a365_incomeceiling": 100000,
    })


def seed_hdmf():
    print("HDMF / Pag-IBIG (EE 2%, cap 10,000):")
    ensure("a365_hdmfcontribution", "HDMF 2025", {
        "a365_employeerate": 0.02,
        "a365_employerrate": 0.02,
        "a365_compensationcap": 10000,
    })


def seed_tax():
    print("BIR semi-monthly withholding brackets:")
    brackets = [
        (1, 0, 10417, 0, 0),
        (2, 10417, 16666, 0, 0.15),
        (3, 16667, 33332, 937.50, 0.20),
        (4, 33333, 83332, 4270.70, 0.25),
        (5, 83333, 333332, 16770.70, 0.30),
        (6, 333333, None, 91770.70, 0.35),
    ]
    for seq, lo, hi, base, rate in brackets:
        data = {
            "a365_sequence": seq,
            "a365_incomefrom": lo,
            "a365_basetax": base,
            "a365_marginalrate": rate,
        }
        if hi is not None:
            data["a365_incometo"] = hi
        ensure("a365_taxbracket", f"BIR SM 2023 bracket {seq}", data)


if __name__ == "__main__":
    seed_sss()
    seed_philhealth()
    seed_hdmf()
    seed_tax()
    print("\nSeed complete.")
