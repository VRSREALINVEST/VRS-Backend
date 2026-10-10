const express = require("express");
const router = express.Router();

const controller = require("../controllers/securedPropertyController");
const upload = require("../middleware/upload");
const requireAdmin = require("../middleware/requireAdmin");
const validateObjectId = require("../middleware/validateObjectId");

// GET ALL
router.get("/", controller.getAllProperties);

// Writes are admin only, and the admin check runs before multer so an
// unauthenticated upload is never buffered or sent to Cloudinary.
router.post(
  "/",
  requireAdmin,
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
  ]),
  controller.createProperty,
);

router.put(
  "/:id",
  requireAdmin,
  validateObjectId,
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
  ]),
  controller.updateProperty,
);

// DELETE
router.delete("/:id", requireAdmin, validateObjectId, controller.deleteProperty);

module.exports = router;
