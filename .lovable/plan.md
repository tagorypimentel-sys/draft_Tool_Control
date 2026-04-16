
Ajustes em impressão/exportação de cautela e adição de campo "Responsável pela Entrega".

### 1. Schema
Adicionar coluna `delivered_by` (text, nullable) na tabela `cautelas` (sqlite local em `src/lib/db.ts`).

### 2. NewCautelaDialog
Adicionar input "Delivered by / Responsável pela Entrega" no cabeçalho ao criar cautela. Salvar em `delivered_by`.

### 3. CautelaDetailsDialog
Mostrar "Responsável pela Entrega" no grid de metadados.

### 4. cautela.ts — ajustar colunas e assinaturas
Em `printCautela`, `exportCautelaPDF` e `exportCautelaExcel`, mudar colunas para:

| Qty | Nome | Marca | Serial/TAG | Tipo | Total (€) |

E no rodapé do print HTML, as duas assinaturas mostram os nomes:
- **Técnico/Supervisor**: `technician` (nome do técnico já vinculado)
- **Responsável pela Entrega**: `cautela.delivered_by`

Adicionar também a linha "Delivered by / Responsável pela Entrega" no header dos 3 formatos (PDF, Excel, Print).

### Arquivos a editar
- `src/lib/db.ts` — adicionar coluna `delivered_by` ao schema + migração in-place
- `src/components/movements/NewCautelaDialog.tsx` — campo no formulário
- `src/components/movements/CautelaDetailsDialog.tsx` — exibir campo
- `src/lib/cautela.ts` — reordenar colunas (Qty, Nome, Marca, Serial/TAG, Tipo, Total €) nos 3 exportadores; assinaturas com nomes
