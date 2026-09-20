const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
        title: 
        {
            type: String,
            required: true, 
            trim: true 
        },
        description:
         { 
            type: String,
            required: true, 
            trim: true 
        },
        date: 
        { 
            type: Date, 
            required: true 
        },
        location:
        { 
            type: String,
            required: true, 
            trim: true 
        },
        price: 
        { 
            type: Number, 
            required: true, 
            min: 0, 
            default: 0 
        },
        totalSeats: 
        { 
            type: Number, 
            required: true, 
            min: 1 
        },
        availableSeats: 
        { 
            type: Number, 
            min: 0 
        },
        category:
        { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Category", 
            required: true 
        },
        createdBy: 
        { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "User" 
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);