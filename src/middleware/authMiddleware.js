const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (!/^Bearer$/i.test(scheme) || !token) {
    return res.status(401).json({ message: "No token" });
  }

  try {
    // Tokens are only ever issued as HS256 (authController); refuse any other
    // algorithm rather than accepting whatever the token header claims.
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};
