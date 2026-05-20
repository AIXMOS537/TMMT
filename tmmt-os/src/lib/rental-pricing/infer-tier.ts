import type { VehicleInput, VehicleTier } from "./types";

const LUXURY_MAKES = new Set([
  "porsche",
  "lamborghini",
  "ferrari",
  "bentley",
  "rolls-royce",
  "rolls royce",
  "maserati",
  "aston martin",
  "mclaren",
  "lotus",
]);

const LUXURY_MAKE_MODELS: Record<string, Set<string>> = {
  "mercedes-benz": new Set(["s-class", "amg gt", "g-class", "maybach"]),
  mercedes: new Set(["s-class", "amg gt", "g-class", "maybach"]),
  bmw: new Set(["7 series", "8 series", "m8", "x7"]),
  audi: new Set(["a8", "r8", "rs7", "e-tron gt"]),
  tesla: new Set(["model s", "model x plaid"]),
  cadillac: new Set(["escalade"]),
  "land rover": new Set(["range rover", "defender 130"]),
  lexus: new Set(["ls"]),
};

const ECONOMY_MAKES = new Set([
  "mitsubishi",
  "nissan",
  "kia",
  "hyundai",
  "chevrolet",
  "chevy",
]);

const ECONOMY_MODELS = new Set([
  "versa",
  "sentra",
  "rio",
  "accent",
  "spark",
  "mirage",
  "corolla",
  "civic",
  "elantra",
  "forte",
  "model 3",
  "model y",
]);

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Classify fleet vehicle into economy, mid, or luxury from make/model/year. */
export function inferVehicleTier(input: VehicleInput): VehicleTier {
  if (input.tier) return input.tier;

  const make = norm(input.make);
  const model = norm(input.model);
  const year = input.year ?? null;

  if (make && LUXURY_MAKES.has(make)) return "luxury";
  if (make && LUXURY_MAKE_MODELS[make]?.has(model)) return "luxury";
  if (make === "tesla" && (model === "model 3" || model === "model y")) return "economy";

  if (make && ECONOMY_MAKES.has(make) && (!model || ECONOMY_MODELS.has(model))) {
    return "economy";
  }
  if (model && ECONOMY_MODELS.has(model)) return "economy";

  if (year != null && year >= 2022 && make === "tesla") return "economy";
  if (year != null && year >= 2020 && (make === "bmw" || make === "mercedes-benz" || make === "mercedes")) {
    return model.includes("3") || model.includes("c-class") ? "mid" : "luxury";
  }

  return "mid";
}

export function tierLabel(tier: VehicleTier): string {
  switch (tier) {
    case "economy":
      return "Economy";
    case "mid":
      return "Mid-tier";
    case "luxury":
      return "Luxury";
  }
}

export function businessLineToTier(lineId: string | null | undefined): VehicleTier | null {
  switch (lineId) {
    case "rentals":
      return "economy";
    case "express":
      return "mid";
    case "black":
    case "luxury":
      return "luxury";
    default:
      return null;
  }
}
