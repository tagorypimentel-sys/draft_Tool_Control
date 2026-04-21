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
      const data = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheetName]);

      if (!data.length) {
        toast.error("Empty file / Arquivo vazio");
        return;
      }

      // Simple column mapper
      const map = (item: any, options: string[]) => {
        const key = Object.keys(item).find(k => 
          options.some(opt => k.toLowerCase().trim().includes(opt.toLowerCase()))
        );
        return key ? item[key] : null;
      };

      let importedCount = 0;
      data.forEach((item: any) => {
        const name = map(item, ["Nome", "Name", "Descrição", "Description"]);
        if (!name) return; // Skip items without name

        const code = map(item, ["Código", "Code", "ID"]) || String(Date.now() + importedCount).slice(-5);
        const brand = map(item, ["Marca", "Brand", "Fabricante"]);
        const model = map(item, ["Modelo", "Model"]);
        const type = map(item, ["Tipo", "Type", "Categoria"]);
        const serial = map(item, ["Série", "Serial", "S/N"]);
        const tag = map(item, ["TAG"]);
        const qty = parseInt(map(item, ["Quantidade", "Qty", "Qtd", "Quantity"])) || 1;
        const val = parseFloat(map(item, ["Valor", "Value", "Price", "Preço"])) || 0;
        const cal = map(item, ["Calibração", "Calibration", "Exige"]) ? 1 : 0;
        const insp = map(item, ["Inspeção", "Inspection"]) ? 1 : 0;

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
