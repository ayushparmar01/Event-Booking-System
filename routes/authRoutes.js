const express = require("express");
const router = express.Router();
const { registerUser, login } = require("../middleware/authMiddleware");

router.post("/register", registerUser);
router.post("/login", login);

module.exports = router;