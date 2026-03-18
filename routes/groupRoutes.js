const express = require("express");
const router = express.Router();
const checkAuth = require("../middleware/authMiddleware");
const Group = require("../models/Group");
const GroupMessage = require("../models/GroupMessage");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.user && (req.user.isAdmin || req.user.role === "admin")) {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Admins only." });
    }
};

// @route   POST /api/groups
// @desc    Create a new group (Admin only)
router.post("/", checkAuth, checkAdmin, async (req, res) => {
    try {
        const { name, description, profileImage, profileImagePublicId, isAllMemberGroup } = req.body;
        
        let members = req.body.members || [];
        if (isAllMemberGroup) {
            const allUsers = await User.find({}, "_id");
            members = allUsers.map(u => u._id);
        } else if (!members.includes(req.user.id)) {
            members.push(req.user.id);
        }

        const newGroup = new Group({
            name,
            description,
            profileImage: profileImage || "/default-group.jpg",
            profileImagePublicId,
            members,
            admin: req.user.id,
            isAllMemberGroup: !!isAllMemberGroup
        });

        await newGroup.save();
        res.status(201).json(newGroup);
    } catch (err) {
        console.error("Error creating group:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   GET /api/groups
// @desc    Get groups the user belongs to (Admins see all)
router.get("/", checkAuth, async (req, res) => {
    try {
        const isAdmin = req.user.isAdmin || req.user.role === "admin";
        let groups;
        if (isAdmin) {
            groups = await Group.find().populate("admin", "name");
        } else {
            groups = await Group.find({ members: req.user.id }).populate("admin", "name");
        }
        res.json(groups);
    } catch (err) {
        console.error("Error fetching groups:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   GET /api/groups/:groupId
// @desc    Get single group details
router.get("/:groupId", checkAuth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId)
            .populate("members", "name profilePicture role enrollmentNumber")
            .populate("admin", "name profilePicture");
        
        if (!group) return res.status(404).json({ message: "Group not found" });

        const isAdmin = req.user.isAdmin || req.user.role === "admin";
        if (!isAdmin && !group.members.some(m => m._id.toString() === req.user.id)) {
            return res.status(403).json({ message: "Not a member of this group" });
        }

        res.json(group);
    } catch (err) {
        console.error("Error fetching group:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   GET /api/groups/:groupId/messages
// @desc    Get messages for a group
router.get("/:groupId/messages", checkAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const isAdmin = req.user.isAdmin || req.user.role === "admin";
        
        // check membership
        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });
        
        if (!isAdmin && !group.members.includes(req.user.id)) {
            return res.status(403).json({ message: "Not a member of this group" });
        }

        const messages = await GroupMessage.find({ groupId })
            .sort({ createdAt: 1 })
            .populate("sender", "name profilePicture role");

        res.json(messages);
    } catch (err) {
        console.error("Error fetching group messages:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   POST /api/groups/send
// @desc    Send a message to a group (Text or Image)
router.post("/send", checkAuth, async (req, res) => {
    try {
        const { groupId, content, mediaUrl, mediaPublicId, type } = req.body;
        const senderId = req.user.id;
        const userRole = req.user.role;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        const isAdmin = req.user.isAdmin || req.user.role === "admin";
        
        // Members only
        if (!isAdmin && !group.members.includes(senderId)) {
            return res.status(403).json({ message: "Not a member of this group" });
        }

        // Faculty restriction
        if (!isAdmin && userRole === "faculty" && !group.allowFacultyMessaging) {
            return res.status(403).json({ message: "Messaging is disabled for faculty in this group" });
        }

        const newMessage = new GroupMessage({
            groupId,
            sender: senderId,
            content: content || "",
            mediaUrl,
            mediaPublicId,
            type: type || "text"
        });

        await newMessage.save();

        // Socket emission to group room
        if (req.io) {
            req.io.to(`group_${groupId}`).emit("receiveGroupMessage", {
                ...newMessage._doc,
                sender: { _id: senderId, name: req.user.name, profilePicture: req.user.profilePicture, role: userRole }
            });
        }

        res.status(201).json(newMessage);
    } catch (err) {
        console.error("Error sending group message:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   PUT /api/groups/:groupId/settings
// @desc    Update group settings (Admin only)
router.put("/:groupId/settings", checkAuth, checkAdmin, async (req, res) => {
    try {
        const { allowFacultyMessaging, description, name, profileImage, profileImagePublicId } = req.body;
        
        const updateData = { allowFacultyMessaging, description, name };
        if (profileImage) updateData.profileImage = profileImage;
        if (profileImagePublicId) updateData.profileImagePublicId = profileImagePublicId;

        const group = await Group.findByIdAndUpdate(
            req.params.groupId,
            { $set: updateData },
            { new: true }
        );
        res.json(group);
    } catch (err) {
        console.error("Error updating group settings:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   POST /api/groups/:groupId/invite
// @desc    Invite/Add members to group (Admin only)
router.post("/:groupId/invite", checkAuth, checkAdmin, async (req, res) => {
    try {
        const { userIds, selectAll } = req.body;
        let membersToAdd = userIds || [];

        if (selectAll) {
            const allUsers = await User.find({}, "_id");
            membersToAdd = allUsers.map(u => u._id);
        }

        const group = await Group.findById(req.params.groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        // Merge and remove duplicates
        const updatedMembers = [...new Set([...group.members.map(m => m.toString()), ...membersToAdd.map(m => m.toString())])];
        
        group.members = updatedMembers;
        await group.save();

        res.json({ message: "Members added successfully", group });
    } catch (err) {
        console.error("Error inviting members:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   DELETE /api/groups/:groupId/members/:memberId
// @desc    Remove a member from group (Admin only)
router.delete("/:groupId/members/:memberId", checkAuth, checkAdmin, async (req, res) => {
    try {
        const { groupId, memberId } = req.params;
        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        group.members = group.members.filter(m => m.toString() !== memberId);
        await group.save();

        res.json({ message: "Member removed", group });
    } catch (err) {
        console.error("Error removing member:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   DELETE /api/groups/:groupId/messages/:messageId
// @desc    Delete a message/media (Admin only or Sender)
router.delete("/:groupId/messages/:messageId", checkAuth, async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await GroupMessage.findById(messageId);
        if (!message) return res.status(404).json({ message: "Message not found" });

        const isAdmin = req.user.isAdmin || req.user.role === "admin";
        if (!isAdmin && message.sender.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        // If it has media, delete from Cloudinary
        if (message.mediaPublicId) {
            await cloudinary.uploader.destroy(message.mediaPublicId);
        }

        await GroupMessage.findByIdAndDelete(messageId);
        
        if (req.io) {
            req.io.to(`group_${req.params.groupId}`).emit("messageDeleted", messageId);
        }

        res.json({ message: "Message deleted" });
    } catch (err) {
        console.error("Error deleting message:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// @route   POST /api/groups/:groupId/react
// @desc    React to a message
router.post("/:groupId/react", checkAuth, async (req, res) => {
  try {
    const { messageId, emoji } = req.body;
    const userId = req.user.id;

    const message = await GroupMessage.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    // Check if user already reacted with this emoji
    const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);
    
    if (reactionIndex > -1) {
      const userIndex = message.reactions[reactionIndex].users.indexOf(userId);
      if (userIndex > -1) {
        // Remove reaction
        message.reactions[reactionIndex].users.splice(userIndex, 1);
        if (message.reactions[reactionIndex].users.length === 0) {
          message.reactions.splice(reactionIndex, 1);
        }
      } else {
        // Add user to existing emoji reaction
        message.reactions[reactionIndex].users.push(userId);
      }
    } else {
      // Create new emoji reaction
      message.reactions.push({ emoji, users: [userId] });
    }

    await message.save();

    // Socket emission
    if (req.io) {
      req.io.to(`group_${req.params.groupId}`).emit("messageReactionUpdate", {
        messageId,
        reactions: message.reactions
      });
    }

    res.json(message.reactions);
  } catch (err) {
    console.error("Error reacting to message:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
