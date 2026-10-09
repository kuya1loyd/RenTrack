type SpreadsheetSheet = {
  name: string;
  rows: Array<Array<string | number | null | undefined>>;
};

function downloadBlob(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character] || character);
}

/** Creates an Excel-readable SpreadsheetML workbook without a runtime dependency. */
export function downloadExcelReport(filename: string, sheets: SpreadsheetSheet[]) {
  const worksheetXml = sheets.map((sheet, index) => {
    const rows = sheet.rows.map((row) => `<Row>${row.map((value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
      }
      return `<Cell><Data ss:Type="String">${escapeXml(String(value ?? ""))}</Data></Cell>`;
    }).join("")}</Row>`).join("");
    const sheetName = escapeXml(sheet.name.slice(0, 31) || `Sheet${index + 1}`);
    return `<Worksheet ss:Name="${sheetName}"><Table>${rows}</Table></Worksheet>`;
  }).join("");
  const workbook = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${worksheetXml}</Workbook>`;
  downloadBlob(filename, workbook, "application/vnd.ms-excel;charset=utf-8");
}

function pdfSafeText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Builds a small text PDF report using the built-in Helvetica font. */
export function downloadPdfReport(filename: string, title: string, lines: string[]) {
  const reportLines = [title, `Generated ${new Date().toLocaleString()}`, "", ...lines];
  const chunks: string[][] = [];
  for (let index = 0; index < reportLines.length; index += 44) chunks.push(reportLines.slice(index, index + 44));
  if (!chunks.length) chunks.push([title]);

  const pageIds = chunks.map((_, index) => 3 + index * 2);
  const fontId = 3 + chunks.length * 2;
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${chunks.length} >>`;
  chunks.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const streamId = pageId + 1;
    const textCommands = pageLines.map((line, lineIndex) => `(${pdfSafeText(line.slice(0, 112))}) Tj${lineIndex < pageLines.length - 1 ? " T*" : ""}`).join("\n");
    const stream = `BT\n/F1 10 Tf\n50 790 Td\n14 TL\n${textCommands}\nET`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  downloadBlob(filename, pdf, "application/pdf");
}
