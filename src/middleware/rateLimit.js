// Fixed-window rate limit per client IP for the public write paths
// (login, enquiries). req.ip is the real visitor address only because app.js
// trusts exactly the hosting proxy in front of the API (TRUST_PROXY).
//
// ponytail: in-memory and per process — right for the single Node process
// this API runs as. With several processes/instances, move to a shared
// store (e.g. express-rate-limit + Redis) or a proxy-level rule.
const MAX_TRACKED_CLIENTS = 50000;

// An IPv6 visitor controls at least a /64, so IPv6 is limited per /64 rather
// than per address; IPv4 (and IPv4-mapped IPv6) stays per address.
const clientKey = (ip) => {
  if (!ip) return "unknown";
  if (!ip.includes(":")) return ip;
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(ip)) return ip.slice(7);

  const [head, tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];

  // Canonical hex so "2001:0DB8" and "2001:db8" share one bucket.
  return `${groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(":")}::/64`;
};

module.exports = ({ windowMs, max, message }) => {
  const hits = new Map(); // ip -> { count, resetAt }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip);
  }, windowMs);
  sweep.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = clientKey(req.ip);
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      // A flood of distinct clients must not grow memory without bound;
      // drop only the oldest entry so everyone else keeps their count.
      if (hits.size >= MAX_TRACKED_CLIENTS) hits.delete(hits.keys().next().value);
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ message });
    }

    next();
  };
};
