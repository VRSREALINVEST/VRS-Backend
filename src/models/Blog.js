const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, required: true },
    content: { type: String, required: true },
    image: { type: String, required: true },

    // Shown on the public article and used for its alt/title attributes.
    // Optional so every blog stored before these fields existed stays valid.
    author: { type: String, trim: true },
    imageAlt: { type: String, trim: true },
    imageTitle: { type: String, trim: true },

    // When the article should become publicly visible. Optional for the same
    // backwards-compatibility reason: existing posts have no publishDate and
    // are treated as already published.
    publishDate: { type: Date },

    metaTitle: String,
    metaDescription: String,

    // Default stays true so anything created by an older client keeps the
    // behaviour it had before drafts existed. The CMS always sends it explicitly.
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Blog", blogSchema);
