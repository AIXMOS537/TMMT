export type PartnerAppStatus = "active" | "recruiting" | "planned";

export type PartnerApp = {
  number: number;
  slug: string;
  name: string;
  industry: string;
  teamSize: string;
  wave: 1 | 2 | 3;
  status: PartnerAppStatus;
};

/** 30-app roadmap — Partner Team Brief (adapted). */
export const PARTNER_APPS: PartnerApp[] = [
  { number: 1, slug: "tmmt_rentals", name: "TMMT Rentals OS", industry: "Vehicle rental arbitrage", teamSize: "5–7", wave: 1, status: "active" },
  { number: 2, slug: "tmmt_property", name: "TMMT Property", industry: "Short-term rental / Airbnb", teamSize: "5–7", wave: 1, status: "recruiting" },
  { number: 3, slug: "service_arbitrage", name: "Service Arbitrage Hub", industry: "Staffing & skilled trades", teamSize: "6–8", wave: 1, status: "recruiting" },
  { number: 4, slug: "fleet_manager", name: "Fleet Manager Pro", industry: "Commercial fleet", teamSize: "5–6", wave: 1, status: "recruiting" },
  { number: 5, slug: "vendor_connect", name: "Vendor Connect", industry: "Vendor & contractor network", teamSize: "4–6", wave: 1, status: "recruiting" },
  { number: 6, slug: "ecommerce_launchpad", name: "E-Commerce Launchpad", industry: "Product resell & dropship", teamSize: "6–8", wave: 2, status: "planned" },
  { number: 7, slug: "digital_product_studio", name: "Digital Product Studio", industry: "Courses, templates, licensing", teamSize: "5–7", wave: 2, status: "planned" },
  { number: 8, slug: "freight_logistics", name: "Freight & Logistics OS", industry: "Last-mile & freight", teamSize: "7–10", wave: 2, status: "planned" },
  { number: 9, slug: "construction_ops", name: "Construction Ops Hub", industry: "Contractors & subs", teamSize: "6–9", wave: 2, status: "planned" },
  { number: 10, slug: "healthcare_staffing", name: "Healthcare Staffing", industry: "Medical & allied staffing", teamSize: "6–9", wave: 2, status: "planned" },
  { number: 11, slug: "cleaning_ops", name: "Cleaning Ops", industry: "Commercial cleaning", teamSize: "5–7", wave: 2, status: "planned" },
  { number: 12, slug: "landscaping_hub", name: "Landscaping Hub", industry: "Landscaping & lawn", teamSize: "5–7", wave: 2, status: "planned" },
  { number: 13, slug: "real_estate_investor", name: "RE Investor OS", industry: "Residential investing", teamSize: "6–8", wave: 2, status: "planned" },
  { number: 14, slug: "fitness_operator", name: "Fitness Operator Hub", industry: "Gyms, trainers, studios", teamSize: "5–7", wave: 2, status: "planned" },
  { number: 15, slug: "restaurant_ops", name: "Restaurant Ops", industry: "Food service", teamSize: "6–8", wave: 2, status: "planned" },
  { number: 16, slug: "salon_spa", name: "Salon & Spa OS", industry: "Beauty & wellness", teamSize: "4–6", wave: 2, status: "planned" },
  { number: 17, slug: "pet_services", name: "Pet Services OS", industry: "Pet care & grooming", teamSize: "4–6", wave: 2, status: "planned" },
  { number: 18, slug: "auto_detailing", name: "Auto Detailing OS", industry: "Mobile & fixed detailing", teamSize: "5–6", wave: 2, status: "planned" },
  { number: 19, slug: "photography_business", name: "Photography Business", industry: "Freelance & studio", teamSize: "5–6", wave: 2, status: "planned" },
  { number: 20, slug: "home_services", name: "Home Services Platform", industry: "Cleaning, repair, landscaping", teamSize: "6–8", wave: 2, status: "planned" },
  { number: 21, slug: "commercial_re_arbitrage", name: "Commercial RE Arbitrage", industry: "Flex space sublease", teamSize: "7–10", wave: 3, status: "planned" },
  { number: 22, slug: "trucking_owner_op", name: "Trucking & Owner-Op OS", industry: "Independent truckers", teamSize: "7–9", wave: 3, status: "planned" },
  { number: 23, slug: "insurance_agency", name: "Insurance Agency Hub", industry: "Independent agents", teamSize: "5–8", wave: 3, status: "planned" },
  { number: 24, slug: "security_services", name: "Security Services OS", industry: "Private security", teamSize: "6–8", wave: 3, status: "planned" },
  { number: 25, slug: "tech_freelancer", name: "Tech Freelancer Platform", industry: "Dev, design, IT", teamSize: "5–7", wave: 3, status: "planned" },
  { number: 26, slug: "crypto_web3", name: "Crypto & Web3 Educator", industry: "Blockchain education", teamSize: "6–8", wave: 3, status: "planned" },
  { number: 27, slug: "sports_athletics", name: "Sports & Athletics OS", industry: "Trainers, coaches", teamSize: "5–7", wave: 3, status: "planned" },
  { number: 28, slug: "gov_contract", name: "Government Contract Hub", industry: "Small biz gov contracting", teamSize: "7–10", wave: 3, status: "planned" },
  { number: 29, slug: "solar_clean_energy", name: "Solar & Clean Energy", industry: "Residential solar", teamSize: "6–8", wave: 3, status: "planned" },
  { number: 30, slug: "international_markets", name: "International Markets", industry: "Global operator licensing", teamSize: "8–10", wave: 3, status: "planned" },
];

export const WAVE_1_RECRUITING = PARTNER_APPS.filter((a) => a.wave === 1 && a.status === "recruiting");

export function partnerAppBySlug(slug: string): PartnerApp | undefined {
  return PARTNER_APPS.find((a) => a.slug === slug);
}
