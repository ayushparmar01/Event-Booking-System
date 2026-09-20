const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === "admin") {
        return next();
    }
    res.status(403).json({ success: false, message: "Access denied, admin only" });
};

module.exports = adminOnly;