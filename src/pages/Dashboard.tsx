import { useMemo } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Card } from "@/components/ui/card";
import { useDb } from "@/hooks/useDb";
import { all } from "@/lib/db";
import { 
  Package, 
  ArrowUpRight, 
  AlertTriangle, 
  Wrench, 
  History, 
  TrendingUp, 
  CheckCircle2,
  Clock
} from "lucide-react";
import { differenceInDays } from "date-fns";

const Dashboard = () => {
  const { version } = useDb();

  const stats = useMemo(() => {
    void version;
    const tools = all<any>("SELECT * FROM tools");
    const cautelas = all<any>("SELECT * FROM cautelas");
    const settings = all<{ value: string }>("SELECT value FROM settings WHERE key = 'overdue_days'");
    const overdueLimit = settings.length > 0 ? parseInt(settings[0].value, 10) : 20;

    const totalTools = tools.reduce((acc: number, t: any) => acc + (t.quantity || 0), 0);
    const inUse = tools.reduce((acc: number, t: any) => acc + (t.status === "in_use" || t.status === "out" ? (t.quantity || 0) : 0), 0);
    const maintenance = tools.filter((t: any) => t.status === "maintenance" || t.status === "calibration").length;
    
    const overdueCautelas = cautelas.filter((c: any) => 
      c.status !== "closed" && differenceInDays(new Date(), new Date(c.date_out)) > overdueLimit
    ).length;

    const recentMovements = all<any>(
      `SELECT c.number, c.project, c.date_out, t.name as tech_name, c.status
       FROM cautelas c
       LEFT JOIN technicians t ON t.id = c.technician_id
       ORDER BY c.created_at DESC
       LIMIT 5`
    );

    return {
      totalTools,
      inUse,
      maintenance,
      overdueCautelas,
      recentMovements
    };
  }, [version]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col">
        <BiLabel en="Dashboard" pt="Painel de Controle" />
        <p className="text-sm text-muted-foreground italic">Welcome back to KOE Draft Tool Control / Bem-vindo ao controle de ferramentas.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 bg-blue-50 rounded-full text-blue-600">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Items</p>
            <h3 className="text-2xl font-bold">{stats.totalTools}</h3>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 bg-amber-50 rounded-full text-amber-600">
            <ArrowUpRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">In Use / Em Uso</p>
            <h3 className="text-2xl font-bold">{stats.inUse}</h3>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-rose-500 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 bg-rose-50 rounded-full text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Overdue / Atrasados</p>
            <h3 className="text-2xl font-bold">{stats.overdueCautelas}</h3>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-teal-500 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 bg-teal-50 rounded-full text-teal-600">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Maintenance</p>
            <h3 className="text-2xl font-bold">{stats.maintenance}</h3>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-lg">Recent Movements / Movimentações Recentes</h3>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-4">
            {stats.recentMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity / Sem atividades recentes.</p>
            ) : stats.recentMovements.map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-transparent hover:border-blue-200 transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center border shadow-sm">
                    {m.status === 'closed' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-amber-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{m.number} — {m.project}</p>
                    <p className="text-xs text-muted-foreground">{m.tech_name || 'System'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium">{new Date(m.date_out).toLocaleDateString()}</p>
                  <p className={`text-[10px] uppercase font-bold ${m.status === 'closed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {m.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Actions / Tips */}
        <Card className="p-6 bg-blue-600 text-white border-none shadow-lg overflow-hidden relative">
          <div className="relative z-10 space-y-4">
            <h3 className="font-bold text-xl leading-tight">Fast Control,<br />Safe Projects.</h3>
            <p className="text-blue-100 text-sm">Use the Dashboard to monitor your tool health and project deadlines in real-time.</p>
            <div className="pt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs bg-white/10 p-2 rounded backdrop-blur-sm">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                System is Online and Synchronized
              </div>
              <div className="flex items-center gap-2 text-xs bg-white/10 p-2 rounded backdrop-blur-sm">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                Database locally encrypted
              </div>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute -bottom-10 -right-10 h-40 w-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -top-10 -left-10 h-40 w-40 bg-blue-400/20 rounded-full blur-3xl" />
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
