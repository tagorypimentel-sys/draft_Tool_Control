
Continuação do trabalho interrompido. Três funcionalidades:

### 1. Botão de idioma no menu principal (header)
- `useLanguage` e `LanguageProvider` já criados; `BiLabel` já refatorado para mostrar apenas o idioma ativo.
- **`AppLayout.tsx`**: adicionar botão no header (ao lado do toggle de tema) mostrando "EN" / "PT" — clica e alterna via `toggle()` do `useLanguage`.
- Nada mais precisa mudar — todos os textos já usam `<BiLabel>`, então a troca é automática.

### 2. Devolver Cautela Completa (ReturnDialog)
Em `src/components/movements/ReturnDialog.tsx`:
- Adicionar botão **"Return Full Cautela / Devolver Cautela Completa"** no cabeçalho de cada `Card` agrupado por cautela.
- Ao clicar: abre `AlertDialog` de confirmação perguntando *"Confirma que todos os itens estão em condições de uso?"* (Sim/Não).
- Se confirmado: preenche automaticamente `state[item_id] = { qty: pending, condition: "in_use", notes: "" }` para todos os itens daquela cautela e dispara `submit()` imediato (ou apenas marca e o usuário clica Confirm Return).
- Decisão: marcar e submeter direto para fluxo rápido.

### 3. Cadastro de ferramentas em lote (Inventory)
Em `src/pages/Inventory.tsx`:
- Novo botão **"Duplicate in batch / Duplicar em lote"** (ícone `Copy`) na coluna Actions de cada linha.
- Abre dialog perguntando:
  - **Quantidade** de novos itens a criar (number input)
  - **Lista de TAGs** (textarea, um TAG por linha) — deve ter exatamente N linhas
- Ao confirmar: para cada TAG, gera novo `code` sequencial via lógica existente e insere com todos os campos da ferramenta original, substituindo apenas `serial_tag` pelo TAG informado e `quantity = 1`.
- Validação: se número de linhas ≠ quantidade → erro toast.

### Arquivos a editar
- `src/components/AppLayout.tsx` — botão EN/PT
- `src/components/movements/ReturnDialog.tsx` — botão "Devolver Cautela Completa" + AlertDialog
- `src/pages/Inventory.tsx` — botão Duplicar em lote + dialog de batch

### Notas
- Como `BiLabel` agora renderiza só um idioma, todas as telas existentes passam a respeitar o toggle automaticamente.
- Nenhuma mudança de schema necessária.
