const Blog = require("../models/Blog");
const slugify = require("slugify");
const cloudinary = require("../config/cloudinary");

// GET ALL
exports.getBlogs = async (req, res) => {
  const blogs = await Blog.find({ isPublished: true }).sort({ createdAt: -1 });
  res.json(blogs);
};

// GET SINGLE BY SLUG (public — published only, so drafts stay unindexable)
exports.getBlogBySlug = async (req, res) => {
  const blog = await Blog.findOne({ slug: req.params.slug, isPublished: true });
  if (!blog) return res.status(404).json({ message: "Not found" });
  res.json(blog);
};

// CREATE BLOG
exports.createBlog = async (req, res) => {
  try {
    const { title, excerpt, content, metaTitle, metaDescription } = req.body;

    const slug = slugify(title, { lower: true, strict: true });

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "blogs" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const blog = await Blog.create({
      title,
      slug,
      excerpt,
      content,
      image: result.secure_url,
      metaTitle,
      metaDescription,
    });

    res.status(201).json(blog);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // 🔥 Delete image from Cloudinary
    if (blog.image) {
      const publicId = blog.image
        .split("/")
        .slice(-1)[0]
        .split(".")[0];

      await cloudinary.uploader.destroy(`blogs/${publicId}`);
    }

    await Blog.findByIdAndDelete(id);

    res.json({ message: "Blog permanently deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};




// UPDATE BLOG
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, excerpt, content, metaTitle, metaDescription } = req.body;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    let imageUrl = blog.image;

    // If new image uploaded
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "blogs" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      imageUrl = result.secure_url;
    }

    // Update slug if title changed
    const slug = title
      ? slugify(title, { lower: true, strict: true })
      : blog.slug;

    const updatedBlog = await Blog.findByIdAndUpdate(
      id,
      {
        title,
        excerpt,
        content,
        metaTitle,
        metaDescription,
        slug,
        image: imageUrl,
      },
      { new: true }
    );

    res.json(updatedBlog);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};