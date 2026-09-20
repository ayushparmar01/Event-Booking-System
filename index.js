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




// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});