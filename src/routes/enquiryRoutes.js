const express = require("express");
const router = express.Router();
const controller = require("../controllers/enquiryController");
const authMiddleware = require("../middleware/authMiddleware");

// Public — the website enquiry popup submits here.
router.post("/", controller.createEnquiry);

// Admin only — visitors must never read or modify enquiries.
router.get("/", authMiddleware, controller.getEnquiries);
router.get("/:id", authMiddleware, controller.getEnquiryById);
router.put("/:id/status", authMiddleware, controller.updateEnquiryStatus);
router.delete("/:id", authMiddleware, controller.deleteEnquiry);

module.exports = router;
