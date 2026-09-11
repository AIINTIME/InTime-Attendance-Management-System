const passkeyService = require("../services/passkeyService");
const { signPasskeyTicket } = require("../utils/jwt");
const prisma = require("../config/prisma");

async function registrationOptions(req, res, next) {
  try {
    const options = await passkeyService.getRegistrationOptions(req.employee, req.headers.origin);
    res.json({ success: true, message: "OK", data: options });
  } catch (err) {
    next(err);
  }
}

async function registrationVerify(req, res, next) {
  try {
    const { response, nickname } = req.body;
    await passkeyService.verifyRegistration(req.employee, response, nickname, req.headers.origin);
    res.json({ success: true, message: "Passkey registered successfully." });
  } catch (err) {
    next(err);
  }
}

async function authenticationOptions(req, res, next) {
  try {
    const options = await passkeyService.getAuthenticationOptions(req.employee, req.headers.origin);
    res.json({ success: true, message: "OK", data: options });
  } catch (err) {
    next(err);
  }
}

async function authenticationVerify(req, res, next) {
  try {
    const { response } = req.body;
    await passkeyService.verifyAuthentication(req.employee, response, req.headers.origin);
    // Short-lived ticket the client attaches to the attendance request that
    // follows, proving passkey verification actually happened server-side.
    const passkeyTicket = signPasskeyTicket(req.employee.id.toString());
    res.json({ success: true, message: "Identity verified", data: { passkeyTicket } });
  } catch (err) {
    next(err);
  }
}

async function listCredentials(req, res, next) {
  try {
    const credentials = await prisma.passkeyCredential.findMany({
      where: { employeeId: req.employee.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      success: true,
      message: "OK",
      data: credentials.map((c) => ({
        id: c.id,
        nickname: c.nickname,
        deviceType: c.deviceType,
        createdAt: c.createdAt,
        lastUsedAt: c.lastUsedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function deleteCredential(req, res, next) {
  try {
    const result = await passkeyService.deleteCredential(req.employee, req.params.id);
    res.json({ success: true, message: "Passkey removed.", data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registrationOptions,
  registrationVerify,
  authenticationOptions,
  authenticationVerify,
  listCredentials,
  deleteCredential,
};
