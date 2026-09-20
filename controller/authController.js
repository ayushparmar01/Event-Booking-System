const User = require("../models/userModel");
const generateToken = require("../utils/tokenUtils");

// register user apis
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if(!name || !email || !password) {
            return res.status(400).json({ message: " all fields are required" });
        }

        const userExists = await User.findOne({ email });
        if(userExists) {
            return res.status(400).json({ message: "User already exists" });
        }   

        const user = await User.create({
            name,
            email,
            password
        });
        res.status(201).json({
            success: true,
            token: generateToken(user._id),
            user: {
                _id: user._id,  
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// apis for login user
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        res.json({
            success: true,
            token: generateToken(user._id),
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

