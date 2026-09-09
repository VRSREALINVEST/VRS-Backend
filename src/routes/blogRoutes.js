const express = require("express");
const router = express.Router();
const controller = require("../controllers/blogController");
const upload = require("../middleware/upload");
const authMiddleware = require("../middleware/authMiddleware");

// Admin listing (includes drafts). Must be declared before "/:slug", otherwise
// "admin" would be matched as a slug.
router.get("/admin/all", authMiddleware, controller.getAllBlogsForAdmin);

// Public reads — published, already-due posts only.
router.get("/", controller.getBlogs);
router.get("/:slug", controller.getBlogBySlug);

// Writes are admin only: without this, anyone could publish, edit or delete
// articles, which would also defeat the draft/published distinction.
router.post("/", authMiddleware, upload.single("image"), controller.createBlog);
router.put("/:id", authMiddleware, upload.single("image"), controller.updateBlog);
router.delete("/:id", authMiddleware, controller.deleteBlog);

module.exports = router;
