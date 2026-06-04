import type { Application, CoachingInsight, ReadinessDimension } from "./types";

function insight(
  dimension: string,
  lenderPerspective: string,
  whyItMatters: string,
  truthfulActions: string,
  timingAdvice: CoachingInsight["timingAdvice"],
  message: string
): CoachingInsight {
  return {
    dimension,
    lenderPerspective,
    whyItMatters,
    truthfulActions,
    timingAdvice,
    message,
  };
}

const COACHING_MAP: Record<
  string,
  (score: number) => Omit<CoachingInsight, "dimension"> | null
> = {
  credit_profile: (score) =>
    score < 75
      ? {
          lenderPerspective:
            "Lenders review credit history, score bands, and derogatory marks to estimate repayment risk.",
          whyItMatters:
            "A weaker profile may mean higher rates, lower limits, or needing a co-signer — not a reason to misstate anything.",
          truthfulActions:
            "Pull your free reports, dispute errors only with documentation, pay on time, and avoid new accounts before applying.",
          timingAdvice: score < 50 ? "wait_and_improve" : "consider_alternatives",
          message:
            "Honey, your credit story matters — but we're going to work with what's true today and build from there.",
        }
      : null,
  debt_to_income: (score) =>
    score < 75
      ? {
          lenderPerspective:
            "Most lenders compare monthly debt payments to gross income (DTI) to see if a new payment fits.",
          whyItMatters:
            "High DTI can cap how much you qualify for even with good income.",
          truthfulActions:
            "List every obligation honestly, consider paying down revolving balances, or increase documented income before applying.",
          timingAdvice: score < 45 ? "wait_and_improve" : "consider_alternatives",
          message:
            "Your bills aren't a moral failing — we just need lenders to see room in the budget for this funding.",
        }
      : null,
  utilization: (score) =>
    score < 75
      ? {
          lenderPerspective:
            "Utilization (balances vs limits) heavily influences scores and perceived risk.",
          whyItMatters:
            "High utilization can drop scores quickly and signal reliance on credit.",
          truthfulActions:
            "Pay down cards before statement dates, avoid maxing cards, and don't hide balances.",
          timingAdvice: score < 40 ? "wait_and_improve" : "apply_now",
          message:
            "Think of utilization like breathing room — lenders want to see you're not stretched to the limit.",
        }
      : null,
  inquiry_risk: (score) =>
    score < 70
      ? {
          lenderPerspective:
            "Multiple recent hard inquiries can signal shopping or distress.",
          whyItMatters:
            "Too many inquiries in a short window can lower approval odds.",
          truthfulActions:
            "Pause new credit applications for 3–6 months; use soft-pull pre-qual tools when available.",
          timingAdvice: "wait_and_improve",
          message:
            "Slow down on applications for a bit — patience now can save you a better offer later.",
        }
      : null,
  document_readiness: (score) =>
    score < 80
      ? {
          lenderPerspective:
            "Underwriters verify income, identity, and business activity with documents — gaps delay or deny.",
          whyItMatters:
            "Incomplete packets get returned; accuracy builds trust.",
          truthfulActions:
            "Gather pay stubs, tax returns, bank statements, and IDs that match your application exactly.",
          timingAdvice: score < 50 ? "wait_and_improve" : "apply_now",
          message:
            "We'll get your paperwork house in order — no shortcuts, no 'estimated' numbers on forms.",
        }
      : null,
  business_revenue: (score) =>
    score < 70
      ? {
          lenderPerspective:
            "Business lenders look at revenue trend, deposits, and industry risk.",
          whyItMatters:
            "Thin revenue may limit product options or require SBA-style programs.",
          truthfulActions:
            "Use actual bank deposits and tax returns; improve bookkeeping; consider smaller line sizes first.",
          timingAdvice: score < 45 ? "wait_and_improve" : "consider_alternatives",
          message:
            "Your business is growing — let's match products to real revenue, not wishful numbers.",
        }
      : null,
  business_bank_activity: (score) =>
    score < 65
      ? {
          lenderPerspective:
            "Average balances and cash flow patterns show ability to service debt.",
          whyItMatters:
            "Low balances may trigger manual review or smaller offers.",
          truthfulActions:
            "Maintain consistent deposits, separate business/personal accounts, keep 2–3 months reserves when possible.",
          timingAdvice: "consider_alternatives",
          message:
            "Cash in the account tells a story — we want that story to be honest and steady.",
        }
      : null,
};

export function generateCoachingInsights(
  dimensions: ReadinessDimension[]
): CoachingInsight[] {
  const insights: CoachingInsight[] = [];

  for (const dim of dimensions) {
    const builder = COACHING_MAP[dim.key];
    if (!builder) continue;
    const partial = builder(dim.score);
    if (partial) {
      insights.push(
        insight(
          dim.label,
          partial.lenderPerspective,
          partial.whyItMatters,
          partial.truthfulActions,
          partial.timingAdvice,
          partial.message
        )
      );
    }
  }

  if (insights.length === 0) {
    insights.push(
      insight(
        "Overall readiness",
        "Lenders reward complete, accurate files and stable credit behavior.",
        "A strong baseline improves rate and approval odds — never guaranteed.",
        "Keep paying on time, maintain low utilization, and apply only to well-matched products.",
        "apply_now",
        "You're in solid shape — we'll still review everything twice before anything goes out the door."
      )
    );
  }

  return insights;
}

export function generateProductMatches(app: Application) {
  const overall = app.overallReadiness;
  const matches = [];

  if (app.track === "personal" || app.track === "both") {
    matches.push({
      id: "pers-unsecured",
      name: "Personal Installment Loan",
      type: "personal" as const,
      lenderType: "Credit union / online lender",
      minScore: 580,
      maxAmount: 50000,
      fitScore: clampFit(overall, app.personal?.desiredFundingAmount ?? 15000, 50000),
      fitReason:
        overall >= 65
          ? "Profile aligns with standard unsecured personal products."
          : "May require smaller amount or secured alternative.",
      disclaimer:
        "No approval guaranteed. Rates depend on verified credit, income, and lender policy.",
    });
    matches.push({
      id: "pers-loc",
      name: "Personal Line of Credit",
      type: "personal" as const,
      lenderType: "Bank",
      minScore: 680,
      maxAmount: 25000,
      fitScore: clampFit(overall - 5, 10000, 25000),
      fitReason:
        overall >= 70
          ? "Strong credit and DTI support revolving personal lines."
          : "Consider after utilization and inquiries improve.",
      disclaimer: "Subject to final underwriting and document verification.",
    });
  }

  if (app.track === "business" || app.track === "both") {
    matches.push({
      id: "biz-term",
      name: "Business Term Loan",
      type: "business" as const,
      lenderType: "CDFI / alternative lender",
      minScore: 0,
      maxAmount: 150000,
      fitScore: clampFit(
        overall,
        app.business?.monthlyRevenue ? app.business.monthlyRevenue * 3 : 25000,
        150000
      ),
      fitReason:
        (app.business?.monthlyRevenue ?? 0) >= 10000
          ? "Revenue supports term loan range with full documentation."
          : "Revenue may support micro-loan or line products first.",
      disclaimer:
        "Business products require verified tax returns and bank statements when stated.",
    });
    matches.push({
      id: "biz-loc",
      name: "Business Line of Credit",
      type: "business" as const,
      lenderType: "Bank / fintech",
      minScore: 0,
      maxAmount: 100000,
      fitScore: clampFit(overall - 3, 20000, 100000),
      fitReason: "Revolving line fits working capital and seasonal cash needs.",
      disclaimer: "Not a substitute for misstated revenue or balance figures.",
    });
  }

  return matches.sort((a, b) => b.fitScore - a.fitScore);
}

function clampFit(readiness: number, amount: number, cap: number): number {
  const amountFactor = amount <= cap ? 10 : -15;
  return Math.min(98, Math.max(20, readiness + amountFactor));
}
