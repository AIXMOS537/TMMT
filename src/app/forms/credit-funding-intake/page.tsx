"use client";

import { useState } from "react";
import Link from "next/link";
import { submitCreditFundingIntake } from "@/app/forms/actions";
import { Card, FormField, inputClass, selectClass, Button, ErrorBanner } from "@/components/ui";
import { CheckCircle, Sparkles } from "lucide-react";

// Phase 9 — Credit & Funding Readiness Intake
// Spec: CREDIT_FUNDING_OS.md
// Educational only. No credit pull. No SSN/DOB collection. Self-reported buckets only.

const SELECTS = {
  preferred_channel: [
    ["sms", "Text"],
    ["email", "Email"],
    ["in_app", "In-app"],
  ],
  personal_vs_business_focus: [
    ["personal", "Personal goals"],
    ["business", "Business goals"],
    ["both", "Both"],
  ],
  entity_type: [
    ["none", "Not registered yet"],
    ["sole_prop", "Sole proprietor"],
    ["llc", "LLC"],
    ["s_corp", "S-Corp"],
    ["c_corp", "C-Corp"],
    ["partnership", "Partnership"],
  ],
  revenue_range: [
    ["none", "No revenue yet"],
    ["<50k", "Under $50k / year"],
    ["50k-250k", "$50k – $250k"],
    ["250k-1m", "$250k – $1M"],
    [">1m", "Over $1M"],
  ],
  team_size: [
    ["just_me", "Just me"],
    ["2-5", "2 – 5"],
    ["6-20", "6 – 20"],
    ["20+", "20+"],
  ],
  funding_goal_type: [
    ["growth", "Growth capital"],
    ["equipment", "Equipment financing"],
    ["working_capital", "Working capital"],
    ["real_estate", "Real estate"],
    ["refinance", "Refinance"],
    ["other", "Other"],
  ],
  prior_funding_history: [
    ["none", "Never applied"],
    ["applied_no_approval", "Applied, no approval"],
    ["approved_completed", "Approved & completed"],
    ["currently_servicing", "Currently servicing a loan"],
  ],
  time_horizon: [
    ["immediate", "Within 30 days"],
    ["near", "Within 90 days"],
    ["planning", "3 – 6 months out"],
    ["exploring", "Just exploring"],
  ],
  awareness_level: [
    ["unaware", "Haven't looked"],
    ["vaguely_aware", "Vaguely aware"],
    ["monitors_regularly", "Monitor regularly"],
    ["actively_managing", "Actively managing"],
  ],
  self_reported_score_range: [
    ["unknown", "Not sure"],
    ["<580", "Under 580"],
    ["580-619", "580 – 619"],
    ["620-679", "620 – 679"],
    ["680-739", "680 – 739"],
    ["740+", "740+"],
  ],
  prior_education_or_program: [
    ["none", "None"],
    ["generic_app", "Generic credit app"],
    ["paid_program", "Paid program"],
    ["professional_advisor", "Professional advisor"],
  ],
  banking_status: [
    ["none", "No bank account"],
    ["personal_only", "Personal only"],
    ["separate_business_account", "Separate business account"],
    ["multiple_business_accounts", "Multiple business accounts"],
  ],
  entity_standing: [
    ["not_registered", "Not registered"],
    ["registered", "Registered"],
    ["registered_and_in_good_standing", "Registered & in good standing"],
    ["unknown", "Not sure"],
  ],
  web_presence: [
    ["none", "None"],
    ["social_only", "Social only"],
    ["landing_page", "Landing page"],
    ["full_site", "Full site"],
  ],
  bookkeeping: [
    ["none", "None"],
    ["spreadsheets", "Spreadsheets"],
    ["accounting_software", "Accounting software"],
    ["bookkeeper", "Bookkeeper"],
    ["cpa", "CPA"],
  ],
  documentation: [
    ["none", "None"],
    ["partial", "Partial"],
    ["organized_last_12mo", "Organized — last 12 months"],
    ["organized_24mo+", "Organized — 24+ months"],
  ],
} as const;

function Select({ name, options, required }: { name: string; options: ReadonlyArray<readonly [string, string]>; required?: boolean }) {
  return (
    <select name={name} className={selectClass} required={required} defaultValue="">
      <option value="">Select...</option>
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

export default function CreditFundingIntakePage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("ai_disclaimer_shown", "true");
    fd.set("credit_guidance_disclaimer_linked", "true");
    fd.set("channel", "web_form");
    fd.set("stage_reached", "6");
    const result = await submitCreditFundingIntake(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 dark:text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Thanks for sharing.</h2>
          <p className="text-gray-600 dark:text-slate-400">
            We&apos;ll review your profile and follow up with educational resources and next steps. No application has been submitted; nothing on your credit report has been changed.
          </p>
          <Button className="mt-6" onClick={() => setSubmitted(false)}>Submit Another</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">Funding Readiness Profile</span>
          </div>
          <p className="text-gray-500 text-sm mt-1 max-w-prose mx-auto">
            A short, conversational profile to help you understand your financial position and what to prepare next. Educational only — this is <strong>not</strong> a credit application and no credit pull is performed.
          </p>
        </div>

        <Card className="p-6">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 border-l-2 border-blue-500 pl-3">
            This assistant uses AI to draft responses. It is not a lawyer, financial advisor, or human representative. Educational information only. Not credit repair. No score guarantee.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1. About you</h2>
              <FormField label="First name (optional)">
                <input name="first_name" className={inputClass} placeholder="What should we call you?" />
              </FormField>
              <FormField label="Best way to reach you">
                <Select name="preferred_channel" options={SELECTS.preferred_channel} />
              </FormField>
              <FormField label="Personal goals, business goals, or both?">
                <Select name="personal_vs_business_focus" options={SELECTS.personal_vs_business_focus} />
              </FormField>
              <FormField label="What are you working toward over the next 12 months?">
                <textarea name="goals_horizon" rows={2} className={inputClass} placeholder="e.g., grow rideshare income, launch detailing business, refinance" />
              </FormField>
              <FormField label="Biggest financial challenge recently">
                <textarea name="top_friction" rows={2} className={inputClass} placeholder="What's the friction?" />
              </FormField>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">2. Your business (if any)</h2>
              <FormField label="Entity type">
                <Select name="entity_type" options={SELECTS.entity_type} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Years in business">
                  <input name="years_in_business" type="number" min={0} max={99} className={inputClass} placeholder="0" />
                </FormField>
                <FormField label="Team size">
                  <Select name="team_size" options={SELECTS.team_size} />
                </FormField>
              </div>
              <FormField label="Annual revenue range">
                <Select name="revenue_range" options={SELECTS.revenue_range} />
              </FormField>
              <FormField label="Industry">
                <input name="industry" className={inputClass} placeholder="e.g., rideshare, detailing, trucking" />
              </FormField>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">3. Funding goals</h2>
              <FormField label="What kind of capital are you preparing for?">
                <Select name="funding_goal_type" options={SELECTS.funding_goal_type} />
              </FormField>
              <FormField label="Time horizon">
                <Select name="time_horizon" options={SELECTS.time_horizon} />
              </FormField>
              <FormField label="Prior funding history">
                <Select name="prior_funding_history" options={SELECTS.prior_funding_history} />
              </FormField>
              <FormField label="Strengths you feel you bring (one per line)">
                <textarea name="readiness_indicators" rows={2} className={inputClass} placeholder="e.g., 3 yrs same industry; consistent monthly revenue" />
              </FormField>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">4. Credit awareness</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 -mt-2">Self-reported only. We do not pull credit here.</p>
              <FormField label="How aware are you of your credit profile today?">
                <Select name="awareness_level" options={SELECTS.awareness_level} />
              </FormField>
              <FormField label="Roughly where do your scores fall?">
                <Select name="self_reported_score_range" options={SELECTS.self_reported_score_range} />
              </FormField>
              <FormField label="Any items you're concerned about? (one per line)">
                <textarea name="existing_challenges" rows={2} className={inputClass} placeholder="e.g., one late payment last year" />
              </FormField>
              <FormField label="Any prior guidance programs?">
                <Select name="prior_education_or_program" options={SELECTS.prior_education_or_program} />
              </FormField>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">5. Infrastructure</h2>
              <FormField label="Business banking">
                <Select name="banking_status" options={SELECTS.banking_status} />
              </FormField>
              <FormField label="Entity standing">
                <Select name="entity_standing" options={SELECTS.entity_standing} />
              </FormField>
              <FormField label="Web presence">
                <Select name="web_presence" options={SELECTS.web_presence} />
              </FormField>
              <FormField label="Bookkeeping">
                <Select name="bookkeeping" options={SELECTS.bookkeeping} />
              </FormField>
              <FormField label="Documentation organization">
                <Select name="documentation" options={SELECTS.documentation} />
              </FormField>
            </section>

            <section className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
                <input name="operator_handoff_requested" type="checkbox" className="mt-1" />
                <span>I&apos;d like a team member to follow up with educational resources and next steps.</span>
              </label>
            </section>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit Profile"}
            </Button>

            <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
              <strong>Not credit repair.</strong> TMMT and AIXMOS provide educational information about consumer credit, score factors, and lender criteria. We do not represent ourselves to be, and are not, a credit repair organization under the Credit Repair Organizations Act (15 U.S.C. § 1679a). We do not promise to remove, dispute, or alter accurate items on your credit report. If you choose hands-on credit repair services, we refer you exclusively to Moe Legacy, an independent company you contract with directly, on its terms. Results vary; we make no guarantee that any specific action will raise your score by a specific amount or within a specific timeframe. We are not a lender — any introduction to a third-party funding source is on their terms; we may receive a referral fee that does not change your cost or rate. See <Link href="/legal/credit" className="underline">/legal/credit</Link> for full disclosures.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
