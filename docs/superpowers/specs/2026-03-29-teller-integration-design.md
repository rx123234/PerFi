# Teller.io Integration Design

**Date:** 2026-03-29
**Status:** Approved
**Replaces:** Plaid integration

## Goal

Replace the existing Plaid integration with Teller.io to enable automatic bank transaction syncing for personal use. The user has a Teller account with a certificate/key pair and wants to connect real bank accounts.

## Scope

- Remove all Plaid code and references
- Add Teller enrollment, account, and transaction sync
- DB migration to rename Plaid columns to Teller equivalents
- No other features change (manual accounts, CSV import, categories, dashboard all untouched)

---

## Architecture

Four areas change:

| Area | Change |
|------|--------|
| Backend | `plaid.rs` → `teller.rs` with mTLS reqwest client |
| Database | Migration 002: rename Plaid tables/columns to Teller equivalents |
| Frontend | `PlaidLink.tsx` → `TellerConnect.tsx`, `PlaidSettings.tsx` → `TellerSettings.tsx` |
| Config | `tauri.conf.json` CSP updated for `cdn.teller.io` and `api.teller.io` |

---

## Data Flow

### Enrollment (Linking a Bank)

1. User clicks "Link Account" in `AccountList`
2. `TellerConnect.tsx` injects Teller Connect JS widget from `cdn.teller.io`
3. Widget opens with `applicationId` + `environment` from stored config
4. User authenticates with their bank in the widget
5. Widget fires `onSuccess({ accessToken, enrollment, user })`
6. Frontend calls `teller_connect_success(accessToken, enrollmentId)`
7. Backend calls `GET /accounts` on `api.teller.io` using mTLS + Basic auth
8. Accounts written to DB; `accessToken` stored in OS keychain keyed by enrollment ID

### Transaction Sync

1. User clicks Sync on an account (or sync all)
2. Backend reads `teller_last_tx_id` from DB for that account
3. Calls `GET /accounts/{id}/transactions?count=250` (adds `from_id=teller_last_tx_id` if not first sync)
4. Inserts new transactions; updates `teller_last_tx_id` to newest transaction ID
5. Returns `SyncResult { added, modified, removed }` — same shape as before

### Certificate Handling

- User sets cert/key file paths once in Settings via file picker
- Paths stored in DB (not cert contents)
- Each API call builds a `reqwest::Client` with the cert loaded from disk at call time
- Certs never stored in keychain or DB — only file paths

---

## Backend: `teller.rs`

### Tauri Commands

| Command | Signature | Description |
|---------|-----------|-------------|
| `save_teller_config` | `(app_id, environment, cert_path, key_path) → ()` | Validates paths exist, writes to `teller_config` table |
| `get_teller_config` | `() → TellerConfigMeta` | Returns safe metadata (no paths, masked app_id) |
| `teller_connect_success` | `(access_token, enrollment_id) → Vec<Account>` | Calls GET /accounts, saves results + keychain token |
| `sync_transactions` | `(account_id) → SyncResult` | Syncs one account |
| `sync_all_accounts` | `() → Vec<(String, SyncResult)>` | Syncs all Teller accounts |

### Teller API

- Base URL: `https://api.teller.io`
- Auth: HTTP Basic (`accessToken` as username, empty password) + mTLS client certificate
- Key endpoints:
  - `GET /accounts` — list enrolled accounts
  - `GET /accounts/{id}/transactions?count=250[&from_id=X]` — paginated transactions
  - `GET /accounts/{id}/balances` — current balance (future use)

### Models

```
TellerConfig (internal, never sent to frontend)
  app_id: String
  environment: String
  cert_path: String
  key_path: String

TellerConfigMeta (safe for frontend)
  is_configured: bool
  environment: String
  app_id_hint: String   // last 4 chars only
```

---

## Database: Migration 002

```sql
-- New config table (replaces plaid_credentials)
CREATE TABLE teller_config (
    id          TEXT PRIMARY KEY,
    app_id      TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'development',
    cert_path   TEXT NOT NULL,
    key_path    TEXT NOT NULL
);

-- Rename Plaid columns on accounts
ALTER TABLE accounts RENAME COLUMN plaid_account_id   TO teller_account_id;
ALTER TABLE accounts RENAME COLUMN plaid_item_id      TO teller_enrollment_id;
ALTER TABLE accounts RENAME COLUMN plaid_access_token TO teller_access_token;
ALTER TABLE accounts RENAME COLUMN plaid_cursor       TO teller_last_tx_id;

-- Rename Plaid tx id on transactions
ALTER TABLE transactions RENAME COLUMN plaid_tx_id TO teller_tx_id;

-- Drop old credentials table
DROP TABLE IF EXISTS plaid_credentials;
```

Existing manual accounts and their transactions are unaffected — only column names change.

---

## Frontend

### `TellerSettings.tsx`

Replaces `PlaidSettings.tsx`. Fields:
- **App ID** — text input
- **Environment** — dropdown: sandbox / development / production
- **Certificate file** — file path input + "Browse" button (uses `@tauri-apps/plugin-dialog`)
- **Private key file** — same pattern
- Save → `save_teller_config`
- Shows configured status (masked app ID, environment, whether cert paths are set)

### `TellerConnect.tsx`

Replaces `PlaidLink.tsx`.
- On button click, dynamically injects `<script src="https://cdn.teller.io/connect/connect.js">` if not already present
- Calls `window.TellerConnect.setup({ appId, environment, onSuccess, onExit })`
- `onSuccess({ accessToken, enrollment, user })` → calls `teller_connect_success` command
- `onExit` resets loading state

### `AccountList.tsx`

- Replace `PlaidLinkButton` import with `TellerConnectButton`
- Badge: `"plaid"` source label → `"Teller"`
- Sync button condition: `acc.source === "plaid"` → `acc.source === "teller"`
- Empty state text updated

### `api.ts`

Remove Plaid commands, add:
```ts
saveTellerConfig(appId, environment, certPath, keyPath) → void
getTellerConfig() → TellerConfigMeta
tellerConnectSuccess(accessToken, enrollmentId) → Account[]
syncTransactions(accountId) → SyncResult   // same signature
syncAllAccounts() → [string, SyncResult][] // same signature
```

---

## CSP Update (`tauri.conf.json`)

```
connect-src 'self' https://api.teller.io;
script-src 'self' https://cdn.teller.io;
```

Remove `https://*.plaid.com`.

---

## Files Changed

| File | Action |
|------|--------|
| `src-tauri/src/commands/plaid.rs` | Delete |
| `src-tauri/src/commands/teller.rs` | Create |
| `src-tauri/src/models.rs` | Replace Plaid models with Teller |
| `src-tauri/migrations/002_teller.sql` | Create |
| `src-tauri/src/db.rs` | Add migration 002 |
| `src/components/Accounts/PlaidLink.tsx` | Delete |
| `src/components/Accounts/TellerConnect.tsx` | Create |
| `src/components/Settings/PlaidSettings.tsx` | Delete |
| `src/components/Settings/TellerSettings.tsx` | Create |
| `src/components/Accounts/AccountList.tsx` | Update imports + labels |
| `src/lib/api.ts` | Swap Plaid commands for Teller |
| `src/lib/types.ts` | Swap Plaid types for Teller |
| `src-tauri/tauri.conf.json` | Update CSP |
| `package.json` | Remove `react-plaid-link` |

## Out of Scope

- Balance syncing (Teller supports it but not currently shown on accounts page — future work)
- Webhooks (polling on demand is sufficient for personal use)
- Multi-user support
