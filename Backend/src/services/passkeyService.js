const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const env = require("../config/env");
const prisma = require("../config/prisma");
const { ApiError } = require("../middleware/errorMiddleware");

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // options must be consumed within 5 minutes

function toUint8Array(base64url) {
  return new Uint8Array(Buffer.from(base64url, "base64url"));
}

function fromUint8Array(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

/**
 * generateRegistrationOptions/generateAuthenticationOptions each need ONE
 * concrete rp.id -- unlike verify*Response, they don't accept a list. It
 * must exactly match the hostname the browser is actually running on, or
 * the browser rejects the ceremony with a SecurityError (rp.id must be a
 * registrable domain suffix of the current origin). WEBAUTHN_RP_ID can
 * list several allowed hostnames (localhost, a LAN hostname, a tunnel
 * domain) for different ways of reaching the app during development, so
 * we pick the one matching the request's actual Origin header rather than
 * always defaulting to the first configured entry.
 */
function isAllowedTunnelHostname(hostname) {
  if (!hostname) return false;
  return (
    hostname.endsWith(".trycloudflare.com") ||
    hostname.endsWith(".ngrok-free.app") ||
    hostname.endsWith(".ngrok.io") ||
    hostname.endsWith(".nip.io") ||
    hostname === "localhost"
  );
}

function resolveRpId(origin) {
  if (origin) {
    try {
      const hostname = new URL(origin).hostname;
      if (env.WEBAUTHN_RP_ID.includes(hostname)) {
        return hostname;
      }
      if (env.NODE_ENV !== "production" && isAllowedTunnelHostname(hostname)) {
        return hostname;
      }
    } catch (err) {
      // Malformed Origin header -- fall through to the default below.
    }
  }
  return env.WEBAUTHN_RP_ID[0];
}

function getExpectedOrigins(origin) {
  const list = [...env.WEBAUTHN_ORIGIN];
  if (origin && env.NODE_ENV !== "production") {
    try {
      const hostname = new URL(origin).hostname;
      if (isAllowedTunnelHostname(hostname) && !list.includes(origin)) {
        list.push(origin);
      }
    } catch (_) {}
  }
  return list;
}

function getExpectedRpIds(origin) {
  const list = [...env.WEBAUTHN_RP_ID];
  if (origin && env.NODE_ENV !== "production") {
    try {
      const hostname = new URL(origin).hostname;
      if (isAllowedTunnelHostname(hostname) && !list.includes(hostname)) {
        list.push(hostname);
      }
    } catch (_) {}
  }
  return list;
}

async function saveChallenge(employeeId, challenge) {
  await prisma.employee.update({
    where: { id: employeeId },
    data: { currentChallenge: challenge, currentChallengeAt: new Date() },
  });
}

async function consumeChallenge(employeeId) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || !employee.currentChallenge) {
    throw new ApiError(400, "No pending passkey request found. Please try again.", "NO_CHALLENGE");
  }
  const age = Date.now() - new Date(employee.currentChallengeAt).getTime();
  if (age > CHALLENGE_TTL_MS) {
    await prisma.employee.update({
      where: { id: employeeId },
      data: { currentChallenge: null, currentChallengeAt: null },
    });
    throw new ApiError(400, "This passkey request expired. Please try again.", "CHALLENGE_EXPIRED");
  }
  const { currentChallenge } = employee;
  await prisma.employee.update({
    where: { id: employeeId },
    data: { currentChallenge: null, currentChallengeAt: null },
  });
  return currentChallenge;
}

const MAX_CREDENTIALS_PER_EMPLOYEE = 2;

async function getRegistrationOptions(employee, origin) {
  const existingCredentials = await prisma.passkeyCredential.findMany({ where: { employeeId: employee.id } });

  if (existingCredentials.length >= MAX_CREDENTIALS_PER_EMPLOYEE) {
    throw new ApiError(
      409,
      `You can only register up to ${MAX_CREDENTIALS_PER_EMPLOYEE} passkey devices. Remove one before adding another.`,
      "PASSKEY_LIMIT_REACHED"
    );
  }

  const options = await generateRegistrationOptions({
    rpName: env.WEBAUTHN_RP_NAME,
    rpID: resolveRpId(origin),
    userName: employee.email,
    userDisplayName: employee.name,
    userID: new Uint8Array(Buffer.from(employee.id.toString())),
    attestationType: "none",
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports,
    })),
    // No authenticatorAttachment restriction: forcing "platform" makes the
    // browser refuse to show any UI at all on devices with no built-in
    // biometric reader configured (many Windows laptops without Windows
    // Hello, some Macs) -- it fails silently before the popup ever opens.
    // Leaving it unset lets the browser also offer security keys and
    // cross-device ("use your phone") passkeys as a fallback.
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await saveChallenge(employee.id, options.challenge);
  return options;
}

async function verifyRegistration(employee, response, nickname, origin) {
  const expectedChallenge = await consumeChallenge(employee.id);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getExpectedOrigins(origin),
      expectedRPID: getExpectedRpIds(origin),
    });
  } catch (err) {
    throw new ApiError(422, "Passkey registration could not be verified.", "PASSKEY_VERIFY_FAILED");
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw new ApiError(422, "Passkey registration could not be verified.", "PASSKEY_VERIFY_FAILED");
  }

  const {
    credentialID,
    credentialPublicKey,
    counter,
    credentialDeviceType,
    credentialBackedUp,
  } = verification.registrationInfo;

  await prisma.passkeyCredential.create({
    data: {
      employeeId: employee.id,
      credentialId: credentialID,
      publicKey: fromUint8Array(credentialPublicKey),
      counter,
      transports: response?.response?.transports || [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      nickname: nickname || "",
      lastUsedAt: new Date(),
    },
  });

  await prisma.employee.update({ where: { id: employee.id }, data: { passkeyRegistered: true } });

  return true;
}

async function getAuthenticationOptions(employee, origin) {
  const credentials = await prisma.passkeyCredential.findMany({ where: { employeeId: employee.id } });
  if (credentials.length === 0) {
    throw new ApiError(
      400,
      "No passkey is registered for this account yet. Please register a passkey first.",
      "NO_PASSKEY_REGISTERED"
    );
  }

  const options = await generateAuthenticationOptions({
    rpID: resolveRpId(origin),
    allowCredentials: credentials.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports,
    })),
    userVerification: "preferred",
  });

  await saveChallenge(employee.id, options.challenge);
  return options;
}

async function verifyAuthentication(employee, response, origin) {
  const expectedChallenge = await consumeChallenge(employee.id);

  const credential = await prisma.passkeyCredential.findFirst({
    where: { employeeId: employee.id, credentialId: response.id },
  });

  if (!credential) {
    throw new ApiError(422, "This passkey is not recognized for this account.", "PASSKEY_UNKNOWN");
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getExpectedOrigins(origin),
      expectedRPID: getExpectedRpIds(origin),
      authenticator: {
        credentialID: credential.credentialId,
        credentialPublicKey: toUint8Array(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports,
      },
    });
  } catch (err) {
    throw new ApiError(422, "Passkey verification failed.", "PASSKEY_VERIFY_FAILED");
  }

  if (!verification.verified) {
    throw new ApiError(422, "Passkey verification failed.", "PASSKEY_VERIFY_FAILED");
  }

  await prisma.passkeyCredential.update({
    where: { id: credential.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  return true;
}

async function deleteCredential(employee, credentialId) {
  const credential = await prisma.passkeyCredential.findFirst({
    where: { id: credentialId, employeeId: employee.id },
  });
  if (!credential) {
    throw new ApiError(404, "Passkey not found.", "PASSKEY_NOT_FOUND");
  }

  await prisma.passkeyCredential.delete({ where: { id: credential.id } });

  const remaining = await prisma.passkeyCredential.count({ where: { employeeId: employee.id } });
  if (remaining === 0) {
    await prisma.employee.update({ where: { id: employee.id }, data: { passkeyRegistered: false } });
  }

  return { passkeyRegistered: remaining > 0 };
}

module.exports = {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
  deleteCredential,
};
