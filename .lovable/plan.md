
Adicionar logo KOE (Kessler) ao cabeçalho do PDF do Inventário e numeração de páginas no rodapé.

## Logo

Copiar `user-uploads://FotoLogo.gif` para `src/assets/koe-logo.png` (PNG é necessário para `jsPDF.addImage` — GIF não é suportado nativamente). Conversão será feita no momento do copy via pipeline de imagem ou, se não for possível, salvar como `.gif` em `public/` e converter para PNG em runtime via canvas.

**Abordagem escolhida:** carregar a imagem em runtime via `<img>` + `<canvas>` → dataURL PNG, e então passar para `doc.addImage(...)`. Isso evita problemas de formato no build e funciona com o GIF original.

- Salvar logo em `src/assets/koe-logo.gif` (import como ES module).
- Helper `loadImageAsDataURL(src)` que retorna Promise<string> com PNG base64.

## Mudanças em `src/pages/Inventory.tsx` — função `exportPdf`

Tornar `exportPdf` async.

**Cabeçalho (em todas as páginas, via `didDrawPage`):**
- Logo KOE no canto superior esquerdo (~18mm × 18mm)
- Título "KOE Draft Tool Control — Inventory / Inventário" ao lado do logo
- Data de exportação (`dd/MM/yyyy HH:mm`) no canto superior direito
- Linha cinza separadora abaixo

**Rodapé (em todas as páginas, via `didDrawPage`):**
- Linha cinza separadora acima
- Centro: `Page X of Y / Página X de Y` (Y preenchido em segundo passo após `autoTable`, percorrendo `doc.internal.getNumberOfPages()`)
- Direita: "KOE Draft Tool Control"

**Ajustes de layout:**
- `margin: { top: 28, bottom: 16, left: 10, right: 10 }`
- `startY: 28`
- Manter orientação landscape

## Arquivos afetados

- `src/assets/koe-logo.gif` (novo — copiado do upload)
- `src/pages/Inventory.tsx` (apenas `exportPdf` + helper de imagem)
