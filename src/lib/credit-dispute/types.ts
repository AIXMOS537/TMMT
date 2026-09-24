export type CreditBureau = "experian" | "equifax" | "transunion";

export type NegativeItemType =
  | "collection"
  | "charge_off"
  | "late_payment"
  | "bankruptcy"
  | "foreclosure"
  | "repossession"
  | "tax_lien"
  | "judgment"
  | "hard_inquiry"
  | "medical_debt"
  | "student_loan"
  | "other";

export type DisputeRoundType =
  | "initial_611"
  | "method_of_verification"
  | "factual_confrontation"
  | "furnisher_623"
  | "fdcpa_validation"
  | "cfpb_escalation"
  | "intent_to_litigate";

export type DisputeStatus =
  | "draft"
  | "sent"
  | "awaiting_response"
  | "response_received"
  | "removed"
  | "verified"
  | "updated"
  | "escalated"
  | "closed";

/**
 * Where a dispute ROUND is in its life (C1). Distinct from DisputeStatus, which is
 * the ITEM's status. A round is born `needs_review`; only a person moves it on.
 *   needs_review -> approved | returned_for_information | cancelled
 *   approved     -> sent (recorded by a person, after mailing; not in C1 UI)
 *   sent         -> response_received -> closed
 * `draft` is the pre-C1 value and is read as needs_review.
 */
export type RoundStatus =
  | "draft"
  | "needs_review"
  | "returned_for_information"
  | "approved"
  | "cancelled"
  | "sent"
  | "response_received"
  | "closed";

export interface ClientAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface CreditProfile {
  id: string;
  fullName: string;
  dateOfBirth?: string;
  ssnLast4?: string;
  currentAddress: ClientAddress;
  previousAddresses?: ClientAddress[];
  phone?: string;
  email?: string;
  scoreExperian?: number;
  scoreEquifax?: number;
  scoreTransunion?: number;
}

export interface NegativeItem {
  id: string;
  bureau: CreditBureau;
  itemType: NegativeItemType;
  furnisherName: string;
  accountNumberMasked?: string;
  reportedBalanceCents?: number;
  dateReported?: string;
  dateOfFirstDelinquency?: string;
  isInaccurate?: boolean;
  isOutdated?: boolean;
  isUnverifiable?: boolean;
  inaccuracyDetails?: string;
  currentRound: number;
  status: DisputeStatus;
}

export interface DisputeLetter {
  subject: string;
  body: string;
  recipient: string;
  recipientAddress: ClientAddress;
  roundType: DisputeRoundType;
  bureau: CreditBureau;
  roundNumber: number;
  responseDueDays: number;
}

export interface DisputeProtocolConfig {
  name: string;
  maxRounds: number;
  roundSequence: DisputeRoundType[];
  daysBetweenRounds: number;
  escalateOnVerified: boolean;
}

export const AGGRESSIVE_FCRA_PROTOCOL: DisputeProtocolConfig = {
  name: "aggressive_fcra",
  maxRounds: 6,
  roundSequence: [
    "initial_611",
    "method_of_verification",
    "factual_confrontation",
    "furnisher_623",
    "cfpb_escalation",
    "intent_to_litigate",
  ],
  daysBetweenRounds: 30,
  escalateOnVerified: true,
};

export const BUREAU_ADDRESSES: Record<CreditBureau, { name: string; address: ClientAddress }> = {
  experian: {
    name: "Experian",
    address: {
      street: "P.O. Box 4500",
      city: "Allen",
      state: "TX",
      zip: "75013",
    },
  },
  equifax: {
    name: "Equifax Information Services LLC",
    address: {
      street: "P.O. Box 740256",
      city: "Atlanta",
      state: "GA",
      zip: "30374",
    },
  },
  transunion: {
    name: "TransUnion LLC",
    address: {
      street: "P.O. Box 2000",
      city: "Chester",
      state: "PA",
      zip: "19016",
    },
  },
};

export const CFPB_ADDRESS: ClientAddress = {
  street: "Consumer Financial Protection Bureau",
  city: "1700 G Street NW, Washington",
  state: "DC",
  zip: "20552",
};
