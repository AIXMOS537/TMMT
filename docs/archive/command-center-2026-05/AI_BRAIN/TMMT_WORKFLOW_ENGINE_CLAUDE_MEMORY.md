# TMMT Workflow Engine Claude Memory

Use this as persistent context for Claude, Cursor, or any AI assistant working on the TMMT business operating system.

## Business Context

TMMT Auto Services LLC, dba TMMT Rentals, is owned by Muhammad Taha.

The business includes:

- Vehicle rentals through Turo and a personal/direct booking site.
- TMMT Ecosystem memberships and coaching, with an offer ladder from $97 to $50K.
- Business automation consulting and operator licensing under Project AIXMOS.

The goal is to move Muhammad from operator mode into orchestrator mode. The business should run through structured workflows, dashboards, assigned tasks, vendor queues, alerts, and owner approval checkpoints.

## Current Stack

- Vercel: frontend/app deployment.
- Supabase: app backend and database layer.
- Airtable: current main operations database.
- Airtable to Supabase sync: Airtable data is being forwarded/synced into Supabase.
- ClickUp: task assignment, team execution, SOPs, job tracking, and accountability.
- GoHighLevel: CRM, customer communication, follow-ups, SMS/email, and sales workflows.
- Turo: primary vehicle rental platform.
- Gusto: payroll and team administration.
- AI tools: document generation, SOPs, VA briefings, rental agreements, summaries, and automation support.

## Product Vision

The app should operate like a business command center:

Customers submit requests, the system turns them into cases, cases trigger tasks, tasks route to internal team members or outside vendors, and each dashboard only shows the right person what they need to act on next.

The workflow should feel like a Rubik's Cube mechanism. Each intake submission creates a structured case. The case moves through modular steps. Tasks, statuses, approvals, vendor jobs, notifications, and dashboards keep updating until all required pieces click into place and the case can close.

## Core Workflow

1. Customer fills out an intake form.
2. Form submission creates a new record/case in Supabase.
3. The record may also sync with Airtable or originate from Airtable depending on the current setup.
4. The system categorizes the request type.
5. Based on the request type, it creates or assigns ClickUp tasks.
6. Internal team members see what needs to be reviewed, approved, assigned, or completed.
7. If an outside vendor is needed, the job appears in the Vendor Portal.
8. Vendor can accept or decline the job.
9. Vendor can update job status, upload files/photos/invoices, and mark work complete.
10. Internal team reviews vendor completion.
11. Customer, investor, internal, and vendor dashboards update based on status.
12. The case closes only when all required workflow pieces are complete.

## Existing Portals

### Internal Team Portal

For TMMT team members to view customer submissions, assigned tasks, vehicles/jobs, approvals, operations status, internal notes, SOPs, and workflow progress.

### External Investor Portal

For investors to view relevant investment/dashboard data, performance, status updates, reports, documents, announcements, and investor-safe metrics.

## Needed Third Portal

### Outside Vendor Portal

For approved vendors who complete jobs for TMMT, such as:

- Mechanics
- Detailers
- Tow companies
- Inspectors
- Drivers
- Repair shops
- Media/content vendors
- Other service providers

The Vendor Portal should feel like a simple job board/work queue. Vendors should log in and see only their assigned jobs, due dates, instructions, location/details, required uploads, status controls, invoice/payment status, and messages or notes from the internal team.

## Dashboard Experiences

The app needs three separate dashboard experiences:

1. Internal Team Dashboard
2. External Investor Dashboard
3. Outside Vendor Dashboard

Future customer-facing dashboard support is also expected.

## Suggested Roles

- admin
- internal_team
- investor
- vendor
- customer

## Suggested Supabase Tables

- profiles
- organizations
- customer_intake_forms
- cases
- case_status_history
- tasks
- clickup_tasks
- vendors
- vendor_jobs
- vendor_job_updates
- vendor_files
- investor_accounts
- investor_updates
- approvals
- notifications
- activity_logs
- documents

## Case Statuses

- intake_submitted
- initial_contact_needed
- initial_contact_complete
- internal_review
- task_assignment
- vendor_needed
- vendor_assigned
- vendor_in_progress
- vendor_completed
- internal_quality_check
- customer_follow_up
- awaiting_approval
- completed
- closed
- blocked

## Vendor Job Statuses

- offered
- accepted
- declined
- scheduled
- in_progress
- pending_review
- completed
- rejected
- paid
- cancelled

## Build Requirements

- Customer intake form should be the starting point.
- Every intake submission should create a trackable case.
- Cases should show progress through a clear status pipeline.
- Internal users should be able to assign tasks to team members or outside vendors.
- Vendor Portal should only show jobs assigned to that vendor.
- Investor Portal should only show investor-safe data, not internal operations unless explicitly allowed.
- Internal Team Portal should show full operational context.
- Use Supabase auth and role-based access control.
- Add row-level security policies if the project is already using Supabase RLS.
- Keep Airtable compatibility in mind because Airtable is still the operations source and syncs data into Supabase.
- ClickUp should remain the execution/task layer, so the app should store ClickUp task IDs and URLs where relevant.
- Design this so future automations can trigger from status changes.

## Workflow Engine Concept

Do not build this as only static dashboards. Build it as a workflow engine where each customer submission becomes a case, and each case moves through modular steps:

- intake
- contact
- review
- assignment
- vendor work if needed
- approval
- completion
- reporting

## First Implementation Priorities

Prioritize:

1. Customer intake form.
2. Supabase case creation.
3. Internal case dashboard.
4. Vendor dashboard.
5. Vendor job assignment.
6. Vendor job status updates.
7. File/photo upload if storage already exists.
8. Basic role-based access.
9. Clean UI consistent with the existing app.

## Prompt For Cursor Or Claude Code

Use this prompt when asking an AI coding assistant to work on the current project:

```text
I am building the TMMT business operating system inside this current project.

The goal is to create a workflow automation app where customers fill out an intake form first, then the system routes the request through the correct workflow until every required step is complete. Think of it like a Rubik's Cube mechanism: each form submission creates a structured case, then the system assigns tasks, updates statuses, routes approvals, notifies the right people, and keeps moving the case forward until all pieces click into place.

Current stack and tools:
- Frontend/app is deployed on Vercel.
- Supabase is the app backend and database layer.
- Airtable is currently the main operations database.
- Airtable data is being forwarded/synced into Supabase.
- ClickUp is used for task assignment, team execution, SOPs, and job tracking.
- GoHighLevel may be used for customer communication, follow-ups, SMS/email, and CRM workflows.

Current portals:
1. Internal Team Portal
   For TMMT team members to view customer submissions, assigned tasks, vehicles/jobs, approvals, operations status, and internal notes.

2. External Investor Portal
   For investors to view relevant investment/dashboard data, performance, status updates, reports, documents, and announcements.

I need to add a third portal:

3. Outside Vendor Portal
   For approved vendors who complete jobs for us, such as mechanics, detailers, tow companies, inspectors, drivers, repair shops, media/content vendors, or other service providers.

The workflow should work like this:

1. Customer fills out an intake form.
2. Form submission creates a new record/case in Supabase.
3. The record may also sync with Airtable or originate from Airtable depending on the current setup.
4. The system categorizes the request type.
5. Based on the request type, it creates or assigns ClickUp tasks.
6. Internal team members see what needs to be reviewed, approved, or assigned.
7. If an outside vendor is needed, the job appears in the Vendor Portal.
8. Vendor can accept/decline the job, update job status, upload files/photos/invoices, and mark work complete.
9. Internal team reviews vendor completion.
10. Customer/investor/internal dashboard updates based on the case status.
11. The case closes only when all required workflow pieces are complete.

Please inspect the existing project structure first and then help me implement this in the current codebase using the existing patterns.

I need the app to support three separate dashboard experiences:
- Internal Team Dashboard
- External Investor Dashboard
- Outside Vendor Dashboard

Please design the data model, routes, components, and role-based access structure for these portals.

Suggested roles:
- admin
- internal_team
- investor
- vendor
- customer

Suggested Supabase tables:
- profiles
- organizations
- customer_intake_forms
- cases
- case_status_history
- tasks
- clickup_tasks
- vendors
- vendor_jobs
- vendor_job_updates
- vendor_files
- investor_accounts
- investor_updates
- approvals
- notifications
- activity_logs
- documents

Core statuses for a case:
- intake_submitted
- initial_contact_needed
- initial_contact_complete
- internal_review
- task_assignment
- vendor_needed
- vendor_assigned
- vendor_in_progress
- vendor_completed
- internal_quality_check
- customer_follow_up
- awaiting_approval
- completed
- closed
- blocked

Vendor job statuses:
- offered
- accepted
- declined
- scheduled
- in_progress
- pending_review
- completed
- rejected
- paid
- cancelled

Build requirements:
- Customer intake form should be the starting point.
- Every intake submission should create a trackable case.
- Cases should show progress through a clear status pipeline.
- Internal users should be able to assign tasks to team members or outside vendors.
- Vendor Portal should only show jobs assigned to that vendor.
- Investor Portal should only show investor-safe data, not internal operations unless explicitly allowed.
- Internal Team Portal should show full operational context.
- Use Supabase auth and role-based access control.
- Add row-level security policies if this project is already using Supabase RLS.
- Keep Airtable compatibility in mind because Airtable is still the operations source and syncs data into Supabase.
- ClickUp should remain the execution/task layer, so the app should store ClickUp task IDs/URLs where relevant.
- Design this so future automations can trigger from status changes.

Important concept:
Do not build this as just static dashboards. Build it as a workflow engine where each customer submission becomes a case, and each case moves through modular steps:
- intake
- contact
- review
- assignment
- vendor work if needed
- approval
- completion
- reporting

Please start by:
1. Inspecting the repo structure.
2. Identifying the framework, routes, auth setup, Supabase client setup, and existing dashboard patterns.
3. Proposing the best implementation plan.
4. Then implementing the first working version of the third Vendor Portal and customer intake-to-case workflow.

For the first version, prioritize:
- Customer intake form
- Supabase case creation
- Internal case dashboard
- Vendor dashboard
- Vendor job assignment
- Vendor job status updates
- File/photo upload if storage already exists
- Basic role-based access
- Clean UI consistent with the existing app
```
