const mongoose = require("mongoose");
const { isHttpUrl } = require("../utils/validation");

const videoTestimonialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    youtubeLink: {
      type: String,
      required: true,
      validate: {
        validator: isHttpUrl,
        message: "YouTube link must be an http(s) URL",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "VideoTestimonial",
  videoTestimonialSchema
);