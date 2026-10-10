const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);

// Node's built-in scrypt, so no new dependency. Stored as
// scrypt$N$r$p$salt$hash: the cost parameters travel with each hash, so they
// can be raised later without invalidating passwords already stored.
const COST = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

// scrypt needs about 128*N*r bytes. Twice that leaves room to raise N later
// without hitting Node's 32 MiB default; the cap stops a tampered stored hash
// from asking for unbounded memory.
const withMaxmem = ({ N, r, p }) => ({
  N,
  r,
  p,
  maxmem: Math.min(256 * N * r, 256 * 1024 * 1024),
});

// Burned on legacy plaintext checks, so they cost the same scrypt work as a
// hashed account and response time can't single out unmigrated accounts.
const TIMING_SALT = crypto.randomBytes(16);

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, withMaxmem(COST));
  return [
    "scrypt",
    COST.N,
    COST.r,
    COST.p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
};

const isHashed = (stored) =>
  typeof stored === "string" && stored.startsWith("scrypt$");

/**
 * Constant-time check of a login attempt against the stored password.
 * Accounts created before hashing still hold their plaintext password; those
 * verify too (nobody is locked out) and the login controller then re-saves
 * them as a hash.
 */
const verifyPassword = async (password, stored) => {
  if (typeof password !== "string" || typeof stored !== "string") return false;

  if (!isHashed(stored)) {
    await scrypt(password, TIMING_SALT, KEY_LENGTH, withMaxmem(COST));
    const given = Buffer.from(password);
    const expected = Buffer.from(stored);
    return (
      given.length === expected.length &&
      crypto.timingSafeEqual(given, expected)
    );
  }

  const [, N, r, p, salt, hash] = stored.split("$");
  const expected = Buffer.from(hash || "", "base64");
  if (!salt || expected.length === 0) return false;

  const actual = await scrypt(
    password,
    Buffer.from(salt, "base64"),
    expected.length,
    withMaxmem({ N: Number(N), r: Number(r), p: Number(p) })
  );
  return crypto.timingSafeEqual(actual, expected);
};

module.exports = { hashPassword, verifyPassword, isHashed };
