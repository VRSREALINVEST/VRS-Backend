// Integration tests for the webinar API: the public list and the admin create
// and update routes. Same local-only setup as enquiries.test.js:
//
//   mongod --dbpath <empty folder> --port 27018
//   TEST_MONGO_URL=mongodb://127.0.0.1:27018 npm test
//
// backend/.env points at the production database, so this file never loads it
// and refuses any server that is not local. Each run uses its own database and
// drops it afterwards.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const MONGO_URL = (
  process.env.TEST_MONGO_URL || "mongodb://127.0.0.1:27017"
).replace(/\/$/, "");

if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(MONGO_URL)) {
  throw new Error(
    "Refusing to run: TEST_MONGO_URL must be a local mongodb:// server " +
      "(127.0.0.1 or localhost, no credentials, no database name)."
  );
}

// Signs the test admin tokens below; never a real secret.
process.env.JWT_SECRET = "test-only-jwt-secret-0123456789abcdef";

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const Webinar = require("../src/models/webinarModel");

let server;
let api;

before(async () => {
  await mongoose.connect(`${MONGO_URL}/vrs_test_webinars_${process.pid}_${Date.now()}`);
  assert.ok(
    ["127.0.0.1", "localhost"].includes(mongoose.connection.host),
    "connected to a non-local MongoDB host"
  );
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  api = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  if (server) await new Promise((resolve) => server.close(resolve));
});

const call = (method, path, body, { admin = true } = {}) => {
  const token = jwt.sign(
    { id: "test-admin", role: "admin" },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "5m" }
  );
  return fetch(`${api}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(admin ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body && JSON.stringify(body),
  });
};

// Synthetic data only. `blank` is what the admin form sends for an optional
// schedule field left empty.
const webinar = (overrides = {}) => ({
  title: "Property investing basics",
  description: "Free webinar",
  meetLink: "https://event.example.com/register",
  ...overrides,
});
const blank = { day: "", time: "", australiaTimeZone: "" };

test("[new] a webinar can be created without a day, time or time zone", async () => {
  const fromForm = await call("POST", "/api/webinars", webinar(blank));
  assert.equal(fromForm.status, 201);
  const saved = await Webinar.findById((await fromForm.json())._id).lean();
  for (const key of ["day", "time", "australiaTimeZone"]) {
    assert.equal(saved[key], undefined, `${key} must not be stored`);
  }

  assert.equal((await call("POST", "/api/webinars", webinar())).status, 201);
});

test("[legacy] title and registration link are still required and checked", async () => {
  for (const missing of ["title", "meetLink"]) {
    const body = webinar();
    delete body[missing];
    assert.equal((await call("POST", "/api/webinars", body)).status, 400, missing);
  }
  assert.equal(
    (await call("POST", "/api/webinars", webinar({ meetLink: "javascript:alert(1)" }))).status,
    400
  );
});

test("[legacy] a schedule that is sent is still validated and stored", async () => {
  for (const bad of [{ day: "Funday" }, { time: "25:00" }, { australiaTimeZone: "PST" }]) {
    const res = await call("POST", "/api/webinars", webinar(bad));
    assert.equal(res.status, 400, JSON.stringify(bad));
  }

  const res = await call(
    "POST",
    "/api/webinars",
    webinar({ day: "Monday", time: "19:30", australiaTimeZone: "AEDT" })
  );
  assert.equal(res.status, 201);
  const saved = await Webinar.findById((await res.json())._id).lean();
  assert.equal(saved.day, "Monday");
  assert.equal(saved.time, "19:30");
  assert.equal(saved.australiaTimeZone, "AEDT");
});

test("[legacy] existing webinars keep their schedule and registration link", async () => {
  const now = new Date();
  const { insertedId } = await Webinar.collection.insertOne({
    title: "Older webinar",
    day: "Tuesday",
    time: "20:00",
    australiaTimeZone: "AEST",
    meetLink: "https://event.example.com/older",
    createdAt: now,
    updatedAt: now,
  });

  const res = await fetch(`${api}/api/webinars`);
  assert.equal(res.status, 200);
  const older = (await res.json()).find((w) => w._id === String(insertedId));
  assert.equal(older.day, "Tuesday");
  assert.equal(older.time, "20:00");
  assert.equal(older.australiaTimeZone, "AEST");
  assert.equal(older.meetLink, "https://event.example.com/older");
});

test("[new] an update with a blank schedule keeps the stored one", async () => {
  const created = await call(
    "POST",
    "/api/webinars",
    webinar({ day: "Friday", time: "18:00", australiaTimeZone: "AWST" })
  );
  const { _id } = await created.json();

  const res = await call("PUT", `/api/webinars/${_id}`, { title: "Renamed", ...blank });
  assert.equal(res.status, 200);
  const saved = await Webinar.findById(_id).lean();
  assert.equal(saved.title, "Renamed");
  assert.equal(saved.day, "Friday");
  assert.equal(saved.time, "18:00");
  assert.equal(saved.australiaTimeZone, "AWST");

  assert.equal((await call("PUT", `/api/webinars/${_id}`, blank)).status, 400);
});

test("[legacy] writes still need an admin token; the list stays public", async () => {
  assert.equal(
    (await call("POST", "/api/webinars", webinar(), { admin: false })).status,
    401
  );
  assert.equal((await fetch(`${api}/api/webinars`)).status, 200);
});
