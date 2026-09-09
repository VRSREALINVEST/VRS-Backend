const Blog = require("../models/Blog");
const slugify = require("slugify");
const cloudinary = require("../config/cloudinary");

// Posts created before publishDate existed have no such field; they are
// treated as already published rather than hidden.
const visibleToPublic = () => ({
  isPublished: true,
  $or: [
    { publishDate: { $exists: false } },
    { publishDate: null },
    { publishDate: { $lte: new Date() } },
  ],
});

// FormData sends every value as a string, so "false" must not be truthy.
const toBoolean = (value, fallback) => {
  if (value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1";
};

const toDate = (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const clean = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

/**
 * Slugs are the public URL, so they are generated once at creation and never
 * recomputed on update. A collision gets a numeric suffix rather than failing
 * with a duplicate-key error.
 */
const buildUniqueSlug = async (title) => {
  const base = slugify(title, { lower: true, strict: true }) || "post";

  let candidate = base;
  let suffix = 2;

  // Bounded so a pathological data set cannot spin forever.
  while (suffix < 200 && (await Blog.exists({ slug: candidate }))) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

const uploadImage = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "blogs" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });

// Cloudinary public ids include the folder, so rebuild it from the URL path
// after the version segment rather than taking only the last filename.
const publicIdFromUrl = (url) => {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
};

const fail = (res, error, fallback = "Something went wrong") => {
  if (error && error.code === 11000) {
    return res.status(409).json({ message: "A blog with that slug already exists" });
  }
  if (error && error.name === "ValidationError") {
    return res.status(400).json({ message: "Please check the blog fields" });
  }
  if (error && error.name === "CastError") {
    return res.status(400).json({ message: "Invalid blog id" });
  }
  console.error("Blog error:", error && error.message);
  return res.status(500).json({ message: fallback });
};

/**
 * @route   GET /api/blog
 * @access  Public — published, already-due posts only.
 */
exports.getBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find(visibleToPublic()).sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    fail(res, error, "Failed to load blogs");
  }
};

/**
 * @route   GET /api/blog/admin/all
 * @access  Admin — includes drafts and scheduled posts.
 *
 * Registered before GET /:slug so "admin" is not read as a slug.
 */
exports.getAllBlogsForAdmin = async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    fail(res, error, "Failed to load blogs");
  }
};

/**
 * @route   GET /api/blog/:slug
 * @access  Public — published only, so drafts stay unindexable.
 */
exports.getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({
      slug: req.params.slug,
      ...visibleToPublic(),
    });

    if (!blog) return res.status(404).json({ message: "Not found" });
    res.json(blog);
  } catch (error) {
    fail(res, error, "Failed to load blog");
  }
};

/**
 * @route   POST /api/blog
 * @access  Admin
 */
exports.createBlog = async (req, res) => {
  let uploadedPublicId = null;

  try {
    const { title, excerpt, content } = req.body;

    if (!clean(title) || !clean(excerpt) || !clean(content)) {
      return res
        .status(400)
        .json({ message: "Title, excerpt and content are required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "A featured image is required" });
    }

    const slug = await buildUniqueSlug(title);

    const result = await uploadImage(req.file.buffer);
    uploadedPublicId = result.public_id;

    const blog = await Blog.create({
      title: clean(title),
      slug,
      excerpt: clean(excerpt),
      content,
      image: result.secure_url,
      author: clean(req.body.author),
      imageAlt: clean(req.body.imageAlt),
      imageTitle: clean(req.body.imageTitle),
      publishDate: toDate(req.body.publishDate),
      metaTitle: clean(req.body.metaTitle),
      metaDescription: clean(req.body.metaDescription),
      isPublished: toBoolean(req.body.isPublished, true),
    });

    res.status(201).json(blog);
  } catch (error) {
    // The image is uploaded before the insert, so clean it up rather than
    // leaving an orphan in Cloudinary when the insert fails.
    if (uploadedPublicId) {
      cloudinary.uploader.destroy(uploadedPublicId).catch(() => {});
    }
    fail(res, error, "Failed to create blog");
  }
};

/**
 * @route   PUT /api/blog/:id
 * @access  Admin
 */
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    let imageUrl = blog.image;

    if (req.file) {
      const result = await uploadImage(req.file.buffer);
      imageUrl = result.secure_url;
    }

    // Only assign what was actually sent, so a partial save cannot blank a
    // field that the form did not include.
    const update = { image: imageUrl };

    const assign = (key, value) => {
      if (value !== undefined) update[key] = value;
    };

    assign("title", clean(req.body.title));
    assign("excerpt", clean(req.body.excerpt));
    assign("author", clean(req.body.author));
    assign("imageAlt", clean(req.body.imageAlt));
    assign("imageTitle", clean(req.body.imageTitle));
    assign("metaTitle", clean(req.body.metaTitle));
    assign("metaDescription", clean(req.body.metaDescription));
    assign("publishDate", toDate(req.body.publishDate));

    if (req.body.content !== undefined) update.content = req.body.content;

    if (req.body.isPublished !== undefined) {
      update.isPublished = toBoolean(req.body.isPublished, blog.isPublished);
    }

    // The slug is deliberately NOT recomputed here: it is the public URL, and
    // renaming an article must not break existing links or its search ranking.

    const updatedBlog = await Blog.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    res.json(updatedBlog);
  } catch (error) {
    fail(res, error, "Failed to update blog");
  }
};

/**
 * @route   DELETE /api/blog/:id
 * @access  Admin
 */
exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    if (blog.image) {
      const publicId = publicIdFromUrl(blog.image);
      // A failed image cleanup must not stop the post itself being removed.
      if (publicId) {
        await cloudinary.uploader.destroy(publicId).catch(() => {});
      }
    }

    await Blog.findByIdAndDelete(id);

    res.json({ message: "Blog permanently deleted" });
  } catch (error) {
    fail(res, error, "Failed to delete blog");
  }
};
