/**
 * Correlation layer between HTTP callers and the single MCP stdio subprocess.
 *
 * Extracted from http-wrapper so the id-correlation and listener-lifecycle rules can be
 * tested without binding a port or spawning node.
 */

export type JsonRpcId = string | number;

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: { name?: string } & Record<string, unknown>;
  [key: string]: unknown;
}

export interface JsonRpcResponse {
  jsonrpc?: string;
  id?: JsonRpcId;
  result?: { tools?: Array<{ name?: string }>; content?: unknown } & Record<string, unknown>;
  error?: unknown;
}

/** The subset of ChildProcess this layer touches, so tests can supply a fake. */
export interface McpProcessLike {
  pid?: number;
  killed?: boolean;
  stdin: { write(chunk: string, callback?: (err?: Error | null) => void): unknown };
  stdout: { on(event: 'data', listener: (chunk: Buffer | string) => void): unknown };
}

/** Distinguishes a timeout (504) from every other failure (500) at the HTTP layer. */
export class RequestTimeoutError extends Error {
  constructor(public readonly timeoutMs: number, public readonly method: string) {
    super(`Request timeout (${timeoutMs / 1000}s)`);
    this.name = 'RequestTimeoutError';
  }
}

interface PendingRequest {
  /** The id the client sent; restored on the way out so the client still recognises its reply. */
  originalId: JsonRpcId;
  method: string;
  resolve: (value: JsonRpcResponse) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface McpTransportOptions {
  log?: (message: string) => void;
}

export class McpTransport {
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private counter = 0;
  private buffer = '';
  private attachedProc: McpProcessLike | null = null;
  private readonly log: (message: string) => void;

  constructor(options: McpTransportOptions = {}) {
    this.log = options.log ?? ((message: string) => console.log(message));
  }

  /**
   * Keyed on process identity rather than a boolean: a restarted subprocess is a different
   * object, so it always gets its own listener even if detach() was never called.
   */
  attach(proc: McpProcessLike): void {
    if (this.attachedProc === proc) return;

    this.attachedProc = proc;
    this.buffer = '';
    proc.stdout.on('data', (chunk) => {
      if (this.attachedProc !== proc) return; // stale listener from a dead process
      this.consume(typeof chunk === 'string' ? chunk : chunk.toString());
    });
    this.log(`[MCP] stdout listener attached to PID: ${proc.pid}`);
  }

  detach(): void {
    this.attachedProc = null;
    this.buffer = '';
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  /** Fail every in-flight request at once, e.g. when the subprocess dies. */
  failAllPending(err: Error): void {
    for (const [internalId, entry] of this.pending) {
      this.pending.delete(internalId);
      clearTimeout(entry.timeout);
      entry.reject(err);
    }
  }

  /**
   * Correlate on a server-generated id, never the client's. Two callers that both pick id 1
   * would otherwise collide in the pending map and receive each other's responses.
   */
  send(proc: McpProcessLike, message: JsonRpcMessage, timeoutMs: number): Promise<JsonRpcResponse> {
    this.attach(proc);

    const originalId = message.id as JsonRpcId;
    const method = message.method ?? 'unknown';
    const internalId = `srv-${++this.counter}`;

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.delete(internalId)) {
          reject(new RequestTimeoutError(timeoutMs, method));
        }
      }, timeoutMs);

      this.pending.set(internalId, { originalId, method, resolve, reject, timeout });

      const fail = (err: Error) => {
        const entry = this.pending.get(internalId);
        if (!entry) return;
        this.pending.delete(internalId);
        clearTimeout(entry.timeout);
        reject(err);
      };

      try {
        proc.stdin.write(JSON.stringify({ ...message, id: internalId }) + '\n', (err) => {
          if (err) fail(new Error(`Failed to write to MCP: ${err.message}`));
        });
      } catch (err) {
        fail(new Error(`Failed to write to MCP: ${(err as Error).message}`));
      }
    });
  }

  private consume(text: string): void {
    this.buffer += text;
    const lines = this.buffer.split('\n');
    this.buffer = lines[lines.length - 1];

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('{')) continue;

      let msg: JsonRpcResponse;
      try {
        msg = JSON.parse(line);
      } catch {
        continue; // interleaved non-JSON logging from the subprocess
      }

      const internalId = msg.id;
      if (internalId === undefined || internalId === null) continue;

      const entry = this.pending.get(internalId);
      if (!entry) continue;

      this.pending.delete(internalId);
      clearTimeout(entry.timeout);
      msg.id = entry.originalId;
      entry.resolve(msg);
    }
  }
}
