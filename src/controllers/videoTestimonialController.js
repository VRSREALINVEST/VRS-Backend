const VideoTestimonial = require("../models/VideoTestimonial");
const {
  pick,
  invalidTextFields,
  normalizeUrl,
  sendError,
} = require("../utils/validation");

// The only fields a request may set (youtubeLink is validated by the schema).
const FIELDS = ["name", "role", "youtubeLink"];

// GET ALL
exports.getVideos = async (req, res) => {
  try {
    const videos = await VideoTestimonial.find().sort({
      createdAt: -1,
    });
    res.json(videos);
  } catch (error) {
    sendError(res, error);
  }
};

// CREATE
exports.createVideo = async (req, res) => {
  try {
    if (invalidTextFields(req.body, FIELDS).length) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const data = pick(req.body, FIELDS);
    data.youtubeLink = normalizeUrl(data.youtubeLink);

    const video = await VideoTestimonial.create(data);

    res.status(201).json(video);
  } catch (error) {
    sendError(res, error);
  }
};

// UPDATE
exports.updateVideo = async (req, res) => {
  try {
    const update = pick(req.body, FIELDS);
    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const blank = invalidTextFields(update, FIELDS, { partial: true });
    if (blank.length) {
      return res
        .status(400)
        .json({ message: `Cannot be empty: ${blank.join(", ")}` });
    }

    if (update.youtubeLink !== undefined) {
      update.youtubeLink = normalizeUrl(update.youtubeLink);
    }

    const video = await VideoTestimonial.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );

    if (!video) {
      return res.status(404).json({ message: "Video testimonial not found" });
    }

    res.json(video);
  } catch (error) {
    sendError(res, error);
  }
};

// DELETE
exports.deleteVideo = async (req, res) => {
  try {
    const video = await VideoTestimonial.findByIdAndDelete(req.params.id);

    if (!video) {
      return res.status(404).json({ message: "Video testimonial not found" });
    }

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    sendError(res, error);
  }
};
