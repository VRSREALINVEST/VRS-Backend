const crypto = require("crypto");
const Admin = require("../models/Admin");
const jwt = require("jsonwebtoken");
const { hashPassword, verifyPassword, isHashed } = require("../utils/password");

const ROLES = ["admin", "superadmin"];
// Same shape check as the enquiry form's email field.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Generate JWT Token
 */
const generateToken = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      role: admin.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// Checked when the email is unknown, so that case costs the same scrypt work
// as a wrong password and the response time doesn't reveal which emails exist.
let dummyHash;
const getDummyHash = async () =>
  (dummyHash ??= await hashPassword(crypto.randomBytes(16).toString("hex")));

/**
 * @route   POST /api/auth/login
 */
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Strings only: an object such as {"$regex": "..."} would otherwise reach
    // the query as a MongoDB operator and match an admin without its email.
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email ||
      !password
    ) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email });
    const valid = await verifyPassword(
      password,
      admin ? admin.password : await getDummyHash()
    );

    if (!admin || !valid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Accounts created before hashing still hold a plaintext password; it is
    // replaced with a hash on the first successful login. Best effort: a
    // failed write must not block a correct login (it retries next time).
    if (!isHashed(admin.password)) {
      try {
        await Admin.updateOne(
          { _id: admin._id },
          { password: await hashPassword(password) }
        );
      } catch (error) {
        console.error("Password rehash failed for admin", String(admin._id));
      }
    }

    const token = generateToken(admin);

    res.status(200).json({
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route   POST /api/auth/create-admin
 */
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (typeof email !== "string" || !EMAIL.test(email)) {
      return res.status(400).json({ message: "A valid email is required" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }
    if (name !== undefined && typeof name !== "string") {
      return res.status(400).json({ message: "Name must be text" });
    }
    if (role !== undefined && !ROLES.includes(role)) {
      return res
        .status(400)
        .json({ message: "Role must be admin or superadmin" });
    }

    if (await Admin.exists({ email })) {
      return res.status(409).json({ message: "Admin already exists" });
    }

    const newAdmin = await Admin.create({
      name,
      email,
      password: await hashPassword(password),
      role: role || "admin",
    });

    // Never echo the password (or its hash) back.
    res.status(201).json({
      message: "Admin created successfully",
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Admin already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
};



exports.getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select("-password");

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json(admin);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
