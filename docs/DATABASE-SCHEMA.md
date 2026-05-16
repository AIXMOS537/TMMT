# TMMT Rentals — Database Schema

## Overview

- **Provider**: Supabase (PostgreSQL)
- **Total Tables**: 44 (25 main + 19 junction)
- **Migrated From**: Airtable (3 bases: TMMT Rentals, TMMT OS, TMMT Rentals Copy)

## Entity Relationship Diagram

```mermaid
erDiagram
    INCOMING_LEADS {
        uuid id PK
        text contact_name
        text phone
        text email
        text status
        text opportunity
        text priority
        timestamp created_on
    }

    BACKGROUND_CHECKS {
        uuid id PK
        text customer_name
        text phone
        text email
        text status
        text review_status
        boolean own_insurance
        text review_notes
    }

    WAITLIST {
        uuid id PK
        text customer_name
        text customer_phone
        text customer_email
        text status
        text vehicle_type
        text make
        text model
        integer year
        numeric desired_weekly_payment
        date date_added
    }

    APPOINTMENTS {
        uuid id PK
        text customer_name
        text phone
        text email
        text appointment_type
        text status
        timestamp appointment_date
    }

    ACTIVE_CUSTOMERS {
        uuid id PK
        text customer_name
        text phone
        text email
        text status
        text assigned_vehicle
        numeric weekly_payment
        date start_date
    }

    FLEET {
        uuid id PK
        text vehicle_name
        text vehicle_make
        text vehicle_model
        integer year
        text vin
        text license_plate
        text status
        text color
        numeric weekly_rate
        numeric odometer
    }

    PAYMENTS {
        uuid id PK
        text customer_name
        numeric amount
        text status
        text payment_method
        date payment_date
    }

    TICKETS {
        uuid id PK
        text ticket_title
        text description
        text status
        text priority
        text category
        text assigned_to
        timestamp created_at
    }

    EXPENSES {
        uuid id PK
        text expense_name
        text category
        numeric amount
        text status
        date expense_date
    }

    INSURANCE {
        uuid id PK
        text policy_name
        text provider
        text policy_number
        text status
        text coverage_type
        date start_date
        date end_date
    }

    CUSTOMER_INSPECTION_PHOTOS {
        uuid id PK
        text full_name
        numeric odometer
        boolean interior_clean
        boolean exterior_clean
        boolean confirmed
    }

    MAINTENANCE {
        uuid id PK
        text vehicle_name
        text service_type
        text status
        numeric cost
        date service_date
    }

    CONTRACTS {
        uuid id PK
        text customer_name
        text contract_type
        text status
        date start_date
        date end_date
    }

    VENDORS {
        uuid id PK
        text vendor_name
        text contact_name
        text phone
        text service_type
        text status
    }

    OPERATION_COSTS {
        uuid id PK
        text name
        text category
        numeric monthly_cost
        text status
    }

    DO_NOT_RENT {
        uuid id PK
        text customer_name
        text reason
        date date_added
    }

    FORMER_CUSTOMERS {
        uuid id PK
        text customer_name
        text phone
        text reason_for_leaving
        date end_date
    }

    VEHICLE_HANDOVERS {
        uuid id PK
        text customer_name
        text vehicle_name
        numeric odometer
        boolean keys_handed
        boolean documents_provided
        boolean walkthrough_complete
        date handover_date
    }

    INCOMING_LEADS ||--o{ BACKGROUND_CHECKS : "qualifies for"
    BACKGROUND_CHECKS ||--o{ WAITLIST : "added to"
    BACKGROUND_CHECKS ||--o{ APPOINTMENTS : "schedules"
    WAITLIST ||--o{ APPOINTMENTS : "available → "
    APPOINTMENTS ||--o{ ACTIVE_CUSTOMERS : "becomes"
    ACTIVE_CUSTOMERS ||--o{ PAYMENTS : "makes"
    ACTIVE_CUSTOMERS ||--o{ TICKETS : "opens"
    ACTIVE_CUSTOMERS ||--o{ FORMER_CUSTOMERS : "becomes"
    ACTIVE_CUSTOMERS ||--o{ DO_NOT_RENT : "flagged as"
    FLEET ||--o{ ACTIVE_CUSTOMERS : "assigned to"
    FLEET ||--o{ MAINTENANCE : "serviced by"
    FLEET ||--o{ INSURANCE : "covered by"
    FLEET ||--o{ CUSTOMER_INSPECTION_PHOTOS : "inspected as"
    FLEET ||--o{ VEHICLE_HANDOVERS : "handed over in"
    VENDORS ||--o{ MAINTENANCE : "performs"
    ACTIVE_CUSTOMERS ||--o{ CONTRACTS : "signs"
```

## Junction / Link Tables (19)

These tables handle many-to-many relationships migrated from Airtable's linked record fields:

| Junction Table | Links |
|---------------|-------|
| `fleet_active_customers` | fleet ↔ active_customers |
| `fleet_background_checks` | fleet ↔ background_checks |
| `fleet_contracts` | fleet ↔ contracts |
| `fleet_customer_inspection_photos` | fleet ↔ inspection photos |
| `fleet_insurance` | fleet ↔ insurance |
| `fleet_maintenance` | fleet ↔ maintenance |
| `fleet_payments` | fleet ↔ payments |
| `fleet_tickets` | fleet ↔ tickets |
| `fleet_vehicle_handovers` | fleet ↔ vehicle_handovers |
| `active_customers_payments` | active_customers ↔ payments |
| `active_customers_tickets` | active_customers ↔ tickets |
| `active_customers_contracts` | active_customers ↔ contracts |
| `active_customers_inspection` | active_customers ↔ inspections |
| `background_checks_fleet` | background_checks ↔ fleet |
| `incoming_leads_appointments` | incoming_leads ↔ appointments |
| `waitlist_appointments` | waitlist ↔ appointments |
| `insurance_fleet` | insurance ↔ fleet |
| `maintenance_vendors` | maintenance ↔ vendors |
| `expenses_vendors` | expenses ↔ vendors |

## Common Columns

All main tables include:

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `airtable_id` | `text` | Original Airtable record ID (for migration reference) |
| `created_at` | `timestamptz` | Auto-set on insert |
| `updated_at` | `timestamptz` | Auto-set on update |

## Status Field Values

### Fleet Status
`Available` · `Rented` · `Under Maintenance` · `Needs Repair` · `Retired`

### Lead Status
`New Lead` · `Contacted` · `Qualified` · `Not Qualified` · `Closed`

### Background Check Status
`Pending` · `Under Review` · `Passed` · `Failed` · `Eligible` · `Not Eligible`

### Waitlist Status
`Waiting` · `Contacted` · `Scheduled` · `Completed`

### Ticket Priority
`Low` · `Moderate` · `High` · `Urgent` · `Critical`

### Ticket Status
`Open` · `In Progress` · `Resolved` · `Closed` · `Escalated`

### Payment Status
`Paid` · `Pending` · `Overdue` · `Failed`

### Insurance Status
`Active` · `Expired` · `Pending` · `Cancelled`

### Contract Status
`Draft` · `Active` · `Signed` · `Expired` · `Terminated`
