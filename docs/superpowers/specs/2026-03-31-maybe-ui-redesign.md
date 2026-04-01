# PerFi UI/UX Redesign — Maybe-Inspired

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Full UI/UX overhaul adopting Maybe's design language while preserving PerFi's transaction logic, Teller integration, and Rust/Tauri backend.

---

## 1. Design System

### Theme & Colors
- **Default theme:** Dark mode (near-black `#0B0B0B` background), with light mode available via toggle
- **Theme switching:** `data-theme` attribute on `<html>`, persisted to localStorage
- **Color palette:** Adopt Maybe's semantic color scales:
  - Surface hierarchy: `bg-surface`, `bg-surface-hover`, `bg-surface-inset`, `bg-container`
  - Text hierarchy: `text-primary`, `text-secondary`, `text-subdued`
  - Borders: Alpha-based subtle borders (1px, ~6% opacity)
  - Shadows: xs through xl with alpha-black in light mode, alpha-white in dark mode
  - Semantic colors: success (green), warning (yellow), destructive (red)
  - Chart colors: 5-6 distinct hues from Maybe's extended palette
- **Color format:** CSS custom properties using hex/rgba (not OKLCH — switching to match Maybe's approach)

### Typography
- **Font family:** Geist (sans-serif) and Geist Mono (monospace)
- **Font loading:** Self-hosted via `@font-face` declarations (Tauri desktop app, no CDN)
- **Scale:** xs (12px), sm (14px), base (16px), lg (18px), xl (20px), 2xl (24px), 3xl (30px)
- **Weights:** Regular (400), Medium (500), Bold (700)

### Spacing & Borders
- **Border radius:** 8px (md), 10px (lg) — modern but not maximally rounded
- **Borders:** Alpha-based, 1px width, subtle
- **Shadows:** Layered shadow system xs-xl

### Tailwind Integration
- Replace current OKLCH CSS variables in `globals.css` with Maybe-inspired semantic tokens
- Add custom Tailwind utilities for surface/container/text hierarchy
- Keep using `@theme inline` directive in Tailwind v4

---

## 2. Layout & Navigation

### Desktop Layout
- **Two-panel:** Icon nav rail (60-84px) + main content area
- **No account sidebar** — accounts are a full page
- **Nav rail:** Vertical strip with app logo at top, nav icons center, settings icon at bottom
- **Active indicator:** Left border highlight on active nav item
- **Tooltips:** Icon labels shown on hover via tooltip component
- **Main content:** Max-width container (~1280px), centered, scrollable

### Nav Items (5 total)
1. **Home** (pie-chart icon) — `/`
2. **Transactions** (credit-card icon) — `/transactions`
3. **Money Flow** (git-branch icon) — `/money-flow`
4. **Accounts** (landmark icon) — `/accounts`
5. **Settings** (settings icon) — `/settings` (at bottom of rail, separated)

### Mobile Layout (future consideration)
- Top bar with hamburger + logo + user menu
- Bottom tab bar with the 5 nav items
- Not in initial scope — PerFi is a Tauri desktop app

---

## 3. Pages

### Home (`/`)
Consolidated dashboard replacing current Dashboard + Cash Flow pages.

**Layout (top to bottom):**
1. **Date range picker** — top right, period selector (This Month, Last Month, 3M, 6M, YTD, 1Y, Custom)
2. **Net Worth section** — smaller time-series line chart showing total balance trend
3. **Cash Flow summary cards** — row of 3 cards: Income (green), Spending (red), Net (blue/gray)
4. **Spending by Category** — pie/donut chart with category legend
5. **Top Merchants** — horizontal bar chart, top 5-10
6. **Spending Trend** — bar chart showing monthly spending over time (from current TrendChart)

### Transactions (`/transactions`)
Redesigned presentation layer, keeping existing transaction logic.

- **Search bar** at top with filter controls
- **Bulk selection** via checkboxes
- **Desktop:** Table/grid view with columns: Date, Description, Category, Amount
- **Inline category editing** via dropdown/click-to-edit
- **Pagination** — keep existing pagination logic
- **Filters:** Category, date range, amount range, account

### Money Flow (`/money-flow`)
- Keep existing Sankey diagram
- Restyle with new design tokens (dark theme compatible)
- Add date range picker consistent with Home page

### Accounts (`/accounts`)
- Account cards in a grid layout
- Each card: account name, institution, balance, last synced, sparkline trend
- Teller Connect button for adding new accounts
- Sync status indicators

### Settings (`/settings`)
Consolidates current Settings + Categories + Import pages.

**Tabs:**
1. **General** — Theme toggle (dark/light), app preferences
2. **Teller** — API configuration (current TellerSettings)
3. **Categories** — Category manager (current CategoryManager)
4. **Import** — CSV import (current CsvImport)

---

## 4. Component Library

Build only what pages require. Components to create:

| Component | Used By | Description |
|-----------|---------|-------------|
| **Tabs** | Settings, Dashboard date ranges | Tab bar with active/inactive states |
| **Dialog** | Account connection, confirmations, category edit | Modal overlay with configurable positioning |
| **Toggle** | Theme switcher, settings | On/off switch |
| **Tooltip** | Nav rail icon labels, chart data points | Hover tooltip |
| **DropdownMenu** | Transaction actions, nav user menu | Positioned dropdown with menu items |

Existing components to restyle:
- **Card** — update with new surface/shadow tokens
- **Button** — add variants: primary, secondary, ghost, destructive, icon-only
- **Badge** — update colors to match new palette
- **Input** — update with new border/focus styles

---

## 5. Charts

- **Keep Recharts** for bar charts, pie charts, line charts, composed charts
- **Keep D3** for Sankey diagram
- **Restyle all charts** with new color tokens and dark-mode-compatible colors
- **Consistent tooltips** across all charts using new design tokens

---

## 6. What Does NOT Change

- Rust/Tauri backend — all commands, database, migrations unchanged
- Transaction logic — categorization, rules, processing
- Teller integration — connection flow, API calls
- Data models and types
- API layer (`api.ts`)
- Build tooling (Vite, Tailwind v4, TypeScript)

---

## 7. Implementation Phases

### Phase 1: Design System Foundation
- Replace `globals.css` with Maybe-inspired tokens
- Add Geist font files and `@font-face` declarations
- Add theme switcher utility (dark/light with `data-theme`)
- Add semantic Tailwind utilities (surface, container, text hierarchy)

### Phase 2: Layout Shell
- Rewrite `Layout.tsx` — icon nav rail + main content
- Build Tooltip component (for nav labels)
- Update `App.tsx` routes (consolidate to 5)

### Phase 3: New Components
- Build Tabs, Dialog, Toggle, DropdownMenu components
- Restyle existing Card, Button, Badge, Input

### Phase 4: Page Redesigns
- **Home** — new consolidated dashboard
- **Transactions** — redesigned presentation
- **Accounts** — card grid layout
- **Money Flow** — restyle with new tokens
- **Settings** — tabbed layout absorbing Categories + Import

### Phase 5: Polish
- Chart restyling for dark mode
- Consistent spacing and typography pass
- Remove unused old components/pages
