const SecuredProperty = require("../models/SecuredProperty");
const Webinar = require("../models/webinarModel");
const Team = require("../models/Team");
const TextTestimonial = require("../models/TextTestimonial");
const VideoTestimonial = require("../models/VideoTestimonial");
const Enquiry = require("../models/Enquiry");
const { sendError } = require("../utils/validation");

exports.getDashboardStats = async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalProperties,
      totalWebinars,
      totalTeam,
      totalTextTestimonials,
      totalVideoTestimonials,
      totalEnquiries,
      propertiesThisMonth,
      upcomingWebinars,
      liveWebinar,
      securedValueAggregation,
    ] = await Promise.all([

      // Total Properties
      SecuredProperty.countDocuments(),

      // Total Webinars
      Webinar.countDocuments(),

      // Team Members
      Team.countDocuments(),

      // Testimonials
      TextTestimonial.countDocuments(),
      VideoTestimonial.countDocuments(),

      // Enquiries
      Enquiry.countDocuments(),

      // Properties added this month
      SecuredProperty.countDocuments({
        createdAt: { $gte: startOfMonth },
      }),

      // Upcoming webinars
      Webinar.countDocuments({
        date: { $gte: new Date() },
      }),

      // Live webinar
      Webinar.findOne({ status: "live" }),

      // Total secured value aggregation
      SecuredProperty.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$securedPrice" },
          },
        },
      ]),
    ]);

    const totalSecuredValue =
      securedValueAggregation.length > 0
        ? securedValueAggregation[0].total
        : 0;

    res.json({
      properties: totalProperties,
      propertiesThisMonth,
      totalSecuredValue,

      webinars: totalWebinars,
      upcomingWebinars,
      isWebinarLive: !!liveWebinar,

      team: totalTeam,
      testimonials: totalTextTestimonials + totalVideoTestimonials,
      enquiries: totalEnquiries || 0,
    });

  } catch (error) {
    sendError(res, error);
  }
};