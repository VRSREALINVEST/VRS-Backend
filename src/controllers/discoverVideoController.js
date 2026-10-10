const DiscoverVideo = require("../models/discoverVideo");
const cloudinary = require("../config/cloudinary");
const { isHttpUrl, normalizeUrl, sendError } = require("../utils/validation");

// GET
exports.getVideo = async (req, res) => {
  try {
    const video = await DiscoverVideo.findOne();
    res.json(video || null);
  } catch (error) {
    sendError(res, error);
  }
};

// UPDATE / CREATE
exports.updateVideo = async (req, res) => {
  try {
    if (!req.body.videoUrl) {
      return res.status(400).json({ message: "Video URL required" });
    }

    // Checked before the thumbnail upload, so a bad link never leaves an
    // orphaned image behind.
    const videoUrl = normalizeUrl(req.body.videoUrl);
    if (!isHttpUrl(videoUrl)) {
      return res
        .status(400)
        .json({ message: "Video URL must be an http(s) link" });
    }

    let uploadedThumbnail = null;

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "discover-video", resource_type: "image" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      // The schema and the admin page both treat thumbnail as the image URL
      // (storing an {url, public_id} object here made every save fail).
      uploadedThumbnail = result.secure_url;
    }

    let video = await DiscoverVideo.findOne();

    if (!video) {
      video = await DiscoverVideo.create({
        thumbnail: uploadedThumbnail,
        videoUrl,
      });
    } else {
      // The previous thumbnail stays in Cloudinary, as before: only a URL is
      // stored, and the old object branch that destroyed it never matched.
      video.videoUrl = videoUrl;

      if (uploadedThumbnail) {
        video.thumbnail = uploadedThumbnail;
      }

      await video.save();
    }

    res.json(video);
  } catch (error) {
    sendError(res, error);
  }
};