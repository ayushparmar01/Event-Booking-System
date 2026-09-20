const Event = require("../models/eventModel");
const Category = require("../models/categoryModel");

// GET /api/events  (?category=<categoryId> se filter)
exports.getEvents = async (req, res) => {
    try {
        const filter = {};
        if (req.query.category) {
            filter.category = req.query.category;
        }

        const events = await Event.find(filter)
            .populate("category", "name")
            .sort({ date: 1 });

        res.json({ success: true, count: events.length, events });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/events/:id
exports.getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate("category", "name");
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }
        res.json({ success: true, event });
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(404).json({ success: false, message: "Event not found" });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/events (only admin)
exports.createEvent = async (req, res) => {
    try {
        const { title, description, date, location, price, totalSeats, category } = req.body;

        if (!title || !description || !date || !location || !totalSeats || !category) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(400).json({ success: false, message: "Invalid category" });
        }

        const event = await Event.create({
            title,
            description,
            date,
            location,
            price,
            totalSeats,
            availableSeats: totalSeats,
            category,
            createdBy: req.user._id
        });

        res.status(201).json({ success: true, event });
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/events/:id (only admin)
exports.updateEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        const fields = ["title", "description", "date", "location", "price", "category"];
        fields.forEach((field) => {
            if (req.body[field] !== undefined) {
                event[field] = req.body[field];
            }
        });

        // seats badalne par booked seats ka dhyan rakho
        if (req.body.totalSeats !== undefined) {
            const bookedSeats = event.totalSeats - event.availableSeats;
            if (req.body.totalSeats < bookedSeats) {
                return res.status(400).json({
                    success: false,
                    message: `Total seats cannot be less than already booked seats (${bookedSeats})`
                });
            }
            event.totalSeats = req.body.totalSeats;
            event.availableSeats = req.body.totalSeats - bookedSeats;
        }

        await event.save();
        res.json({ success: true, event });
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/events/:id (only admin)
exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }
        res.json({ success: true, message: "Event deleted" });
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(404).json({ success: false, message: "Event not found" });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};
