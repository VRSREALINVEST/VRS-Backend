const express = require("express");
const router = express.Router();
const controller = require("../controllers/teamController");
const upload = require("../middleware/upload");
const requireAdmin = require("../middleware/requireAdmin");
const validateObjectId = require("../middleware/validateObjectId");

router.get("/", controller.getTeam);

// Admin only; the admin check runs before multer buffers any upload.
router.post("/", requireAdmin, upload.single("image"), controller.createMember);
router.put("/:id", requireAdmin, validateObjectId, upload.single("image"), controller.updateMember);
router.delete("/:id", requireAdmin, validateObjectId, controller.deleteMember);

module.exports = router;
