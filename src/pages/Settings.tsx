import { useRef, useMemo, useState, useEffect } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Download, Upload, Moon, Sun, Trash2, FileSpreadsheet } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { exportDbBytes, importDbBytes, all, run } from "@/lib/db";
import { useDb } from "@/hooks/useDb";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const Settings = () => {
  const { theme, toggle } = useTheme();
  const { bump, version } = useDb();
  const inputRef = useRef<HTMLInputElement>(null);
  const excelRef = useRef<HTMLInputElement>(null);

  const savedOverdue = useMemo(() => {
    void version;
    const row = all<{ value: string | null }>("SELECT value FROM settings WHERE key = 'overdue_days'");
    return row.length > 0 && row[0].value ? row[0].value : "20";
  }, [version]);
  const [overdueDays, setOverdueDays] = useState(savedOverdue);
  useEffect(() => setOverdueDays(savedOverdue), [savedOverdue]);

  const saveOverdue = () => {
    const v = parseInt(overdueDays, 10);
    if (isNaN(v) || v < 1) return;
    run("INSERT OR REPLACE INTO settings (key, value) VALUES ('overdue_days', ?)", [String(v)]);
    bump();
    toast.success("Saved / Salvo");
  };

  const exportDb = () => {
    const bytes = exportDbBytes();
    if (!bytes) return;
    const blob = new Blob([bytes as BlobPart], { type: "application/x-sqlite3" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tool-control-${new Date().toISOString().slice(0, 10)}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup exported / Backup exportado");
  };

  const importDb = async (file: File) => {
    const buf = await file.arrayBuffer();
    await importDbBytes(new Uint8Array(buf));
    bump();
    toast.success("Backup imported / Backup importado");
  };

  const clearInventory = () => {
    if (!confirm("Are you sure you want to delete ALL tools? This cannot be undone!\n\nTem certeza que deseja apagar TODAS as ferramentas? Isso não pode ser desfeito!")) {
      return;
    }
    run("DELETE FROM tools");
    bump();
    toast.success("Inventory cleared / Inventário limpo");
  };

  const importExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      // Lê forçando as chaves a serem as letras das colunas: A, B, C, D, E, F, G, H...
      const data = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheetName], { header: "A", defval: "" });

      if (!data.length) {
        toast.error("Empty file / Arquivo vazio");
        return;
      }

      let importedCount = 0;
      
      // Get max existing code for sequence
      const existing = all<{ code: string }>("SELECT code FROM tools WHERE code GLOB '[0-9][0-9][0-9][0-9]' ORDER BY code DESC LIMIT 1");
      let nextNum = existing.length > 0 ? parseInt(existing[0].code, 10) + 1 : 1;

      const normalizeStr = (s: any) => {
        if (!s) return "";
        return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      };

      data.forEach((item: any, index: number) => {
        // Pula a primeira linha se for o cabeçalho
        if (index === 0 && (normalizeStr(item["A"]).includes("cod") || normalizeStr(item["B"]).includes("nome"))) {
          return;
        }

        const name = item["B"]; // Coluna B = NOME
        if (!name || String(name).trim() === "") return;

        let code = item["A"]; // Coluna A = Código
        if (code && String(code).trim() !== "") {
          code = String(code).padStart(4, "0");
        } else {
          code = String(nextNum).padStart(4, "0");
          nextNum++;
        }

        const brand = item["C"]; // Coluna C = Marca
        const type = item["D"] || item["E"]; // Coluna D = Categoria / E = Tipo
        const model = ""; // Modelo não especificado
        const serial = item["F"]; // Coluna F = Serie/TAG
        let tag = item["F"];
        if (tag && String(tag).trim() !== "") tag = String(tag).padStart(4, "0");

        const qty = parseInt(item["I"]) || 1; // Fallback se tiver Qtd
        const val = parseFloat(item["J"]) || 0; // Fallback se tiver Valor
        
        const parseBool = (val: any) => {
          if (val === undefined || val === null || val === "") return 0;
          const str = normalizeStr(val);
          if (str === "0" || str.includes("nao") || str.includes("no") || str.includes("fals")) return 0;
          if (str.includes("sim") || str === "s" || str === "y" || str.includes("yes") || str.includes("tru") || str.includes("verdadeir") || str === "1" || str === "x") return 1;
          return 0;
        };

        // Solicitação específica do usuário: G = Inspeção, H = Calibração
        const inspRaw = item["G"];
        const calRaw = item["H"];
        
        const insp = parseBool(inspRaw);
        const cal = parseBool(calRaw);

        run(
          `INSERT INTO tools (id, code, name, brand, model, type, serial_tag, tag, status, quantity, value_eur, requires_calibration, requires_inspection)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [crypto.randomUUID(), String(code), String(name), brand, model, type, serial, tag, "available", qty, val, cal, insp]
        );
        importedCount++;
      });

      bump();
      toast.success(`${importedCount} items imported / itens importados`);
    } catch (err) {
      console.error(err);
      toast.error("Error importing file / Erro ao importar arquivo");
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <BiLabel en="Settings" pt="Configurações" />

      <Card className="p-4 space-y-4">
        <BiLabel en="Appearance" pt="Aparência" size="small" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <BiLabel en="Dark mode" pt="Modo escuro" size="small" />
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggle} />
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <BiLabel en="Overdue Alert" pt="Alerta de Atraso" size="small" />
        <div className="flex items-center gap-3">
          <BiLabel en="Days to flag overdue" pt="Dias para marcar como atrasada" size="small" className="flex-1" />
          <Input
            type="number"
            min={1}
            value={overdueDays}
            onChange={(e) => setOverdueDays(e.target.value)}
            className="w-20"
          />
          <Button size="sm" onClick={saveOverdue}>
            <BiLabel en="Save" pt="Salvar" size="small" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground italic">
          Cautelas open longer than this will be highlighted in red. <br />
          Cautelas abertas por mais tempo serão destacadas em vermelho.
        </p>
      </Card>

      <Card className="p-4 space-y-4">
        <BiLabel en="Database backup" pt="Backup do banco" size="small" />
        <div className="flex gap-2 flex-wrap">
          <Button onClick={exportDb} variant="outline">
            <Download />
            <BiLabel en="Export" pt="Exportar" size="small" />
          </Button>
          <Button onClick={() => inputRef.current?.click()} variant="outline">
            <Upload />
            <BiLabel en="Import" pt="Importar" size="small" />
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".sqlite,.db"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importDb(f);
              e.target.value = "";
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground italic">
          Data is stored locally in your browser. Export regularly. <br />
          Os dados são armazenados localmente no navegador. Exporte regularmente.
        </p>
      </Card>

      <Card className="p-4 space-y-4 border-destructive/20 bg-destructive/5">
        <BiLabel en="Danger Zone" pt="Zona de Perigo" size="small" className="text-destructive" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <BiLabel en="Clear Inventory" pt="Limpar Inventário" size="small" />
            <p className="text-xs text-muted-foreground">
              Delete all items from the tools table. <br />
              Apagar todos os itens da tabela de ferramentas.
            </p>
          </div>
          <Button variant="destructive" onClick={clearInventory} size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            <BiLabel en="Clear All" pt="Clear All" size="small" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 pt-4 border-t">
          <div>
            <BiLabel en="Import from Excel/CSV" pt="Importar de Excel/CSV" size="small" />
            <p className="text-xs text-muted-foreground">
              Import tools from an .xlsx or .csv file. <br />
              Importar ferramentas de um arquivo Excel ou CSV.
            </p>
          </div>
          <Button variant="outline" onClick={() => excelRef.current?.click()} size="sm">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            <BiLabel en="Select File" pt="Selecionar Arquivo" size="small" />
          </Button>
          <input
            ref={excelRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importExcel(f);
              e.target.value = "";
            }}
          />
        </div>
      </Card>
    </div>
  );
};

export default Settings;
