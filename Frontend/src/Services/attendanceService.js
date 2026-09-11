import api from "./api";

export async function registerOfficeAttendance({ latitude, longitude, accuracy, passkeyTicket }) {
  const { data } = await api.post("/attendance/office", {
    latitude,
    longitude,
    accuracy,
    passkeyTicket,
  });
  return data.data.attendance;
}

export async function registerDistanceAttendance({
  latitude,
  longitude,
  accuracy,
  reason,
  passkeyTicket,
}) {
  const { data } = await api.post("/attendance/distance", {
    latitude,
    longitude,
    accuracy,
    reason,
    passkeyTicket,
  });
  return data.data.attendance;
}

export async function checkOutAttendance(payload) {
  const body = typeof payload === "string" ? { passkeyTicket: payload } : payload;
  const { data } = await api.post("/attendance/checkout", body);
  return data.data.attendance;
}

export async function getTodayAttendance() {
  const { data } = await api.get("/attendance/today");
  return data.data.attendance;
}

export async function getMyRecords(params = {}) {
  const { data } = await api.get("/attendance/my-records", { params });
  return data.data;
}

// Real working-day count for a calendar month (Sundays excluded, admin-
// configured half-day Saturdays counted as 0.5) -- backend-authoritative
// since it depends on OrgSettings.halfDayRules.
export async function getWorkingDays(year, month) {
  const { data } = await api.get("/attendance/working-days", { params: { year, month } });
  return data.data;
}

export async function getEmployeeSettings() {
  const { data } = await api.get("/employees/settings");
  return data.data.settings;
}
