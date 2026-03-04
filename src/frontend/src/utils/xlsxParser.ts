/**
 * Minimal xlsx parser — no external dependencies.
 * Supports the common xlsx format (Office Open XML / OOXML).
 * Reads only the first sheet, returns headers + rows.
 */

export type SpreadsheetData = {
  headers: string[];
  rows: (string | number | boolean | null)[][];
};

// Unzip a zip buffer and return a map of filename -> string content
async function unzip(buffer: ArrayBuffer): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Find End of Central Directory
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("Not a valid ZIP file");

  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const centralDirSize = view.getUint32(eocdOffset + 12, true);

  let offset = centralDirOffset;
  while (offset < centralDirOffset + centralDirSize) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;

    const filenameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const compressionMethod = view.getUint16(offset + 10, true);

    const filenameBytes = bytes.slice(
      offset + 46,
      offset + 46 + filenameLength,
    );
    const filename = new TextDecoder().decode(filenameBytes);

    // Read local file header at localHeaderOffset
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const localFilenameLength = view.getUint16(localHeaderOffset + 26, true);
    const dataOffset =
      localHeaderOffset + 30 + localFilenameLength + localExtraLength;

    const compressedData = bytes.slice(dataOffset, dataOffset + compressedSize);

    if (compressionMethod === 0) {
      // Stored (no compression)
      result.set(filename, new TextDecoder().decode(compressedData));
    } else if (compressionMethod === 8) {
      // Deflate
      try {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();

        writer.write(compressedData);
        writer.close();

        const chunks: Uint8Array[] = [];
        let done = false;
        while (!done) {
          const { value, done: d } = await reader.read();
          if (value) chunks.push(value);
          done = d;
        }

        const total = chunks.reduce((s, c) => s + c.length, 0);
        const out = new Uint8Array(total);
        let pos = 0;
        for (const chunk of chunks) {
          out.set(chunk, pos);
          pos += chunk.length;
        }
        result.set(
          filename,
          new TextDecoder("utf-8", { fatal: false }).decode(out),
        );
      } catch {
        // Skip files that can't be decompressed
      }
    }

    offset += 46 + filenameLength + extraLength + commentLength;
  }

  return result;
}

// Parse XML string, returning a simple representation
function parseXml(xml: string): Element {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  return doc.documentElement;
}

// Parse shared strings
function parseSharedStrings(xml: string): string[] {
  const doc = parseXml(xml);
  const si = doc.getElementsByTagName("si");
  const result: string[] = [];
  for (let i = 0; i < si.length; i++) {
    const t = si[i].getElementsByTagName("t");
    let text = "";
    for (let j = 0; j < t.length; j++) {
      text += t[j].textContent ?? "";
    }
    result.push(text);
  }
  return result;
}

// Convert Excel column letter to 0-based index
function colLetterToIndex(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + col.charCodeAt(i) - 64;
  }
  return result - 1;
}

// Parse cell reference like "A1" -> { col: 0, row: 0 }
function parseCellRef(ref: string): { col: number; row: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { col: 0, row: 0 };
  return {
    col: colLetterToIndex(match[1]),
    row: Number.parseInt(match[2], 10) - 1,
  };
}

// Parse a worksheet XML
function parseSheet(xml: string, sharedStrings: string[]): SpreadsheetData {
  const doc = parseXml(xml);
  const rows = doc.getElementsByTagName("row");

  // First pass: determine grid size
  let maxCol = 0;
  let maxRow = 0;

  const cellData: Map<string, string | number | boolean | null> = new Map();

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const cells = row.getElementsByTagName("c");
    for (let ci = 0; ci < cells.length; ci++) {
      const cell = cells[ci];
      const ref = cell.getAttribute("r") ?? "";
      const type = cell.getAttribute("t") ?? "";
      const { col, row: rowIdx } = parseCellRef(ref);

      if (col > maxCol) maxCol = col;
      if (rowIdx > maxRow) maxRow = rowIdx;

      const vEl = cell.getElementsByTagName("v")[0];
      const v = vEl?.textContent ?? null;

      let value: string | number | boolean | null = null;

      if (v !== null) {
        if (type === "s") {
          // Shared string
          value = sharedStrings[Number.parseInt(v, 10)] ?? "";
        } else if (type === "b") {
          value = v === "1";
        } else if (type === "inlineStr") {
          const is = cell.getElementsByTagName("is")[0];
          value = is?.textContent ?? "";
        } else {
          // Number or date
          const num = Number.parseFloat(v);
          value = Number.isNaN(num) ? v : num;
        }
      }

      cellData.set(ref, value);
    }
  }

  if (maxRow === 0 && cellData.size === 0) {
    return { headers: [], rows: [] };
  }

  // Build 2D grid
  const grid: (string | number | boolean | null)[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const rowArr: (string | number | boolean | null)[] = [];
    for (let c = 0; c <= maxCol; c++) {
      // Build ref
      let col = "";
      let n = c + 1;
      while (n > 0) {
        col = String.fromCharCode(64 + (n % 26 || 26)) + col;
        n = Math.floor((n - 1) / 26);
      }
      const ref = `${col}${r + 1}`;
      rowArr.push(cellData.get(ref) ?? null);
    }
    grid.push(rowArr);
  }

  if (grid.length === 0) return { headers: [], rows: [] };

  const headers = grid[0].map((h) => (h != null ? String(h) : ""));
  const dataRows = grid.slice(1);

  return { headers, rows: dataRows };
}

export async function parseXlsxBuffer(
  buffer: ArrayBuffer,
): Promise<SpreadsheetData> {
  try {
    const files = await unzip(buffer);

    // Get shared strings
    const sharedStringsXml = files.get("xl/sharedStrings.xml") ?? "";
    const sharedStrings = sharedStringsXml
      ? parseSharedStrings(sharedStringsXml)
      : [];

    // Get workbook to find sheet order
    const workbookXml = files.get("xl/workbook.xml") ?? "";
    let sheetName = "xl/worksheets/sheet1.xml";

    if (workbookXml) {
      const wb = parseXml(workbookXml);
      const sheets = wb.getElementsByTagName("sheet");
      if (sheets.length > 0) {
        const sheetId = sheets[0].getAttribute("r:id") ?? "rId1";
        // Try to find the actual file via relationships
        const relsXml = files.get("xl/_rels/workbook.xml.rels") ?? "";
        if (relsXml) {
          const rels = parseXml(relsXml);
          const relationships = rels.getElementsByTagName("Relationship");
          for (let i = 0; i < relationships.length; i++) {
            const rel = relationships[i];
            if (rel.getAttribute("Id") === sheetId) {
              const target = rel.getAttribute("Target") ?? "";
              sheetName = target.startsWith("/")
                ? target.slice(1)
                : `xl/${target}`;
              break;
            }
          }
        }
      }
    }

    const sheetXml =
      files.get(sheetName) ?? files.get("xl/worksheets/sheet1.xml") ?? "";
    if (!sheetXml) return { headers: [], rows: [] };

    return parseSheet(sheetXml, sharedStrings);
  } catch (err) {
    console.error("xlsx parse error:", err);
    throw new Error("Failed to parse xlsx file");
  }
}

export async function parseXlsxFile(file: File): Promise<SpreadsheetData> {
  const buffer = await file.arrayBuffer();
  return parseXlsxBuffer(buffer);
}

export async function parseXlsxFromUrl(url: string): Promise<SpreadsheetData> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return parseXlsxBuffer(buffer);
}
