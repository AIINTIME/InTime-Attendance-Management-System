export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isStrongEnoughPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

export function extractErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  return error?.response?.data?.message || fallback;
}

export function extractErrorCode(error) {
  return error?.response?.data?.code || null;
}
