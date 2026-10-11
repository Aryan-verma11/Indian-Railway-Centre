// Small, dependency-free configuration helpers (unit-tested in tests/unit/config.test.js).

// TRUST_PROXY controls how Express derives req.ip (used by rate limiting and audit logs).
//   unset / 0 / false : do not trust X-Forwarded-For (correct for local development and direct exposure)
//   1, 2, ...         : number of reverse-proxy hops in front of the app (e.g. 1 on Render / Railway)
//   other text        : Express subnet list such as "loopback" or "10.0.0.0/8" (comma separated)
// "true" is rejected on purpose: it trusts every hop, so clients could spoof their IP and dodge rate limits.
export function parseTrustProxy(value) {
  if (value === undefined || value === null) return false;
  const text = String(value).trim();
  if (text === '' || /^(false|off|no)$/i.test(text)) return false;
  if (/^\d+$/.test(text)) {
    const hops = Number(text);
    if (hops > 10) throw new Error('TRUST_PROXY must be a small hop count (0-10) or a subnet list.');
    return hops === 0 ? false : hops;
  }
  if (/^(true|on|yes)$/i.test(text)) {
    throw new Error('TRUST_PROXY=true trusts every proxy and allows IP spoofing. Use a hop count such as 1.');
  }
  if (!/^[a-z0-9.:/,\s_-]+$/i.test(text)) throw new Error('TRUST_PROXY has an invalid value.');
  return text;
}
