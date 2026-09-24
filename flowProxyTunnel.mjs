/**
 * Standalone, detached local proxy tunnel for the Flow Chrome window.
 * Wraps the authenticated upstream proxy (FLOW_PROXY_SERVER env var) into a
 * local unauthenticated one via proxy-chain, and writes its address to the
 * info file (argv[2]) so flowBridge.ts can find it.
 *
 * Runs as its OWN detached process, independent of server.ts, specifically
 * so restarting the dev server (`npm run dev`) does not kill this tunnel and
 * orphan the already-running Chrome window that points --proxy-server at it.
 */
import { anonymizeProxy } from 'proxy-chain';
import fs from 'fs';

const upstream = process.env.FLOW_PROXY_SERVER;
const infoFile = process.argv[2];

if (!upstream || !infoFile) {
  console.error('Usage: FLOW_PROXY_SERVER=... node flowProxyTunnel.mjs <infoFilePath>');
  process.exit(1);
}

const localUrl = await anonymizeProxy(upstream);
fs.writeFileSync(infoFile, JSON.stringify({ localUrl, pid: process.pid, startedAt: Date.now() }));
console.log('TUNNEL_READY:' + localUrl);

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
setInterval(() => {}, 1 << 30); // keep process alive
