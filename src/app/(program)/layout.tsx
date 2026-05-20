import { CubeProgramShell } from "@/components/CubeProgramShell";

export const metadata = {
  title: "AIXMOS Program — TMMT Workforce",
  description: "Staff review queue for credit & funding readiness",
};

export default function ProgramLayout({ children }: { children: React.ReactNode }) {
  return <CubeProgramShell>{children}</CubeProgramShell>;
}
