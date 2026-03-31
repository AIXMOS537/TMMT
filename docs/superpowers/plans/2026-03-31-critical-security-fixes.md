# Critical Security & Error Handling Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical audit findings — enable RLS, move public forms to validated server actions, add rate limiting, replace alert() with inline errors, add .catch() to fetches.

**Architecture:** Server actions with zod validation replace client-side Supabase inserts on public forms. In-memory rate limiter in middleware gates `/forms` POST submissions. Admin pages get inline error state instead of alert(). RLS SQL migration locks down all tables with anon INSERT policies for public form tables.

**Tech Stack:** zod (new dep), Next.js server actions, Supabase RLS policies

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/app/forms/actions.ts` | All 8 form server actions with zod validation |
| Create | `src/lib/rate-limit.ts` | In-memory rate limiter (Map-based) |
| Create | `src/app/error.tsx` | Root error boundary |
| Create | `src/app/(admin)/error.tsx` | Admin error boundary |
| Create | `supabase/migrations/20260331_enable_rls.sql` | RLS migration SQL |
| Modify | `middleware.ts` | Add rate limit check for `/forms` |
| Modify | `src/app/forms/lead-intake/page.tsx` | Use server action, inline error |
| Modify | `src/app/forms/appointment/page.tsx` | Use server action, inline error |
| Modify | `src/app/forms/background-check/page.tsx` | Use server action, inline error |
| Modify | `src/app/forms/waitlist/page.tsx` | Use server action, inline error |
| Modify | `src/app/forms/ticket/page.tsx` | Use server action, inline error |
| Modify | `src/app/forms/inspection/page.tsx` | Use server action, inline error |
| Modify | `src/app/forms/handover/page.tsx` | Use server action, inline error |
| Modify | `src/app/forms/onboarding-inspection/page.tsx` | Use server action, inline error |
| Modify | `src/app/(admin)/leads/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/fleet/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/customers/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/payments/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/maintenance/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/appointments/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/background-checks/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/contracts/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/do-not-rent/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/expenses/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/former-customers/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/inspections/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/insurance/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/operation-costs/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/tickets/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/vendors/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/waitlist/page.tsx` | Inline error, .catch() on fetch |
| Modify | `src/app/(admin)/page.tsx` | .catch() on dashboard fetch |
| Modify | `src/components/ui.tsx` | Add ErrorBanner component |

---

### Task 1: Install zod and add ErrorBanner component

**Files:**
- Modify: `package.json`
- Modify: `src/components/ui.tsx`

- [ ] **Step 1: Install zod**

```bash
npm install zod
```

- [ ] **Step 2: Add ErrorBanner component to ui.tsx**

Add at the end of `src/components/ui.tsx`:

```tsx
// --- Error Banner ---
export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start justify-between gap-3">
      <p>{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 dark:hover:text-red-200 shrink-0"
        >
          ×
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/ui.tsx
git commit -m "feat: install zod and add ErrorBanner component"
```

---

### Task 2: Create rate limiter utility

**Files:**
- Create: `src/lib/rate-limit.ts`

- [ ] **Step 1: Create rate-limit.ts**

```typescript
// In-memory rate limiter — resets on deploy, sufficient for low-traffic admin tool
const hits = new Map<string, number[]>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_HITS = 5;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = hits.get(key) ?? [];

  // Prune entries outside the window
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_HITS) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);
  return false;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rate-limit.ts
git commit -m "feat: add in-memory rate limiter for public forms"
```

---

### Task 3: Add rate limiting to middleware

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Update middleware.ts**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase-server";
import { isRateLimited } from "@/lib/rate-limit";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // Rate limit form submissions (POST only)
  if (pathname.startsWith("/forms") && request.method === "POST") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }
  }

  const supabase = createMiddlewareClient(request, response);

  // getUser() contacts Supabase Auth server — do NOT use getSession() here
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic =
    pathname.startsWith("/login") || pathname.startsWith("/forms");

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Return response so refreshed session cookies are sent back to the browser
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add rate limiting for public form submissions"
```

---

### Task 4: Create server actions for all 8 public forms

**Files:**
- Create: `src/app/forms/actions.ts`

- [ ] **Step 1: Create forms/actions.ts with all 8 server actions**

```typescript
"use server";

import { z } from "zod";
import { createSSRClient } from "@/lib/supabase-server";

// ─── Shared helpers ──────────────────────────────

type FormResult = { success: true } | { success: false; error: string };

async function insertRow(table: string, record: Record<string, unknown>): Promise<FormResult> {
  const supabase = await createSSRClient();
  const { error } = await supabase.from(table).insert(record);
  if (error) {
    console.error(`[${table}] insert failed:`, error.message);
    return { success: false, error: "Submission failed. Please try again." };
  }
  return { success: true };
}

// ─── 1. Lead Intake ──────────────────────────────

const leadSchema = z.object({
  contact_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20),
  email: z.string().email().max(254).or(z.literal("")),
  opportunity_name: z.string().max(500).optional(),
  priority_level: z.enum(["Urgent", "Moderate", "Requires Follow Up", ""]).optional(),
  notes: z.string().max(2000).optional(),
});

export async function submitLeadIntake(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;
  return insertRow("incoming_leads", {
    contact_name: d.contact_name.trim(),
    phone: Number(d.phone.replace(/\D/g, "")) || null,
    email: d.email || null,
    opportunity_name: d.opportunity_name || null,
    priority_level: d.priority_level || null,
    notes: d.notes || null,
    status: "New Lead",
  });
}

// ─── 2. Appointment ──────────────────────────────

const appointmentSchema = z.object({
  customer_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20),
  email: z.string().email().max(254).or(z.literal("")),
  appointment_type: z.enum(["Vehicle Pickup", "Vehicle Return", "Inspection", "Insurance Review", "Payment Discussion", "General Inquiry"]),
  appointment_date: z.string().min(1),
  appointment_time: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export async function submitAppointment(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = appointmentSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;
  return insertRow("appointments", {
    customer_name: d.customer_name.trim(),
    phone: d.phone,
    email: d.email || null,
    appointment_type: d.appointment_type,
    appointment_date: d.appointment_date,
    appointment_time: d.appointment_time,
    notes: d.notes || null,
    status: "Scheduled",
    created_at: new Date().toISOString(),
  });
}

// ─── 3. Background Check ─────────────────────────

const bgCheckSchema = z.object({
  customer_name: z.string().min(1).max(200),
  phone_number: z.string().min(7).max(20),
  email: z.string().email().max(254),
  own_insurance: z.enum(["Yes", "No"]),
  review_notes: z.string().max(2000).optional(),
});

export async function submitBackgroundCheck(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = bgCheckSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;
  return insertRow("background_checks", {
    customer_name: d.customer_name.trim(),
    phone_number: d.phone_number,
    email: d.email,
    own_insurance: d.own_insurance,
    review_notes: d.review_notes || null,
    background_check_status: "Pending",
    insurance_check_status: "Pending",
    earnings_verification_status: "Pending",
    verification_form_submitted: true,
  });
}

// ─── 4. Waitlist ─────────────────────────────────

const waitlistSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().min(7).max(20),
  customer_email: z.string().email().max(254).or(z.literal("")),
  vehicle_type: z.string().max(100).optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.string().max(4).optional(),
  desired_weekly_payment: z.string().max(10).optional(),
  desired_specs_notes: z.string().max(2000).optional(),
});

export async function submitWaitlist(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = waitlistSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;
  return insertRow("waitlist", {
    customer_name: d.customer_name.trim(),
    customer_phone: d.customer_phone,
    customer_email: d.customer_email || null,
    vehicle_type: d.vehicle_type || null,
    make: d.make || null,
    model: d.model || null,
    year: d.year ? Number(d.year) : null,
    desired_weekly_payment: d.desired_weekly_payment ? Number(d.desired_weekly_payment) : null,
    desired_specs_notes: d.desired_specs_notes || null,
    status: "Waiting",
    date_added: new Date().toISOString().split("T")[0],
  });
}

// ─── 5. Ticket ───────────────────────────────────

const ticketSchema = z.object({
  customer_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20),
  vehicle_description: z.string().max(200).optional(),
  issue_type: z.enum(["Mechanical Issue", "Electrical Issue", "Body Damage", "Flat Tire", "Accident", "Locked Out", "Battery Dead", "Check Engine Light", "A/C or Heating", "Windshield/Glass", "Other"]),
  urgency: z.enum(["Low", "Medium", "High", "Emergency"]),
  description: z.string().min(1).max(5000),
  location: z.string().max(500).optional(),
});

export async function submitTicket(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = ticketSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;
  return insertRow("tickets", {
    customer_name: d.customer_name.trim(),
    phone: d.phone,
    vehicle_description: d.vehicle_description || null,
    issue_type: d.issue_type,
    urgency: d.urgency,
    description: d.description,
    location: d.location || null,
    status: "Open",
    created_at: new Date().toISOString(),
  });
}

// ─── 6. Inspection (Customer) ────────────────────

const inspectionSchema = z.object({
  full_name: z.string().min(1).max(200),
  odometer_reading: z.string().min(1),
  confirmation: z.literal("on"),
});

export async function submitInspection(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = inspectionSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and confirm the inspection." };

  const d = parsed.data;
  return insertRow("customer_inspection_photos", {
    full_name: d.full_name.trim(),
    odometer_reading: Number(d.odometer_reading),
    interior_clean: raw.interior_clean === "on",
    exterior_clean: raw.exterior_clean === "on",
    confirmation: true,
    date_time: new Date().toISOString(),
  });
}

// ─── 7. Handover ─────────────────────────────────

const handoverSchema = z.object({
  customer_name: z.string().min(1).max(200),
  staff_name: z.string().min(1).max(200),
  vehicle_make: z.string().max(100).optional(),
  vehicle_model: z.string().max(100).optional(),
  license_plate: z.string().max(20).optional(),
  odometer_reading: z.string().min(1),
  fuel_level: z.enum(["Empty", "1/4", "1/2", "3/4", "Full"]),
  condition_notes: z.string().max(2000).optional(),
  customer_signature: z.string().min(1).max(200),
  handover_type: z.enum(["Pickup", "Return"]),
});

export async function submitHandover(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = handoverSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;
  return insertRow("vehicle_handovers", {
    customer_name: d.customer_name.trim(),
    staff_name: d.staff_name.trim(),
    vehicle_make: d.vehicle_make || null,
    vehicle_model: d.vehicle_model || null,
    license_plate: d.license_plate || null,
    odometer_reading: Number(d.odometer_reading),
    fuel_level: d.fuel_level,
    check_exterior: raw.check_exterior === "on",
    check_interior: raw.check_interior === "on",
    check_tires: raw.check_tires === "on",
    check_lights: raw.check_lights === "on",
    check_documents: raw.check_documents === "on",
    condition_notes: d.condition_notes || null,
    customer_signature: d.customer_signature.trim(),
    handover_type: d.handover_type,
    status: "Completed",
    handover_date: new Date().toISOString().split("T")[0],
  });
}

// ─── 8. Onboarding Inspection ────────────────────

const onboardingSchema = z.object({
  inspector_name: z.string().min(1).max(200),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.string().min(1).max(4),
  vin: z.string().min(1).max(50),
  license_plate: z.string().max(20).optional(),
  color: z.string().max(50).optional(),
  odometer: z.string().min(1),
  overall_rating: z.enum(["Fleet Ready", "Conditional", "Needs Work", "Rejected"]),
  notes: z.string().max(5000).optional(),
});

export async function submitOnboardingInspection(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check required fields and try again." };

  const d = parsed.data;

  // Build record with all fields from form
  const record: Record<string, unknown> = {
    inspector_name: d.inspector_name.trim(),
    make: d.make.trim(),
    model: d.model.trim(),
    year: d.year,
    vin: d.vin.trim(),
    license_plate: d.license_plate || null,
    color: d.color || null,
    odometer: Number(d.odometer),
    overall_rating: d.overall_rating,
    notes: d.notes || null,
    status: "Completed",
    inspection_date: new Date().toISOString().split("T")[0],
  };

  // Copy remaining fields (condition ratings, tire pressures, etc.)
  const numericFields = ["tire_pressure_fl", "tire_pressure_fr", "tire_pressure_rl", "tire_pressure_rr"];
  const skipFields = new Set(["inspector_name", "make", "model", "year", "vin", "license_plate", "color", "odometer", "overall_rating", "notes"]);

  for (const [k, v] of Object.entries(raw)) {
    if (skipFields.has(k) || !v) continue;
    record[k] = numericFields.includes(k) ? Number(v) : v;
  }

  return insertRow("vehicle_onboarding_inspection", record);
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/forms/actions.ts
git commit -m "feat: add validated server actions for all 8 public forms"
```

---

### Task 5: Update all 8 public form pages to use server actions

Each form page needs the same changes:
1. Remove `import { supabase }` — replace with server action import
2. Replace `supabase.from().insert()` with server action call
3. Add `error` state, replace `alert()` with inline `ErrorBanner`

**Files:**
- Modify: All 8 files in `src/app/forms/*/page.tsx`

- [ ] **Step 1: Update lead-intake/page.tsx**

Replace `src/app/forms/lead-intake/page.tsx` entirely:

```tsx
"use client";

import { useState } from "react";
import { submitLeadIntake } from "@/app/forms/actions";
import { Card, FormField, inputClass, selectClass, Button, ErrorBanner } from "@/components/ui";
import { Car, CheckCircle } from "lucide-react";

const priorityOptions = ["Urgent", "Moderate", "Requires Follow Up"];

export default function LeadIntakeForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await submitLeadIntake(fd);
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 dark:text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600 dark:text-slate-400">Your inquiry has been submitted. We&apos;ll reach out to you shortly.</p>
          <Button className="mt-6" onClick={() => { setSubmitted(false); setError(null); }}>Submit Another</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Car className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">TMMT Rentals</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-slate-200">Vehicle Rental Inquiry</h1>
          <p className="text-gray-500 text-sm mt-1">Fill out the form below and we&apos;ll get back to you</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Full Name" required>
              <input name="contact_name" className={inputClass} required placeholder="John Doe" />
            </FormField>
            <FormField label="Phone Number" required>
              <input name="phone" type="tel" className={inputClass} required placeholder="(555) 123-4567" />
            </FormField>
            <FormField label="Email">
              <input name="email" type="email" className={inputClass} placeholder="john@example.com" />
            </FormField>
            <FormField label="What are you looking for?">
              <input name="opportunity_name" className={inputClass} placeholder="e.g., Weekly sedan rental for rideshare" />
            </FormField>
            <FormField label="How urgent is your need?">
              <select name="priority_level" className={selectClass}>
                <option value="">Select urgency...</option>
                {priorityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Additional Notes">
              <textarea name="notes" rows={3} className={inputClass} placeholder="Any details about your rental needs..." />
            </FormField>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit Inquiry"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update appointment/page.tsx**

Same pattern: replace `import { supabase }` with `import { submitAppointment } from "@/app/forms/actions"`, add `error` state, add `ErrorBanner`, replace `supabase.from("appointments").insert(record)` with:

```tsx
const result = await submitAppointment(fd);
setLoading(false);
if (!result.success) { setError(result.error); return; }
setSubmitted(true);
```

Remove the manual record-building code (FormData iteration, type coercions, status/timestamp setting) — the server action handles all of that.

- [ ] **Step 3: Update background-check/page.tsx**

Same pattern with `submitBackgroundCheck`. Remove supabase import, manual record building, alert(). Add error state + ErrorBanner.

- [ ] **Step 4: Update waitlist/page.tsx**

Same pattern with `submitWaitlist`. Remove supabase import, manual record building (year/payment Number coercions), alert(). Add error state + ErrorBanner.

- [ ] **Step 5: Update ticket/page.tsx**

Same pattern with `submitTicket`. Remove supabase import, manual record building, alert(). Add error state + ErrorBanner.

- [ ] **Step 6: Update inspection/page.tsx**

Same pattern with `submitInspection`. Remove supabase import, manual record building (checkbox coercions), alert(). Add error state + ErrorBanner.

- [ ] **Step 7: Update handover/page.tsx**

Same pattern with `submitHandover`. Important: the `handover_type` comes from React state — add a hidden input `<input type="hidden" name="handover_type" value={handoverType} />` so it's included in FormData. Remove supabase import, manual record building (checkbox coercions, odometer Number), alert(). Add error state + ErrorBanner.

- [ ] **Step 8: Update onboarding-inspection/page.tsx**

Same pattern with `submitOnboardingInspection`. Remove supabase import, manual record building (tire pressure/odometer Number coercions), alert(). Add error state + ErrorBanner.

- [ ] **Step 9: Verify build**

```bash
npm run build
```
Expected: Build succeeds with no errors. All 8 form pages should compile.

- [ ] **Step 10: Commit**

```bash
git add src/app/forms/
git commit -m "feat: migrate all public forms to validated server actions with inline errors"
```

---

### Task 6: Replace alert() and add .catch() in all admin pages

Every admin page needs 3 changes:
1. Add `const [error, setError] = useState<string | null>(null);`
2. Replace `if (error) { alert(error.message); return; }` with `if (error) { console.error(error.message); setError("Failed to save. Please try again."); return; }`
3. Add `.catch(() => { setError("Failed to load data."); setLoading(false); })` to the `.then()` chain in `load()`
4. Add `ErrorBanner` import and render it inside the Modal, above the form
5. Clear error on modal close: add `setError(null)` to onClose handler

**Files:**
- Modify: All 17 admin page files + dashboard

- [ ] **Step 1: Update leads/page.tsx as the reference implementation**

In `src/app/(admin)/leads/page.tsx`:

Add `ErrorBanner` to the ui import:
```tsx
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, inputClass, selectClass, ErrorBanner } from "@/components/ui";
```

Add error state after the other useState calls:
```tsx
const [error, setError] = useState<string | null>(null);
```

Update `load()` to add .catch():
```tsx
const load = () => { setLoading(true); setError(null); getLeads().then((d) => { setData(d as Lead[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); }); };
```

Update `handleSave` — replace the alert line:
```tsx
const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.phone) record.phone = Number(record.phone);
    if (editing?.id) record.id = editing.id;
    const { error } = await supabase.from("incoming_leads").upsert(record);
    if (error) { console.error(error.message); setError("Failed to save. Please try again."); return; }
    setModalOpen(false); setEditing(null); load();
  };
```

Update Modal onClose to clear error:
```tsx
<Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); }} title={editing ? "Edit Lead" : "New Lead"}>
```

Add ErrorBanner inside the Modal form, as the first child:
```tsx
<form onSubmit={handleSave} className="space-y-4">
  <ErrorBanner message={error} onDismiss={() => setError(null)} />
  {/* ...existing fields... */}
</form>
```

- [ ] **Step 2: Apply same pattern to fleet/page.tsx**

Same 5 changes: add ErrorBanner import, add error state, add .catch() to load, replace alert() in handleSave, add ErrorBanner in Modal.

- [ ] **Step 3: Apply to customers/page.tsx**
- [ ] **Step 4: Apply to payments/page.tsx**
- [ ] **Step 5: Apply to maintenance/page.tsx**
- [ ] **Step 6: Apply to appointments/page.tsx**
- [ ] **Step 7: Apply to background-checks/page.tsx**
- [ ] **Step 8: Apply to contracts/page.tsx**
- [ ] **Step 9: Apply to do-not-rent/page.tsx**
- [ ] **Step 10: Apply to expenses/page.tsx**
- [ ] **Step 11: Apply to former-customers/page.tsx**
- [ ] **Step 12: Apply to inspections/page.tsx**
- [ ] **Step 13: Apply to insurance/page.tsx**
- [ ] **Step 14: Apply to operation-costs/page.tsx**
- [ ] **Step 15: Apply to tickets/page.tsx**
- [ ] **Step 16: Apply to vendors/page.tsx**
- [ ] **Step 17: Apply to waitlist/page.tsx**

- [ ] **Step 18: Update dashboard page.tsx — add .catch()**

In `src/app/(admin)/page.tsx`, update the useEffect:

```tsx
useEffect(() => {
  getDashboardData().then(setData).catch(() => setData(null));
}, []);
```

Add a fallback when data is null after load attempt — show an error message instead of infinite spinner. After the `if (!data)` spinner block, this is already handled since null means loading. Instead, add an error state:

```tsx
const [loadError, setLoadError] = useState(false);

useEffect(() => {
  getDashboardData().then(setData).catch(() => setLoadError(true));
}, []);

if (loadError) {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-red-600 dark:text-red-400">Failed to load dashboard data. Please refresh the page.</p>
    </div>
  );
}
```

- [ ] **Step 19: Verify build**

```bash
npm run build
```
Expected: Build succeeds. Zero `alert()` calls should remain.

- [ ] **Step 20: Commit**

```bash
git add src/app/\(admin\)/
git commit -m "feat: replace alert() with inline errors, add .catch() to all admin fetches"
```

---

### Task 7: Add error boundaries

**Files:**
- Create: `src/app/error.tsx`
- Create: `src/app/(admin)/error.tsx`

- [ ] **Step 1: Create root error boundary**

```tsx
"use client";

import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
        <p className="text-gray-500 dark:text-slate-400 mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <Button onClick={reset}>Try Again</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create admin error boundary**

```tsx
"use client";

import { Button } from "@/components/ui";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Failed to load page</h2>
        <p className="text-gray-500 dark:text-slate-400 mb-4 text-sm">
          Something went wrong loading this page.
        </p>
        <Button onClick={reset}>Retry</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/error.tsx src/app/\(admin\)/error.tsx
git commit -m "feat: add error boundary components for root and admin routes"
```

---

### Task 8: Write RLS migration SQL

**Files:**
- Create: `supabase/migrations/20260331_enable_rls.sql`

- [ ] **Step 1: Create migration directory and SQL file**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Write the migration**

```sql
-- Enable RLS on all tables and add policies
-- Run this in Supabase SQL Editor or via supabase db push

-- ════════════════════════════════════════════════════
-- PUBLIC FORM TABLES: anon can INSERT only
-- ════════════════════════════════════════════════════

-- incoming_leads
ALTER TABLE incoming_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_leads" ON incoming_leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_leads" ON incoming_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- background_checks
ALTER TABLE background_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_bg_checks" ON background_checks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_bg_checks" ON background_checks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- waitlist
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_waitlist" ON waitlist FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_waitlist" ON waitlist FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_appointments" ON appointments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_appointments" ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_tickets" ON tickets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_tickets" ON tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- customer_inspection_photos
ALTER TABLE customer_inspection_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_inspections" ON customer_inspection_photos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_inspections" ON customer_inspection_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vehicle_handovers
ALTER TABLE vehicle_handovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_handovers" ON vehicle_handovers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_handovers" ON vehicle_handovers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vehicle_onboarding_inspection
ALTER TABLE vehicle_onboarding_inspection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_onboarding" ON vehicle_onboarding_inspection FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_onboarding" ON vehicle_onboarding_inspection FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════
-- ADMIN-ONLY TABLES: authenticated full access, no anon
-- ════════════════════════════════════════════════════

ALTER TABLE fleet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_fleet" ON fleet FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE active_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_customers" ON active_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_payments" ON customer_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_insurance" ON insurance FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_expenses" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE fleet_car_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_fleet_inspections" ON fleet_car_inspections FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_contracts" ON contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE shops_mechanics_cleaning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_vendors" ON shops_mechanics_cleaning FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE operation_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_op_costs" ON operation_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE do_not_rent_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_dnr" ON do_not_rent_list FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE former_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_former" ON former_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE maintenance_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_maintenance" ON maintenance_appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE vehicle_handover ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_handover" ON vehicle_handover FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Note: This migration covers the main tables. Junction tables should also have RLS enabled — check `docs/DATABASE-SCHEMA.md` for the full list and add similar `authenticated FOR ALL` policies for each.

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add RLS migration — enable row-level security on all tables"
```

- [ ] **Step 4: Remind user to run migration**

The SQL must be executed in the Supabase SQL Editor (Dashboard > SQL Editor > paste and run). This cannot be automated from the codebase. **Test on a staging project first** if available.

---

### Task 9: Final verification

- [ ] **Step 1: Full build**

```bash
npm run build
```
Expected: Clean build, no errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Expected: No new warnings or errors.

- [ ] **Step 3: Manual verification checklist**

- [ ] Open each public form in browser, submit, confirm success
- [ ] Submit a form 6+ times quickly — confirm 429 response on 6th attempt
- [ ] Open admin pages, confirm data loads without alert()
- [ ] Edit a record, confirm save works with inline error on failure
- [ ] Trigger a network error (disconnect wifi), confirm error banner appears instead of hanging spinner
- [ ] After running RLS migration: confirm public forms still insert, confirm admin pages still load/save when logged in, confirm unauthenticated direct API calls to admin tables are blocked
