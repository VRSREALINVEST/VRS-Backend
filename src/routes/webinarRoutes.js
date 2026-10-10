const express = require("express");
const router = express.Router();
const webinarController = require("../controllers/webinarController");
const requireAdmin = require("../middleware/requireAdmin");
const validateObjectId = require("../middleware/validateObjectId");

// Writes are admin only; the list stays public for the website.
router.post("/", requireAdmin, webinarController.createWebinar);
router.get("/", webinarController.getWebinars);
router.put("/:id", requireAdmin, validateObjectId, webinarController.updateWebinar);
router.delete("/:id", requireAdmin, validateObjectId, webinarController.deleteWebinar);

module.exports = router;
