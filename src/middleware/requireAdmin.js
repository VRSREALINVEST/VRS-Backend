const authMiddleware = require("./authMiddleware");
const roleMiddleware = require("./roleMiddleware");

// Gate for every admin-only route: a valid login token whose role is an admin
// role. Superadmin-only routes use roleMiddleware("superadmin") instead.
module.exports = [authMiddleware, roleMiddleware("admin", "superadmin")];
