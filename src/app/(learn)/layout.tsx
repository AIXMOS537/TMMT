import { CubeApplicationProvider } from "@/components/CubeApplicationProvider";
import { LearnChrome } from "@/components/learn/engine-chrome";

export const metadata = {
  title: "AIXMOS Learn — Credit & funding readiness",
  description: "Education, readiness scoring, and truthful application prep",
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <CubeApplicationProvider defaultRole="client">
      <LearnChrome>{children}</LearnChrome>
    </CubeApplicationProvider>
  );
}
