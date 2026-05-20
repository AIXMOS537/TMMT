export type DealerFleetRow = {
  id: string;
  vehicle_name: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  year: number | null;
  vin_number: string | null;
  license_plate: string | null;
  vehicle_status: string | null;
  retail_status: string | null;
  acquisition_cost: number | null;
  list_price: number | null;
  mileage: number | null;
};

export type DealerLeadRow = {
  id: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  opportunity_name: string | null;
  created_on: string | null;
};

export type DealRow = {
  id: string;
  ref_code: string;
  party_id: string | null;
  fleet_vehicle_id: string | null;
  vehicle_label: string | null;
  vin: string | null;
  status: string;
  sale_price: number | null;
  trade_in_value: number | null;
  down_payment: number | null;
  notes: string | null;
  created_at: string;
  parties?: { full_name: string } | null;
};

export type DealPaymentRow = {
  id: string;
  deal_id: string;
  amount: number;
  paid_at: string;
  method: string;
  reference: string | null;
  deals?: { ref_code: string; vehicle_label: string | null } | null;
};

export const DEAL_STATUSES = ["working", "pending", "sold", "funded", "cancelled"] as const;
export const RETAIL_STATUSES = ["available", "pending", "sold"] as const;
