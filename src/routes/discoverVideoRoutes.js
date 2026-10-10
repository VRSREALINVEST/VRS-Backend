const express = require("express");
const router = express.Router();
const controller = require("../controllers/discoverVideoController");
const upload = require("../middleware/upload");
const requireAdmin = require("../middleware/requireAdmin");

router.get("/", controller.getVideo);

// Admin only; the admin check runs before multer buffers the thumbnail.
router.put("/", requireAdmin, upload.single("thumbnail"), controller.updateVideo);

module.exports = router;
