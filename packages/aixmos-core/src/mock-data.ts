import { computeReadiness } from "./readiness-engine";
import { generateCoachingInsights, generateProductMatches } from "./coach-engine";
import type { Application, DocumentItem, UserProfile } from "./types";

export const DEFAULT_DOCUMENTS: DocumentItem[] = [
  { id: "gov-id", label: "Government-issued ID", required: true, uploaded: false, verified: false },
  { id: "pay-stubs", label: "Recent pay stubs (2 months)", required: true, uploaded: false, verified: false },
  { id: "tax-returns", label: "Personal tax returns (2 years)", required: true, uploaded: false, verified: false },
  { id: "bank-stmts", label: "Personal bank statements (3 months)", required: true, uploaded: false, verified: false },
  { id: "biz-bank", label: "Business bank statements (3 months)", required: false, uploaded: false, verified: false },
  { id: "biz-tax", label: "Business tax returns", required: false, uploaded: false, verified: false },
  { id: "biz-formation", label: "Articles of incorporation / formation", required: false, uploaded: false, verified: false },
  { id: "debt-schedule", label: "Debt schedule (if applicable)", required: false, uploaded: false, verified: false },
];

export const DEMO_USERS: Record<string, UserProfile> = {
  client: {
    id: "user-client-1",
    name: "Jordan Rivera",
    email: "jordan@example.com",
    role: "client",
    onboardingComplete: false,
    track: "both",
  },
  coach: {
    id: "user-coach-1",
    name: "Patricia Chen",
    email: "coach@aixmos.com",
    role: "coach",
    onboardingComplete: true,
    track: "both",
  },
  admin: {
    id: "user-admin-1",
    name: "Marcus Webb",
    email: "admin@aixmos.com",
    role: "admin",
    onboardingComplete: true,
    track: "both",
  },
  supervisor: {
    id: "user-supervisor-1",
    name: "Elena Vasquez",
    email: "supervisor@aixmos.com",
    role: "supervisor",
    onboardingComplete: true,
    track: "both",
  },
};

function baseApplication(): Application {
  const now = new Date().toISOString();
  const app: Application = {
    id: "app-demo-001",
    clientName: "Jordan Rivera",
    track: "both",
    status: "onboarding",
    documents: DEFAULT_DOCUMENTS.map((d) => ({ ...d })),
    readiness: [],
    overallReadiness: 0,
    coachingInsights: [],
    productMatches: [],
    advisorNotes: "",
    adminNotes: "",
    supervisorNotes: "",
    clientConsentGiven: false,
    auditLog: [
      {
        id: "audit-init",
        timestamp: now,
        actor: "System",
        role: "admin",
        action: "Application created",
        toStatus: "onboarding",
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  return refreshApplicationScores(app);
}

export function refreshApplicationScores(app: Application): Application {
  const { dimensions, overall } = computeReadiness(app);
  const coachingInsights = generateCoachingInsights(dimensions);
  const withScores: Application = {
    ...app,
    readiness: dimensions,
    overallReadiness: overall,
    coachingInsights,
    updatedAt: new Date().toISOString(),
  };
  withScores.productMatches = generateProductMatches(withScores);
  return withScores;
}

export function createInitialState(role: keyof typeof DEMO_USERS = "client") {
  return {
    currentUser: { ...DEMO_USERS[role] },
    application: baseApplication(),
  };
}

export const SAMPLE_PERSONAL = {
  legalName: "Jordan Rivera",
  dob: "1988-04-12",
  address: "1420 Maple Ave, Austin, TX 78701",
  employment: "Operations Manager — full-time W-2",
  income: 72000,
  housingStatus: "Renting",
  monthlyObligations: 1850,
  creditScoreRange: "670-739",
  creditUtilization: 42,
  recentInquiries: 3,
  derogatoryAccounts: 1,
  fundingGoal: "Debt consolidation + home improvement",
  desiredFundingAmount: 25000,
  timeline: "Within 60 days",
};

export const SAMPLE_BUSINESS = {
  businessName: "Rivera Ops Consulting LLC",
  entityType: "LLC",
  einStatus: "Yes — verified",
  industry: "Professional services",
  businessAge: "3 years",
  monthlyRevenue: 14500,
  averageBankBalance: 8200,
  existingBusinessDebt: 12000,
  businessCreditProfile: "Thin file — 2 trade lines",
  bankStatementsAvailable: true,
  taxReturnsAvailable: true,
  fundingPurpose: "Working capital + equipment",
};
