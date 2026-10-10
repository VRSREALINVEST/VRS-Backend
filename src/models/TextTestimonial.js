const mongoose = require("mongoose");

const textTestimonialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    // The public site draws one star per point, so the value must be 1-5.
    rating: {
      type: Number,
      default: 5,
      min: [1, "Rating must be between 1 and 5"],
      max: [5, "Rating must be between 1 and 5"],
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "TextTestimonial",
  textTestimonialSchema
);
