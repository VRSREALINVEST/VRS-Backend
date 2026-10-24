const mongoose = require("mongoose");

// Option lists are the authoritative source for what a public form may submit.
// Each form mirrors one of these lists; anything else is rejected here.

// Shown by the enquiry popup (components/ui/EnquiryPopup.tsx).
const REQUIREMENTS = [
  "Buy an Investment Property",
  "Buy My First Home",
  "Property Coaching",
  "Free Consultation",
  "General Enquiry",
];

// "Primary property goal" shown by the Contact page form. Kept as its own list
// rather than replacing REQUIREMENTS so the popup and every enquiry already in
// the database stay valid. Both lists feed the same `requirement` field.
// The curly apostrophe and em dash below are significant: the enum compares
// exact strings, so the form must send these characters byte for byte.
const PROPERTY_GOALS = [
  "Buy my first home",
  "Buy my first investment property",
  "Grow my property portfolio",
  "Pay off my mortgage sooner",
  "Attend the Property Wealth Master Class",
  "Book a strategy call",
  "I’m not sure yet — I need guidance",
];

// "What are you looking to do?" on the /strategy-session form (Page Copy v2).
// It feeds the same `requirement` field; the first and fourth options already
// exist in PROPERTY_GOALS.
const STRATEGY_GOALS = [
  "Buy my first investment property",
  "Add to my portfolio",
  "Buy through my SMSF",
  "Buy my first home",
  "Just learning for now",
];

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT", "Overseas"];

// The en dashes are significant, as above.
const TIMINGS = [
  "Within 3 months",
  "3–6 months",
  "6–12 months",
  "Just researching",
];

// Which form sent the enquiry. Enquiries saved before this existed have none.
const SOURCES = ["strategy-session"];

const UTM_KEYS = ["source", "medium", "campaign", "term", "content"];
const UTM_MAX_LENGTH = 200;

const PROPERTY_TYPES = [
  "Apartment / Unit",
  "House",
  "Townhouse",
  "Land",
  "Commercial",
  "Not Sure Yet",
];

const STATUSES = ["New", "Contacted", "Closed"];

// The strategy-session form's extra fields are mandatory only for that form,
// so the older request shape and existing records stay valid.
function isStrategySession() {
  return this.source === "strategy-session";
}

// Fields only the strategy-session form sends. A request carrying any of them
// must also name that source; otherwise it would be checked as the older
// shape and fail on a `name` the form never sends.
function hasStrategyFields() {
  return ["firstName", "lastName", "state", "timing", "contactConsent"].some(
    (field) => this[field] !== undefined
  );
}

const enquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [100, "Full name is too long"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: [150, "Email is too long"],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Please enter a valid email"],
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      maxlength: [20, "Phone number is too long"],
      match: [/^\+?[\d\s()-]{8,20}$/, "Please enter a valid phone number"],
    },

    requirement: {
      type: String,
      required: [true, "Please select what you are enquiring about"],
      enum: {
        values: [
          ...new Set([...REQUIREMENTS, ...PROPERTY_GOALS, ...STRATEGY_GOALS]),
        ],
        message: "Invalid enquiry type",
      },
      // A strategy-session enquiry may only use that form's own options.
      validate: {
        validator(value) {
          return !isStrategySession.call(this) || STRATEGY_GOALS.includes(value);
        },
        message: "Invalid enquiry type",
      },
    },

    propertyType: {
      type: String,
      enum: { values: PROPERTY_TYPES, message: "Invalid property type" },
    },

    preferredLocation: {
      type: String,
      trim: true,
      maxlength: [120, "Preferred location is too long"],
    },

    message: {
      type: String,
      trim: true,
      maxlength: [1000, "Message is too long"],
    },

    // `name` stays the single display/search field; for a strategy-session
    // enquiry the controller builds it from these two.
    firstName: {
      type: String,
      trim: true,
      maxlength: [40, "First name is too long"],
      required: [isStrategySession, "First name is required"],
    },

    lastName: {
      type: String,
      trim: true,
      maxlength: [40, "Last name is too long"],
      required: [isStrategySession, "Last name is required"],
    },

    state: {
      type: String,
      enum: { values: STATES, message: "Invalid state" },
      required: [isStrategySession, "Please select your state"],
    },

    timing: {
      type: String,
      enum: { values: TIMINGS, message: "Invalid timing" },
      required: [isStrategySession, "Please select when you are hoping to buy"],
    },

    // No defaults on the consent fields: an enquiry saved before they existed
    // keeps neither, so "never asked" stays distinguishable from "declined".
    // The controller stores real booleans only.
    contactConsent: {
      type: Boolean,
      required: [isStrategySession, "Contact permission is required"],
      validate: {
        validator(value) {
          return !isStrategySession.call(this) || value === true;
        },
        message: "Contact permission is required",
      },
    },

    marketingConsent: Boolean,

    utm: Object.fromEntries(
      UTM_KEYS.map((key) => [
        key,
        {
          type: String,
          trim: true,
          maxlength: [UTM_MAX_LENGTH, "UTM value is too long"],
        },
      ])
    ),

    source: {
      type: String,
      enum: { values: SOURCES, message: "Invalid source" },
      required: [hasStrategyFields, "Source is required"],
    },

    status: {
      type: String,
      enum: { values: STATUSES, message: "Invalid status" },
      default: "New",
    },
  },
  { timestamps: true }
);

// The admin list sorts by newest and filters by submission date, and the
// statistics run four bounded createdAt ranges, so this index serves both.
enquirySchema.index({ createdAt: -1 });

const Enquiry = mongoose.model("Enquiry", enquirySchema);

module.exports = Enquiry;
module.exports.REQUIREMENTS = REQUIREMENTS;
module.exports.PROPERTY_GOALS = PROPERTY_GOALS;
module.exports.PROPERTY_TYPES = PROPERTY_TYPES;
module.exports.STATUSES = STATUSES;
module.exports.STRATEGY_GOALS = STRATEGY_GOALS;
module.exports.STATES = STATES;
module.exports.TIMINGS = TIMINGS;
module.exports.SOURCES = SOURCES;
module.exports.UTM_KEYS = UTM_KEYS;
module.exports.UTM_MAX_LENGTH = UTM_MAX_LENGTH;
