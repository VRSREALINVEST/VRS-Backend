const express = require("express");
const router = express.Router();
const controller = require("../controllers/enquiryController");
const requireAdmin = require("../middleware/requireAdmin");
const rateLimit = require("../middleware/rateLimit");

// Public, but throttled so the form (and the admin notification each one
// triggers) can't be flooded: 5 submissions per client per 15 minutes.
const enquiryLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many enquiries. Please try again later.",
});

// Public — the website enquiry popup submits here.
router.post("/", enquiryLimit, controller.createEnquiry);

// Admin only — visitors must never read or modify enquiries.
// "/stats" is declared before "/:id" so it is not matched as an enquiry id.
router.get("/stats", requireAdmin, controller.getEnquiryStats);
router.get("/", requireAdmin, controller.getEnquiries);
router.get("/:id", requireAdmin, controller.getEnquiryById);
router.put("/:id/status", requireAdmin, controller.updateEnquiryStatus);
router.delete("/:id", requireAdmin, controller.deleteEnquiry);

module.exports = router;
