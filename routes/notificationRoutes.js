const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const Notification = require("../models/Notification");

// @route   GET api/notifications
// @desc    Get all notifications for current user
// @access  Private
router.get("/", auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ receiver: req.user._id })
            .populate("sender", "name profilePicture")
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(notifications);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   PATCH api/notifications/:id/read
// @desc    Mark a notification as read
// @access  Private
router.patch("/:id/read", auth, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        if (notification.receiver.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "User not authorized" });
        }

        notification.isRead = true;
        await notification.save();
        res.json(notification);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   PATCH api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.patch("/read-all", auth, async (req, res) => {
    try {
        await Notification.updateMany(
            { receiver: req.user._id, isRead: false },
            { isRead: true }
        );
        res.json({ message: "All notifications marked as read" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
