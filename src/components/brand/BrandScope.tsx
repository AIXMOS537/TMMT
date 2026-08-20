import BrandProvider from "./BrandProvider";
import { getRequestBrand } from "@/lib/platform/request-brand";

export default async function BrandScope({ children }: { children: React.ReactNode }) {
  const brand = await getRequestBrand();
  return <BrandProvider brand={brand}>{children}</BrandProvider>;
}
