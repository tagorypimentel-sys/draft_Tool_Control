import { BiLabel } from "@/components/BiLabel";
import { Card } from "@/components/ui/card";

const Placeholder = ({ en, pt }: { en: string; pt: string }) => (
  <div className="space-y-4">
    <BiLabel en={en} pt={pt} />
    <Card className="p-10 flex items-center justify-center">
      <BiLabel en="Coming soon" pt="Em breve" className="items-center" />
    </Card>
  </div>
);

export const Reports = () => <Placeholder en="Reports" pt="Relatórios" />;
