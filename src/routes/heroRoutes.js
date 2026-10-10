const express = require("express");
const router = express.Router();
const heroController = require("../controllers/heroController");
const upload = require("../middleware/upload");
const requireAdmin = require("../middleware/requireAdmin");
const validateObjectId = require("../middleware/validateObjectId");

router.get("/", heroController.getHero);

router.put(
  "/",
  requireAdmin,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "video", maxCount: 1 },
  ]),
  heroController.updateHero
);

router.delete(
  "/image/:id",
  requireAdmin,
  validateObjectId,
  heroController.deleteImage
);

module.exports = router;
