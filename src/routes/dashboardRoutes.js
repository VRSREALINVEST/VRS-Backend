const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const requireAdmin = require("../middleware/requireAdmin");

// Admin dashboard figures (including the enquiry count) are not public.
router.get("/stats", requireAdmin, dashboardController.getDashboardStats);

module.exports = router;
