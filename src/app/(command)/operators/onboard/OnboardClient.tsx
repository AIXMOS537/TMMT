"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, Card, FormField, Button, inputClass, selectClass } from "@/components/ui";
import { onboardOperator, verifyOperatorDomain, type OnboardResult } from "./actions";

const TIERS = [
  { value: "custom", label: "Custom" },
  { value: "full_os", label: "Full OS" },
];

const MODULES = [
  { value: "rentals_app", label: "Rentals app" },
  { value: "credit_repair", label: "Credit guidance" },
  { value: "lease_to_own", label: "Lease to own" },
  { value: "operator_program", label: "Operator program" },
  { value: "dispatch_core", label: "Dispatch" },
  { value: "agent_sales", label: "Sales agent" },
  { value: "revenue_engine", label: "Revenue engine" },
];

export default function OnboardClient() {
  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [tier, setTier] = useState("custom");
  const [modules, setModules] = useState<string[]>(["rentals_app"]);
  const [adminEmail, setAdminEmail] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<OnboardResult | null>(null);

  const [checking, setChecking] = useState(false);
  const [dnsNote, setDnsNote] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const toggleModule = (value: string) =>
    setModules((m) => (m.includes(value) ? m.filter((x) => x !== value) : [...m, value]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await onboardOperator({ name, hostname, licenseTier: tier, modules, adminEmail });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setCreated(res.data);
  }

  async function check() {
    if (!created) return;
    setChecking(true);
    setDnsNote(null);
    const res = await verifyOperatorDomain(created.hostname);
    setChecking(false);
    if (!res.success) {
      setDnsNote(res.error);
      return;
    }
    setVerified(res.data.verified);
    setDnsNote(res.data.detail);
  }

  if (created) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`${name} is set up`}
          description="One step left, and it happens at their registrar."
        />

        <Card>
          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="text-green-600 font-semibold">✓</span>
              <span>Organization created — their data is isolated from every other tenant by row-level security.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-green-600 font-semibold">✓</span>
              <span>
                <code className="font-mono">{created.hostname}</code> registered to them. No other operator can claim it.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-green-600 font-semibold">✓</span>
              <span>Licence created, <strong>inactive</strong>. Activate it once they have paid.</span>
            </li>
            <li className="flex gap-3">
              <span className={created.adminInvited ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>
                {created.adminInvited ? "✓" : "—"}
              </span>
              <span>
                {created.adminInvited
                  ? "Their admin was added and can sign in."
                  : "No admin added yet — you can add one later."}
              </span>
            </li>
          </ol>
        </Card>

        <Card>
          <h3 className="text-base font-semibold mb-1">Have them add this DNS record</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            At whoever hosts <code className="font-mono">{created.hostname}</code>. Until it exists, the domain is a
            claim — nothing routes there.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-2 pr-6">Type</th>
                  <th className="pb-2 pr-6">Name</th>
                  <th className="pb-2">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pr-6 py-1">{created.dns.type}</td>
                  <td className="pr-6 py-1">{created.dns.name}</td>
                  <td className="py-1">{created.dns.value}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={check} disabled={checking || verified}>
              {checking ? "Checking DNS…" : verified ? "Verified" : "Check DNS now"}
            </Button>
            {dnsNote && (
              <span className={`text-sm ${verified ? "text-green-600" : "text-amber-600"}`}>{dnsNote}</span>
            )}
          </div>
        </Card>

        <div className="flex gap-3">
          <Link href="/operators" className="text-sm underline">
            Back to operators
          </Link>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => {
              setCreated(null);
              setName("");
              setHostname("");
              setAdminEmail("");
              setVerified(false);
              setDnsNote(null);
            }}
          >
            Onboard another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboard an operator"
        description="Creates their organization, claims their domain, and issues an inactive licence."
      />

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Business name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Joe's Auto"
                required
              />
            </FormField>
            <FormField label="Their domain">
              <input
                className={inputClass}
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="joes-auto.com"
                required
              />
            </FormField>
            <FormField label="Licence tier">
              <select className={selectClass} value={tier} onChange={(e) => setTier(e.target.value)}>
                {TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Their admin's email (optional)">
              <input
                className={inputClass}
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="owner@joes-auto.com"
              />
            </FormField>
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold mb-1">What they get</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Modules gate what appears in their build. Start narrow — adding one later is a click.
          </p>
          <div className="flex flex-wrap gap-2">
            {MODULES.map((m) => {
              const on = modules.includes(m.value);
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => toggleModule(m.value)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    on
                      ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                      : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </Card>

        {error && (
          <div className="rounded bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={busy}>
            {busy ? "Setting up…" : "Create operator"}
          </Button>
          <p className="text-sm text-gray-500">
            The licence starts <strong>inactive</strong>. Nothing runs for them until you activate it.
          </p>
        </div>
      </form>
    </div>
  );
}
