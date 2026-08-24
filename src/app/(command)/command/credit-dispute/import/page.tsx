"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, PageHeader, Button } from "@/components/ui";
import {
  DisputeFoxReportSchema,
  parseDisputeFoxReport,
  parseDisputeFoxCsv,
} from "@/lib/credit-dispute/importers/disputefox";
import {
  MfsnReportSchema,
  parseMfsnReport,
  parseMfsnCsv,
} from "@/lib/credit-dispute/importers/myfreescorenow";
import { generateId, upsertClient, type ReportSource } from "@/lib/credit-dispute/data/store";
import type { NegativeItem } from "@/lib/credit-dispute/types";

type ImportSource = "disputefox" | "myfreescorenow";

export default function CreditDisputeImportPage() {
  const router = useRouter();
  const [source, setSource] = useState<ImportSource>("myfreescorenow");
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [rawInput, setRawInput] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ name: string; count: number } | null>(null);

  function handleParse() {
    setError("");
    setPreview(null);
    try {
      if (format === "json") {
        const parsed = JSON.parse(rawInput);
        if (source === "disputefox") {
          const report = DisputeFoxReportSchema.parse(parsed);
          setPreview({ name: report.client.fullName, count: parseDisputeFoxReport(report).length });
        } else {
          const report = MfsnReportSchema.parse(parsed);
          setPreview({ name: report.client?.fullName ?? "Unknown", count: parseMfsnReport(report).length });
        }
      } else if (source === "disputefox") {
        const report = parseDisputeFoxCsv(rawInput);
        setPreview({ name: report.client.fullName, count: parseDisputeFoxReport(report).length });
      } else {
        const report = parseMfsnCsv(rawInput);
        setPreview({ name: report.client?.fullName ?? "Unknown", count: parseMfsnReport(report).length });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    }
  }

  function handleImport() {
    setError("");
    try {
      const id = generateId();
      let negatives: ReturnType<typeof parseDisputeFoxReport> = [];
      let profileData: {
        fullName: string;
        email?: string;
        phone?: string;
        dateOfBirth?: string;
        ssnLast4?: string;
        scoreExperian?: number;
        scoreEquifax?: number;
        scoreTransunion?: number;
        currentAddress: { street: string; city: string; state: string; zip: string };
      };

      if (format === "json") {
        const parsed = JSON.parse(rawInput);
        if (source === "disputefox") {
          const report = DisputeFoxReportSchema.parse(parsed);
          negatives = parseDisputeFoxReport(report);
          profileData = {
            fullName: report.client.fullName,
            email: report.client.email,
            phone: report.client.phone,
            dateOfBirth: report.client.dateOfBirth,
            ssnLast4: report.client.ssnLast4,
            scoreExperian: report.scores?.experian,
            scoreEquifax: report.scores?.equifax,
            scoreTransunion: report.scores?.transunion,
            currentAddress: report.client.address ?? { street: "", city: "", state: "", zip: "" },
          };
        } else {
          const report = MfsnReportSchema.parse(parsed);
          negatives = parseMfsnReport(report);
          profileData = {
            fullName: report.client?.fullName ?? "Unknown Client",
            email: report.client?.email,
            phone: report.client?.phone,
            scoreExperian: report.scores?.experian,
            scoreEquifax: report.scores?.equifax,
            scoreTransunion: report.scores?.transunion,
            currentAddress: report.client?.address ?? { street: "", city: "", state: "", zip: "" },
          };
        }
      } else if (source === "disputefox") {
        const report = parseDisputeFoxCsv(rawInput);
        negatives = parseDisputeFoxReport(report);
        profileData = {
          fullName: report.client.fullName,
          currentAddress: { street: "", city: "", state: "", zip: "" },
        };
      } else {
        const report = parseMfsnCsv(rawInput);
        negatives = parseMfsnReport(report);
        profileData = {
          fullName: report.client?.fullName ?? "Unknown",
          currentAddress: { street: "", city: "", state: "", zip: "" },
        };
      }

      const items: NegativeItem[] = negatives.map((n, i) => ({
        id: `item-${id}-${i}`,
        bureau: n.bureau,
        itemType: n.itemType,
        furnisherName: n.furnisherName,
        accountNumberMasked: n.accountNumberMasked,
        reportedBalanceCents: n.reportedBalanceCents,
        dateReported: n.dateReported,
        dateOfFirstDelinquency: n.dateOfFirstDelinquency,
        isInaccurate: n.isInaccurate,
        isOutdated: n.isOutdated,
        isUnverifiable: n.isUnverifiable,
        inaccuracyDetails: n.inaccuracyDetails,
        currentRound: 0,
        status: "draft",
      }));

      upsertClient({
        profile: { id, ...profileData },
        source: source as ReportSource,
        negativeItems: items,
        disputeRounds: [],
        importedAt: new Date().toISOString(),
      });

      router.push(`/command/credit-dispute/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import credit report"
        description="MyFreeScoreNow (affiliate scores) + Dispute Fox (dispute workflow) → client_journey spine"
      />

      <Link href="/command/credit-dispute" className="text-sm text-blue-600">← Back to credit command</Link>

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={source === "myfreescorenow"} onChange={() => setSource("myfreescorenow")} />
            MyFreeScoreNow (primary)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={source === "disputefox"} onChange={() => setSource("disputefox")} />
            Dispute Fox
          </label>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={format === "json"} onChange={() => setFormat("json")} />
            JSON
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={format === "csv"} onChange={() => setFormat("csv")} />
            CSV
          </label>
        </div>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="Paste intake JSON or CSV from screen capture workflow..."
          className="w-full min-h-[240px] p-3 font-mono text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {preview && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Ready: {preview.name} — {preview.count} negative item(s)
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleParse}>Preview</Button>
          <Button onClick={handleImport} disabled={!rawInput}>Import</Button>
        </div>
      </Card>
    </div>
  );
}
