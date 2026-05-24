# TMMT Rentals — Business Pipeline Flow

## Customer Lifecycle

The full journey from initial lead to active customer (or exit):

```mermaid
flowchart TD
    A["🌐 Lead Intake Form<br/>/forms/lead-intake"] -->|"New Lead"| B["📋 Incoming Leads<br/>/leads"]
    B -->|"Qualified"| C["🔍 Background Check<br/>/background-checks"]
    B -->|"Not Qualified"| X1["❌ Closed"]
    
    C -->|"Passed"| D{"Vehicle Available?"}
    C -->|"Failed"| X2["🚫 Do Not Rent<br/>/do-not-rent"]
    
    D -->|"Yes"| E["📅 Appointment<br/>/appointments"]
    D -->|"No"| F["⏳ Waitlist<br/>/waitlist"]
    
    F -->|"Vehicle Available"| E
    
    E -->|"Appointment Complete"| G["🔑 Vehicle Handover<br/>/forms/handover"]
    G -->|"Keys Handed Over"| H["✅ Active Customer<br/>/customers"]
    
    H -->|"Contract Ends"| I["📦 Former Customer<br/>/former-customers"]
    H -->|"Violation"| X2
    H -->|"Ongoing"| H

    style A fill:#3b82f6,color:#fff
    style B fill:#f59e0b,color:#fff
    style C fill:#8b5cf6,color:#fff
    style E fill:#06b6d4,color:#fff
    style F fill:#f97316,color:#fff
    style G fill:#10b981,color:#fff
    style H fill:#22c55e,color:#fff
    style I fill:#6b7280,color:#fff
    style X1 fill:#ef4444,color:#fff
    style X2 fill:#dc2626,color:#fff
```

## Lead Status Flow

```mermaid
stateDiagram-v2
    [*] --> New_Lead: Form submitted
    New_Lead --> Contacted: Staff reaches out
    Contacted --> Qualified: Meets criteria
    Contacted --> Not_Qualified: Doesn't meet criteria
    Qualified --> Background_Check: Moves to verification
    Not_Qualified --> [*]
    
    state "New Lead" as New_Lead
    state "Contacted" as Contacted
    state "Qualified" as Qualified
    state "Not Qualified" as Not_Qualified
    state "Background Check" as Background_Check
```

## Background Check Flow

```mermaid
stateDiagram-v2
    [*] --> Pending: Submitted
    Pending --> Under_Review: Staff begins review
    Under_Review --> Passed: All checks clear
    Under_Review --> Failed: Issues found
    Passed --> Eligible: Approved for rental
    Failed --> Not_Eligible: Denied
    
    state "Pending" as Pending
    state "Under Review" as Under_Review
    state "Passed" as Passed
    state "Failed" as Failed
    state "Eligible" as Eligible
    state "Not Eligible" as Not_Eligible
```

## Vehicle Lifecycle

```mermaid
flowchart LR
    A["🚗 Vehicle Acquired"] --> B["🔧 Onboarding Inspection<br/>/forms/onboarding-inspection"]
    B --> C["✅ Available<br/>/fleet"]
    C --> D["🔑 Rented Out"]
    D --> E["📋 Customer Inspection<br/>/forms/inspection"]
    E --> F{"Condition OK?"}
    F -->|"Yes"| C
    F -->|"No"| G["🔧 Maintenance<br/>/maintenance"]
    G --> C
    D --> H["🛡️ Insurance Claim<br/>/insurance"]
    C --> I["🏚️ Retired"]

    style A fill:#3b82f6,color:#fff
    style C fill:#22c55e,color:#fff
    style D fill:#f59e0b,color:#fff
    style G fill:#f97316,color:#fff
    style I fill:#6b7280,color:#fff
```

## Vehicle Status States

```mermaid
stateDiagram-v2
    [*] --> Available: Onboarding complete
    Available --> Rented: Assigned to customer
    Rented --> Available: Returned + inspected
    Available --> Under_Maintenance: Needs repair
    Under_Maintenance --> Available: Repair complete
    Rented --> Under_Maintenance: Issue during rental
    Available --> Retired: End of life
    Rented --> Retired: Totaled / beyond repair
    
    state "Available" as Available
    state "Rented" as Rented
    state "Under Maintenance" as Under_Maintenance
    state "Retired" as Retired
```

## Ticket Flow

```mermaid
stateDiagram-v2
    [*] --> Open: Submitted via form or admin
    Open --> In_Progress: Staff assigned
    In_Progress --> Resolved: Issue fixed
    In_Progress --> Escalated: Needs attention
    Escalated --> Resolved: Fixed
    Resolved --> [*]
    
    state "Open" as Open
    state "In Progress" as In_Progress
    state "Resolved" as Resolved
    state "Escalated" as Escalated
```

## Payment Flow

```mermaid
flowchart TD
    A["Active Customer"] --> B["Weekly Payment Due"]
    B --> C{"Payment Made?"}
    C -->|"Yes"| D["✅ Paid<br/>Record in /payments"]
    C -->|"No"| E["⚠️ Overdue"]
    E --> F{"Follow-up"}
    F -->|"Pays"| D
    F -->|"No Response"| G["🎫 Ticket Created<br/>/tickets"]
    G --> H{"Resolution"}
    H -->|"Pays"| D
    H -->|"Default"| I["🚫 Repossession"]

    style D fill:#22c55e,color:#fff
    style E fill:#f59e0b,color:#fff
    style G fill:#ef4444,color:#fff
    style I fill:#dc2626,color:#fff
```

## Form → Table Mapping

```mermaid
flowchart LR
    subgraph PublicForms["Public Forms"]
        F1["Lead Intake"]
        F2["Background Check"]
        F3["Waitlist"]
        F4["Appointment"]
        F5["Inspection"]
        F6["Onboarding Inspection"]
        F7["Handover"]
        F8["Ticket"]
    end

    subgraph SupabaseTables["Supabase Tables"]
        T1["incoming_leads"]
        T2["background_checks"]
        T3["waitlist"]
        T4["appointments"]
        T5["customer_inspection_photos"]
        T6["vehicle_handovers"]
        T7["tickets"]
    end

    F1 --> T1
    F2 --> T2
    F3 --> T3
    F4 --> T4
    F5 --> T5
    F6 --> T5
    F7 --> T6
    F8 --> T7
```
