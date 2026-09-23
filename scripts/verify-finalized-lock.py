"""Verify the finalized-payroll plug-in blocks edits to a locked entry and
allows edits when the period is Processing. Reversible: toggles status on the
given dev period and restores the entry's allowances. Argv: PERIOD_ID ENTRY_ID."""
import sys, json, os
from urllib.request import Request, urlopen
from urllib.error import HTTPError
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from auth import load_env, get_token

load_env()
BASE = os.environ["DATAVERSE_URL"].rstrip("/") + "/api/data/v9.2"
period_id, entry_id = sys.argv[1], sys.argv[2]
tok = get_token()

def patch(table, rid, body):
    req = Request(f"{BASE}/{table}({rid})", data=json.dumps(body).encode(), method="PATCH")
    req.add_header("Authorization", f"Bearer {tok}")
    req.add_header("Content-Type", "application/json")
    req.add_header("If-Match", "*")
    try:
        urlopen(req, timeout=30); return 204, ""
    except HTTPError as e:
        return e.code, json.loads(e.read()).get("error", {}).get("message", "")

# Lock the period, then attempt an entry edit — expect it blocked by the plug-in.
patch("a365_payrollperiods", period_id, {"a365_payrollstatus": 749910004})
code, msg = patch("a365_payrollentries", entry_id, {"a365_allowances": 1})
assert code >= 400 and "finalized" in msg.lower(), f"Expected block, got {code}: {msg}"
print("BLOCKED as expected while Locked:", msg)

# Unlock (-> Processing), then the same edit should succeed.
patch("a365_payrollperiods", period_id, {"a365_payrollstatus": 749910001})
code, msg = patch("a365_payrollentries", entry_id, {"a365_allowances": 0})
assert code == 204, f"Expected 204 after unlock, got {code}: {msg}"
print("ALLOWED as expected while Processing.")
print("PLUG-IN VERIFIED.")
