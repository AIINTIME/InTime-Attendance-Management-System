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
