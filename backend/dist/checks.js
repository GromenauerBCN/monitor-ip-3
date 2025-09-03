import net from 'net';
const sleep = (ms) => new Promise(res => setTimeout(res, ms));
function isHttpAddress(address) {
    const a = (address || '').trim().toLowerCase();
    return a.startsWith('http://') || a.startsWith('https://');
}
function buildUrl(kind, address) {
    const a = address.trim();
    if (isHttpAddress(a))
        return a; // ja ve amb protocol
    // si no porta protocol, assumim http (el camp kind al model és "http" | "tcp")
    return `http://${a}`;
}
export async function checkHttp(url, timeoutMs = 8000) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(url, {
            signal: ctrl.signal,
            redirect: 'follow',
            headers: {
                // alguns serveis rebutgen peticions sense UA
                'user-agent': 'MonitorIP/1.0 (+https://example.invalid)'
            }
        });
        return r.ok;
    }
    catch {
        return false;
    }
    finally {
        clearTimeout(id);
    }
}
export async function checkTcp(host, port, timeoutMs = 5000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let done = false;
        const finish = (ok) => { if (!done) {
            done = true;
            try {
                socket.destroy();
            }
            catch { }
            resolve(ok);
        } };
        socket.setTimeout(timeoutMs);
        socket.once('connect', () => finish(true));
        socket.once('error', () => finish(false));
        socket.once('timeout', () => finish(false));
        socket.connect(port, host);
    });
}
/**
 * Manté la signatura existent 'http'|'tcp', però detecta també URLs amb https://
 * - Si 'host' comença per http(s) → es fa HTTP(S) encara que kind sigui 'http'
 * - Si no és una URL i kind és 'http' → es construeix http://<host>
 * - En qualsevol altre cas → TCP (requereix port)
 */
export async function checkWithRetries(kind, host, port) {
    const attempts = Number(process.env.RETRY_ATTEMPTS || 3);
    const intervalMs = Number(process.env.RETRY_INTERVAL_SEC || 60) * 1000;
    for (let i = 1; i <= attempts; i++) {
        let ok = false;
        if (isHttpAddress(host) || kind === 'http') {
            const url = buildUrl(kind, host);
            ok = await checkHttp(url);
        }
        else {
            if (!port)
                return false; // TCP sense port no té sentit
            ok = await checkTcp(host, port);
        }
        if (ok)
            return true; // surt si algun intent va bé
        if (i < attempts)
            await sleep(intervalMs); // espera abans del proper intent
    }
    return false; // tots els intents KO
}
