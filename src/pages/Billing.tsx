import { PageContainer, PageHeader } from "@/components/PageShell";
import { MonthlyBillingView } from "@/components/MonthlyBillingView";

export default function Billing() {
  return (
    <PageContainer>
      <PageHeader
        title="Facturación"
        description="Cuentas corrientes, vencimientos y cobranzas"
      />
      <div className="mt-4 min-w-0">
        <MonthlyBillingView />
      </div>
    </PageContainer>
  );
}
