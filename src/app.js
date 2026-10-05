const express = require("express");
const cors = require("cors");

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

module.exports = app;