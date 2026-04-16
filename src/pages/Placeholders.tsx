const Placeholder = ({ title }: { title: string }) => (
  <div className="space-y-2">
    <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
    <p className="text-muted-foreground">Esta seção será implementada na próxima fase.</p>
  </div>
);

export const Emprestimos = () => <Placeholder title="Empréstimos" />;
export const Colaboradores = () => <Placeholder title="Colaboradores" />;
