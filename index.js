/*
const express = require("express");
const dotenv = require("dotenv");
connectDB = require("./config/db");
dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(express.json());
// Test route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Booking System Backend is running"
    });
});

app.use("/api/auth", require("./routes/authRoutes"));

const router = express.Router();
const { getCategories, createCategory } = require("./controller/categoryController");
const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/roleMiddleware");

router.get("/", getCategories);
router.post("/", protect, adminOnly, createCategory);

module.exports = router;



// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
*/

const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Health check (browser me "/" ab frontend page kholta hai)
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Booking System Backend is running"
    });
});

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/bookings", require("./routes/bookingRoutes"));

// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});