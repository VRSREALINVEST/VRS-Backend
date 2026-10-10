const express = require("express");
const router = express.Router();
const controller = require("../controllers/videoTestimonialController");
const requireAdmin = require("../middleware/requireAdmin");
const validateObjectId = require("../middleware/validateObjectId");


router.get("/", controller.getVideos);

// Admin only.
router.post("/", requireAdmin, controller.createVideo);
router.put("/:id", requireAdmin, validateObjectId, controller.updateVideo);
router.delete("/:id", requireAdmin, validateObjectId, controller.deleteVideo);

module.exports = router;
