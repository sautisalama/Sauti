import tls from 'node:tls';
import net from 'node:net';

/**
 * A small POP3 client (RFC 1939). POP3 only knows one folder and has no flags, so it is used just to
 * read and delete. Message numbers change between sessions; UIDL is the stable id.
 */
export class Pop3 {
  private socket!: net.Socket | tls.TLSSocket;
  private buf = '';
  private waiters: (() => void)[] = [];
  private closed = false;
  private error: Error | null = null;

  constructor(private host: string, private port: number, private secure: boolean) {}

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onErr = (e: Error) => {
        this.error = e;
        reject(e);
        this.wake();
      };
      const opts = { host: this.host, port: this.port, servername: this.host, timeout: 20_000 };
      this.socket = this.secure ? tls.connect(opts, () => resolve()) : net.connect(opts, () => resolve());
      this.socket.setEncoding('utf8');
      this.socket.on('data', (d: string) => {
        this.buf += d;
        this.wake();
      });
      this.socket.on('error', onErr);
      this.socket.on('timeout', () => onErr(new Error('The mail server took too long to answer.')));
      this.socket.on('close', () => {
        this.closed = true;
        this.wake();
      });
    });
    const greeting = await this.line();
    if (!greeting.startsWith('+OK')) throw new Error('The POP3 server refused the connection.');
  }

  private wake() {
    const w = this.waiters.splice(0);
    w.forEach((f) => f());
  }

  private async until(cond: () => number): Promise<number> {
    for (;;) {
      const i = cond();
      if (i >= 0) return i;
      if (this.error) throw this.error;
      if (this.closed) throw new Error('The connection closed unexpectedly.');
      await new Promise<void>((r) => this.waiters.push(r));
    }
  }

  private async line(): Promise<string> {
    const i = await this.until(() => this.buf.indexOf('\r\n'));
    const l = this.buf.slice(0, i);
    this.buf = this.buf.slice(i + 2);
    return l;
  }

  /** Send a command; for multi-line replies read until the lone "." line. */
  private async cmd(c: string, multi = false): Promise<string> {
    this.socket.write(c + '\r\n');
    const first = await this.line();
    if (!first.startsWith('+OK')) throw new Error(first.replace(/^-ERR\s*/, '') || 'The POP3 server returned an error.');
    if (!multi) return first;
    const end = await this.until(() => {
      if (this.buf.startsWith('.\r\n')) return 0;
      const i = this.buf.indexOf('\r\n.\r\n');
      return i >= 0 ? i + 2 : -1;
    });
    const body = this.buf.slice(0, end);
    this.buf = this.buf.slice(end + 3);
    // Undo byte-stuffing of lines that begin with ".".
    return body.replace(/^\.\./gm, '.');
  }

  async login(user: string, pass: string) {
    await this.cmd(`USER ${user}`);
    await this.cmd(`PASS ${pass}`);
  }

  /** [number, uidl] for every message, oldest first. */
  async uidl(): Promise<[number, string][]> {
    const body = await this.cmd('UIDL', true);
    return body
      .split('\r\n')
      .filter(Boolean)
      .map((l) => {
        const [n, id] = l.split(' ');
        return [Number(n), id] as [number, string];
      });
  }

  async top(n: number): Promise<Buffer> {
    return Buffer.from(await this.cmd(`TOP ${n} 0`, true), 'utf8');
  }

  async retr(n: number): Promise<Buffer> {
    return Buffer.from(await this.cmd(`RETR ${n}`, true), 'utf8');
  }

  async dele(n: number) {
    await this.cmd(`DELE ${n}`);
  }

  async quit() {
    try {
      this.socket.write('QUIT\r\n');
    } catch {
      /* already closed */
    }
    this.socket.destroy();
  }
}

/** A stable positive integer for a UIDL string (the app's message ids are numbers). */
export function uidOf(uidl: string): number {
  let h = 2166136261;
  for (let i = 0; i < uidl.length; i++) {
    h ^= uidl.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 1) || 1;
}
