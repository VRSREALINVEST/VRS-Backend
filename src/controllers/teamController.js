const TeamMember = require("../models/Team");
const cloudinary = require("../config/cloudinary");
const { pick, invalidTextFields, sendError } = require("../utils/validation");

// The only fields a request may set; the image comes from the upload.
const FIELDS = ["name", "role"];

// GET ALL
exports.getTeam = async (req, res) => {
  try {
    const members = await TeamMember.find().sort({ createdAt: -1 });
    res.json(members);
  } catch (error) {
    sendError(res, error);
  }
};



// CREATE
exports.createMember = async (req, res) => {
  try {
    // Validated before uploading, so a rejected request leaves no orphan image.
    const missing = invalidTextFields(req.body, FIELDS);
    if (missing.length) {
      return res
        .status(400)
        .json({ message: `Required: ${missing.join(", ")}` });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image required" });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "team-members" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const member = await TeamMember.create({
      ...pick(req.body, FIELDS),
      image: result.secure_url,
    });

    res.status(201).json(member);
  } catch (error) {
    sendError(res, error);
  }
};

// UPDATE
exports.updateMember = async (req, res) => {
  try {
    const updateData = pick(req.body, FIELDS);

    const blank = invalidTextFields(updateData, FIELDS, { partial: true });
    if (blank.length) {
      return res
        .status(400)
        .json({ message: `Cannot be empty: ${blank.join(", ")}` });
    }

    // 404 before uploading anything for a member that doesn't exist.
    if (!(await TeamMember.exists({ _id: req.params.id }))) {
      return res.status(404).json({ message: "Team member not found" });
    }

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "team-members" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      updateData.image = result.secure_url;
    }

    const member = await TeamMember.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!member) {
      return res.status(404).json({ message: "Team member not found" });
    }

    res.json(member);
  } catch (error) {
    sendError(res, error);
  }
};

// DELETE
exports.deleteMember = async (req, res) => {
  try {
    const member = await TeamMember.findByIdAndDelete(req.params.id);

    if (!member) {
      return res.status(404).json({ message: "Team member not found" });
    }

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    sendError(res, error);
  }
};
