import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, ClipboardList, AlertTriangle, Wrench as WrenchIcon } from "lucide-react";

const Dashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [ferr, empr, manut] = await Promise.all([
        supabase.from("ferramentas").select("status", { count: "exact" }),
        supabase.from("emprestimos").select("id, data_prevista, data_devolucao", { count: "exact" }).is("data_devolucao", null),
        supabase.from("manutencoes").select("id", { count: "exact" }).is("data_fim", null),
      ]);
      const total = ferr.count ?? 0;
      const emprestadas = empr.count ?? 0;
      const emManutencao = manut.count ?? 0;
      const atrasadas = (empr.data ?? []).filter(
        (e) => e.data_prevista && new Date(e.data_prevista) < new Date()
      ).length;
      return { total, emprestadas, emManutencao, atrasadas };
    },
  });

  const cards = [
    { label: "Total de ferramentas", value: stats?.total ?? 0, icon: Wrench, color: "text-primary" },
    { label: "Emprestadas", value: stats?.emprestadas ?? 0, icon: ClipboardList, color: "text-warning" },
    { label: "Em manutenção", value: stats?.emManutencao ?? 0, icon: WrenchIcon, color: "text-muted-foreground" },
    { label: "Atrasadas", value: stats?.atrasadas ?? 0, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do controle de ferramentas</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
