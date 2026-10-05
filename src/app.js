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
    "https://vrs-admin.vercel.app",
    "https://www.vrsrealinvest.com.au",
    "https://vrsrealinvest.com.au",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
};

app.use(cors(corsConfig));

app.use(express.json());