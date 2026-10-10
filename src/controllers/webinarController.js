const Webinar = require("../models/webinarModel");
const {
  pick,
  invalidTextFields,
  normalizeUrl,
  sendError,
} = require("../utils/validation");

// The only fields a request may set; formats are validated by the schema.
const FIELDS = [
  "title",
  "description",
  "day",
  "time",
  "australiaTimeZone",
  "meetLink",
  "recordingLink",
  "durationMinutes",
];
const REQUIRED = ["title", "day", "time", "australiaTimeZone", "meetLink"];

const withNormalizedLinks = (data) => {
  for (const key of ["meetLink", "recordingLink"]) {
    if (data[key] !== undefined) data[key] = normalizeUrl(data[key]);
  }
  return data;
};

exports.createWebinar = async (req, res) => {
  try {
    if (invalidTextFields(req.body, REQUIRED).length) {
      return res.status(400).json({
        message: "Required fields missing",
      });
    }

    const webinar = await Webinar.create(
      withNormalizedLinks(pick(req.body, FIELDS))
    );

    res.status(201).json(webinar);
  } catch (error) {
    sendError(res, error);
  }
};


/* ========================= */
/* GET ALL WEBINARS (LIMIT 3) */
/* ========================= */
exports.getWebinars = async (req, res) => {
  try {
    const webinars = await Webinar.find()
      .sort({ createdAt: -1 }) // latest first

    if (!webinars.length) {
      return res.status(404).json({ message: "No webinars found" });
    }

    res.json(webinars);
  } catch (error) {
    sendError(res, error);
  }
};
/* ========================= */
/* UPDATE WEBINAR */
/* ========================= */
exports.updateWebinar = async (req, res) => {
  try {
    // Only known fields, so an update can't carry $unset or other operators.
    const update = pick(req.body, FIELDS);
    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const blank = invalidTextFields(update, REQUIRED, { partial: true });
    if (blank.length) {
      return res
        .status(400)
        .json({ message: `Cannot be empty: ${blank.join(", ")}` });
    }

    const webinar = await Webinar.findByIdAndUpdate(
      req.params.id,
      withNormalizedLinks(update),
      { new: true, runValidators: true }
    );

    if (!webinar) {
      return res.status(404).json({ message: "Webinar not found" });
    }

    res.json(webinar);
  } catch (error) {
    sendError(res, error);
  }
};

/* ========================= */
/* DELETE WEBINAR */
/* ========================= */
exports.deleteWebinar = async (req, res) => {
  try {
    const webinar = await Webinar.findByIdAndDelete(req.params.id);

    if (!webinar) {
      return res.status(404).json({ message: "Webinar not found" });
    }

    res.json({ message: "Webinar deleted" });
  } catch (error) {
    sendError(res, error);
  }
};
