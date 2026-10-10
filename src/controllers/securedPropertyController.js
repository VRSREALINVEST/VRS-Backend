const SecuredProperty = require("../models/SecuredProperty");
const cloudinary = require("../config/cloudinary");
const { pick, invalidTextFields, sendError } = require("../utils/validation");

// The only fields a request may set; the images come from the uploads.
const FIELDS = ["title", "description", "securedPrice", "marketPrice", "currentPrice"];

exports.createProperty = async (req, res) => {
  try {
    // Everything is validated before uploading, so a rejected request never
    // leaves orphaned images in Cloudinary.
    const missing = invalidTextFields(req.body, FIELDS);
    if (missing.length) {
      return res
        .status(400)
        .json({ message: `Required: ${missing.join(", ")}` });
    }

    if (!req.files?.coverImage || !req.files?.galleryImages) {
      return res
        .status(400)
        .json({ message: "Cover image and gallery images required" });
    }

    // Upload cover image
    const coverUpload = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "secured-properties/cover" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        },
      );
      stream.end(req.files.coverImage[0].buffer);
    });

    // Upload gallery images
    const galleryUploadPromises = req.files.galleryImages.map(
      (file) =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "secured-properties/gallery" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result.secure_url);
            },
          );
          stream.end(file.buffer);
        }),
    );

    const galleryImages = await Promise.all(galleryUploadPromises);

    const property = await SecuredProperty.create({
      ...pick(req.body, FIELDS),
      coverImage: coverUpload,
      galleryImages,
    });

    res.status(201).json(property);
  } catch (error) {
    sendError(res, error);
  }
};

// GET ALL
exports.getAllProperties = async (req, res) => {
  try {
    const properties = await SecuredProperty.find().sort({
      createdAt: -1,
    });
    res.json(properties);
  } catch (error) {
    sendError(res, error);
  }
};

// UPDATE
exports.updateProperty = async (req, res) => {
  try {
    const updateData = pick(req.body, FIELDS);

    const blank = invalidTextFields(updateData, FIELDS, { partial: true });
    if (blank.length) {
      return res
        .status(400)
        .json({ message: `Cannot be empty: ${blank.join(", ")}` });
    }

    // 404 before uploading anything for a property that doesn't exist.
    if (!(await SecuredProperty.exists({ _id: req.params.id }))) {
      return res.status(404).json({ message: "Property not found" });
    }

    // If new cover image uploaded
    if (req.files?.coverImage) {
      const coverUpload = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "secured-properties/cover" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          },
        );
        stream.end(req.files.coverImage[0].buffer);
      });

      updateData.coverImage = coverUpload;
    }

    // If new gallery images uploaded
    if (req.files?.galleryImages) {
      const galleryUploadPromises = req.files.galleryImages.map(
        (file) =>
          new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "secured-properties/gallery" },
              (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
              },
            );
            stream.end(file.buffer);
          }),
      );

      updateData.galleryImages = await Promise.all(galleryUploadPromises);
    }

    const property = await SecuredProperty.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    );

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.json(property);
  } catch (error) {
    sendError(res, error);
  }
};

exports.deleteProperty = async (req, res) => {
  try {
    const property = await SecuredProperty.findByIdAndDelete(req.params.id);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.json({ message: "Property deleted successfully" });
  } catch (error) {
    sendError(res, error);
  }
};


