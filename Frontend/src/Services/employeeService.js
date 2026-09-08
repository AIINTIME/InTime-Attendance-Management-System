import api from "./api";

export async function getMyProfile() {
  const { data } = await api.get("/employees/me");
  return data.data.user;
}

export async function updateMyProfile(payload) {
  const { data } = await api.put("/employees/me", payload);
  return data.data.user;
}

export async function changeMyPassword(payload) {
  await api.post("/employees/me/change-password", payload);
}

export async function uploadMyProfilePhoto(file) {
  const formData = new FormData();
  formData.append("photo", file);
  const { data } = await api.post("/employees/me/profile-photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data.profilePhoto;
}
