const mongoose = require("mongoose");
const { isHttpUrl } = require("../utils/validation");

const discoverVideoSchema = new mongoose.Schema(
  {
    thumbnail: {
      type: String,
      required: true,
    },
    videoUrl: {
      type: String,
      required: true,
      validate: {
        validator: isHttpUrl,
        message: "Video URL must be an http(s) URL",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "DiscoverVideo",
  discoverVideoSchema
);
