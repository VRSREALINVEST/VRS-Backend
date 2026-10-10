const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const rateLimit = require("../middleware/rateLimit");

// Brute-force brake: 10 attempts per client per 15 minutes.
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please try again later.",
});

// Login
router.post("/login", loginLimit, authController.loginAdmin);

// Create Admin
router.post(
  "/create-admin",
  authMiddleware,
  roleMiddleware("superadmin"),
  authController.createAdmin
);

// Get Profile
router.get(
  "/profile",
  requireAdmin,
  authController.getProfile
);

module.exports = router;
