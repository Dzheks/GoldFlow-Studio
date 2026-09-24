/**
 * Bridge to a real, logged-in Google Flow session in a real Chrome window.
 *
 * IMPORTANT: Google actively blocks sign-in on any browser Playwright/Selenium
 * LAUNCHES directly (chromium.launch()/launchPersistentContext() add an
 * "--enable-automation" flag that sets navigator.webdriver = true, and
 * Google's login page shows "This browser or app may not be secure" for
 * that). Confirmed live in this session — the user hit exactly that wall.
 *
 * The fix used here is the standard workaround: spawn a REAL, plain Chrome
 * process ourselves (no Playwright launch flags at all) with
 * --remote-debugging-port open, let the user log in with their own hands
 * (fully human-driven, so Google never flags it), and only THEN attach
 * Playwright to it via chromium.connectOverCDP() — which does not add any
 * automation flags to an already-running browser.
 *
 * Uses a dedicated profile dir (.flow-profile/) so it never touches the
 * user's everyday Chrome profile/tabs — this is a separate window.
 */
import { chromium, Browser, Page } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';

const PROFILE_DIR = path.resolve(process.cwd(), '.flow-profile');
const DEBUG_PORT = 9222;
const FLOW_URL = 'https://flow.google.com/';
const SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function findChromeExe(): string {
  for (const p of CHROME_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome.exe не найден в стандартных путях — укажите путь вручную в flowBridge.ts');
}

async function isDebugPortUp(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

const TUNNEL_INFO_FILE = path.resolve(process.cwd(), '.flow-tunnel.json');
const TUNNEL_SCRIPT = path.resolve(process.cwd(), 'flowProxyTunnel.mjs');

function checkTcpAlive(host: string, port: number, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port, timeout: timeoutMs }, () => {
      sock.end();
      resolve(true);
    });
    sock.on('error', () => resolve(false));
    sock.on('timeout', () => {
      sock.destroy();
      resolve(false);
    });
  });
}

async function readTunnelInfo(): Promise<{ localUrl: string } | null> {
  if (!fs.existsSync(TUNNEL_INFO_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(TUNNEL_INFO_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Wraps an authenticated upstream proxy (http://user:pass@host:port) into a local,
 * unauthenticated one so Chrome never needs to show its native auth popup.
 *
 * Runs the tunnel as its OWN standalone detached process (flowProxyTunnel.mjs),
 * not inside this server's Node process — restarting `npm run dev` must not kill
 * the tunnel a live Chrome window already points --proxy-server at.
 */
async function resolveProxyForChrome(): Promise<string | null> {
  const raw = process.env.FLOW_PROXY_SERVER?.trim();
  if (!raw) return null;

  const existing = await readTunnelInfo();
  if (existing?.localUrl) {
    const u = new URL(existing.localUrl);
    if (await checkTcpAlive(u.hostname, Number(u.port))) return existing.localUrl;
  }

  const child = spawn(process.execPath, [TUNNEL_SCRIPT, TUNNEL_INFO_FILE], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, FLOW_PROXY_SERVER: raw },
  });
  child.unref();

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const info = await readTunnelInfo();
    if (info?.localUrl) {
      const u = new URL(info.localUrl);
      if (await checkTcpAlive(u.hostname, Number(u.port))) return info.localUrl;
    }
  }
  throw new Error('Не удалось поднять локальный прокси-туннель за 10 секунд');
}

/**
 * Spawns a plain, un-automated Chrome window with a debug port open. User logs in by hand.
 * If FLOW_PROXY_SERVER is set (.env), ALL of this window's traffic — login included —
 * routes through it via a local proxy-chain wrapper (no Chrome auth popup needed).
 */
export async function openLoginWindow(): Promise<{ ok: boolean; message: string }> {
  const upstreamRaw = process.env.FLOW_PROXY_SERVER?.trim();
  const localProxy = await resolveProxyForChrome().catch((err) => {
    throw new Error(`Не удалось подключиться к прокси ${upstreamRaw}: ${err?.message}`);
  });

  if (await isDebugPortUp()) {
    return {
      ok: true,
      message: localProxy
        ? 'Окно Chrome для Flow уже открыто (через ваш US-прокси) — переключитесь на него и войдите в аккаунт.'
        : 'Окно Chrome для Flow уже открыто — переключитесь на него и войдите в аккаунт.',
    };
  }
  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const exe = findChromeExe();
  const args = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];
  if (localProxy) args.push(`--proxy-server=${localProxy}`);
  args.push(FLOW_URL);

  const child = spawn(exe, args, { detached: true, stdio: 'ignore' });
  child.unref();

  return {
    ok: true,
    message: localProxy
      ? 'Открыто отдельное окно Chrome через ваш US-прокси (логин/пароль прокси уже применены автоматически) — войдите в аккаунт Google с подпиской Flow вручную и откройте любой проект.'
      : 'Открыто отдельное окно Chrome (не ваш обычный профиль) — войдите в аккаунт Google с подпиской Flow вручную и откройте любой проект. Это окно НЕ управляется автоматизацией во время входа, поэтому Google не должен блокировать логин.',
  };
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!(await isDebugPortUp())) {
    browserPromise = null;
    throw new Error('Окно Chrome для Flow не запущено — сначала нажмите «Войти в Google Flow»');
  }

  // A cached connection can go stale if the Chrome window was closed/relaunched
  // (e.g. after a server restart broke its proxy tunnel) while the port number
  // stayed the same — isConnected() catches that, isDebugPortUp() alone can't.
  if (browserPromise) {
    const existing = await browserPromise.catch(() => null);
    if (existing?.isConnected()) return existing;
    browserPromise = null;
  }

  browserPromise = chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
  try {
    return await browserPromise;
  } catch (err) {
    browserPromise = null;
    throw err;
  }
}

async function ensureFlowPage(): Promise<Page> {
  const browser = await getBrowser();
  const ctx = browser.contexts()[0] || (await browser.newContext());
  let page = ctx.pages().find((p) => p.url().includes('flow.google.com'));
  if (!page) {
    page = ctx.pages()[0] || (await ctx.newPage());
    if (!page.url().includes('flow.google.com')) {
      await page.goto(FLOW_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    }
  }
  return page;
}

export interface FlowStatus {
  loggedIn: boolean;
  hasProject: boolean;
  projectId: string | null;
  currentUrl: string | null;
  windowOpen: boolean;
  error?: string;
}

export async function getFlowStatus(): Promise<FlowStatus> {
  const windowOpen = await isDebugPortUp();
  if (!windowOpen) {
    return { loggedIn: false, hasProject: false, projectId: null, currentUrl: null, windowOpen: false };
  }
  try {
    const page = await ensureFlowPage();
    const loggedIn = await page
      .evaluate(() => Boolean((window as any).WIZ_global_data?.SNlM0e))
      .catch(() => false);
    const currentUrl = page.url();
    const match = currentUrl.match(/\/project\/([a-zA-Z0-9_-]+)/);
    return {
      loggedIn,
      hasProject: Boolean(match),
      projectId: match ? match[1] : null,
      currentUrl,
      windowOpen: true,
    };
  } catch (err: any) {
    return { loggedIn: false, hasProject: false, projectId: null, currentUrl: null, windowOpen, error: err?.message };
  }
}

// ---- in-page batchexecute transport (runs with the real session's cookies/recaptcha) ----

const BATCHEXECUTE_EVAL = `
async function __flowBatchexecute(rpcid, argsArray, siteKey, action) {
  const wiz = window.WIZ_global_data;
  if (!wiz || !wiz.SNlM0e) throw new Error('WIZ_global_data недоступен — страница Flow не залогинена или не прогрузилась');
  try { localStorage.removeItem('_grecaptcha'); } catch (e) {}
  const recaptcha = await window.grecaptcha.enterprise.execute(siteKey, { action });

  const at = wiz.SNlM0e;
  const bl = wiz.cfb2h;
  const fsid = wiz.FdrFJe;
  const hl = wiz.NsqkG || 'en';
  const acctMatch = location.pathname.match(/^\\/u\\/(\\d+)\\//);
  const prefix = acctMatch ? '/u/' + acctMatch[1] : '';
  const sourcePath = encodeURIComponent(location.pathname || '/');
  const reqUrl = location.origin + prefix + '/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=' + rpcid +
    '&source-path=' + sourcePath + '&bl=' + encodeURIComponent(bl) + '&f.sid=' + encodeURIComponent(fsid) +
    '&hl=' + encodeURIComponent(hl) + '&_reqid=' + Math.floor(Math.random() * 900000 + 100000) + '&rt=c';

  const freq = JSON.stringify([[[rpcid, JSON.stringify(argsArray), null, 'generic']]]);
  const body = 'f.req=' + encodeURIComponent(freq) + '&at=' + encodeURIComponent(at) + '&';

  const res = await fetch(reqUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'x-same-domain': '1',
    },
    body,
    credentials: 'include',
  });
  const text = await res.text();
  const cleaned = text.replace(/^\\)\\]\\}'\\n?/, '');
  const lines = cleaned.split('\\n');
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const lenLine = lines[i].trim();
    const len = Number(lenLine);
    if (!lenLine || Number.isNaN(len)) continue;
    const jsonLine = lines[i + 1];
    i++;
    if (!jsonLine) continue;
    try {
      const arr = JSON.parse(jsonLine);
      if (Array.isArray(arr)) rows.push(...arr);
    } catch (e) {}
  }
  for (const row of rows) {
    if (Array.isArray(row) && row[0] === 'wrb.fr' && row[1] === rpcid) {
      if (row[5]) throw new Error('Flow RPC error: ' + JSON.stringify(row[5]));
      return row[2] ? JSON.parse(row[2]) : null;
    }
    if (Array.isArray(row) && row[0] === 'er') {
      throw new Error('Flow batchexecute error: ' + JSON.stringify(row));
    }
  }
  throw new Error('Нет ответа batchexecute для rpcid ' + rpcid + ' (пустой/непонятный ответ)');
}
`;

async function callFlowRpc(page: Page, rpcid: string, argsArray: any, action: string): Promise<any> {
  return page.evaluate(
    ({ src, rpcid, argsArray, siteKey, action }) => {
      // eslint-disable-next-line no-new-func
      const fn = new Function(src + '\nreturn __flowBatchexecute(arguments[0], arguments[1], arguments[2], arguments[3]);');
      return fn(rpcid, argsArray, siteKey, action);
    },
    { src: BATCHEXECUTE_EVAL, rpcid, argsArray, siteKey: SITE_KEY, action }
  );
}

const uuid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`.toUpperCase();

function buildGenerateImageArgs(opts: {
  prompt: string;
  workflowId: string;
  model: string;
  aspect: number;
  imageInputs?: string[];
  seed?: number;
  count?: number;
}) {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const authBlock = [null, 22, null, null, null, opts.workflowId, null, null, null, null, ['__RECAPTCHA__', 1]];
  const refs = opts.imageInputs?.length ? opts.imageInputs.map((id) => [id, null, null, null, 1]) : null;
  return [
    null,
    [[null, null, refs, seed, opts.aspect, opts.model || 'NARWHAL', null, authBlock, [[[opts.prompt]]], null, null, null, uuid(), uuid()]],
    opts.count || 1,
    authBlock,
    [uuid()],
  ];
}

function buildUploadImageArgs(opts: { projectId: string; base64: string; mime: string; fileName: string }) {
  const authBlock = [null, 22, null, null, null, opts.projectId, null, null, null, null, ['__RECAPTCHA__', 1]];
  return [authBlock, opts.base64, opts.mime || 'image/png', 1, null, null, null, null, opts.fileName || 'image.png', null, uuid(), uuid()];
}

function injectRecaptcha(args: any, token: string): any {
  const json = JSON.stringify(args).replace(/"__RECAPTCHA__"/g, JSON.stringify(token));
  return JSON.parse(json);
}

export interface FlowImageResult {
  imageBase64: string;
  mimeType: string;
}

/** Uploads a reference image (hero/style) to Flow, returns its Flow mediaId. */
export async function flowUploadReference(base64: string, mime: string, fileName = 'reference.png'): Promise<string> {
  const page = await ensureFlowPage();
  const status = await getFlowStatus();
  if (!status.loggedIn) throw new Error('Flow не залогинен — войдите в открытом окне Chrome');
  if (!status.projectId) throw new Error('Нет открытого проекта Flow — откройте проект во вкладке Flow');

  const token = await page.evaluate(
    ({ siteKey }) => {
      try { localStorage.removeItem('_grecaptcha'); } catch (e) {}
      return (window as any).grecaptcha.enterprise.execute(siteKey, { action: 'IMAGE_GENERATION' });
    },
    { siteKey: SITE_KEY }
  );
  const rawArgs = buildUploadImageArgs({ projectId: status.projectId, base64, mime, fileName });
  const args = injectRecaptcha(rawArgs, token);
  const reply = await callFlowRpc(page, 'maseQ', args, 'IMAGE_GENERATION');
  const mediaId = reply?.[0]?.[0];
  if (!mediaId) throw new Error('Flow не вернул mediaId для загруженного референса');
  return mediaId;
}

/** Generates an image through the real Flow session and returns it as base64. */
export async function flowGenerateImage(opts: {
  prompt: string;
  model: string;
  aspect: number;
  imageInputs?: string[];
  seed?: number;
}): Promise<FlowImageResult> {
  const browser = await getBrowser();
  const page = await ensureFlowPage();
  const status = await getFlowStatus();
  if (!status.loggedIn) throw new Error('Flow не залогинен — войдите в открытом окне Chrome');
  if (!status.projectId) throw new Error('Нет открытого проекта Flow — откройте проект во вкладке Flow');

  const token = await page.evaluate(
    ({ siteKey }) => {
      try { localStorage.removeItem('_grecaptcha'); } catch (e) {}
      return (window as any).grecaptcha.enterprise.execute(siteKey, { action: 'IMAGE_GENERATION' });
    },
    { siteKey: SITE_KEY }
  );
  const rawArgs = buildGenerateImageArgs({
    prompt: opts.prompt,
    workflowId: status.projectId,
    model: opts.model,
    aspect: opts.aspect,
    imageInputs: opts.imageInputs,
    seed: opts.seed,
  });
  const args = injectRecaptcha(rawArgs, token);
  const reply = await callFlowRpc(page, 'ogiZ0b', args, 'IMAGE_GENERATION');

  const urls = Array.from(new Set((JSON.stringify(reply).match(/https:\/\/flow-content\.google\/image\/[a-zA-Z0-9_\-\/]+/g) || [])));
  if (!urls.length) throw new Error('Flow не вернул изображение (пустой ответ ogiZ0b)');

  const ctx = page.context();
  const imgRes = await ctx.request.get(urls[0]);
  if (!imgRes.ok()) throw new Error(`Не удалось скачать картинку из Flow (${imgRes.status()})`);
  const buf = await imgRes.body();
  const mimeType = imgRes.headers()['content-type'] || 'image/png';
  return { imageBase64: buf.toString('base64'), mimeType };
}

export async function shutdownFlowBridge(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    // Only disconnect Playwright's CDP session — do NOT close the user's Chrome window.
    if (browser) await browser.close().catch(() => {});
  }
  browserPromise = null;
}
