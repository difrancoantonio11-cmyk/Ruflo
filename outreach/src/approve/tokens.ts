/**
 * Signed, expiring approval links.
 *
 * The approval buttons live in an email, so the endpoint that receives them
 * cannot require a login. A token therefore has to carry its own proof: it
 * names one lead, one action and one deadline, signed with a secret that never
 * leaves the machine. Anyone without the secret can neither forge a link nor
 * change which lead an existing link points at.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export type ApprovalAction = 'build' | 'reject' | 'later';

export interface ApprovalClaim {
  leadPageId: string;
  action: ApprovalAction;
}

const SEPARATOR = '.';

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function unb64url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signature(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Creates a token valid for `ttlDays` (default 14 — longer than any digest stays relevant). */
export function sign(secret: string, claim: ApprovalClaim, ttlDays = 14): string {
  const exp = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  const payload = b64url(`${claim.leadPageId}|${claim.action}|${exp}`);
  return `${payload}${SEPARATOR}${signature(secret, payload)}`;
}

/** Returns the claim if the token is authentic and unexpired, otherwise undefined. */
export function verify(secret: string, token: string): ApprovalClaim | undefined {
  const parts = token.split(SEPARATOR);
  if (parts.length !== 2) return undefined;
  const [payload, provided] = parts as [string, string];

  const expected = signature(secret, payload);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;

  const fields = unb64url(payload).split('|');
  if (fields.length !== 3) return undefined;
  const [leadPageId, action, expRaw] = fields as [string, string, string];

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return undefined;
  if (action !== 'build' && action !== 'reject' && action !== 'later') return undefined;

  return { leadPageId, action };
}
