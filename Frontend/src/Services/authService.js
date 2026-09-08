import api from "./api";

export async function employeeLogin(email, password) {
  const { data } = await api.post("/auth/employee/login", { email, password });
  return data.data.user;
}

export async function adminLogin(email, password) {
  const { data } = await api.post("/auth/admin/login", { email, password });
  return data.data.user;
}

export async function logout() {
  await api.post("/auth/logout");
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data.data.user;
}
