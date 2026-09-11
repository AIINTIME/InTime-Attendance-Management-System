// Prisma rows are plain objects with no Mongoose-style schema-level field
// hiding, so every place that sends an Employee/Admin row to the client
// must strip these fields explicitly.
function sanitizeEmployee(e) {
  if (!e) return e;
  const { passwordHash, currentChallenge, currentChallengeAt, ...rest } = e;
  return rest;
}

function sanitizeAdmin(a) {
  if (!a) return a;
  const { passwordHash, ...rest } = a;
  return rest;
}

module.exports = { sanitizeEmployee, sanitizeAdmin };
