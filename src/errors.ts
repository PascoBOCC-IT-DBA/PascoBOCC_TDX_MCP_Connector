/**
 * Error shaping for tool responses.
 *
 * TDX error bodies echo back whatever we sent plus internal identifiers, and the server also
 * talks to Key Vault and its own config, so raw error text is treated as untrusted for
 * client consumption. `toToolError()` is the single place tool handlers turn an exception
 * into an MCP result: the full detail goes to stderr under a correlation id, and the caller
 * gets a short message plus that id so an operator can join the two.
 */

import { randomUUID } from "crypto";
import { TdxRateLimitError } from "./tdx-rate-limit.js";

/** How much of a TDX error body is worth keeping in the logs. */
const MAX_LOGGED_BODY_CHARS = 1000;

/**
 * A non-2xx response from TDX. `body` is diagnostic only -- it must never be returned to a
 * caller, which is why it lives on the error rather than in the message.
 */
export class TdxApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: string
  ) {
    super(`TDX API error ${status} ${method} ${path}`);
    this.name = "TdxApiError";
  }
}

/**
 * Marks an error whose message this server authored and whose text is safe to show a caller.
 * Anything not marked is assumed to carry upstream or internal detail and is replaced with a
 * generic message.
 */
export class ToolSafeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolSafeError";
  }
}

/**
 * Masks known secret values in text that is about to be logged. Used on auth failures, where
 * the response may quote the credentials we just sent.
 */
export function redactSecrets(text: string, secrets: (string | undefined)[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) {
      out = out.split(secret).join("[redacted]");
    }
  }
  return out;
}

export interface ToolErrorResult {
  // The MCP SDK's result type is open-ended; without this the helper's return type is
  // narrower than the callback signature it has to satisfy.
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError: true;
}

/**
 * Converts any thrown value into an MCP error result, logging the detail server-side.
 *
 * The returned message keeps enough structure for an agent to decide what to do next
 * (status code, method, path, "throttled" vs "failed") without carrying a response body.
 */
export function toToolError(e: unknown): ToolErrorResult {
  const ref = randomUUID().slice(0, 8);

  let message: string;
  if (e instanceof TdxRateLimitError) {
    message = `TDX throttled ${e.method} ${e.path} after ${e.attempts} attempts. Retry later or reduce request volume. (ref ${ref})`;
  } else if (e instanceof TdxApiError) {
    message = `TDX API error ${e.status} on ${e.method} ${e.path}. (ref ${ref})`;
  } else if (e instanceof ToolSafeError) {
    message = `${e.message} (ref ${ref})`;
  } else {
    message = `The request could not be completed. Ask an administrator to check the server log for ref ${ref}.`;
  }

  const detail = e instanceof Error ? e.stack ?? e.message : String(e);
  console.error(`[ToolError ${ref}] ${detail}`);
  if (e instanceof TdxApiError && e.body) {
    console.error(`[ToolError ${ref}] TDX response body: ${e.body.slice(0, MAX_LOGGED_BODY_CHARS)}`);
  }

  return { content: [{ type: "text", text: message }], isError: true };
}
