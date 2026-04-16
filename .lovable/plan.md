

## Reformulação: Tool Control System v2 (Bilíngue EN/PT)

Vou reestruturar o app atual para atender ao novo prompt. Mudanças principais: tipografia bilíngue obrigatória em toda a UI, nova estrutura de menu, moeda em Euro, dark mode, e mudança de backend (de Lovable Cloud para sql.js offline).

### Decisão importante de backend

O app atual usa **Lovable Cloud (Supabase)** com autenticação. O novo prompt pede **sql.js (SQLite no IndexedDB), offline, sem auth, usuário único master**. Isso é uma reescrita arquitetural grande.

Vou assumir que você quer seguir o novo prompt — removendo auth e migrando para sql.js. Se preferir manter Lovable Cloud (recomendado: dados não se perdem ao limpar o navegador), me avise antes de aprovar.

### Componente reutilizável central

`<BiLabel en="Name" pt="Nome" size="default | table | small" />`
- default: EN 15px/700 + PT 11px italic muted
- table: EN 13px/700 + PT 9px italic muted
- Usado em TUDO: sidebar, headers de tabela, labels de form, botões, placeholders, títulos de modal, badges, tooltips, estados vazios

### Navegação (sidebar)

| # | EN / PT | Ícone | Rota |
|---|---|---|---|
| 1 | Inventory / Inventário | Wrench | `/` |
| 2 | Movements / Movimentações (badge vermelho se pendentes) | ArrowLeftRight | `/movements` |
| 3 | Calibration / Calibração | Crosshair | `/calibration` |
| 4 | Reports / Relatórios | BarChart2 | `/reports` |
| 5 | Technician Register / Cadastro de Técnicos | UserCheck | `/technicians` |
| Footer | Settings / Configurações | Settings | `/settings` |

Estado ativo: `bg-blue-50 text-blue-700` (icon também). Hover: `bg-slate-100` / `dark:bg-slate-800`.

### Modelo de dados (sql.js)

```text
tools          (id, code, name, category, location, status,
                acquisition_date, value_eur, notes)
                — status: available | in_use | maintenance | calibration | retired
                — NUNCA deletadas, só mudam status
movements      (id, tool_id, technician_id, type, date_out,
                date_expected, date_in, notes)
                — type: checkout | return
calibrations   (id, tool_id, last_date, next_date, certificate, notes)
technicians    (id, name, department, contact)
settings       (key, value) — tema, etc.
```

Persistência: sql.js em memória + serialização periódica para IndexedDB via `idb-keyval`. Hook `useDb()` provê instância e helpers tipados. Sem auth, sem RLS.

### Telas

1. **Inventory** — tabela de ferramentas com busca/filtro por categoria/status/local. Colunas bilíngues (Code/Código, Name/Nome, Category/Categoria, Location/Local, Status, Value/Valor em €, Actions/Ações). Botão "Add tool / Adicionar ferramenta". Ações por linha: Edit, Change status (NÃO delete).
2. **Movements** — registrar saída/devolução, lista de movimentos ativos, destaque para atrasados. Badge no menu = nº de movimentos sem devolução.
3. **Calibration** — lista de ferramentas com data de calibração, próximas/vencidas em destaque, registrar nova calibração.
4. **Reports** — cards de totais + gráficos básicos (recharts) + exportação CSV.
5. **Technicians** — CRUD de técnicos.
6. **Settings** — toggle dark mode, info do app, exportar/importar backup do banco (.sqlite).

### Moeda Euro

Helper `formatEUR(value)` → `€ 1.250,00` (formato europeu, `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })`). Input com prefixo `€`.

### Dark mode

Toggle no header (Sun/Moon). Persistido em `localStorage` + tabela settings. Tailwind `dark:` em todo o design system. Variáveis HSL ajustadas em `index.css`.

### Pilha técnica

- Mantém: React + Vite + Tailwind + shadcn/ui + Lucide + react-router + react-query + sonner
- Adiciona: `sql.js`, `idb-keyval`, `date-fns`, `recharts` (já presente)
- Remove: Supabase client, AuthProvider, páginas Auth, todas as queries para `supabase.from(...)`, migrations
- A Lovable Cloud continua provisionada mas fica sem uso (ou podemos desabilitar nas configurações depois)

### Entrega em fases

1. **Fase A (esta entrega)** — `<BiLabel>`, design system + dark mode, sql.js setup, nova sidebar bilíngue, Inventory completo, Technicians completo, Settings (tema + backup).
2. **Fase B** — Movements (saída/devolução, badge de pendentes, atrasados).
3. **Fase C** — Calibration + Reports (gráficos + CSV).

Começo pela Fase A após sua aprovação.

### Confirmações antes de começar

1. **Backend**: confirma trocar Lovable Cloud (Supabase com auth) por sql.js offline (sem auth, dados ficam só no navegador do usuário)?
2. **Dados existentes**: se já cadastrou algo nas tabelas atuais, será descartado. Ok?
3. **Escopo Fase A**: ok começar pelas telas Inventory + Technicians + Settings, deixando Movements/Calibration/Reports para fases seguintes? Ou prefere tudo de uma vez?

