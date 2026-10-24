const CELL_RANGE = /^([A-Za-z]+)(\d+)?(?::([A-Za-z]+)(\d+)?)?$/;

export function extractSpreadsheetId(input: string) {
  const value = String(input || "").trim();
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return /^[a-zA-Z0-9-_]{20,}$/.test(value) ? value : "";
}

export function quoteSheetName(name: string) {
  return `'${name.replaceAll("'", "''")}'`;
}

function columnNumber(value: string) {
  return value.toUpperCase().split("").reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
}

function columnName(value: number) {
  let number = value;
  let result = "";
  while (number > 0) {
    number -= 1;
    result = String.fromCharCode(65 + (number % 26)) + result;
    number = Math.floor(number / 26);
  }
  return result;
}

export function buildPreviewRange(sheet: string, requestedRange: string, headerRow: boolean) {
  const withoutSheet = (requestedRange || "A:AX").split("!").at(-1)?.trim() || "A:AX";
  const match = withoutSheet.match(CELL_RANGE);
  if (!match) throw new Error("数据范围格式无效，请使用 A:Z 或 A1:Z5000 形式");

  const startColumn = columnNumber(match[1]);
  const requestedEndColumn = columnNumber(match[3] || match[1]);
  if (startColumn <= 0 || requestedEndColumn < startColumn) throw new Error("数据范围的结束列必须晚于开始列");

  const endColumn = Math.min(requestedEndColumn, startColumn + 49);
  const startRow = Number(match[2] || 1);
  const requestedEndRow = match[4] ? Number(match[4]) : Number.POSITIVE_INFINITY;
  if (!Number.isSafeInteger(startRow) || startRow < 1 || requestedEndRow < startRow) {
    throw new Error("数据范围的行号无效");
  }
  const rowLimit = headerRow ? 101 : 100;
  const endRow = Math.min(requestedEndRow, startRow + rowLimit - 1);

  return `${quoteSheetName(sheet)}!${columnName(startColumn)}${startRow}:${columnName(endColumn)}${endRow}`;
}

export function generatedColumnName(index: number) {
  return columnName(index + 1);
}
