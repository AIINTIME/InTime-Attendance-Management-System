const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const env = require("../config/env");
const { getLocalParts } = require("../utils/timezone");

const STATUS_LABELS = {
  ON_TIME: "On Time",
  SLIGHT_LATE: "Slight Late",
  VERY_LATE: "Very Late",
};

function formatMinutesAsHours(minutes) {
  if (minutes === null || minutes === undefined) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function statusLabel(record) {
  const parts = [STATUS_LABELS[record.latenessStatus] || record.latenessStatus];
  if (record.insufficientHours) parts.push("Insufficient Hours");
  return parts.join(" · ");
}

function formatHM(dateInput) {
  if (!dateInput) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: env.APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dateInput));
}

/**
 * "List of Logs"-style exports (spec: replicate a biometric-device period
 * report) always cover a bounded, contiguous day range so the grid has a
 * fixed number of day columns -- default to the current calendar month
 * (org timezone) when the admin didn't pick an explicit range.
 */
function resolvePeriod({ fromDate, toDate } = {}) {
  if (fromDate && toDate) return { fromDate, toDate };
  const { year, month } = getLocalParts(new Date());
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this one
  return {
    fromDate: fromDate || `${year}-${mm}-01`,
    toDate: toDate || `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function periodLabel({ fromDate, toDate }) {
  return `Period : ${fromDate.replace(/-/g, "/")} ~ ${toDate.slice(5).replace("-", "/")}`;
}

/** One entry per calendar day in [fromDate, toDate], inclusive. */
function buildDayColumns(fromDate, toDate) {
  const days = [];
  let cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  while (cursor <= end) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    days.push({ dayNum: cursor.getUTCDate(), key: `${y}-${m}-${d}` });
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return days;
}

/**
 * Groups attendance records by employee, one section per employee
 * (spec section 49) rather than one continuous mixed table.
 */
function groupByEmployee(records) {
  const groups = new Map();
  for (const record of records) {
    const employee = record.employeeId || {};
    const key = employee.id ? employee.id.toString() : "unknown";
    if (!groups.has(key)) {
      groups.set(key, { employee, records: [] });
    }
    groups.get(key).records.push(record);
  }
  return Array.from(groups.values()).sort((a, b) =>
    (a.employee.name || "").localeCompare(b.employee.name || "")
  );
}

/** Same grouping, but indexed by day-of-month for the "List of Logs" grid. */
function groupByEmployeeAndDay(records) {
  const groups = groupByEmployee(records);
  return groups.map((g) => {
    const byDay = new Map();
    for (const record of g.records) byDay.set(record.workingDateKey, record);
    return { employee: g.employee, byDay };
  });
}

async function generateExcelBuffer(records, period = {}) {
  const resolved = resolvePeriod(period);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "InTime Attendance Portal";
  workbook.created = new Date();

  addFlatDataSheet(workbook, records, resolved);
  addGridSheet(workbook, records, resolved);

  return workbook.xlsx.writeBuffer();
}

function addFlatDataSheet(workbook, records, period) {
  const sheet = workbook.addWorksheet("Attendance");
  const columns = [
    { header: "Employee ID", key: "employeeId", width: 14 },
    { header: "Employee Name", key: "name", width: 22 },
    { header: "Email", key: "email", width: 26 },
    { header: "Department", key: "department", width: 18 },
    { header: "Date", key: "date", width: 12 },
    { header: "Check-in Time", key: "checkIn", width: 14 },
    { header: "Check-out Time", key: "checkOut", width: 14 },
    { header: "Login Type", key: "loginType", width: 12 },
    { header: "Reason", key: "reason", width: 28 },
    { header: "Latitude", key: "latitude", width: 12 },
    { header: "Longitude", key: "longitude", width: 12 },
    { header: "Office Distance (m)", key: "officeDistance", width: 16 },
    { header: "Attendance Status", key: "status", width: 20 },
    { header: "Total Working Hours", key: "workingHours", width: 16 },
  ];
  sheet.columns = columns;

  // Title + period banner above the header row.
  sheet.spliceRows(1, 0, [], []);
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell(1, 1).value = "InTime Attendance Report";
  sheet.getCell(1, 1).font = { bold: true, size: 14 };
  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell(2, 1).value = periodLabel(period);
  sheet.getCell(2, 1).font = { italic: true, color: { argb: "FF64748B" } };

  const headerRow = sheet.getRow(3);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF6FD" } };

  for (const record of records) {
    const employee = record.employeeId || {};
    sheet.addRow({
      employeeId: employee.employeeId || "",
      name: employee.name || "",
      email: employee.email || "",
      department: employee.department || "",
      date: record.workingDateKey,
      checkIn: formatHM(record.checkInTime),
      checkOut: formatHM(record.checkOutTime),
      loginType: record.loginType,
      reason: record.reason || "",
      latitude: record.latitude,
      longitude: record.longitude,
      officeDistance: record.officeDistanceMeters ?? "",
      status: statusLabel(record),
      workingHours: formatMinutesAsHours(record.totalWorkingMinutes),
    });
  }
}

const GRID_BORDER = { style: "thin", color: { argb: "FF1B7A3D" } };
const GRID_BORDERS = { top: GRID_BORDER, left: GRID_BORDER, bottom: GRID_BORDER, right: GRID_BORDER };

/** "List of Logs" style grid: day-of-month columns, one block per employee. */
function addGridSheet(workbook, records, period) {
  const sheet = workbook.addWorksheet("List of Logs");
  const dayColumns = buildDayColumns(period.fromDate, period.toDate);
  const groups = groupByEmployeeAndDay(records);
  const numCols = dayColumns.length;

  sheet.columns = dayColumns.map(() => ({ width: 8 }));

  sheet.mergeCells(1, 1, 1, numCols);
  sheet.getCell(1, 1).value = "List of Logs";
  sheet.getCell(1, 1).font = { bold: true, size: 18, color: { argb: "FF0E7A3B" } };
  sheet.getCell(1, 1).alignment = { horizontal: "center" };

  sheet.mergeCells(2, 1, 2, numCols);
  sheet.getCell(2, 1).value = periodLabel(period);
  sheet.getCell(2, 1).font = { italic: true, color: { argb: "FF0E7A3B" } };

  let row = 4;

  function writeDayHeaderRow(r) {
    dayColumns.forEach((d, i) => {
      const cell = sheet.getCell(r, i + 1);
      cell.value = d.dayNum;
      cell.font = { bold: true, color: { argb: "FF1E3A8A" } };
      cell.alignment = { horizontal: "center" };
      cell.border = GRID_BORDERS;
    });
  }

  function writeNameBand(r, no, employee) {
    sheet.mergeCells(r, 1, r, Math.min(6, numCols));
    sheet.getCell(r, 1).value = `No : ${no}`;
    if (numCols > 6) {
      sheet.mergeCells(r, 7, r, Math.min(18, numCols));
      sheet.getCell(r, 7).value = `Name : ${(employee.name || "").toUpperCase()}`;
    }
    if (numCols > 18) {
      sheet.mergeCells(r, 19, r, numCols);
      sheet.getCell(r, 19).value = `Dept : ${employee.department || ""}`;
    }
    for (let c = 1; c <= numCols; c++) {
      const cell = sheet.getCell(r, c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22D3EE" } };
      cell.font = { bold: true, color: { argb: "FF0F172A" } };
      cell.border = GRID_BORDERS;
    }
  }

  function writeDataRow(r, byDay) {
    dayColumns.forEach((d, i) => {
      const cell = sheet.getCell(r, i + 1);
      const record = byDay.get(d.key);
      if (record) {
        const inT = formatHM(record.checkInTime);
        const outT = formatHM(record.checkOutTime);
        cell.value = outT ? `${inT}\n${outT}` : inT;
      }
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.font = { size: 9 };
      cell.border = GRID_BORDERS;
    });
    sheet.getRow(r).height = 26;
  }

  groups.forEach((group, index) => {
    writeDayHeaderRow(row);
    writeNameBand(row + 1, index + 1, group.employee);
    writeDataRow(row + 2, group.byDay);
    row += 4; // day row + band row + data row + 1 blank spacer row
  });

  if (groups.length === 0) {
    sheet.mergeCells(row, 1, row, numCols);
    sheet.getCell(row, 1).value = "No attendance records match the selected filters.";
    sheet.getCell(row, 1).font = { italic: true, color: { argb: "FF64748B" } };
  }
}

async function generatePdfBuffer(records, period = {}) {
  const resolved = resolvePeriod(period);
  const dayColumns = buildDayColumns(resolved.fromDate, resolved.toDate);
  const groups = groupByEmployeeAndDay(records);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 24, size: "A4", layout: "landscape" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const MARGIN = 24;
    const pageWidth = doc.page.width - MARGIN * 2;
    const colWidth = pageWidth / dayColumns.length;
    const dayHeaderH = 16;
    const bandH = 15;
    const dataRowH = 24;
    const blockH = dayHeaderH + bandH + dataRowH;
    const blockGap = 8;

    function drawFrame() {
      doc.lineWidth(1.4).rect(10, 10, doc.page.width - 20, doc.page.height - 20).stroke("#1B7A3D");
      doc.lineWidth(0.6).rect(14, 14, doc.page.width - 28, doc.page.height - 28).stroke("#1B7A3D");
    }

    drawFrame();
    doc.on("pageAdded", drawFrame);

    doc
      .font("Courier-Bold")
      .fontSize(20)
      .fillColor("#0E7A3B")
      .text("List of Logs", MARGIN, 22, { width: pageWidth, align: "center" });
    doc
      .font("Courier")
      .fontSize(10)
      .fillColor("#0E7A3B")
      .text(periodLabel(resolved), MARGIN, 50);

    let y = 74;

    function ensureSpace() {
      if (y + blockH > doc.page.height - MARGIN - 10) {
        doc.addPage();
        y = MARGIN + 10;
      }
    }

    function drawDayHeaderRow(topY) {
      doc.font("Courier-Bold").fontSize(6.5);
      dayColumns.forEach((d, i) => {
        const x = MARGIN + i * colWidth;
        doc.lineWidth(0.4).rect(x, topY, colWidth, dayHeaderH).stroke("#1B7A3D");
        doc.fillColor("#1E3A8A").text(String(d.dayNum), x, topY + 4, { width: colWidth, align: "center" });
      });
    }

    function drawNameBand(topY, no, employee) {
      doc
        .lineWidth(0.4)
        .rect(MARGIN, topY, pageWidth, bandH)
        .fillAndStroke("#22D3EE", "#1B7A3D");
      doc.font("Courier-Bold").fontSize(8).fillColor("#0F172A");
      doc.text(`No : ${no}`, MARGIN + 6, topY + 4, { width: 90, lineBreak: false });
      doc.text(`Name : ${truncate((employee.name || "").toUpperCase(), 28)}`, MARGIN + 140, topY + 4, {
        width: pageWidth - 300,
        lineBreak: false,
      });
      doc.text(`Dept : ${truncate(employee.department || "", 18)}`, MARGIN + pageWidth - 160, topY + 4, {
        width: 150,
        lineBreak: false,
      });
    }

    function drawDataRow(topY, byDay) {
      dayColumns.forEach((d, i) => {
        const x = MARGIN + i * colWidth;
        doc.lineWidth(0.4).rect(x, topY, colWidth, dataRowH).stroke("#1B7A3D");
        const record = byDay.get(d.key);
        if (record) {
          doc.font("Courier").fontSize(6).fillColor("#111827");
          doc.text(formatHM(record.checkInTime), x, topY + 3, { width: colWidth, align: "center", lineBreak: false });
          if (record.checkOutTime) {
            doc.text(formatHM(record.checkOutTime), x, topY + 13, {
              width: colWidth,
              align: "center",
              lineBreak: false,
            });
          }
        }
      });
    }

    groups.forEach((group, index) => {
      ensureSpace();
      drawDayHeaderRow(y);
      drawNameBand(y + dayHeaderH, index + 1, group.employee);
      drawDataRow(y + dayHeaderH + bandH, group.byDay);
      y += blockH + blockGap;
    });

    if (groups.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor("#64748B")
        .text("No attendance records match the selected filters.", MARGIN, y + 10);
    }

    doc.end();
  });
}

module.exports = { generateExcelBuffer, generatePdfBuffer, resolvePeriod };
