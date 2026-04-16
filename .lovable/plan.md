
Adicionar filtros de **Categoria** e **Tipo** dentro do diálogo "Nova Cautela" para facilitar a seleção de ferramentas.

## O que vai mudar

No componente `src/components/movements/NewCautelaDialog.tsx`, na barra de busca acima da tabela de ferramentas, adicionar dois novos `Select`:

1. **Categoria** — lista única de `category` extraída das ferramentas disponíveis carregadas.
2. **Tipo** — lista única de `type` extraída das ferramentas disponíveis carregadas.

Ambos com opção "Todas / Todos" para limpar o filtro.

## Comportamento

- Os filtros operam em conjunto com o campo de busca por texto já existente (AND lógico).
- A lista de opções é derivada apenas das ferramentas atualmente carregadas (já filtradas por disponibilidade e calibração).
- Os botões "Selecionar todos filtrados" e "Limpar" continuam funcionando, respeitando agora também os filtros de categoria/tipo.
- Os filtros são resetados ao abrir/fechar o diálogo, junto com os outros campos.

## Layout

```text
[ 🔍 Search tools..............] [Categoria ▾] [Tipo ▾] [Selecionar todos] [Limpar]
```

Em telas estreitas (<768px), os filtros quebram para a linha de baixo.

## Detalhes técnicos

- Novos states: `categoryFilter` e `typeFilter` (default `"all"`).
- `categories` e `types` derivados via `useMemo` a partir de `tools` (DISTINCT, sem nulos, ordenados).
- `filtered` (useMemo) ganha duas condições adicionais: `t.category === categoryFilter` e `t.type === typeFilter` quando diferentes de `"all"`.
- Usar componentes `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` já presentes em `src/components/ui/select.tsx`.
- Labels bilíngues via `BiLabel` (Categoria/Category, Tipo/Type, Todas/All).

## Arquivo afetado

- `src/components/movements/NewCautelaDialog.tsx` (única alteração)
