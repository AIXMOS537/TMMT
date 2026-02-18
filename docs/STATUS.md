# TMMT Rentals — Project Status

> Last updated: February 18, 2026

## Migration Status

| Phase | Status | Details |
|-------|--------|---------|
| Airtable Export | ✅ Complete | 2,713 records across 3 bases |
| Supabase Schema | ✅ Complete | 44 tables (25 main + 19 junction) |
| Data Import | ✅ Complete | 1,453 records, 368 junction links, 0 errors |
| App Build | ✅ Complete | 29 routes, all compiling |
| Dark Mode | ✅ Complete | Class-based with toggle + persistence |

## Current Record Counts

| Table | Records | Notes |
|-------|---------|-------|
| fleet | 41 | Active fleet vehicles |
| incoming_leads | 662 | Lead pipeline |
| background_checks | 237 | Verification records |
| waitlist | 78 | Customers waiting for vehicles |
| appointments | 1 | Scheduled appointments |
| active_customers | 37 | Currently renting |
| payments | 0 | Payment tracking |
| tickets | 257 | Support/issue tickets |
| expenses | 35 | Business expenses |
| insurance | 24 | Insurance policies |
| customer_inspection_photos | 1 | Inspection records |
| maintenance | 0 | Maintenance records |
| contracts | 1 | Rental contracts |
| vendors | 0 | Vendor/shop directory |
| operation_costs | 5 | Software & tools |
| do_not_rent | 0 | Blacklisted customers |
| former_customers | 1 | Archived customers |
| vehicle_handovers | 0 | Handover records |

## Feature Status

```mermaid
graph LR
    subgraph Done["✅ Complete"]
        D1["Dashboard + KPIs"]
        D2["18 Admin Pages"]
        D3["8 Public Forms"]
        D4["Dark Mode"]
        D5["Supabase Integration"]
        D6["Search + Filters"]
        D7["CRUD (Create/Read/Update/Delete)"]
        D8["Status Badges"]
        D9["Responsive Sidebar"]
    end

    subgraph Planned["🔲 Planned"]
        P1["Authentication"]
        P2["Row-Level Security"]
        P3["File Uploads<br/>(Supabase Storage)"]
        P4["Email Notifications"]
        P5["Reporting / Analytics"]
        P6["TMMT Rentals Copy base"]
    end

    subgraph NiceToHave["💡 Nice to Have"]
        N1["PDF Contract Generation"]
        N2["Calendar View"]
        N3["Customer Portal"]
        N4["SMS Integration"]
        N5["Payment Gateway"]
    end
```

## Application Routes

### Admin Pages (18)

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Dashboard | KPI stats, recent leads & tickets |
| `/fleet` | Fleet Vehicles | Vehicle inventory management |
| `/leads` | Incoming Leads | Lead pipeline with status cards |
| `/background-checks` | Background Checks | Verification tracking |
| `/waitlist` | Waitlist | Customer queue management |
| `/appointments` | Appointments | Scheduling |
| `/customers` | Active Customers | Current renters |
| `/payments` | Payments | Payment tracking |
| `/tickets` | Tickets | Support ticket management |
| `/expenses` | Expenses | Business expense tracking |
| `/insurance` | Insurance | Policy management |
| `/inspections` | Inspections | Vehicle inspection logs |
| `/maintenance` | Maintenance | Repair/service tracking |
| `/contracts` | Contracts | Rental agreement management |
| `/vendors` | Vendors / Shops | Vendor directory |
| `/operation-costs` | Software & Tools | Operational cost tracking |
| `/do-not-rent` | Do Not Rent | Customer blacklist |
| `/former-customers` | Former Customers | Customer archive |

### Public Forms (8)

| Route | Form | Inserts Into |
|-------|------|-------------|
| `/forms/lead-intake` | New Customer Inquiry | `incoming_leads` |
| `/forms/background-check` | Background Check Submission | `background_checks` |
| `/forms/waitlist` | Join Waitlist | `waitlist` |
| `/forms/appointment` | Schedule Appointment | `appointments` |
| `/forms/inspection` | Vehicle Inspection | `customer_inspection_photos` |
| `/forms/onboarding-inspection` | Full Onboarding (23 fields) | `customer_inspection_photos` |
| `/forms/handover` | Vehicle Handover Checklist | `vehicle_handovers` |
| `/forms/ticket` | Submit Support Ticket | `tickets` |

## Codebase Stats

| Metric | Value |
|--------|-------|
| Total source files | 33 |
| Total lines of code | ~3,740 |
| Admin pages | 18 |
| Public forms | 8 |
| Shared components | 3 files (Sidebar, ThemeToggle, ui) |
| Library modules | 3 files (supabase, queries, utils) |
| Supabase tables | 44 (25 main + 19 junction) |
| Migrated records | 1,453 |
| Junction links | 368 |

## Known Issues

- **Payments table empty** — May need re-import or manual entry
- **Maintenance/Vendors/Handovers empty** — New tables awaiting data
- **No authentication** — All pages currently use anon key
- **No file uploads** — Airtable had attachment fields (photos, licenses, contracts) not yet migrated to Supabase Storage
- **TMMT Rentals (Copy) base** — Deferred; needs manager clarification
