# TMMT Rentals — Architecture

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.1 |
| Database | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth + `@supabase/ssr` | 0.9.0 |
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
        Middleware["Middleware (auth gate)"]
        AppRouter["App Router"]
        AdminPages["17 Admin Pages (protected)"]
        Forms["8 Public Forms (public)"]
        LoginPage["Login Page"]
        ServerActions["Server Actions (signIn / signOut)"]
    end

    subgraph Backend["Supabase"]
        Auth["Auth ✅"]
        DB["PostgreSQL<br/>44 tables"]
        Storage["Storage (planned)<br/>File uploads"]
        RLS["Row-Level Security (planned)"]
    end

    UI --> Middleware
    Middleware -->|"authenticated"| AppRouter
    Middleware -->|"unauthenticated"| LoginPage
    AppRouter --> AdminPages
    AppRouter --> Forms
    LoginPage --> ServerActions
    ServerActions -->|"signInWithPassword"| Auth
    AdminPages -->|"@supabase/supabase-js"| DB
    Forms -->|"@supabase/supabase-js"| DB
```

## Directory Structure

```
TMMT/
├── docs/                          # Documentation
├── middleware.ts                  # Auth gate — checks session on every request
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root shell — blocking theme init script, suppressHydrationWarning required
│   │   ├── globals.css            # Tailwind v4 imports + dark mode variant
│   │   ├── (admin)/               # Protected route group (requires auth)
│   │   │   ├── layout.tsx         # Admin layout — renders Sidebar
│   │   │   ├── actions.ts         # signOut server action
│   │   │   ├── page.tsx           # Dashboard (KPI stats + recent activity)
│   │   │   ├── fleet/             # Fleet vehicle management
│   │   │   ├── leads/             # Incoming leads pipeline
│   │   │   ├── background-checks/ # Background verification tracking
│   │   │   ├── waitlist/          # Customer waitlist management
│   │   │   ├── appointments/      # Appointment scheduling
│   │   │   ├── customers/         # Active customer management
│   │   │   ├── payments/          # Payment tracking
│   │   │   ├── tickets/           # Support ticket management
│   │   │   ├── expenses/          # Expense tracking
│   │   │   ├── insurance/         # Insurance policy tracking
│   │   │   ├── inspections/       # Vehicle inspection records
│   │   │   ├── maintenance/       # Maintenance scheduling
│   │   │   ├── contracts/         # Contract management
│   │   │   ├── vendors/           # Vendor/shop directory
│   │   │   ├── operation-costs/   # Software & tools costs
│   │   │   ├── do-not-rent/       # Blacklisted customers
│   │   │   └── former-customers/  # Former customer archive
│   │   ├── (auth)/                # Public auth route group
│   │   │   ├── layout.tsx         # Minimal centered layout (no sidebar)
│   │   │   └── login/
│   │   │       ├── page.tsx       # Email + password login form
│   │   │       └── actions.ts     # signIn server action
│   │   └── forms/                 # Public-facing intake forms (no auth)
│   │       ├── lead-intake/
│   │       ├── background-check/
│   │       ├── waitlist/
│   │       ├── appointment/
│   │       ├── inspection/
│   │       ├── onboarding-inspection/
│   │       ├── handover/
│   │       └── ticket/
│   ├── components/
│   │   ├── Sidebar.tsx            # Navigation sidebar (5 groups + logout button)
│   │   ├── ThemeToggle.tsx        # Dark/light mode toggle
│   │   └── ui.tsx                 # Reusable UI component library
│   └── lib/
│       ├── supabase.ts            # Browser anon client (singleton); createServiceClient() exists but unused
│       ├── supabase-server.ts     # SSR clients: createSSRClient, createMiddlewareClient
│       ├── queries.ts             # Read fetchers only; writes use inline supabase.from().upsert() in pages
│       └── utils.ts               # Formatting + status colors
├── .env                           # Supabase credentials (gitignored)
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
        Supabase["supabase.ts<br/>Browser anon client (singleton)<br/>createServiceClient() unused"]
        SupabaseServer["supabase-server.ts<br/>createSSRClient (server actions)<br/>createMiddlewareClient (middleware)"]
        Queries["queries.ts<br/>fetchTable, getDashboardData<br/>(read-only; writes inline in pages)"]
        Utils["utils.ts<br/>cn, formatCurrency,<br/>formatDate, formatDateTime, statusColor"]
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
    EditForm --> Save: supabase.from().upsert()
    Save --> LoadData: Refresh data
    EditForm --> Delete: supabase.from().delete()
    Delete --> LoadData
```

## Auth Flow

- **Strategy**: Next.js middleware (`middleware.ts`) intercepts every request and calls `supabase.auth.getUser()` to verify the session token against the Supabase Auth server
- **Protected**: All routes except `/login` and `/forms/*`
- **Session storage**: Cookie-based via `@supabase/ssr` — tokens refreshed automatically on each request
- **Login**: Email + password via `supabase.auth.signInWithPassword()` in a server action
- **Logout**: `supabase.auth.signOut()` server action, triggered from sidebar button
- **Account management**: Admins created manually in Supabase dashboard (no signup flow)

```mermaid
sequenceDiagram
    participant Browser
    participant Middleware
    participant Supabase as Supabase Auth
    participant Page

    Browser->>Middleware: GET /fleet
    Middleware->>Supabase: getUser() — verify token
    Supabase-->>Middleware: no session
    Middleware-->>Browser: redirect /login

    Browser->>Page: GET /login
    Page-->>Browser: login form

    Browser->>Page: POST (email + password)
    Page->>Supabase: signInWithPassword()
    Supabase-->>Page: session + cookies
    Page-->>Browser: redirect /

    Browser->>Middleware: GET /fleet
    Middleware->>Supabase: getUser() — verify token
    Supabase-->>Middleware: user ok
    Middleware-->>Browser: pass through to /fleet
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
    NextJS->>Supabase: supabase.from("fleet").upsert(data)
    Supabase-->>NextJS: { data, error }
    NextJS-->>Browser: Refresh table / show error
```
