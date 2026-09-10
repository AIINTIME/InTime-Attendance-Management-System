import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import api from "./api";

/**
 * WebAuthn's Credential Management API is only exposed to the page at all
 * in a secure context (https://, or the special-cased http://localhost).
 * On an insecure origin -- e.g. a plain http://<lan-ip>:5173 -- every
 * browser (including a fully up-to-date Chrome on Android) simply leaves
 * `window.PublicKeyCredential` undefined, which is indistinguishable from
 * "unsupported browser" unless we check `isSecureContext` separately. This
 * is by far the most common cause of a false "not supported" report.
 */
export function getWebAuthnStatus() {
  if (typeof window === "undefined") {
    return { supported: false, reason: "unavailable" };
  }
  if (!window.isSecureContext) {
    return { supported: false, reason: "insecure-context" };
  }
  if (window.PublicKeyCredential === undefined) {
    return { supported: false, reason: "unsupported-browser" };
  }
  return { supported: true, reason: null };
}

export function isWebAuthnSupported() {
  return getWebAuthnStatus().supported;
}

export function webAuthnUnavailableMessage() {
  const { reason } = getWebAuthnStatus();
  if (reason === "insecure-context") {
    return `Passkeys need a secure connection, and this page is loaded over an insecure address (${window.location.origin}). Open the app using its HTTPS link instead of a plain http:// LAN address -- a LAN IP over http:// can never support passkeys, in any browser.`;
  }
  return "This browser doesn't support passkeys. Try the latest version of Chrome, Safari, Edge, or Firefox.";
}

/**
 * WebAuthn's "relying party ID" must be a real, registrable domain -- an
 * IP address (e.g. https://192.168.1.23) is never accepted, even over a
 * fully trusted HTTPS connection with a valid certificate. Browsers throw
 * a SecurityError for this specific case, which we turn into an actionable
 * message instead of a generic "verification failed".
 */
function isIpAddressHost() {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname);
}

function describeCeremonyError(err) {
  if (err.name === "PasskeyCeremonyTimeout") {
    return err.message;
  }
  if (err.name === "SecurityError" && isIpAddressHost()) {
    return `Passkeys can't be tied to an IP address (${window.location.hostname}) -- this is a hard rule in the WebAuthn standard, not something a certificate can fix. Use a real hostname instead: either the HTTPS tunnel link, or a hostname that resolves to this device (e.g. via your router's local DNS or a service like nip.io).`;
  }
  if (err.name === "SecurityError") {
    return "Passkeys are blocked on this address for security reasons (the domain doesn't match what this account's passkey was registered for).";
  }
  // Surface the raw browser error rather than a generic message, so a
  // fresh failure mode isn't silently hidden the next time something breaks.
  return `Passkey ceremony failed: ${err.name || "Error"}${err.message ? ` -- ${err.message}` : ""}`;
}

// The browser's own WebAuthn UI can occasionally get stuck with no visible
// prompt at all -- most commonly a leftover pending request from an earlier
// attempt in the same tab (e.g. after several hot-reloads during dev, or a
// component unmounting mid-ceremony) blocking the next one silently. There's
// no public API to cancel/abort it from here, so this timeout at least stops
// the UI from waiting forever with no feedback and tells the user the one
// thing that reliably clears it: reload the page.
const CEREMONY_TIMEOUT_MS = 65000;

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const timeoutError = new Error(
        "Your device didn't respond to the passkey prompt in time. If no fingerprint/Face ID/PIN dialog appeared at all, reload this page and try again -- a stuck request from an earlier attempt can silently block new ones."
      );
      timeoutError.name = "PasskeyCeremonyTimeout";
      reject(timeoutError);
    }, CEREMONY_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function guessDeviceNickname() {
  const ua = navigator.userAgent || "";
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return "Android device";
  if (/mac os/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows PC";
  return "My device";
}

/**
 * Registers a new passkey for the currently logged-in employee.
 * Throws a friendly error on cancellation/unsupported device.
 */
export async function registerPasskey(nickname) {
  if (!isWebAuthnSupported()) {
    throw new Error(webAuthnUnavailableMessage());
  }

  const { data: optionsResponse } = await api.post("/passkeys/register/options");
  const options = optionsResponse.data;

  let attestation;
  try {
    attestation = await withTimeout(startRegistration({ optionsJSON: options }));
  } catch (err) {
    if (err.name === "InvalidStateError") {
      throw new Error("A passkey is already registered on this device.");
    }
    if (err.name === "NotAllowedError") {
      throw new Error("Passkey registration was cancelled.");
    }
    throw new Error(describeCeremonyError(err));
  }

  await api.post("/passkeys/register/verify", { response: attestation, nickname });
  return true;
}

/**
 * Verifies the employee's identity via passkey. Returns a short-lived
 * ticket that must be attached to the following attendance request.
 */
export async function verifyPasskey() {
  if (!isWebAuthnSupported()) {
    throw new Error(webAuthnUnavailableMessage());
  }

  const { data: optionsResponse } = await api.post("/passkeys/auth/options");
  const options = optionsResponse.data;

  let assertion;
  try {
    assertion = await withTimeout(startAuthentication({ optionsJSON: options }));
  } catch (err) {
    if (err.name === "NotAllowedError") {
      throw new Error("Passkey verification was cancelled.");
    }
    throw new Error(describeCeremonyError(err));
  }

  const { data } = await api.post("/passkeys/auth/verify", { response: assertion });
  return data.data.passkeyTicket;
}

export async function listPasskeys() {
  const { data } = await api.get("/passkeys");
  return data.data;
}

export async function deletePasskey(id) {
  const { data } = await api.delete(`/passkeys/${id}`);
  return data.data;
}
