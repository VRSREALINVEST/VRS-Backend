const mongoose = require("mongoose");
const { isHttpUrl } = require("../utils/validation");

const webinarSchema = new mongoose.Schema(
{
  title: {
    type: String,
    required: true,
  },

  description: String,

  day: {
    type: String,
    required: true,
    enum: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
  },

  // 24-hour HH:MM (what the admin time input sends); the public page
  // formats it by splitting on ":".
  time: {
    type: String,
    required: true,
    match: [/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Time must be HH:MM (24-hour)"],
  },

  australiaTimeZone: {
    type: String,
    required: true,
    enum: ["AWST","ACST","ACDT","AEST","AEDT"],
  },

  durationMinutes: {
    type: Number,
    default: 60,
    min: [1, "Duration must be between 1 and 1440 minutes"],
    max: [1440, "Duration must be between 1 and 1440 minutes"],
  },

  // Rendered as the public "Register Now" link, so http(s) only.
  meetLink: {
    type: String,
    required: true,
    validate: {
      validator: isHttpUrl,
      message: "Meet link must be an http(s) URL",
    },
  },

  // Optional; the admin form sends "" when it is left blank.
  recordingLink: {
    type: String,
    validate: {
      validator: (value) => value == null || value === "" || isHttpUrl(value),
      message: "Recording link must be an http(s) URL",
    },
  },
},
{ timestamps: true }
);

module.exports = mongoose.model("Webinar", webinarSchema);
