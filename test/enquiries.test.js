// Integration tests for POST /api/enquiries and the admin enquiry routes. The
// Express app runs in-process against a throwaway database on a LOCAL MongoDB
// server only:
//
//   mongod --dbpath <empty folder> --port 27018
//   TEST_MONGO_URL=mongodb://127.0.0.1:27018 npm test
//
// backend/.env points at the production database, so this file never loads it
// (only server.js calls dotenv) and refuses any server that is not local. Each
// run creates its own uniquely named database and drops it afterwards.
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
const Enquiry = require("../src/models/Enquiry");
const { toAdminPayload } = require("../src/config/socket");

let server;
let api;

before(async () => {
  await mongoose.connect(`${MONGO_URL}/vrs_test_${process.pid}_${Date.now()}`);
  // Belt and braces: check where the driver actually connected.
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

// The public POST is limited per client, and req.ip comes from
// X-Forwarded-For (one trusted proxy), so each request gets its own address.
let clients = 0;
const nextIp = () => {
  clients += 1;
  return `10.0.${Math.floor(clients / 250)}.${clients % 250}`;
};

const post = (body, { ip = nextIp(), raw } = {}) => {
  const payload = raw ?? (body === undefined ? undefined : JSON.stringify(body));
  return fetch(`${api}/api/enquiries`, {
    method: "POST",
    headers: {
      "X-Forwarded-For": ip,
      ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: payload,
  });
};

const asAdmin = (path, init = {}) => {
  const token = jwt.sign(
    { id: "test-admin", role: "admin" },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "5m" }
  );
  return fetch(`${api}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "X-Forwarded-For": nextIp(),
    },
  });
};

// Synthetic contact details only.
const strategy = (overrides = {}) => ({
  source: "strategy-session",
  firstName: "Test",
  lastName: "Visitor",
  email: "test.visitor@example.com",
  phone: "0400 000 000",
  state: "NSW",
  requirement: "Just learning for now",
  timing: "3–6 months",
  contactConsent: true,
  ...overrides,
});

const savedDoc = async (res) => {
  const body = await res.json();
  assert.equal(res.status, 201, JSON.stringify(body));
  return Enquiry.findById(body.id).lean();
};

const fieldErrors = async (res) => {
  assert.equal(res.status, 400);
  return (await res.json()).errors || {};
};

test("[new] the option lists match Page Copy v2 exactly", () => {
  assert.deepEqual(Enquiry.STATES, [
    "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT", "Overseas",
  ]);
  assert.deepEqual(Enquiry.TIMINGS, [
    "Within 3 months", "3–6 months", "6–12 months", "Just researching",
  ]);
  assert.deepEqual(Enquiry.STRATEGY_GOALS, [
    "Buy my first investment property",
    "Add to my portfolio",
    "Buy through my SMSF",
    "Buy my first home",
    "Just learning for now",
  ]);
});

test("[new] a strategy-session enquiry stores the new fields and builds name", async () => {
  const doc = await savedDoc(
    await post(strategy({ firstName: "  Test ", utm: { source: "google", medium: "cpc" } }))
  );

  assert.equal(doc.name, "Test Visitor");
  assert.equal(doc.firstName, "Test");
  assert.equal(doc.lastName, "Visitor");
  assert.equal(doc.state, "NSW");
  assert.equal(doc.timing, "3–6 months");
  assert.equal(doc.requirement, "Just learning for now");
  assert.equal(doc.contactConsent, true);
  assert.equal(doc.marketingConsent, false);
  assert.deepEqual(doc.utm, { source: "google", medium: "cpc" });
  assert.equal(doc.source, "strategy-session");
  assert.equal(doc.status, "New");
});

test("[new] every approved state, timing and goal is accepted", async () => {
  for (const state of Enquiry.STATES) await savedDoc(await post(strategy({ state })));
  for (const timing of Enquiry.TIMINGS) await savedDoc(await post(strategy({ timing })));
  for (const requirement of Enquiry.STRATEGY_GOALS) {
    await savedDoc(await post(strategy({ requirement })));
  }
});

test("[new] marketing consent defaults to false and is stored only for a JSON true", async () => {
  assert.equal((await savedDoc(await post(strategy()))).marketingConsent, false);
  assert.equal(
    (await savedDoc(await post(strategy({ marketingConsent: true })))).marketingConsent,
    true
  );
  assert.equal(
    (await savedDoc(await post(strategy({ marketingConsent: "true" })))).marketingConsent,
    false
  );
});

test("[new] contact consent must be exactly true", async () => {
  for (const contactConsent of [undefined, false, "true", 1, null]) {
    const errors = await fieldErrors(await post(strategy({ contactConsent })));
    assert.ok(errors.contactConsent, `contactConsent=${JSON.stringify(contactConsent)}`);
  }
});

test("[new] first name, last name, state and timing are required", async () => {
  const errors = await fieldErrors(
    await post(strategy({ firstName: "", lastName: undefined, state: undefined, timing: " " }))
  );
  for (const field of ["firstName", "lastName", "state", "timing"]) {
    assert.ok(errors[field], field);
  }
});

test("[new] state, timing, goal and source must be approved options", async () => {
  const cases = [
    ["state", "Victoria"],
    ["timing", "3-6 months"], // ASCII hyphen, not the approved en dash
    ["requirement", "Grow my property portfolio"], // valid only for older forms
    ["source", "popup"],
  ];
  for (const [field, value] of cases) {
    const errors = await fieldErrors(await post(strategy({ [field]: value })));
    assert.ok(errors[field], `${field}=${value}`);
  }
});

test("[new] strategy-session fields need a valid source", async () => {
  // Without a source the request used to be checked as the older shape and
  // failed only on `name`, which the form doesn't send.
  const noSource = strategy();
  delete noSource.source;
  assert.equal((await fieldErrors(await post(noSource))).source, "Source is required");

  for (const source of ["", ["strategy-session"], { value: "strategy-session" }, 1, null]) {
    const errors = await fieldErrors(await post(strategy({ source })));
    assert.ok(errors.source, `source=${JSON.stringify(source)}`);
  }

  // Surrounding spaces are trimmed, like every other text field.
  assert.equal(
    (await savedDoc(await post(strategy({ source: " strategy-session " })))).source,
    "strategy-session"
  );
});

test("[new] UTM keeps known keys only and caps values at 200 characters", async () => {
  const doc = await savedDoc(
    await post(
      strategy({
        utm: { source: ` ${"x".repeat(300)} `, campaign: "spring", gclid: "abc", term: 42 },
      })
    )
  );
  assert.deepEqual(Object.keys(doc.utm).sort(), ["campaign", "source"]);
  assert.equal(doc.utm.source.length, 200);

  const none = await savedDoc(await post(strategy({ utm: "utm_source=google" })));
  assert.equal(none.utm, undefined);
});

test("[legacy] the older request shape is still accepted without consent", async () => {
  const doc = await savedDoc(
    await post({
      name: "Legacy Visitor",
      email: "legacy.visitor@example.com",
      phone: "+61 400 000 000",
      requirement: "Free Consultation",
      propertyType: "House",
      message: "Hello",
    })
  );
  assert.equal(doc.name, "Legacy Visitor");
  assert.equal(doc.requirement, "Free Consultation");
  assert.equal(doc.propertyType, "House");
  assert.equal(doc.source, undefined);
  assert.equal(doc.contactConsent, undefined);
  // Never asked, so "—" in the admin, not a "No" the visitor never gave.
  assert.equal(doc.marketingConsent, undefined);
});

test("[legacy] existing validation still rejects a bad email, phone and goal", async () => {
  const errors = await fieldErrors(
    await post({ name: "X", email: "not-an-email", phone: "12", requirement: "Something else" })
  );
  for (const field of ["email", "phone", "requirement"]) assert.ok(errors[field], field);
});

test("[legacy] malformed JSON gets a 400", async () => {
  const res = await post(undefined, { raw: "{not json" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).message, "Malformed JSON body");
});

test("[fix] a request without a JSON body gets a 400, not a 500", async () => {
  const res = await post(undefined);
  assert.equal(res.status, 400);
});

test("[legacy] the public limit is still 5 requests per client per 15 minutes", async () => {
  const ip = nextIp();
  for (let i = 0; i < 5; i++) assert.equal((await post({}, { ip })).status, 400);
  assert.equal((await post({}, { ip })).status, 429);
});

test("[legacy] admin enquiry routes still require an admin token", async () => {
  assert.equal((await fetch(`${api}/api/enquiries`)).status, 401);
  assert.equal((await fetch(`${api}/api/enquiries/stats`)).status, 401);
  assert.equal((await asAdmin("/api/enquiries")).status, 200);
});

test("[new] the admin list returns the new fields", async () => {
  const { id } = await (
    await post(strategy({ marketingConsent: true, utm: { source: "newsletter" } }))
  ).json();
  const row = (await (await asAdmin("/api/enquiries")).json()).find((e) => e._id === id);

  assert.equal(row.firstName, "Test");
  assert.equal(row.lastName, "Visitor");
  assert.equal(row.state, "NSW");
  assert.equal(row.timing, "3–6 months");
  assert.equal(row.contactConsent, true);
  assert.equal(row.marketingConsent, true);
  assert.deepEqual(row.utm, { source: "newsletter" });
  assert.equal(row.source, "strategy-session");
});

test("[legacy] records saved before these fields existed still load, search, update and delete", async () => {
  const now = new Date();
  const { insertedId } = await Enquiry.collection.insertOne({
    name: "Older Record",
    email: "older.record@example.com",
    phone: "0400 111 222",
    requirement: "Buy an Investment Property",
    status: "New",
    createdAt: now,
    updatedAt: now,
  });
  const id = String(insertedId);

  const one = await (await asAdmin(`/api/enquiries/${id}`)).json();
  assert.equal(one.name, "Older Record");
  for (const field of ["firstName", "lastName", "state", "timing", "contactConsent", "marketingConsent", "utm", "source"]) {
    assert.equal(one[field], undefined, `${field} must stay absent on an older record`);
  }

  const updated = await asAdmin(`/api/enquiries/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Contacted" }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).status, "Contacted");

  const found = await (await asAdmin("/api/enquiries?search=Older%20Record")).json();
  assert.ok(found.some((e) => e._id === id));

  const stats = await (await asAdmin("/api/enquiries/stats")).json();
  assert.ok(stats.total >= 1);

  assert.equal((await asAdmin(`/api/enquiries/${id}`, { method: "DELETE" })).status, 200);
});

test("[new] a strategy-session enquiry keeps its fields through a status update and can be deleted", async () => {
  const { id } = await (
    await post(strategy({ marketingConsent: true, utm: { campaign: "spring" } }))
  ).json();

  const res = await asAdmin(`/api/enquiries/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Closed" }),
  });
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.status, "Closed"); // the document after the update
  assert.equal(updated.name, "Test Visitor");
  assert.equal(updated.state, "NSW");
  assert.equal(updated.timing, "3–6 months");
  assert.equal(updated.contactConsent, true);
  assert.equal(updated.marketingConsent, true);
  assert.deepEqual(updated.utm, { campaign: "spring" });
  assert.equal(updated.source, "strategy-session");

  assert.equal((await asAdmin(`/api/enquiries/${id}`, { method: "DELETE" })).status, 200);
  assert.equal((await asAdmin(`/api/enquiries/${id}`)).status, 404);
});

test("[new] the realtime admin payload carries the new fields", async () => {
  const withUtm = await Enquiry.findById(
    (await (await post(strategy({ utm: { campaign: "spring" } }))).json()).id
  );
  const payload = toAdminPayload(withUtm);
  assert.equal(payload.name, "Test Visitor");
  assert.equal(payload.firstName, "Test");
  assert.equal(payload.lastName, "Visitor");
  assert.equal(payload.state, "NSW");
  assert.equal(payload.timing, "3–6 months");
  assert.equal(payload.contactConsent, true);
  assert.equal(payload.marketingConsent, false);
  assert.equal(payload.utm.campaign, "spring");
  assert.equal(payload.source, "strategy-session");
  assert.equal(payload.__v, undefined);

  const withoutUtm = await Enquiry.findById((await (await post(strategy())).json()).id);
  assert.equal(toAdminPayload(withoutUtm).utm, undefined);
});
