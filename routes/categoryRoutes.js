const express = require("express");
const router = express.Router();
const { getCategories, createCategory } = require("../controller/categoryController");
const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/roleMiddleware");

router.get("/", getCategories);
router.post("/", protect, adminOnly, createCategory);

module.exports = router;