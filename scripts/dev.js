// Runs Backend + Frontend + Phone Tunnel together for `npm run dev`.
// Forwards a trailing `--host` (from `npm run dev -- --host`) to Vite only.
// Add `--no-tunnel` to skip starting the Cloudflare tunnel.
const concurrently = require("concurrently");

const args = process.argv.slice(2);
const forwardHost = args.includes("--host");
const skipTunnel = args.includes("--no-tunnel");

const frontendCommand = forwardHost
  ? "npm run dev --prefix Frontend -- --host"
  : "npm run dev --prefix Frontend";

const commands = [
  { command: "npm run dev --prefix Backend", name: "BACKEND", prefixColor: "blue" },
  { command: frontendCommand, name: "FRONTEND", prefixColor: "green" },
];

if (!skipTunnel) {
  commands.push({
    command: "node scripts/tunnel.js",
    name: "TUNNEL",
    prefixColor: "magenta",
  });
}

const { result } = concurrently(commands, {
  killOthersOn: ["failure", "success"],
  restartTries: 0,
});

result.catch(() => process.exit(1));

