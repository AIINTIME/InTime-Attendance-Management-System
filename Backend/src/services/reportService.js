const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

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

async function generateExcelBuffer(records) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "InTime Attendance Portal";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Attendance");

  sheet.columns = [
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

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEAF6FD" },
  };

  for (const record of records) {
    const employee = record.employeeId || {};
    sheet.addRow({
      employeeId: employee.employeeId || "",
      name: employee.name || "",
      email: employee.email || "",
      department: employee.department || "",
      date: record.workingDateKey,
      checkIn: record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : "",
      checkOut: record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString() : "",
      loginType: record.loginType,
      reason: record.reason || "",
      latitude: record.latitude,
      longitude: record.longitude,
      officeDistance: record.officeDistanceMeters ?? "",
      status: statusLabel(record),
      workingHours: formatMinutesAsHours(record.totalWorkingMinutes),
    });
  }

  return workbook.xlsx.writeBuffer();
}

/**
 * Groups attendance records by employee, one section/page per employee
 * (spec section 49) rather than one continuous mixed table.
 */
function groupByEmployee(records) {
  const groups = new Map();
  for (const record of records) {
    const employee = record.employeeId || {};
    const key = employee._id ? employee._id.toString() : "unknown";
    if (!groups.has(key)) {
      groups.set(key, { employee, records: [] });
    }
    groups.get(key).records.push(record);
  }
  return Array.from(groups.values());
}

async function generatePdfBuffer(records) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const groups = groupByEmployee(records);

    groups.forEach((group, index) => {
      if (index > 0) doc.addPage();

      const employee = group.employee;
      doc
        .fontSize(16)
        .fillColor("#0F172A")
        .text(employee.name || "Unknown Employee", { continued: false });
      doc
        .fontSize(10)
        .fillColor("#64748B")
        .text(
          `${employee.employeeId || ""}  ·  ${employee.department || ""}  ·  ${employee.email || ""}`
        );
      doc.moveDown(1);

      const colX = [40, 110, 175, 240, 310, 460];
      const headers = ["Date", "Check-in", "Check-out", "Type", "Hours", "Status"];
      const headerY = doc.y;
      doc.fontSize(9).fillColor("#0F172A");
      headers.forEach((h, i) => doc.text(h, colX[i], headerY, { width: colX[i + 1] ? colX[i + 1] - colX[i] : 140 }));
      doc.moveDown(0.5);
      doc
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .strokeColor("#E2E8F0")
        .stroke();
      doc.moveDown(0.3);

      doc.fontSize(9).fillColor("#334155");
      group.records
        .sort((a, b) => (a.workingDateKey < b.workingDateKey ? 1 : -1))
        .forEach((record) => {
          const rowY = doc.y;
          const checkIn = record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : "-";
          const checkOut = record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString() : "-";
          const row = [
            record.workingDateKey,
            checkIn,
            checkOut,
            record.loginType,
            formatMinutesAsHours(record.totalWorkingMinutes) || "-",
            statusLabel(record),
          ];
          row.forEach((cell, i) =>
            doc.text(String(cell), colX[i], rowY, { width: colX[i + 1] ? colX[i + 1] - colX[i] : 140 })
          );
          doc.moveDown(0.6);

          if (doc.y > 760) {
            doc.addPage();
            doc.fontSize(9);
          }
        });
    });

    if (groups.length === 0) {
      doc.fontSize(13).fillColor("#64748B").text("No attendance records match the selected filters.");
    }

    doc.end();
  });
}

module.exports = { generateExcelBuffer, generatePdfBuffer };
