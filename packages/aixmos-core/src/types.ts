export type UserRole = "client" | "coach" | "admin" | "supervisor";

export type FundingTrack = "personal" | "business" | "both";

export type ApplicationStatus =
  | "onboarding"
  | "questionnaire_in_progress"
  | "questionnaire_complete"
  | "coach_reviewed"
  | "advisor_reviewed"
  | "admin_reviewed"
  | "supervisor_approved"
  | "client_consent_given"
  | "submitted"
  | "prepared_for_manual"
  | "returned_for_corrections";

export interface PersonalQuestionnaire {
  legalName: string;
  dob: string;
  address: string;
  employment: string;
  income: number;
  housingStatus: string;
  monthlyObligations: number;
  creditScoreRange: string;
  creditUtilization: number;
  recentInquiries: number;
  derogatoryAccounts: number;
  fundingGoal: string;
  desiredFundingAmount: number;
  timeline: string;
}

export interface BusinessQuestionnaire {
  businessName: string;
  entityType: string;
  einStatus: string;
  industry: string;
  businessAge: string;
  monthlyRevenue: number;
  averageBankBalance: number;
  existingBusinessDebt: number;
  businessCreditProfile: string;
  bankStatementsAvailable: boolean;
  taxReturnsAvailable: boolean;
  fundingPurpose: string;
}

export interface DocumentItem {
  id: string;
  label: string;
  required: boolean;
  uploaded: boolean;
  verified: boolean;
}

export interface ReadinessDimension {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  status: "strong" | "moderate" | "weak";
}

export interface CoachingInsight {
  dimension: string;
  lenderPerspective: string;
  whyItMatters: string;
  truthfulActions: string;
  timingAdvice: "apply_now" | "wait_and_improve" | "consider_alternatives";
  message: string;
}

export interface ProductMatch {
  id: string;
  name: string;
  type: "personal" | "business";
  lenderType: string;
  minScore: number;
  maxAmount: number;
  fitScore: number;
  fitReason: string;
  disclaimer: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  action: string;
  fromStatus?: ApplicationStatus;
  toStatus?: ApplicationStatus;
  notes?: string;
}

export interface Application {
  id: string;
  clientName: string;
  track: FundingTrack;
  status: ApplicationStatus;
  personal?: PersonalQuestionnaire;
  business?: BusinessQuestionnaire;
  documents: DocumentItem[];
  readiness: ReadinessDimension[];
  overallReadiness: number;
  coachingInsights: CoachingInsight[];
  productMatches: ProductMatch[];
  advisorNotes: string;
  adminNotes: string;
  supervisorNotes: string;
  clientConsentGiven: boolean;
  consentTimestamp?: string;
  submissionMethod?: "api_stub" | "manual_prep";
  submissionReference?: string;
  auditLog: AuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  onboardingComplete: boolean;
  track: FundingTrack;
}

export interface AppState {
  currentUser: UserProfile;
  application: Application;
}
