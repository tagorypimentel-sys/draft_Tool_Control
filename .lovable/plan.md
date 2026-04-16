

## Menu Movimentações — Plano de Implementação

Vou implementar o menu **Movements / Movimentações** completo conforme as 10 regras descritas, mantendo o padrão bilíngue (BiLabel), Euro e sql.js já estabelecidos.

### 1. Mudanças no schema (sql.js)

O schema atual de `tools` e `movements` é insuficiente. Vou estender via `ALTER TABLE` (idempotente, preservando dados existentes):

**`tools` — novos campos:**
- `brand` TEXT — Marca
- `type` TEXT — Tipo
- `serial_tag` TEXT — Nº Série / TAG
- `quantity` INTEGER DEFAULT 1 — quantidade total disponível em estoque
- (mantém `code`, `name`, `category`, `value_eur`, `status`, etc.)

Status passa a aceitar: `available`, `out`, `out_of_service` (Fora de Uso), `maintenance`, `retired`.

**Nova tabela `cautelas`** (cabeçalho da saída):
```
id TEXT PK
number TEXT UNIQUE          -- PROJETO_01, PROJETO_02...
project TEXT NOT NULL
client TEXT
ship TEXT
technician_id TEXT NOT NULL
date_out TEXT NOT NULL
date_in TEXT                -- preenchido quando 100% devolvido
status TEXT                 -- open | partial | closed
notes TEXT
created_at TEXT
```

**Nova tabela `cautela_items`** (linhas de cada cautela):
```
id TEXT PK
cautela_id TEXT NOT NULL
tool_id TEXT NOT NULL
qty_out INTEGER NOT NULL
qty_returned INTEGER DEFAULT 0
qty_out_of_service INTEGER DEFAULT 0
condition_notes TEXT        -- observações quando devolvido fora de uso
unit_value_eur REAL
```

A tabela antiga `movements` fica obsoleta (não usada na nova UI, mas preservada para não quebrar nada).

### 2. Numeração de cautela `PROJETO_NN`

Função `generateCautelaNumber(project)`:
1. Normaliza `project` (uppercase, sem espaços/acentos).
2. Conta cautelas existentes com mesmo prefixo: `SELECT COUNT(*) FROM cautelas WHERE number LIKE 'PROJETO_%'`.
3. Retorna `PROJETO_` + `String(count+1).padStart(2,'0')` → ex: `OFFSHORE01_03`.

### 3. Tela `Movements.tsx` — estrutura

Tabs ou seções:

**A) Header com 2 botões grandes:**
- `New Checkout / Nova Saída (Cautela)` — abre dialog de criação
- `Return Items / Devolver Material` — abre dialog de devolução

**B) Lista de cautelas abertas/parciais** (tabela bilíngue):
| Number/Nº | Project/Projeto | Technician/Técnico | Client/Cliente | Ship/Navio | Date Out/Saída | Status | Actions/Ações |

Ações por linha: View/Ver detalhes, Print/Imprimir, Export PDF, Export Excel, Return/Devolver.

**C) Filtros:** por técnico, por projeto, por número de cautela, status.

### 4. Dialog "Nova Saída (Cautela)"

Campos (todos com `<BiLabel>`):
- Technician/Supervisor (select de `technicians`)
- Project Number / Nº Projeto (input texto)
- Client / Cliente (input)
- Ship / Navio (input)
- Lista de ferramentas disponíveis (`status='available' AND quantity > 0`):
  - Tabela com checkbox + input de quantidade por linha
  - Busca rápida no topo
  - Botão "Select All Filtered / Selecionar todos filtrados"
  - Colunas: ☐, Code, Name, Brand, Category, Type, Serial/TAG, Available Qty, Qty to take, Unit Value €
- Footer: total de itens selecionados + valor total €

Ao salvar:
- Gera número da cautela.
- Insere em `cautelas` (status `open`).
- Insere linhas em `cautela_items` com `qty_out`.
- Para cada `tool_id`, decrementa `tools.quantity` e, se zerar, marca `status='out'`. (Se quantity > 1 e ainda sobra, mantém `available`.)
- Toast de sucesso + opções imediatas: Print, Export PDF, Export Excel.

### 5. Dialog "Devolver Material"

- Filtros no topo: técnico, projeto, número da cautela.
- Lista de cautelas filtradas com seus itens pendentes (`qty_out - qty_returned - qty_out_of_service > 0`).
- Para cada item: input "Qty returning" + radio "In use condition / Em condição de uso" vs "Out of service / Fora de uso".
- Se "out of service": campo de observações obrigatório.
- Devolução parcial permitida.

Ao confirmar:
- Atualiza `qty_returned` (+ se em uso) e devolve à `tools.quantity`, status volta a `available`.
- Ou `qty_out_of_service` (+ se fora de uso) e cria/atualiza linha em `tools` com novo status `out_of_service` (ou apenas marca o item; ferramenta volta ao estoque com status `out_of_service`). **Decisão**: a quantidade fora de uso volta ao estoque mas como ferramentas separadas com status `out_of_service`. Para simplificar: mantemos a ferramenta original e adicionamos um campo `quantity_out_of_service` em `tools`.
- Recalcula status da cautela: se tudo retornou → `closed` + `date_in`. Senão → `partial`.

**Refinamento (mais simples)**: adiciono em `tools` os campos:
- `quantity` (total disponível)
- `quantity_out_of_service` (separado)
Quando "in use" volta → `quantity++`. Quando "out of service" volta → `quantity_out_of_service++` (não disponível para nova cautela).

### 6. Exportação PDF

Biblioteca: **`jspdf` + `jspdf-autotable`** (instalar).

Função `exportCautelaPDF(cautelaId)`:
- Cabeçalho: logo/título + número da cautela + data + projeto + cliente + navio + técnico.
- Tabela com colunas: **Name, Brand, Category, Type, Serial/TAG, Value (€), Qty, Total (€)**.
- Linha final: TOTAL GERAL €.
- Salva como `Cautela_{number}.pdf`.

### 7. Exportação Excel

Biblioteca: **`xlsx`** (SheetJS — instalar).

Função `exportCautelaExcel(cautelaId)`:
- Mesmas colunas do PDF.
- Cabeçalho com metadados da cautela.
- Linha total.
- Salva como `Cautela_{number}.xlsx`.

### 8. Impressão

Função `printCautela(cautelaId)`:
- Abre `window.open` com HTML otimizado para impressão (CSS `@media print`).
- Conteúdo reduzido (só campos exigidos): **Name, Brand, Serial/TAG, Value (€), Qty, Total (€)**.
- Rodapé com 2 áreas de assinatura:
  - "Technician/Supervisor / Técnico/Supervisor: __________"
  - "Delivered by / Entregue por: __________"
- `window.print()` automático.

### 9. Atualização da tela `Inventory`

Para os novos campos funcionarem, preciso adicionar em `Inventory.tsx`:
- Campos no formulário: **Brand, Type, Serial/TAG, Quantity**.
- Coluna na tabela: Brand, Serial/TAG, Qty Available.
- Não vou refazer a tela — apenas estender o formulário e tabela existentes.

### 10. Badge de pendentes na sidebar

Já existe `pendingCount` baseado em `movements.date_in IS NULL`. Vou trocar a fonte para:
```sql
SELECT COUNT(*) FROM cautelas WHERE status IN ('open','partial')
```

### Arquivos a criar/editar

**Criar:**
- `src/pages/Movements.tsx` — tela principal
- `src/components/movements/NewCautelaDialog.tsx`
- `src/components/movements/ReturnDialog.tsx`
- `src/components/movements/CautelaDetailsDialog.tsx`
- `src/lib/cautela.ts` — geração de número, exports PDF/Excel, impressão

**Editar:**
- `src/lib/db.ts` — novas tabelas + ALTERs idempotentes para `tools`
- `src/App.tsx` — registrar rota `/movements`
- `src/pages/Placeholders.tsx` — remover `Movements`
- `src/pages/Inventory.tsx` — adicionar Brand, Type, Serial/TAG, Quantity
- `src/components/AppSidebar.tsx` — atualizar fonte do badge

**Dependências novas:**
- `jspdf`, `jspdf-autotable`, `xlsx`

### Confirmações antes de implementar

1. **Modelo de quantidade**: ok adicionar `quantity` (estoque) e `quantity_out_of_service` em `tools`? Ferramentas hoje funcionam como "1 unidade por linha" — o novo modelo permite múltiplas. Itens já cadastrados ganham `quantity=1` automaticamente. Confirma?

2. **Numeração da cautela**: o formato `PROJETO_NN` usa o nome do projeto digitado como prefixo (ex: `OFFSHORE_01`, `OFFSHORE_02`). A numeração reinicia/incrementa por projeto (cada projeto tem sua sequência). Está correto? Ou prefere uma sequência global?

3. **Fora de Uso**: ao devolver "fora de uso", a ferramenta volta ao estoque marcada como `out_of_service` (não disponível para nova cautela, visível no Inventory com status diferente). Confirma essa regra?

4. **Inventory**: ok eu estender o formulário/tabela do Inventory para incluir os novos campos (Brand, Type, Serial/TAG, Quantity)? Sem isso a saída de cautela não tem o que mostrar.

Aguardando aprovação para começar.

