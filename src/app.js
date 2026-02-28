require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const { sequelize } = require("./models");
const authRoutes = require("./routes/authRoutes");
const branchRoutes = require("./routes/branchRoutes");
const menuRoutes = require("./routes/menuRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const qrRoutes = require("./routes/qrRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const abaRoutes = require("./routes/abaRoutes"); // Import ABA routes


// ─── App Initialization ───────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;


// ─── Middleware Setup ─────────────────────────────────────────────────────────
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(helmet()); // Set various security HTTP headers
app.use(express.json({ limit: "10mb" })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: "10mb" })); // Parse URL-encoded bodies


// Use morgan for logging in development environment
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}


// Serve static files (uploaded images)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));


// ─── API Routes ───────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
    message: "Server is running."
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/aba", abaRoutes); // Register ABA routes here


// ─── Error Handling Middleware ──────────────────────────────────────────────


// 404 Not Found handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "Route not found." });
});


// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "An unexpected error occurred.",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});


const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection has been established successfully.");
    // ❌ Do NOT auto-sync when using manual schema
    await sequelize.sync();
    app.listen(PORT, () => {
      console.log(`✅ Server is running on http://localhost:${PORT}`);
      console.log(`🚀 API health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
    process.exit(1);
  }
};
startServer();
