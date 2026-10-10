const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

// Enquiry events carry lead contact details, so they are broadcast to this
// room only, and a socket joins it solely after proving it holds a valid
// admin JWT.
const ADMIN_ROOM = "admins";

let io = null;

// Mirrors the frontend URLs the backend already knows about. No production
// host is hardcoded; both come from the environment.
const allowedOrigins = () =>
  [process.env.ADMIN_FRONTEND_URL, process.env.USER_FRONTEND_URL].filter(
    Boolean
  );

/**
 * Attach Socket.IO to the existing HTTP server.
 * Never creates a second server, and is a no-op if already initialised.
 */
const initSocket = (httpServer) => {
  if (io) return io;

  const origins = allowedOrigins();

  io = new Server(httpServer, {
    cors: {
      // Falls back to reflecting the request origin only when no frontend URLs
      // are configured, which is the local-development case.
      origin: origins.length > 0 ? origins : true,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Handshake auth uses the same token and secret as authMiddleware, so a
  // public website visitor can never subscribe to admin enquiry events.
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;

    if (!token) return next(new Error("Unauthorized"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });
      // Same admin roles as requireAdmin on the REST routes.
      if (!["admin", "superadmin"].includes(decoded.role)) {
        return next(new Error("Unauthorized"));
      }
      socket.admin = { id: decoded.id, role: decoded.role };
      next();
    } catch (error) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(ADMIN_ROOM);

    // Log the admin id only, never lead contact details.
    console.log(`Admin socket connected: ${socket.admin.id}`);

    socket.on("disconnect", () => {
      console.log(`Admin socket disconnected: ${socket.admin.id}`);
    });
  });

  return io;
};

/**
 * The fields the authenticated admin dashboard renders for an enquiry, which
 * is the same set GET /api/enquiries already returns to that admin. Excludes
 * mongo internals such as __v.
 */
const toAdminPayload = (enquiry) => ({
  _id: enquiry._id,
  name: enquiry.name,
  email: enquiry.email,
  phone: enquiry.phone,
  requirement: enquiry.requirement,
  propertyType: enquiry.propertyType,
  preferredLocation: enquiry.preferredLocation,
  message: enquiry.message,
  status: enquiry.status,
  createdAt: enquiry.createdAt,
  updatedAt: enquiry.updatedAt,
});

/**
 * Broadcast a newly created enquiry to connected admins.
 * Call this ONLY after MongoDB has confirmed the write.
 *
 * A socket failure must never fail the visitor's submission, so everything
 * here is best-effort.
 */
const emitNewEnquiry = (enquiry) => {
  if (!io) return;

  try {
    io.to(ADMIN_ROOM).emit("enquiry:new", toAdminPayload(enquiry));
  } catch (error) {
    console.error("Socket emit failed for enquiry:new");
  }
};

/** Stop accepting socket connections during shutdown. */
const closeSocket = () => {
  if (!io) return;
  io.close();
  io = null;
};

module.exports = {
  initSocket,
  emitNewEnquiry,
  closeSocket,
  toAdminPayload,
  ADMIN_ROOM,
};
