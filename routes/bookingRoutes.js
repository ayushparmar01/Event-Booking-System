const express = require("express");
const router = express.Router();
const {
    createBooking,
    getMyBookings,
    cancelBooking,
    getAllBookings
} = require("../controller/bookingController");
const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/roleMiddleware");

router.post("/", protect, createBooking);
router.get("/my", protect, getMyBookings);
router.get("/", protect, adminOnly, getAllBookings);
router.put("/:id/cancel", protect, cancelBooking);

module.exports = router;