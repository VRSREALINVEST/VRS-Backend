const TextTestimonial = require("../models/TextTestimonial");
const { pick, invalidTextFields, sendError } = require("../utils/validation");

// The only fields a request may set (rating is validated by the schema).
const FIELDS = ["name", "location", "text", "rating"];
const TEXT_FIELDS = ["name", "location", "text"];

// GET ALL
exports.getTestimonials = async (req, res) => {
  try {
    const testimonials = await TextTestimonial.find().sort({
      createdAt: -1,
    });
    res.json(testimonials);
  } catch (error) {
    sendError(res, error);
  }
};

// CREATE
exports.createTestimonial = async (req, res) => {
  try {
    const missing = invalidTextFields(req.body, TEXT_FIELDS);
    if (missing.length) {
      return res
        .status(400)
        .json({ message: `Required: ${missing.join(", ")}` });
    }

    const testimonial = await TextTestimonial.create(pick(req.body, FIELDS));

    res.status(201).json(testimonial);
  } catch (error) {
    sendError(res, error);
  }
};

// UPDATE
exports.updateTestimonial = async (req, res) => {
  try {
    // Only known fields, so an update can't carry $unset or other operators.
    const update = pick(req.body, FIELDS);
    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const blank = invalidTextFields(update, TEXT_FIELDS, { partial: true });
    if (blank.length) {
      return res
        .status(400)
        .json({ message: `Cannot be empty: ${blank.join(", ")}` });
    }

    const testimonial = await TextTestimonial.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );

    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    res.json(testimonial);
  } catch (error) {
    sendError(res, error);
  }
};

// DELETE
exports.deleteTestimonial = async (req, res) => {
  try {
    const testimonial = await TextTestimonial.findByIdAndDelete(req.params.id);

    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    sendError(res, error);
  }
};
