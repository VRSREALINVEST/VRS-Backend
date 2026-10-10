// Shared request guards for the admin content controllers.

/**
 * Copies only the allowed keys that were actually sent, so a request can
 * never set other fields or smuggle in update operators such as $unset.
 */
const pick = (body, keys) =>
  Object.fromEntries(
    keys.filter((key) => body && body[key] !== undefined).map((key) => [key, body[key]])
  );

/**
 * Required text fields must arrive as non-empty strings: this rejects missing
 * values, "" and objects such as {"$ne": null}. With `partial` (updates) only
 * the keys that were sent are checked. Returns the offending keys.
 */
const invalidTextFields = (body, keys, { partial = false } = {}) =>
  keys.filter((key) => {
    const value = body ? body[key] : undefined;
    if (partial && value === undefined) return false;
    return typeof value !== "string" || value.trim() === "";
  });

/** http(s) links only, so a stored link can never be javascript: or data:. */
const isHttpUrl = (value) => {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};

/**
 * Admins paste links without a scheme ("meet.google.com/abc"); store those as
 * https. A value that already has a scheme is left for isHttpUrl to judge, so
 * "javascript:..." can never be rewritten into something acceptable.
 */
const normalizeUrl = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "" || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

/**
 * Mongoose validation and cast failures are the client's fault (400) and
 * their messages are safe to show the admin. Anything else is logged here
 * and answered with a generic 500 that leaks nothing internal.
 */
const sendError = (res, error) => {
  if (error && error.name === "ValidationError") {
    const errors = {};
    for (const [field, err] of Object.entries(error.errors)) {
      errors[field] = err.message;
    }
    return res
      .status(400)
      .json({ message: Object.values(errors)[0] || "Invalid data", errors });
  }

  if (error && error.name === "CastError") {
    return res.status(400).json({ message: `Invalid value for ${error.path}` });
  }

  console.error(error);
  return res.status(500).json({ message: "Server error" });
};

module.exports = { pick, invalidTextFields, isHttpUrl, normalizeUrl, sendError };
