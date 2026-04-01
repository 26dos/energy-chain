import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = path.join(__dirname, "../docs/有功功率数据.xlsx");

/**
 * Reads the active power xlsx and returns an array of standardised records.
 * Each record: { meter, time, value }
 * The xlsx has 3 meter groups per row: (time, meter_id, value) × 3
 */
export function parseXlsx() {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    for (let col = 0; col < 9; col += 3) {
      const time = row[col];
      const meter = row[col + 1];
      const value = row[col + 2];
      if (time != null && meter != null && value != null) {
        records.push({
          meter: String(meter),
          time: String(time),
          value: String(value),
        });
      }
    }
  }
  return records;
}
