const express = require("express");
const router = express.Router();
const checkAuth = require("../middleware/authMiddleware");
const Message = require("../models/Message");
const User = require("../models/User");

// @route   POST /api/messages/send
// @desc    Send a message to a connection
router.post("/send", checkAuth, async (req, res) => {
    try {
        const { recipientId, content } = req.body;
        const senderId = req.user.id;

        if (!content || !recipientId) {
            return res.status(400).json({ message: "Recipient and content are required" });
        }

        // Verify recipient exists
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ message: "Recipient not found" });
        }

        // Create new message
        const newMessage = new Message({
            sender: senderId,
            recipient: recipientId,
            content,
        });

        await newMessage.save();

        // Socket.io integration (if available in req)
        if (req.io) {
            // Emit to recipient if they are online (joined their room)
            req.io.to(recipientId).emit("receiveMessage", {
                _id: newMessage._id,
                sender: { _id: senderId, name: req.user.name, profilePic: req.user.profilePic }, // Basic sender info
                recipient: recipientId,
                content: newMessage.content,
                createdAt: newMessage.createdAt
            });
        }

        res.status(201).json(newMessage);
    } catch (err) {
        console.error("Error sending message:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   GET /api/messages/:otherUserId
// @desc    Get conversation between current user and another user
router.get("/:otherUserId", checkAuth, async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const currentUserId = req.user.id;

        const messages = await Message.find({
            $or: [
                { sender: currentUserId, recipient: otherUserId },
                { sender: otherUserId, recipient: currentUserId },
            ],
        })
            .sort({ createdAt: 1 }) // Oldest first
            .populate("sender", "name profilePic")
            .populate("recipient", "name profilePic");

        res.json(messages);
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   PUT /api/messages/read/:otherUserId
// @desc    Mark all messages from specific user as read
router.put("/read/:otherUserId", checkAuth, async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const currentUserId = req.user.id;

        await Message.updateMany(
            { sender: otherUserId, recipient: currentUserId, read: false },
            { $set: { read: true } }
        );

        res.json({ message: "Messages marked as read" });
    } catch (err) {
        console.error("Error marking messages as read:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
