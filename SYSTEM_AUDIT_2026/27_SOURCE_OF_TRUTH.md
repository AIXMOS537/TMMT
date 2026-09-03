# 27 · SOURCE OF TRUTH AUDIT

**The single most valuable table in this audit.** Where two systems claim the same fact, the conflict is named and one canonical owner is recommended.

| Entity | Claimants | Recommended canonical | Conflict |
|---|---|---|---|
| **Contact** | GoHighLevel (1,642) · `ghl_contacts` · `people` (1,209) | **GoHighLevel** | 🟡 mirror is fine; do not let the app become a second CRM |
| **Lead** | `incoming_leads` (876) · GHL · **Airtable** (verification) | **`incoming_leads`** | 🔴 **three writers.** Airtable's "Verified" checkbox still promotes records |
| **Person** | `people` · `ghl_contacts` · `incoming_leads` · `active_customers` · `parties` (0) · `portal_clients` (0) | **`people`** | 🔴 six models; two empty and removable |
| **Vehicle** | `fleet` (43) · `vehicles` (2) | **`fleet`** | 🔴 dead twin still in schema |
| **Rental** | `active_customers` (35) · `bookings` (0) | **`active_customers`** *(today)* | 🔴 `bookings` is the better design, unused |
| **Payment** | `customer_payments` (31) · `payments` (0) · `rental_ledger` (3) · `deal_payments` (0) · GHL/Stripe | **`customer_payments`** | 🔴 **free text — unqueryable**; 4 competing tables |
| **Organization** | `organizations` (9) · `tenant-map.generated.ts` | **`organizations`** | 🔴 **id types disagree — this is P0-1** |
| **Owner/Partner** | `partner_fleet_access` (0) · `partners` (1) · `portal_clients` (0) | **`partner_fleet_access`** | 🟡 all near-empty |
| **Operator** | `operator_profiles` (19) | `operator_profiles` | 🟢 clean |
| **Task** | `exec_va_tasks` (17,806) · `tasks` (0) · `clickup_tasks` (0) · ClickUp | **`exec_va_tasks`** | 🟠 two dead twins |
| **Communication** | GHL · `comm_channels` (4) · `agent_conversations` (0) · `outreach_touches` (0) | **GoHighLevel** | 🟠 app is rebuilding what GHL does |
| **Document** | `document_uploads` · `documents` (0) · `program_documents` (0) · Storage | **`document_uploads`** | 🟠 |
| **Audit** | `audit_events` (124) · `program_audit_log` (0) · `memory_events` (11) · `sync_events` (33) | **`audit_events`** | 🟡 documented as intentionally distinct |
| **Pricing** | `rental_pricing_rules` (10) · GHL checkout links · owner's real rates | 🔴 **none is correct** | Seed data ≠ rate card ($300–$500 real) |
| **Vehicle status** | `fleet.vehicle_status` free text | `fleet.vehicle_status` | 🟠 no transition rules or history |

## 🔴 The org-identity conflict — the one that is costing money now
```
organizations.id            →  uuid  (database)
tenant-map.generated.ts     →  "aixmos" / "tmmt" / "moe-legacy"  (slugs)
OrgIdSchema (tenant.ts:60)  →  requires uuid
                            ↓
            OrgRowShapeError  →  184 lost leads
```
**Two systems disagree about what an organization's identity *is*, and the disagreement throws on the revenue path.** Fixing the source-of-truth conflict *is* fixing the outage.

## Rules to adopt
1. **GHL owns contacts and conversations.** The app mirrors, never authors.
2. **The app owns rental operations, fleet, money and compliance.** GHL never authors these.
3. **Supabase owns identity and authorization.** One org id type: UUID. Everywhere.
4. **Airtable owns nothing** — or is formally declared the owner of Leads verification. Not both.
5. **Never duplicate:** contact records, campaign/nurture sequences, appointment reminders, task queues. GHL does these and is working.
