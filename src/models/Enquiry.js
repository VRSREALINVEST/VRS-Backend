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

const PROPERTY_TYPES = [
  "Apartment / Unit",
  "House",
  "Townhouse",
  "Land",
  "Commercial",
  "Not Sure Yet",
];

const STATUSES = ["New", "Contacted", "Closed"];

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
        values: [...REQUIREMENTS, ...PROPERTY_GOALS],
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
