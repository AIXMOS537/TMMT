// shared/schemas/types.ts — cross-workstream shared types.

export type OperatorTier = 1 | 2 | 3; // 1 refer-only, 2 certified, 3 capital partner

export interface Operator {
  id: string;
  name: string;
  email: string;
  tier: OperatorTier;
  state: string;              // VA only at launch
  covenantAcceptedAt?: string;
  subscriptionActive: boolean;
}

export type FundingRung = "credit_repair" | "business_credit" | "business_funding" | "community_capital";

export interface Client {
  id: string;
  operatorId: string;        // referring operator
  rung: FundingRung;
  state: string;
  piiOnNas: boolean;         // true; PII must live on NAS tier
}

export type FundingProduct =
  | "zero_apr_card" | "line_of_credit" | "sba_term" | "equipment"
  | "revenue_based_financing" | "merchant_cash_advance"; // last two gated

export interface FundingDeal {
  id: string;
  clientId: string;
  product: FundingProduct;
  amount: number;
  status: "draft" | "pending_approval" | "submitted" | "funded" | "declined";
}

export interface DisputeItem {
  id: string;
  clientId: string;
  bureau: "experian" | "equifax" | "transunion";
  reason: string;
  status: "drafted" | "pending_approval" | "sent" | "investigating" | "resolved";
  clockStartedAt?: string;   // 30-day reinvestigation
}

export type CommissionTrigger = "credit_repair_service" | "funding_funded" | "consulting_delivered";
// NOTE: there is intentionally NO "operator_recruited" trigger. Recruitment pay = illegal pyramid.

export interface Commission {
  id: string;
  operatorId: string;
  trigger: CommissionTrigger;
  basisAmount: number;
  payoutAmount: number;
  status: "pending_approval" | "approved" | "paid";
}
