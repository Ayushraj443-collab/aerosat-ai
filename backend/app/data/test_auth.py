"""
Copernicus Sentinel Hub / CDSE OAuth Authentication Diagnostic CLI Tool.

Run via:
    python -m app.data.test_auth

Reports:
    - Credentials configured: YES / NO
    - Token request: SUCCESS / FAILURE / NOT_CONFIGURED
    - HTTP status and sanitized error category
    - Provider tested
    - Timestamp (UTC)

Under NO circumstance are secrets or access tokens displayed, printed, or leaked.
"""

import sys
from app.data.connectors import CopernicusOAuthManager

def run_diagnostic():
    diag = CopernicusOAuthManager.test_connection()
    configured_str = "YES" if diag["credentials_configured"] else "NO"
    status_str = diag["token_request"]
    http_str = str(diag["http_status"]) if diag["http_status"] is not None else "None"
    err_cat_str = diag["error_category"] or "None"

    print("=" * 66)
    print("      AeroSat-AI — Copernicus OAuth Authentication Diagnostic      ")
    print("=" * 66)
    print(f"Credentials Configured : {configured_str}")
    print(f"Token Request          : {status_str}")
    print(f"HTTP Status            : {http_str}")
    print(f"Error Category         : {err_cat_str}")
    print(f"Auth Provider Tested   : {diag['auth_provider']}")
    print(f"Timestamp (UTC)        : {diag['timestamp']}")
    print("-" * 66)
    print(f"Details                : {diag['details']}")
    print("=" * 66)

    if status_str == "SUCCESS":
        print("\n[PASS] Copernicus OAuth authentication verified successfully.")
        return 0
    elif status_str == "NOT_CONFIGURED":
        print("\n[ACTION REQUIRED] Credentials not configured in backend/.env.")
        print("Set COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET in backend/.env.")
        return 0
    else:
        print("\n[FAIL] Authentication rejected or connection failed.")
        print("Check your Client ID and Client Secret in backend/.env.")
        return 1

if __name__ == "__main__":
    sys.exit(run_diagnostic())
