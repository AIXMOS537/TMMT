"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCube } from "@aixmos/core";
import { SAMPLE_BUSINESS } from "@aixmos/core";
import type { BusinessQuestionnaire } from "@aixmos/core";
import { Button } from "@/components/aixmos-ui/button";
import { Card, CardDescription, CardTitle } from "@/components/aixmos-ui/card";
import { Input, Label, Select } from "@/components/aixmos-ui/input";
import { WorkflowBanner } from "@/components/learn/workflow-banner";

const empty: BusinessQuestionnaire = {
  businessName: "",
  entityType: "",
  einStatus: "",
  industry: "",
  businessAge: "",
  monthlyRevenue: 0,
  averageBankBalance: 0,
  existingBusinessDebt: 0,
  businessCreditProfile: "",
  bankStatementsAvailable: false,
  taxReturnsAvailable: false,
  fundingPurpose: "",
};

export default function BusinessQuestionnairePage() {
  const router = useRouter();
  const { state, updateApplication, transitionStatus } = useCube();
  const [form, setForm] = useState<BusinessQuestionnaire>(state.application.business ?? empty);

  function set<K extends keyof BusinessQuestionnaire>(key: K, value: BusinessQuestionnaire[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    updateApplication({ business: form });
    transitionStatus("questionnaire_complete", "Business questionnaire submitted");
    router.push("/dashboard");
  }

  return (
    <div>
      <WorkflowBanner />
      <Card>
        <CardTitle>Business funding questionnaire</CardTitle>
        <CardDescription>
          Use actual revenue and bank activity — do not inflate figures to &quot;look better.&quot;
        </CardDescription>

        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="bizName">Business name</Label>
            <Input id="bizName" required value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="entity">Entity type</Label>
            <Select id="entity" required value={form.entityType} onChange={(e) => set("entityType", e.target.value)}>
              <option value="">Select…</option>
              <option>LLC</option>
              <option>S-Corp</option>
              <option>C-Corp</option>
              <option>Sole proprietorship</option>
              <option>Partnership</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="ein">EIN status</Label>
            <Select id="ein" required value={form.einStatus} onChange={(e) => set("einStatus", e.target.value)}>
              <option value="">Select…</option>
              <option>Yes — verified</option>
              <option>Applied — pending</option>
              <option>No EIN yet</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="industry">Industry</Label>
            <Input id="industry" required value={form.industry} onChange={(e) => set("industry", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="age">Business age</Label>
            <Select id="age" required value={form.businessAge} onChange={(e) => set("businessAge", e.target.value)}>
              <option value="">Select…</option>
              <option>Less than 1 year</option>
              <option>1–2 years</option>
              <option>3 years</option>
              <option>4+ years</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="revenue">Monthly revenue ($)</Label>
            <Input id="revenue" type="number" min={0} required value={form.monthlyRevenue || ""} onChange={(e) => set("monthlyRevenue", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="balance">Average bank balance ($)</Label>
            <Input id="balance" type="number" min={0} required value={form.averageBankBalance || ""} onChange={(e) => set("averageBankBalance", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="debt">Existing business debt ($)</Label>
            <Input id="debt" type="number" min={0} required value={form.existingBusinessDebt || ""} onChange={(e) => set("existingBusinessDebt", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="bcredit">Business credit profile</Label>
            <Input id="bcredit" required value={form.businessCreditProfile} onChange={(e) => set("businessCreditProfile", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="purpose">Funding purpose</Label>
            <Input id="purpose" required value={form.fundingPurpose} onChange={(e) => set("fundingPurpose", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.bankStatementsAvailable} onChange={(e) => set("bankStatementsAvailable", e.target.checked)} />
            Bank statements available (3+ months)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.taxReturnsAvailable} onChange={(e) => set("taxReturnsAvailable", e.target.checked)} />
            Business tax returns available
          </label>

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setForm(SAMPLE_BUSINESS)}>
              Load demo data
            </Button>
            <Button type="submit">Save & view readiness</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
