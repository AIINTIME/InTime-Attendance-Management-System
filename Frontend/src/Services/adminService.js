import api from "./api";

export async function updateAdminProfile(payload) {
  const { data } = await api.put("/admin/profile", payload);
  return data.data.user;
}

export async function changeAdminPassword(payload) {
  await api.post("/admin/profile/change-password", payload);
}

export async function uploadAdminProfilePhoto(file) {
  const formData = new FormData();
  formData.append("photo", file);
  const { data } = await api.post("/admin/profile/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data.profilePhoto;
}

export async function getDashboard() {
  const { data } = await api.get("/admin/dashboard");
  return data.data;
}

export async function listEmployees(params = {}) {
  const { data } = await api.get("/admin/employees", { params });
  return data.data;
}

export async function createEmployee(payload) {
  const { data } = await api.post("/admin/employees", payload);
  return data.data.employee;
}

export async function getEmployeeById(id) {
  const { data } = await api.get(`/admin/employees/${id}`);
  return data.data;
}

export async function updateEmployee(id, payload) {
  const { data } = await api.put(`/admin/employees/${id}`, payload);
  return data.data.employee;
}

export async function resetEmployeePassword(id, temporaryPassword) {
  await api.post(`/admin/employees/${id}/reset-password`, { temporaryPassword });
}

export async function setEmployeeStatus(id, isActive) {
  const { data } = await api.patch(`/admin/employees/${id}/status`, { isActive });
  return data.data.employee;
}

export async function getEmployeeAttendanceHistory(id, params = {}) {
  const { data } = await api.get(`/admin/employees/${id}/attendance`, { params });
  return data.data;
}

export async function listAttendance(params = {}) {
  const { data } = await api.get("/admin/attendance", { params });
  return data.data;
}

export async function previewReport(params = {}) {
  const { data } = await api.get("/reports/attendance", { params });
  return data.data;
}

export function buildExportUrl(kind, params = {}) {
  const search = new URLSearchParams(params).toString();
  const base = import.meta.env.VITE_API_URL || "/api";
  return `${base}/reports/attendance/${kind}${search ? `?${search}` : ""}`;
}
