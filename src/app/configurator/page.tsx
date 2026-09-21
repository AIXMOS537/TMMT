import type { Metadata } from "next";
import ConfiguratorView from "./ConfiguratorView";

export const metadata: Metadata = {
  title: "Build your system — TMMT × AIXMOS",
  description:
    "Pick the parts you want. Every item says whether it is running today or not switched on yet.",
};

export default function ConfiguratorPage() {
  return <ConfiguratorView />;
}
