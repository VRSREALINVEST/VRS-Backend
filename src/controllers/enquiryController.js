const Enquiry = require("../models/Enquiry");
const { STATUSES } = require("../models/Enquiry");
const { emitNewEnquiry } = require("../config/socket");

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

/**
 * @route   POST /api/enquiries
 * @access  Public — submitted by the enquiry popup and the Contact page form.
 */
exports.createEnquiry = async (req, res) => {
  try {
    // Whitelisted: status, timestamps and _id can never be set by a visitor.
    const enquiry = await Enquiry.create({
      name: clean(req.body.name),
      email: clean(req.body.email),
      phone: clean(req.body.phone),
      requirement: clean(req.body.requirement),
      propertyType: clean(req.body.propertyType),
      preferredLocation: clean(req.body.preferredLocation),
      message: clean(req.body.message),
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
    // ponytail: returns the full list, filtered in the admin UI. Move search
    // and status filtering here with pagination once this passes a few
    // thousand enquiries.
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.json(enquiries);
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
      { new: true }
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
