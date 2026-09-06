import { IntakeFlow } from "@/components/intake/intake-flow";
import { SiteHeader } from "@/components/site/site-header";

export default function IntakePage() {
  return (
    <main className="flex min-h-svh flex-col">
      <SiteHeader />
      <IntakeFlow />
    </main>
  );
}
