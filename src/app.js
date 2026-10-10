const express = require("express");
const cors = require("cors");
const multer = require("multer");

const authRoutes = require("./routes/authRoutes");
const heroRoutes = require("./routes/heroRoutes");
const securedPropertyRoutes = require("./routes/securedPropertyRoutes");
const webinarRoutes = require("./routes/webinarRoutes");
const discoverVideoRoutes = require("./routes/discoverVideoRoutes");
const teamRoutes = require("./routes/teamRoutes");
const textTestimonialRoutes = require("./routes/textTestimonialRoutes");
const videoTestimonialRoutes = require("./routes/videoTestimonialRoutes");
const blogRoutes = require("./routes/blogRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");

const app = express();

app.disable("x-powered-by");

// The API sits behind exactly one reverse proxy (Hostinger's LiteSpeed), so
// req.ip is taken from the X-Forwarded-For entry that proxy adds, and the
// login/enquiry rate limits see the real visitor instead of the proxy.
// Set TRUST_PROXY to the number of proxy hops if the hosting changes. Any
// other value would silently put every visitor in one rate-limit bucket (a
// few bad logins could then lock out every admin), so it falls back to 1.
const proxyHops = process.env.TRUST_PROXY ?? "1";
if (!/^\d+$/.test(proxyHops)) {
  console.warn("[security] TRUST_PROXY must be a whole number of proxy hops; using 1.");
}
app.set("trust proxy", /^\d+$/.test(proxyHops) ? Number(proxyHops) : 1);

const corsConfig = {
  origin: [
    "https://admin.vrsrealinvest.com.au",
    "https://vrs-admin.vercel.app",
    "https://www.vrsrealinvest.com.au",
    "https://vrsrealinvest.com.au",
    "http://localhost:3001",
    "http://localhost:3000",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
};

app.use(cors(corsConfig));

// One audit line per write (never the body), so changes to site content and
// rejected attempts can be traced in the server logs. Registered before the
// body parser so requests it rejects are logged too.
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  res.on("finish", () => {
    console.log(
      `[audit] ${req.method} ${req.originalUrl} ${res.statusCode} admin=${req.admin?.id || "-"} ip=${req.ip}`
    );
  });
  next();
});

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/hero", heroRoutes);
app.use("/api/secured-properties", securedPropertyRoutes);
app.use("/api/webinars", webinarRoutes);
app.use("/api/discover-video", discoverVideoRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/text-testimonials", textTestimonialRoutes);
app.use("/api/video-testimonials", videoTestimonialRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/enquiries", enquiryRoutes);

// Last stop for errors from body parsing, multer and route handlers: always
// JSON with a fitting status, never Express's HTML page or a stack trace.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ message: err.message });
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }

  res.status(status).json({
    message: err.type === "entity.parse.failed" ? "Malformed JSON body" : err.message,
  });
});

module.exports = app;