# PerFi

PerFi is a local-first personal finance desktop app built to make personal finance easier, more understandable, and more accessible.

The mission is simple: it should not cost extra money just to understand your own money.

PerFi aims to help people answer practical questions like:

- Where is my money going?
- What bills are recurring?
- Am I on track this month?
- How is my net worth changing?
- What does retirement look like from here?
- What does the next few months of cash flow probably look like?

## Status

PerFi is:

- Open source
- Actively under development
- A work in progress, not a finished product

Some areas are already useful today, while others are still rough, evolving, or being actively redesigned. Expect incomplete workflows, changing data models, and occasional sharp edges.

## Screenshots

These screenshots use the isolated demo profile with fake data so real financial data stays separate.

### Dashboard and Analysis

<p align="center">
  <img src="docs/readme-assets/01-home-dashboard.png" alt="PerFi home dashboard" width="48%" />
  <img src="docs/readme-assets/03-spending.png" alt="PerFi spending analysis" width="48%" />
</p>
<p align="center">
  <img src="docs/readme-assets/06-money-flow.png" alt="PerFi money flow view" width="48%" />
  <img src="docs/readme-assets/10-forecast.png" alt="PerFi forecast view" width="48%" />
</p>

### Planning and Wealth

<p align="center">
  <img src="docs/readme-assets/04-budget.png" alt="PerFi budget page" width="48%" />
  <img src="docs/readme-assets/07-net-worth.png" alt="PerFi net worth page" width="48%" />
</p>
<p align="center">
  <img src="docs/readme-assets/08-goals.png" alt="PerFi goals page" width="48%" />
  <img src="docs/readme-assets/09-retirement.png" alt="PerFi retirement planning page" width="48%" />
</p>

### Operations and Setup

<p align="center">
  <img src="docs/readme-assets/02-transactions.png" alt="PerFi transactions page" width="48%" />
  <img src="docs/readme-assets/05-fixed-costs.png" alt="PerFi fixed costs page" width="48%" />
</p>
<p align="center">
  <img src="docs/readme-assets/12-accounts.png" alt="PerFi accounts page" width="48%" />
  <img src="docs/readme-assets/11-insights.png" alt="PerFi insights page" width="48%" />
</p>

<details>
  <summary>Full screenshot gallery</summary>

  <p align="center">
    <img src="docs/readme-assets/13-settings-general.png" alt="PerFi settings general tab" width="48%" />
    <img src="docs/readme-assets/14-settings-categories.png" alt="PerFi settings categories tab" width="48%" />
  </p>
  <p align="center">
    <img src="docs/readme-assets/15-settings-import.png" alt="PerFi settings import tab" width="48%" />
  </p>

</details>

## What PerFi Does Today

### Core Money Tracking

- Account management for checking, savings, and credit-card style accounts
- Local transaction storage in SQLite
- Transaction search, filtering, and categorization
- Manual category editing
- Category rules for repeated auto-categorization
- Planning exclusion controls so certain transactions or categories do not affect forecasts

### Import and Data Ingestion

- CSV transaction import with format selection
- Import preview before committing data
- Duplicate detection during import
- Teller configuration for live bank sync workflows
- Investment CSV import
- Investment statement parsing support in the backend, including PDF/CSV-oriented import work

### Dashboard and Spending Analysis

- Home dashboard with command-center style summaries
- Cash flow summary cards
- Spending by category
- Top merchants
- Spending trends
- Money flow / Sankey-style flow views
- Fixed-cost detection and recurring-spend analysis
- Detailed spending breakdown pages

### Planning and Wealth Features

- Net worth tracking
- Assets and liabilities management
- Net worth history snapshots
- Budget management
- Goal tracking
- Retirement profile and projection workflows
- Cash flow forecasting
- Seasonal pattern analysis
- Debt payoff planning

### Insights and AI Prep

- Saved insights feed
- Filter-specific “Prepare Data for AI” export for insight sections
- Explainable forecast work, including confidence ranges and uncertainty bands

### Local Profiles and Demo Data

- Default local profile for your real data
- Secondary local profiles via `--profile <name>`
- Isolated screenshot/demo profile support
- Demo data seeding for non-default profiles

## Product Philosophy

PerFi is built around a few principles:

- Local first: your financial data should primarily live on your machine
- Explainable over magical: forecasts and planning tools should be inspectable and understandable
- Practical over performative: the goal is useful personal finance decisions, not finance theater
- Accessible by default: people should not need to pay a subscription just to see where they stand

## Privacy and Data Storage

PerFi stores its app data locally.

- Main data store: local SQLite database (`perfi.db`)
- Default profile: your normal app data directory
- Additional profiles: separate app data directories under `profiles/<name>`
- Sensitive runtime data, if configured, can include local Teller-related connection metadata and tokens in the local database

This repo itself is source code. User financial data is intended to live locally, not in git.

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS
- Desktop shell: Tauri 2
- Backend: Rust
- Database: SQLite via `rusqlite`
- Charts: Recharts and D3 Sankey
- E2E tests: Playwright

## Project Structure

High-level layout:

- [src](D:\github\PerFi\src): React app
- [src-tauri](D:\github\PerFi\src-tauri): Rust backend and Tauri app
- [src-tauri\migrations](D:\github\PerFi\src-tauri\migrations): SQLite schema migrations
- [tests\e2e](D:\github\PerFi\tests\e2e): Playwright end-to-end tests

Key app areas:

- [src\App.tsx](D:\github\PerFi\src\App.tsx): top-level routes
- [src\components\Dashboard](D:\github\PerFi\src\components\Dashboard): home and dashboard surfaces
- [src\components\Transactions](D:\github\PerFi\src\components\Transactions): transaction list and controls
- [src\components\Spending](D:\github\PerFi\src\components\Spending): spending analysis
- [src\components\Budget](D:\github\PerFi\src\components\Budget): budget workflows
- [src\components\NetWorth](D:\github\PerFi\src\components\NetWorth): asset/liability and net worth workflows
- [src\components\Goals](D:\github\PerFi\src\components\Goals): goal tracking
- [src\components\Retirement](D:\github\PerFi\src\components\Retirement): retirement modeling
- [src\components\Forecasting](D:\github\PerFi\src\components\Forecasting): forecast UI
- [src\components\Insights](D:\github\PerFi\src\components\Insights): insights and AI export
- [src\components\Settings](D:\github\PerFi\src\components\Settings): settings, Teller, imports, profile info

## Building PerFi

### Prerequisites

You need:

- Node.js 20+ recommended
- npm available on your machine
- Rust toolchain installed
- Tauri system prerequisites installed for your OS

For Windows, that generally means:

- Rust via `rustup`
- Microsoft Visual Studio C++ build tools
- WebView2 runtime

If Tauri prerequisites are missing, install them first using the official Tauri docs for your platform.

### Install dependencies

From the repo root:

```powershell
npm install
```

### Run in development

Frontend only:

```powershell
npm run dev
```

Desktop app:

```powershell
npm run tauri dev
```

### Build the desktop app

```powershell
npm run tauri build
```

The packaged Windows executable is built at:

- [perfi.exe](D:\github\PerFi\src-tauri\target\release\perfi.exe)

## Testing

Frontend E2E tests:

```powershell
npx playwright install chromium
npx playwright test
```

Alternate scripts:

```powershell
npm run test:e2e
npm run test:e2e:headed
```

For this project, the current desktop validation gate is:

```powershell
npm run tauri build
```

## Running a Separate Screenshot / Demo Instance

PerFi supports isolated local profiles so you do not have to mix real data and fake data.

Launch a separate profile like this:

```powershell
D:\github\PerFi\src-tauri\target\release\perfi.exe --profile screenshots
```

Then open Settings and seed demo data into that non-default profile.

This keeps your default profile and live data separate from screenshot/demo data.

## Current Limitations

PerFi is still early. Some known realities:

- Some features are more polished than others
- Forecasting is heuristic and still evolving
- Teller/live sync setup is still developer-oriented
- Data models and UX may change
- There are still Rust warnings and unfinished backend surfaces in planning-related modules
- The app should be treated as experimental software, not production-grade financial infrastructure

## Open Source

PerFi is intended to be open source and hackable.

If you want to contribute, the most useful areas are:

- reliability and correctness
- import quality
- forecasting improvements
- UI/UX polish
- data quality tools
- tests and regression coverage

## Why This Exists

Most people do not need more finance complexity. They need more clarity.

PerFi exists because basic financial understanding should be easier:

- easier to import and review your own data
- easier to understand cash flow
- easier to see recurring obligations
- easier to plan savings and retirement
- easier to trust what the software is telling you

And it should not require paying extra money just to know how your own finances are doing.
