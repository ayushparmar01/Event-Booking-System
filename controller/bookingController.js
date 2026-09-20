const Booking = require("../models/bookingModel");
const Event = require("../models/eventModel");

// POST /api/bookings  (login user)  body: { eventId, seats }
exports.createBooking = async (req, res) => {
    try {
        const { eventId, seats } = req.body;

        if (!eventId || !seats) {
            return res.status(400).json({ success: false, message: "eventId and seats are required" });
        }
        if (!Number.isInteger(seats) || seats < 1) {
            return res.status(400).json({ success: false, message: "Seats must be a whole number, at least 1" });
        }

        const existing = await Event.findById(eventId);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }
        if (existing.date < new Date()) {
            return res.status(400).json({ success: false, message: "This event is already over" });
        }

        // Seats ek hi step me check + kam hoti hain, taaki overbooking na ho
        const event = await Event.findOneAndUpdate(
            { _id: eventId, availableSeats: { $gte: seats } },
            { $inc: { availableSeats: -seats } },
            { new: true }
        );
        if (!event) {
            return res.status(400).json({
                success: false,
                message: `Not enough seats available (only ${existing.availableSeats} left)`
            });
        }

        let booking;
        try {
            booking = await Booking.create({
                user: req.user._id,
                event: event._id,
                seats,
                totalPrice: event.price * seats
            });
        } catch (err) {
            // booking save nahi hui toh seats wapas kar do
            await Event.findByIdAndUpdate(event._id, { $inc: { availableSeats: seats } });
            throw err;
        }

        res.status(201).json({ success: true, booking });
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(404).json({ success: false, message: "Event not found" });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/bookings/my  (login user apni bookings dekhe)
exports.getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user._id })
            .populate("event", "title date location price")
            .sort({ createdAt: -1 });

        res.json({ success: true, count: bookings.length, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/bookings/:id/cancel  (apni booking cancel, admin kisi ki bhi)
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        const isOwner = booking.user.toString() === req.user._id.toString();
        if (!isOwner && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "You can cancel only your own booking" });
        }

        // sirf tab cancel ho jab abhi confirmed ho (double cancel se bachne ke liye)
        const cancelled = await Booking.findOneAndUpdate(
            { _id: booking._id, status: "confirmed" },
            { status: "cancelled" },
            { new: true }
        );
        if (!cancelled) {
            return res.status(400).json({ success: false, message: "Booking is already cancelled" });
        }

        // seats wapas event me jod do
        await Event.findByIdAndUpdate(booking.event, { $inc: { availableSeats: booking.seats } });

        res.json({ success: true, message: "Booking cancelled", booking: cancelled });
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/bookings  (sirf admin: sabki bookings)
exports.getAllBookings = async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate("user", "name email")
            .populate("event", "title date")
            .sort({ createdAt: -1 });

        res.json({ success: true, count: bookings.length, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};