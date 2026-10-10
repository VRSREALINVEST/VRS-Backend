const express = require("express");
const router = express.Router();
const controller = require("../controllers/textTestimonialController");
const requireAdmin = require("../middleware/requireAdmin");
const validateObjectId = require("../middleware/validateObjectId");

router.get("/", controller.getTestimonials);

// Admin only.
router.post("/", requireAdmin, controller.createTestimonial);
router.put("/:id", requireAdmin, validateObjectId, controller.updateTestimonial);
router.delete("/:id", requireAdmin, validateObjectId, controller.deleteTestimonial);

module.exports = router;
