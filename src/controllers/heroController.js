const Hero = require("../models/Hero");
const cloudinary = require("../config/cloudinary");

/**
 * GET HERO
 */
exports.getHero = async (req, res) => {
  try {
    let hero = await Hero.findOne();

    if (!hero) {
      hero = await Hero.create({
        type: "image",
        images: [],
      });
    }

    res.json(hero);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * UPDATE HERO
 */
exports.updateHero = async (req, res) => {
  try {
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({ message: "Type required" });
    }

    // Anything else previously fell through both branches below and the
    // request hung without a response.
    if (type !== "image" && type !== "video") {
      return res.status(400).json({ message: "Type must be image or video" });
    }

    let hero = await Hero.findOne();

    if (!hero) {
      hero = new Hero({ type: "image", images: [] });
    }

    // ================= IMAGE MODE =================
    if (type === "image") {
      const files = req.files?.images || [];

      if (files.length === 0 && hero.images.length === 0) {
        return res.status(400).json({ message: "At least 1 image required" });
      }

      // Upload new images
      const uploadedImages = await Promise.all(
        files.map((file) => {
          return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "hero", resource_type: "image" },
              (error, result) => {
                if (error) reject(error);
                else {
                  resolve({
                    url: result.secure_url,
                    public_id: result.public_id,
                  });
                }
              }
            );
            stream.end(file.buffer);
          });
        })
      );

      // append images
      const totalImages = [...hero.images, ...uploadedImages];

      if (totalImages.length > 10) {
        return res.status(400).json({ message: "Max 10 images allowed" });
      }

      hero.type = "image";
      hero.images = totalImages;
      hero.video = undefined;

      await hero.save();

      return res.json({ message: "Images updated", hero });
    }

    // ================= VIDEO MODE =================
    if (type === "video") {
      const file = req.files?.video?.[0];

      if (!file) {
        return res.status(400).json({ message: "Video required" });
      }

      // delete old video
      if (hero.video?.public_id) {
        await cloudinary.uploader.destroy(hero.video.public_id, {
          resource_type: "video",
        });
      }

      const video = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "hero", resource_type: "video" },
          (error, result) => {
            if (error) reject(error);
            else {
              resolve({
                url: result.secure_url,
                public_id: result.public_id,
              });
            }
          }
        );
        stream.end(file.buffer);
      });

      hero.type = "video";
      hero.video = video;
      hero.images = [];

      await hero.save();

      return res.json({ message: "Video updated", hero });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * DELETE IMAGE
 */
exports.deleteImage = async (req, res) => {
  try {
    const { id } = req.params;

    const hero = await Hero.findOne();

    if (!hero) {
      return res.status(404).json({ message: "Hero not found" });
    }

    const image = hero.images.id(id);

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // delete from cloudinary
    await cloudinary.uploader.destroy(image.public_id);

    // remove from DB
    image.deleteOne();

    await hero.save();

    res.json({ message: "Image deleted", hero });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};