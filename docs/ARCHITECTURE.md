# TMMT Rentals — Architecture

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.1 |
| Database | Supabase (PostgreSQL) | — |
| Icons | lucide-react | — |
| Utilities | date-fns, clsx, tailwind-merge | — |

## High-Level Architecture

```mermaid
graph TB
    subgraph Client["Browser"]
        UI["Next.js App (React)"]
        Toggle["Dark Mode Toggle"]
    end

    subgraph Server["Next.js Server"]
        AppRouter["App Router"]
        Pages["18 Admin Pages"]
        Forms["8 Public Forms"]
        API["Server Components"]
    end

    subgraph Backend["Supabase"]
        Auth["Auth (planned)"]
        DB["PostgreSQL<br/>44 tables"]
        Storage["Storage (planned)<br/>File uploads"]
        RLS["Row-Level Security (planned)"]
    end

    UI --> AppRouter
    AppRouter --> Pages
    AppRouter --> Forms
    Pages -->|"@supabase/supabase-js"| DB
    Forms -->|"@supabase/supabase-js"| DB
```

## Directory Structure

```
TMMT/
├── docs/                          # Documentation
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout + sidebar + dark mode script
│   │   ├── globals.css            # Tailwind v4 imports + dark mode variant
│   │   ├── page.tsx               # Dashboard (KPI stats + recent activity)
│   │   ├── fleet/                 # Fleet vehicle management
│   │   ├── leads/                 # Incoming leads pipeline
│   │   ├── background-checks/     # Background verification tracking
│   │   ├── waitlist/              # Customer waitlist management
│   │   ├── appointments/          # Appointment scheduling
│   │   ├── customers/             # Active customer management
│   │   ├── payments/              # Payment tracking
│   │   ├── tickets/               # Support ticket management
│   │   ├── expenses/              # Expense tracking
│   │   ├── insurance/             # Insurance policy tracking
│   │   ├── inspections/           # Vehicle inspection records
│   │   ├── maintenance/           # Maintenance scheduling
│   │   ├── contracts/             # Contract management
│   │   ├── vendors/               # Vendor/shop directory
│   │   ├── operation-costs/       # Software & tools costs
│   │   ├── do-not-rent/           # Blacklisted customers
│   │   ├── former-customers/      # Former customer archive
│   │   └── forms/                 # Public-facing intake forms
│   │       ├── lead-intake/       # New customer inquiry
│   │       ├── background-check/  # Background check submission
│   │       ├── waitlist/          # Join waitlist
│   │       ├── appointment/       # Schedule appointment
│   │       ├── inspection/        # Vehicle inspection checklist
│   │       ├── onboarding-inspection/ # Full 23-field onboarding
│   │       ├── handover/          # Vehicle handover checklist
│   │       └── ticket/            # Support ticket submission
│   ├── components/
│   │   ├── Sidebar.tsx            # Navigation sidebar (5 groups)
│   │   ├── ThemeToggle.tsx        # Dark/light mode toggle
│   │   └── ui.tsx                 # Reusable UI component library
│   └── lib/
│       ├── supabase.ts            # Supabase client initialization
│       ├── queries.ts             # All data fetchers + CRUD helpers
│       └── utils.ts               # Formatting + status colors
├── .env.local                     # Supabase credentials (gitignored)
├── package.json
├── tsconfig.json
└── next.config.ts
```

## Component Architecture

```mermaid
graph LR
    subgraph SharedComponents["src/components/"]
        Sidebar["Sidebar.tsx<br/>Navigation + ThemeToggle"]
        UI["ui.tsx<br/>Card, DataTable, Modal,<br/>FormField, Button, Badge,<br/>StatusBadge, FilterBar,<br/>StatCard, PageHeader"]
        Theme["ThemeToggle.tsx<br/>Dark mode persistence"]
    end

    subgraph Lib["src/lib/"]
        Supabase["supabase.ts<br/>Client init"]
        Queries["queries.ts<br/>fetchTable, upsertRecord,<br/>deleteRecord, getDashboardData"]
        Utils["utils.ts<br/>cn, formatCurrency,<br/>formatDate, statusColor"]
    end

    subgraph Pages["Admin Pages (×18)"]
        P["Each page uses:<br/>• PageHeader<br/>• FilterBar<br/>• DataTable<br/>• Modal + FormField<br/>• StatusBadge"]
    end

    subgraph Forms["Public Forms (×8)"]
        F["Each form uses:<br/>• Card<br/>• FormField<br/>• Button<br/>• supabase.insert()"]
    end

    Pages --> UI
    Pages --> Queries
    Pages --> Utils
    Forms --> UI
    Forms --> Supabase
```

## Admin Page Pattern

Every admin page follows the same architecture:

```mermaid
stateDiagram-v2
    [*] --> LoadData: useEffect → fetchTable()
    LoadData --> Display: setState(data)
    Display --> Search: User types in FilterBar
    Search --> FilteredView: useMemo filters data
    FilteredView --> Display
    Display --> OpenModal: User clicks row or "Add"
    OpenModal --> EditForm: Modal with FormField inputs
    EditForm --> Save: upsertRecord()
    Save --> LoadData: Refresh data
    EditForm --> Delete: deleteRecord()
    Delete --> LoadData
```

## Dark Mode

- **Mechanism**: Class-based (`html.dark`) via Tailwind v4 `@custom-variant`
- **Persistence**: `localStorage.theme` = `"dark"` | `"light"`
- **Flash prevention**: Inline `<script>` in `<head>` applies class before first paint
- **Fallback**: Respects `prefers-color-scheme: dark` when no stored preference
- **Toggle**: Sun/moon button in sidebar header

## Data Flow

```mermaid
sequenceDiagram
    participant Browser
    participant NextJS as Next.js
    participant Supabase as Supabase (PostgreSQL)

    Browser->>NextJS: Page load
    NextJS->>Supabase: fetchTable("fleet", "*", "created_at")
    Supabase-->>NextJS: JSON rows
    NextJS-->>Browser: Rendered table

    Browser->>NextJS: User clicks "Add New"
    NextJS-->>Browser: Opens Modal form

    Browser->>NextJS: User submits form
    NextJS->>Supabase: upsertRecord("fleet", data)
    Supabase-->>NextJS: { data, error }
    NextJS-->>Browser: Refresh table / show error
```
