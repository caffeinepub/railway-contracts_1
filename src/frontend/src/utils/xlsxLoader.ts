/**
 * Lazy XLSX loader – loads the `xlsx` library from CDN on first use.
 * This avoids needing xlsx in package.json while still supporting full
 * spreadsheet parsing in the browser.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XLSXLib = ReturnType<() => Record<string, unknown>>;

let xlsxPromise: Promise<XLSXLib> | null = null;

function loadXLSX(): Promise<XLSXLib> {
  if (xlsxPromise) return xlsxPromise;

  xlsxPromise = new Promise((resolve, reject) => {
    const win = window as unknown as Record<string, unknown>;
    // Check if already loaded (e.g. via a previous call)
    if (win.XLSX) {
      resolve(win.XLSX as XLSXLib);
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => {
      const lib = (window as unknown as Record<string, unknown>).XLSX;
      if (lib) {
        resolve(lib as XLSXLib);
      } else {
        reject(new Error("XLSX library failed to initialise"));
      }
    };
    script.onerror = () => {
      xlsxPromise = null; // allow retry
      reject(new Error("Failed to load XLSX library from CDN"));
    };
    document.head.appendChild(script);
  });

  return xlsxPromise;
}

export type SpreadsheetData = {
  headers: string[];
  rows: (string | number | boolean | null)[][];
};

async function parseBuffer(buffer: ArrayBuffer): Promise<SpreadsheetData> {
  const XLSX = await loadXLSX();
  const data = new Uint8Array(buffer);
  const workbook = (
    XLSX as {
      read: (
        data: Uint8Array,
        opts: { type: string },
      ) => { SheetNames: string[]; Sheets: Record<string, unknown> };
    }
  ).read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const utils = (
    XLSX as {
      utils: {
        sheet_to_json: (
          ws: unknown,
          opts: { header: number; defval: null },
        ) => (string | number | boolean | null)[][];
      };
    }
  ).utils;
  const jsonData = utils.sheet_to_json(worksheet, { header: 1, defval: null });

  if (jsonData.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = (jsonData[0] as (string | number | boolean | null)[]).map(
    (h) => (h != null ? String(h) : ""),
  );
  const rows = jsonData.slice(1) as (string | number | boolean | null)[][];
  return { headers, rows };
}

export async function parseXlsxFile(file: File): Promise<SpreadsheetData> {
  const buffer = await file.arrayBuffer();
  return parseBuffer(buffer);
}

export async function parseXlsxFromUrl(url: string): Promise<SpreadsheetData> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return parseBuffer(buffer);
}

const AMOUNT_KEYWORDS = [
  "amount",
  "total",
  "cost",
  "expense",
  "rate",
  "price",
  "value",
  "rupee",
];

/** Returns index of the best "amount" column, or -1 if none found */
export function findPrimaryAmountColumnIndex(headers: string[]): number {
  for (const keyword of AMOUNT_KEYWORDS) {
    const idx = headers.findIndex((h) => h.toLowerCase().includes(keyword));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Returns array of numbers (sum) or null (non-numeric column) for each column */
export function computeColumnTotals(data: SpreadsheetData): (number | null)[] {
  if (data.headers.length === 0) return [];

  return data.headers.map((_, colIdx) => {
    let hasNumeric = false;
    let sum = 0;
    for (const row of data.rows) {
      const cell = row[colIdx];
      if (cell !== null && cell !== undefined && cell !== "") {
        const num = typeof cell === "number" ? cell : Number(cell);
        if (!Number.isNaN(num)) {
          sum += num;
          hasNumeric = true;
        }
      }
    }
    return hasNumeric ? sum : null;
  });
}
