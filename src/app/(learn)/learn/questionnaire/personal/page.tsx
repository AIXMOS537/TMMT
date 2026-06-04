"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCube } from "@aixmos/core";
import { SAMPLE_PERSONAL } from "@aixmos/core";
import type { PersonalQuestionnaire } from "@aixmos/core";
import { Button } from "@/components/aixmos-ui/button";
import { Card, CardDescription, CardTitle } from "@/components/aixmos-ui/card";
import { Input, Label, Select } from "@/components/aixmos-ui/input";
import { WorkflowBanner } from "@/components/learn/workflow-banner";

const empty: PersonalQuestionnaire = {
  legalName: "",
  dob: "",
  address: "",
  employment: "",
  income: 0,
  housingStatus: "",
  monthlyObligations: 0,
  creditScoreRange: "",
  creditUtilization: 0,
  recentInquiries: 0,
  derogatoryAccounts: 0,
  fundingGoal: "",
  desiredFundingAmount: 0,
  timeline: "",
};

export default function PersonalQuestionnairePage() {
  const router = useRouter();
  const { state, updateApplication, transitionStatus } = useCube();
  const [form, setForm] = useState<PersonalQuestionnaire>(
    state.application.personal ?? empty
  );

  function set<K extends keyof PersonalQuestionnaire>(key: K, value: PersonalQuestionnaire[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function loadSample() {
    setForm(SAMPLE_PERSONAL);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    updateApplication({ personal: form, clientName: form.legalName || state.application.clientName });
    transitionStatus("questionnaire_complete", "Personal questionnaire submitted");
    const next =
      state.application.track === "both" ? "/questionnaire/business" : "/dashboard";
    router.push(next);
  }

  return (
    <div>
      <WorkflowBanner />
      <Card>
        <CardTitle>Personal funding questionnaire</CardTitle>
        <CardDescription>
          Answer truthfully — lenders verify income, credit, and obligations. Estimates are fine only when
          labeled as estimates.
        </CardDescription>

        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="legalName">Legal name</Label>
            <Input id="legalName" required value={form.legalName} onChange={(e) => set("legalName", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="dob">Date of birth</Label>
            <Input id="dob" type="date" required value={form.dob} onChange={(e) => set("dob", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" required value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="employment">Employment</Label>
            <Input id="employment" required value={form.employment} onChange={(e) => set("employment", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="income">Annual gross income ($)</Label>
            <Input id="income" type="number" required min={0} value={form.income || ""} onChange={(e) => set("income", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="housing">Housing status</Label>
            <Select id="housing" required value={form.housingStatus} onChange={(e) => set("housingStatus", e.target.value)}>
              <option value="">Select…</option>
              <option>Renting</option>
              <option>Own with mortgage</option>
              <option>Own outright</option>
              <option>Living with family</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="obligations">Monthly obligations ($)</Label>
            <Input id="obligations" type="number" required min={0} value={form.monthlyObligations || ""} onChange={(e) => set("monthlyObligations", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="score">Credit score range</Label>
            <Select id="score" required value={form.creditScoreRange} onChange={(e) => set("creditScoreRange", e.target.value)}>
              <option value="">Select…</option>
              <option value="800+">800+</option>
              <option value="740-799">740–799</option>
              <option value="670-739">670–739</option>
              <option value="580-669">580–669</option>
              <option value="below-580">Below 580</option>
              <option value="unknown">Unknown</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="util">Credit utilization (%)</Label>
            <Input id="util" type="number" min={0} max={100} required value={form.creditUtilization || ""} onChange={(e) => set("creditUtilization", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="inquiries">Recent hard inquiries (6 mo)</Label>
            <Input id="inquiries" type="number" min={0} required value={form.recentInquiries} onChange={(e) => set("recentInquiries", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="derog">Derogatory accounts</Label>
            <Input id="derog" type="number" min={0} required value={form.derogatoryAccounts} onChange={(e) => set("derogatoryAccounts", Number(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="goal">Funding goal</Label>
            <Input id="goal" required value={form.fundingGoal} onChange={(e) => set("fundingGoal", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="amount">Desired funding amount ($)</Label>
            <Input id="amount" type="number" min={0} required value={form.desiredFundingAmount || ""} onChange={(e) => set("desiredFundingAmount", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="timeline">Timeline</Label>
            <Select id="timeline" required value={form.timeline} onChange={(e) => set("timeline", e.target.value)}>
              <option value="">Select…</option>
              <option>ASAP (30 days)</option>
              <option>Within 60 days</option>
              <option>3–6 months</option>
              <option>Exploring — no rush</option>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={loadSample}>
              Load demo data
            </Button>
            <Button type="submit">Save & continue</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
