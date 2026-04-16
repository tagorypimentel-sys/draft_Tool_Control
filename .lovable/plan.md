

## Sistema de Controle de Ferramentas

Aplicação web em português para cadastrar ferramentas, controlar empréstimos (quem retirou, quando, devolução), gerenciar categorias/locais e ver relatórios básicos. Backend com **Lovable Cloud** (Supabase) para persistir dados e autenticar usuários.

### Telas

1. **Login / Cadastro** — autenticação por e-mail e senha.
2. **Dashboard** — cards com totais (ferramentas, emprestadas, em manutenção, atrasadas) e atividades recentes.
3. **Ferramentas** — lista com busca/filtro (categoria, status, local), botões para criar/editar/excluir. Cada ferramenta tem: nome, código/patrimônio, categoria, localização, estado (disponível, emprestada, manutenção, baixada), foto opcional, observações.
4. **Empréstimos** — registrar retirada (ferramenta + responsável + data prevista de devolução), registrar devolução, ver histórico. Destaque para atrasados.
5. **Colaboradores** — cadastro de pessoas que pegam ferramentas emprestadas (nome, setor, contato).
6. **Categorias e Locais** — CRUD simples.
7. **Relatórios** — ferramentas mais emprestadas, atrasos, histórico por colaborador.

### Modelo de dados (Lovable Cloud)

```text
profiles            (id, nome, email)
user_roles          (user_id, role: admin | operador)
categorias          (id, nome)
locais              (id, nome)
colaboradores       (id, nome, setor, contato)
ferramentas         (id, codigo, nome, categoria_id, local_id,
                     status, foto_url, observacoes, created_at)
emprestimos         (id, ferramenta_id, colaborador_id, usuario_id,
                     data_retirada, data_prevista, data_devolucao,
                     observacoes)
manutencoes         (id, ferramenta_id, descricao, data_inicio,
                     data_fim, custo)
```

RLS habilitada em todas as tabelas. Papéis (`admin`/`operador`) em tabela separada com função `has_role()` (admins editam tudo, operadores registram empréstimos/devoluções).

### Pilha técnica

- React + Vite + Tailwind + shadcn/ui (já instalado)
- `react-router-dom` para rotas, layout com **Sidebar** shadcn (Dashboard, Ferramentas, Empréstimos, Colaboradores, Cadastros, Relatórios)
- `@tanstack/react-query` para data fetching
- Supabase (Lovable Cloud) para auth, banco e storage de fotos
- Design system: tons neutros profissionais com acento azul, definidos em `index.css` (HSL)

### Entrega em fases

1. **Fase 1** — Setup Lovable Cloud, auth, layout com sidebar, design system, CRUD de ferramentas, categorias e locais.
2. **Fase 2** — Colaboradores, fluxo completo de empréstimo/devolução, dashboard com indicadores.
3. **Fase 3** — Manutenções, relatórios, upload de fotos, marcação de atrasos.

Começarei pela **Fase 1** após sua aprovação. Se quiser mudar idioma, escopo (ex.: sem manutenção) ou remover autenticação, é só dizer.

<lov-actions>
<lov-suggestion message="Aprovado, pode começar pela Fase 1">Aprovar e iniciar Fase 1</lov-suggestion>
<lov-suggestion message="Quero um escopo mais simples: apenas inventário de ferramentas e empréstimos, sem manutenção e sem múltiplos usuários (uso pessoal, sem login).">Versão simples sem login</lov-suggestion>
<lov-suggestion message="Construa tudo de uma vez (Fases 1, 2 e 3) em vez de dividir em entregas.">Construir tudo de uma vez</lov-suggestion>
<lov-suggestion message="Adicione também geração de QR Code para cada ferramenta e leitura via câmera para registrar empréstimo/devolução rapidamente.">Adicionar QR Code</lov-suggestion>
<lov-suggestion message="Adicione exportação de relatórios em PDF e CSV (ferramentas, empréstimos, atrasados).">Exportar relatórios PDF/CSV</lov-suggestion>
</lov-actions>
