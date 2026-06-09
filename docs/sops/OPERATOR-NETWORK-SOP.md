# TMMT Operators Network — recruitment & assignment

## Purpose

Operators deliver AIXMOS services (credit guidance support, intake, GHL logging) and may support TMMT rental vertical tasks.

## Recruitment

1. Public apply: [`/operator-apply`](/operator-apply) → GHL `operatorApply` link  
2. Review application in GHL pipeline **Operators**  
3. On approve: create Airtable **People** row  

## Airtable People — `System` field

| Value | Access |
|-------|--------|
| `AIXMOS Portal` | AIXMOS portal + credit/funding SOPs |
| `TMMT Rentals` | TMMT `/operator` feed + rental SOPs |
| `Both` | Full network operator |

Sync to portal users:

```bash
export $(grep -v '^#' .env | xargs)
npm run sync:aixmos-people
```

## Assignment rules

- **Rental field work** → operator with `TMMT Rentals` or `Both`  
- **Credit guidance clients** → operator with `AIXMOS Portal` or `Both`  
- Max active clients per operator: set in GHL custom field (owner defines)  

## Onboarding checklist (first 30 days)

1. Read Operator Training Manual (`AIXMOS/files/operator-training.html`)  
2. GHL login + pipeline walkthrough  
3. Shadow one intake call  
4. First solo call with executive VA on copy  
5. Log every call in GHL within 30 minutes  

## TMMT operator feed

Published owner commands appear at `/operator` in TMMT OS (Supabase-backed).
