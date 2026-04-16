
Três ajustes simples no `src/pages/Inventory.tsx`:

### 1. Mover ícone de visualização rápida (olho)
Na tabela, remover o botão `<Eye>` da coluna **Actions** e criar uma nova coluna entre **Photo** e **Code** contendo apenas o botão olho. Adicionar o `TableHead` correspondente (vazio ou com label "Ver/View").

### 2. Campo Valor sem valor pré-definido
- No objeto `empty`: remover `value_eur: 0` (deixar `undefined`).
- No `<Input>` do valor: trocar `value={form.value_eur ?? 0}` por `value={form.value_eur ?? ""}` para que o campo apareça vazio ao abrir o formulário de novo cadastro.
- O `Number(form.value_eur) || 0` no INSERT/UPDATE já garante 0 caso o usuário não digite.

### 3. Inverter posição de Type e Model
No grid do formulário, trocar a ordem dos dois blocos:
- Antes: Brand → **Type** → **Model** → Serial/TAG
- Depois: Brand → **Model** → **Type** → Serial/TAG

### Arquivo a editar
- `src/pages/Inventory.tsx` (apenas)
