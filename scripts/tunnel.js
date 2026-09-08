const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const backendEnvPath = path.join(rootDir, "Backend", ".env");
const certPath = path.join(rootDir, "Frontend", ".cert", "cert.pem");
const keyPath = path.join(rootDir, "Frontend", ".cert", "key.pem");

function findCloudflared() {
  const candidates = [
    "cloudflared",
    "/opt/homebrew/bin/cloudflared",
    "/usr/local/bin/cloudflared",
  ];
  for (const bin of candidates) {
    try {
      execSync(`${bin} --version`, { stdio: "ignore" });
      return bin;
    } catch (_) {}
  }
  return null;
}

function updateBackendEnv(tunnelUrl) {
  if (!fs.existsSync(backendEnvPath) || !tunnelUrl) return;

  try {
    const urlObj = new URL(tunnelUrl);
    const domain = urlObj.hostname;
    let content = fs.readFileSync(backendEnvPath, "utf-8");

    // Update WEBAUTHN_RP_ID
    content = content.replace(/^WEBAUTHN_RP_ID=(.*)$/m, (match, val) => {
      const parts = val
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !s.includes("trycloudflare.com"));
      parts.push(domain);
      return `WEBAUTHN_RP_ID=${parts.join(",")}`;
    });

    // Update WEBAUTHN_ORIGIN
    content = content.replace(/^WEBAUTHN_ORIGIN=(.*)$/m, (match, val) => {
      const parts = val
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !s.includes("trycloudflare.com"));
      parts.push(tunnelUrl);
      return `WEBAUTHN_ORIGIN=${parts.join(",")}`;
    });

    fs.writeFileSync(backendEnvPath, content, "utf-8");
  } catch (err) {
    // Non-fatal if env update fails
    console.warn(`[TUNNEL] Note: could not update Backend/.env: ${err.message}`);
  }
}

function printBanner(tunnelUrl, localUrl) {
  console.log("\n" + "=".repeat(66));
  console.log("🚀  INTIME PHONE TUNNEL IS ACTIVE!");
  console.log(`📱  Phone / Remote Link : \x1b[36m\x1b[1m${tunnelUrl}\x1b[0m`);
  console.log(`💻  Local Web Link      : \x1b[32m${localUrl}\x1b[0m`);
  console.log("🔑  Logins              : employee@intime.local / Employee123!");
  console.log("                          admin@intime.local    / ChangeMe123!");
  console.log("=".repeat(66) + "\n");
}

function cleanupStaleTunnels() {
  try {
    // Kill any existing cloudflared processes running for localhost:5173
    execSync("pkill -f 'cloudflared tunnel.*5173'", { stdio: "ignore" });
  } catch (_) {}
}

function startTunnel() {
  const cloudflaredBin = findCloudflared();
  if (!cloudflaredBin) {
    console.warn("\x1b[33m%s\x1b[0m", "[TUNNEL] ⚠️  cloudflared is not installed on this system.");
    console.warn(
      "[TUNNEL] To enable automatic phone tunnels, install it with: brew install cloudflared"
    );
    console.warn("[TUNNEL] Continuing with Backend & Frontend...\n");
    // Keep alive so concurrently doesn't treat as process exit
    setInterval(() => {}, 60000);
    return;
  }

  cleanupStaleTunnels();

  const isHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);
  const localUrl = isHttps ? "https://localhost:5173" : "http://localhost:5173";
  const args = ["tunnel", "--url", localUrl];
  if (isHttps) {
    args.push("--no-tls-verify");
  }

  console.log(`[TUNNEL] Starting Cloudflare Tunnel for ${localUrl}...`);

  const tunnelProc = spawn(cloudflaredBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let tunnelUrl = null;
  let isShuttingDown = false;

  function handleData(data) {
    if (isShuttingDown) return;
    const text = data.toString();
    if (!tunnelUrl) {
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match) {
        tunnelUrl = match[0];
        updateBackendEnv(tunnelUrl);
        printBanner(tunnelUrl, localUrl);
      }
    }

    // Only forward notable errors or messages when active, suppress verbose ICMP/ping noise
    if (
      text.includes("ERR") ||
      text.includes("error") ||
      text.includes("Cannot determine default configuration path")
    ) {
      if (!text.includes("ICMP") && !text.includes("metrics") && !text.includes("datagram handler")) {
        process.stderr.write(`[TUNNEL] ${text}`);
      }
    }
  }

  tunnelProc.stdout.on("data", handleData);
  tunnelProc.stderr.on("data", handleData);

  tunnelProc.on("close", (code) => {
    if (!isShuttingDown && code !== 0 && code !== null) {
      console.log(`[TUNNEL] Process exited with code ${code}`);
    }
  });

  tunnelProc.on("error", (err) => {
    if (!isShuttingDown) {
      console.error(`[TUNNEL] Failed to start tunnel: ${err.message}`);
    }
  });

  const cleanup = () => {
    isShuttingDown = true;
    try {
      tunnelProc.kill("SIGTERM");
    } catch (_) {}
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", cleanup);
}

startTunnel();
