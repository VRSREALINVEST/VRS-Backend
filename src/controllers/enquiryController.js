const Enquiry = require("../models/Enquiry");
const { STATUSES, UTM_KEYS, UTM_MAX_LENGTH } = require("../models/Enquiry");
const { emitNewEnquiry } = require("../config/socket");
const {
  APP_TIMEZONE,
  statBoundaries,
  parseDateRange,
} = require("../utils/dateRange");

// A visitor-supplied search term goes into a RegExp, so metacharacters must be
// neutralised or a crafted term could hang the query.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Mongoose validation errors carry per-field messages that are safe to show a
// visitor; anything else is an internal fault and must not leak outwards.
const handleError = (res, error) => {
  if (error.name === "ValidationError") {
    const errors = {};
    for (const [field, err] of Object.entries(error.errors)) {
      errors[field] = err.message;
    }
    return res.status(400).json({ message: "Please check the form", errors });
  }

  if (error.name === "CastError") {
    return res.status(400).json({ message: "Invalid enquiry id" });
  }

  console.error("Enquiry error:", error);
  return res.status(500).json({ message: "Something went wrong" });
};

// Empty strings must become undefined so optional enum fields skip validation
// instead of failing on "" not being a member.
const clean = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

// Only a JSON true counts as consent ("true", 1 or "on" do not). Undefined when
// the request never mentioned it, as the older request shape doesn't.
const consent = (value) => (value === undefined ? undefined : value === true);

// Attribution is best effort: unknown keys and non-strings are dropped and
// overlong values cut, so a malformed UTM can never block an enquiry.
const cleanUtm = (utm) => {
  if (!utm || typeof utm !== "object" || Array.isArray(utm)) return undefined;

  const kept = {};
  for (const key of UTM_KEYS) {
    const value = clean(utm[key]);
    if (value) kept[key] = value.slice(0, UTM_MAX_LENGTH);
  }
  return Object.keys(kept).length ? kept : undefined;
};

/**
 * @route   POST /api/enquiries
 * @access  Public — submitted by the /strategy-session form (source
 *          "strategy-session"). The older request shape without a source is
 *          still accepted unchanged.
 */
exports.createEnquiry = async (req, res) => {
  try {
    // Express 5 leaves req.body undefined when no JSON body was sent.
    const body = req.body ?? {};
    // A source that was sent must name a known form exactly. Dropping a
    // malformed one (an array, an empty string) would quietly check the
    // request as the older shape instead, so it becomes "" and fails.
    const source =
      body.source === undefined ? undefined : (clean(body.source) ?? "");
    const firstName = clean(body.firstName);
    const lastName = clean(body.lastName);

    // Whitelisted: status, timestamps and _id can never be set by a visitor.
    const enquiry = await Enquiry.create({
      // The strategy-session form sends first and last name; `name` stays the
      // single field the admin inbox shows and searches.
      name:
        source === "strategy-session"
          ? [firstName, lastName].filter(Boolean).join(" ") || undefined
          : clean(body.name),
      firstName,
      lastName,
      email: clean(body.email),
      phone: clean(body.phone),
      requirement: clean(body.requirement),
      propertyType: clean(body.propertyType),
      preferredLocation: clean(body.preferredLocation),
      message: clean(body.message),
      state: clean(body.state),
      timing: clean(body.timing),
      contactConsent: consent(body.contactConsent),
      // The strategy-session form always asks, so an unticked box is a real
      // "no". The older shape never asked, so it stays unset unless sent.
      marketingConsent:
        source === "strategy-session"
          ? body.marketingConsent === true
          : consent(body.marketingConsent),
      utm: cleanUtm(body.utm),
      source,
    });

    // Only now that Mongo has confirmed the write do connected admins hear
    // about it. Emitting earlier could announce an enquiry that never saved.
    emitNewEnquiry(enquiry);

    res.status(201).json({
      message: "Enquiry submitted successfully",
      id: enquiry._id,
    });
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * @route   GET /api/enquiries
 * @access  Admin
 */
exports.getEnquiries = async (req, res) => {
  try {
    const filter = {};

    // Search across the three fields the admin list shows.
    const search = clean(req.query.search);
    if (search) {
      const term = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: term }, { email: term }, { phone: term }];
    }

    // Status filter: only "New", "Contacted", "Closed" are valid.
    const statusFilter = clean(req.query.status);
    if (statusFilter) {
      if (STATUSES.includes(statusFilter)) {
        filter.status = statusFilter;
      }
      // Silently ignore invalid status values rather than constructing
      // an arbitrary query.
    }

    // Date range on the submission date, resolved in the business timezone.
    const range = parseDateRange(req.query.from, req.query.to);
    if (range.invalid) {
      return res
        .status(400)
        .json({ message: "From date cannot be after To date" });
    }

    if (range.gte || range.lt) {
      filter.createdAt = {};
      if (range.gte) filter.createdAt.$gte = range.gte;
      if (range.lt) filter.createdAt.$lt = range.lt;
    }

    const enquiries = await Enquiry.find(filter).sort({ createdAt: -1 });
    res.json(enquiries);
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * @route   GET /api/enquiries/stats
 * @access  Admin
 *
 * Deliberately unaffected by the list's search/date filters: these cards
 * describe the whole database, not the current view.
 *
 * One $facet pass so the four counts share a single trip to MongoDB, and each
 * branch is a bounded createdAt range served by the createdAt index rather
 * than four separate collection scans.
 */
exports.getEnquiryStats = async (req, res) => {
  try {
    const { todayStart, tomorrowStart, last7Start, lastMonthStart, thisMonthStart } =
      statBoundaries();

    const [result] = await Enquiry.aggregate([
      {
        $facet: {
          today: [
            { $match: { createdAt: { $gte: todayStart, $lt: tomorrowStart } } },
            { $count: "n" },
          ],
          last7Days: [
            { $match: { createdAt: { $gte: last7Start, $lt: tomorrowStart } } },
            { $count: "n" },
          ],
          lastMonth: [
            {
              $match: {
                createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
              },
            },
            { $count: "n" },
          ],
          total: [{ $count: "n" }],
        },
      },
    ]);

    const count = (branch) => (branch && branch[0] ? branch[0].n : 0);

    res.json({
      today: count(result.today),
      last7Days: count(result.last7Days),
      lastMonth: count(result.lastMonth),
      total: count(result.total),
      timezone: APP_TIMEZONE,
    });
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * @route   GET /api/enquiries/:id
 * @access  Admin
 */
exports.getEnquiryById = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    res.json(enquiry);
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * @route   PUT /api/enquiries/:id/status
 * @access  Admin
 */
exports.updateEnquiryStatus = async (req, res) => {
  try {
    const status = clean(req.body.status);

    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: "after" }
    );

    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    res.json(enquiry);
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * @route   DELETE /api/enquiries/:id
 * @access  Admin
 */
exports.deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);

    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    res.json({ message: "Enquiry deleted", id: enquiry._id });
  } catch (error) {
    handleError(res, error);
  }
};
