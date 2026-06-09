import type {
  Application,
  BusinessQuestionnaire,
  PersonalQuestionnaire,
  ReadinessDimension,
} from "./types";

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}

function statusFromScore(score: number): "strong" | "moderate" | "weak" {
  if (score >= 75) return "strong";
  if (score >= 50) return "moderate";
  return "weak";
}

function scoreCreditProfile(p?: PersonalQuestionnaire): number {
  if (!p) return 0;
  const rangeScores: Record<string, number> = {
    "800+": 95,
    "740-799": 85,
    "670-739": 70,
    "580-669": 45,
    "below-580": 20,
    unknown: 30,
  };
  let score = rangeScores[p.creditScoreRange] ?? 40;
  score -= p.derogatoryAccounts * 12;
  return clamp(score);
}

function scoreIncome(p?: PersonalQuestionnaire): number {
  if (!p) return 0;
  if (p.income >= 120000) return 90;
  if (p.income >= 75000) return 78;
  if (p.income >= 50000) return 65;
  if (p.income >= 35000) return 50;
  return 35;
}

function scoreDti(p?: PersonalQuestionnaire): number {
  if (!p || p.income <= 0) return 0;
  const dti = (p.monthlyObligations * 12) / p.income;
  if (dti <= 0.28) return 92;
  if (dti <= 0.36) return 75;
  if (dti <= 0.43) return 55;
  if (dti <= 0.5) return 35;
  return 15;
}

function scoreUtilization(p?: PersonalQuestionnaire): number {
  if (!p) return 0;
  if (p.creditUtilization <= 10) return 95;
  if (p.creditUtilization <= 30) return 80;
  if (p.creditUtilization <= 50) return 55;
  if (p.creditUtilization <= 70) return 30;
  return 10;
}

function scoreInquiryRisk(p?: PersonalQuestionnaire): number {
  if (!p) return 0;
  if (p.recentInquiries === 0) return 95;
  if (p.recentInquiries <= 2) return 70;
  if (p.recentInquiries <= 5) return 45;
  return 20;
}

function scoreDocReadiness(docs: { uploaded: boolean; required: boolean }[]): number {
  const required = docs.filter((d) => d.required);
  if (required.length === 0) return 50;
  const uploaded = required.filter((d) => d.uploaded).length;
  return clamp(Math.round((uploaded / required.length) * 100));
}

function scoreBusinessRevenue(b?: BusinessQuestionnaire): number {
  if (!b) return 0;
  if (b.monthlyRevenue >= 50000) return 92;
  if (b.monthlyRevenue >= 25000) return 78;
  if (b.monthlyRevenue >= 10000) return 62;
  if (b.monthlyRevenue >= 5000) return 45;
  return 25;
}

function scoreBankActivity(b?: BusinessQuestionnaire): number {
  if (!b) return 0;
  if (b.averageBankBalance >= 25000) return 90;
  if (b.averageBankBalance >= 10000) return 72;
  if (b.averageBankBalance >= 5000) return 55;
  if (b.averageBankBalance >= 2000) return 38;
  return 20;
}

function scoreProductFit(app: Application): number {
  const scores = app.readiness.length ? app.readiness.map((r) => r.score) : [50];
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const hasDocs = app.documents.filter((d) => d.required && d.uploaded).length >= 2;
  return clamp(Math.round(avg * 0.85 + (hasDocs ? 15 : 0)));
}

export function computeReadiness(app: Application): {
  dimensions: ReadinessDimension[];
  overall: number;
} {
  const dimensions: ReadinessDimension[] = [
    {
      key: "credit_profile",
      label: "Credit Profile",
      score: scoreCreditProfile(app.personal),
      maxScore: 100,
      status: "moderate",
    },
    {
      key: "income_cash_flow",
      label: "Income / Cash Flow",
      score: scoreIncome(app.personal),
      maxScore: 100,
      status: "moderate",
    },
    {
      key: "debt_to_income",
      label: "Debt-to-Income",
      score: scoreDti(app.personal),
      maxScore: 100,
      status: "moderate",
    },
    {
      key: "utilization",
      label: "Credit Utilization",
      score: scoreUtilization(app.personal),
      maxScore: 100,
      status: "moderate",
    },
    {
      key: "inquiry_risk",
      label: "Inquiry Risk",
      score: scoreInquiryRisk(app.personal),
      maxScore: 100,
      status: "moderate",
    },
    {
      key: "document_readiness",
      label: "Document Readiness",
      score: scoreDocReadiness(app.documents),
      maxScore: 100,
      status: "moderate",
    },
  ];

  if (app.track === "business" || app.track === "both") {
    dimensions.push(
      {
        key: "business_revenue",
        label: "Business Revenue",
        score: scoreBusinessRevenue(app.business),
        maxScore: 100,
        status: "moderate",
      },
      {
        key: "business_bank_activity",
        label: "Business Bank Activity",
        score: scoreBankActivity(app.business),
        maxScore: 100,
        status: "moderate",
      }
    );
  }

  dimensions.push({
    key: "product_fit",
    label: "Product Fit",
    score: 0,
    maxScore: 100,
    status: "moderate",
  });

  dimensions.forEach((d) => {
    d.status = statusFromScore(d.score);
  });

  const productFit = scoreProductFit({ ...app, readiness: dimensions });
  const pf = dimensions.find((d) => d.key === "product_fit");
  if (pf) {
    pf.score = productFit;
    pf.status = statusFromScore(productFit);
  }

  const relevant = dimensions.filter((d) => d.key !== "product_fit");
  const overall = Math.round(
    relevant.reduce((sum, d) => sum + d.score, 0) / relevant.length
  );

  return { dimensions, overall };
}
