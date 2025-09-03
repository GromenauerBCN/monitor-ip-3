import net from 'net';

// ❗ Força IPv4 a undici (fetch de Node 18/20+)
import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function checkHttp(url: string, timeoutMs = 12000): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const baseInit: RequestInit = {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'MonitorIP/1.0 (+https://monitor-ip-3.onrender.com)',
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'connection': 'keep-alive',
      },
    };

    // Intent lleuger amb HEAD
    let r = await fetch(url, { ...baseInit, method: 'HEAD' }).catch(() => null as any);
    if (!r || !r.ok) {
      // Fallback a GET
      r = await fetch(url, { ...baseInit, method: 'GET' }).catch(() => null as any);
    }

    const latency = Date.now() - start;
    if (!r) return { ok: false, latencyMs: latency, error: 'network/TLS error' };

    // Acceptem 2xx i 3xx com a UP
    const up = r.status < 400;
    if (!up) return { ok: false, latencyMs: latency, error: `HTTP ${r.status}` };

    return { ok: true, latencyMs: latency };
  } catch (e: any) {
    const latency = Date.now() - start;
    return { ok: false, latencyMs: latency, error: e?.message || 'exception' };
  } finally {
    clearTimeout(t);
  }
}

export async function checkTcp(host: string, port: number, timeoutMs = 8000): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let finished = false;

    const finish = (ok: boolean, error?: string) => {
      if (finished) return;
      finished = true;
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ ok, latencyMs: latency, error });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, 'timeout'));
    socket.once('error', (err) => finish(false, err?.message || 'error'));
    socket.connect(port, host);
  });
}

/** Retrys: 3 intents separats X segons */
export async function checkWithRetries(kind: 'http'|'tcp', host: string, port?: number): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const attempts = Number(process.env.RETRY_ATTEMPTS || 3);
  const intervalMs = Number(process.env.RETRY_INTERVAL_SEC || 60) * 1000;

  let last: { ok: boolean; latencyMs?: number; error?: string } = { ok: false };
  for (let i = 1; i <= attempts; i++) {
    last = kind === 'http'
      ? await checkHttp(host)
      : await checkTcp(host, port!);

    if (last.ok) return last;
    if (i < attempts) await sleep(intervalMs);
  }
  return last;
}
