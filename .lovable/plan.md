
## Plano: Ajustes no Inventário

### 1. Remover dropdown de status na tabela
Na coluna **Actions**, remover o `<Select>` que muda status inline. Manter apenas o botão de editar (lápis) e adicionar o novo botão de visualização rápida (olho). A alteração de status continua disponível ao editar a ferramenta.

### 2. Adicionar campo "Model / Modelo"
**Schema (`src/lib/db.ts`)**: adicionar `ALTER TABLE tools ADD COLUMN model TEXT` na lista idempotente `ALTERS`.

**Form (`Inventory.tsx`)**:
- Adicionar `model` ao type `Tool` e ao objeto `empty`.
- Novo campo no formulário (grid 2 colunas), posicionado após **Brand**.
- Incluir `model` no `INSERT` e `UPDATE`.

### 3. Botão de visualização rápida (ícone olho)
Novo componente inline ou dialog dentro do `Inventory.tsx`:

- Botão `<Eye />` na coluna Actions (ao lado do lápis).
- Abre um `<Dialog>` mostrando:
  - Foto grande (ou placeholder se não houver) — ~250x250px
  - **Name / Nome** (título grande)
  - **Model / Modelo** (linha bilíngue)
  - **Notes / Observações** (bloco de texto)
- Bilíngue em todos os labels usando `<BiLabel>`.

### Arquivos a editar
- `src/lib/db.ts` — adicionar ALTER para `model`
- `src/pages/Inventory.tsx` — type Tool, empty, form (campo Model), tabela (remover Select, adicionar botão Eye), novo state + Dialog de quick view, ajustar INSERT/UPDATE

### Resumo visual da coluna Actions
Antes: `[Select status][Editar]`  
Depois: `[👁 Ver][✏ Editar]`
