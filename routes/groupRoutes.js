const express = require("express");
const router = express.Router();
const checkAuth = require("../middleware/authMiddleware");
const Group = require("../models/Group");
const GroupMessage = require("../models/GroupMessage");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const Notification = require("../models/Notification");

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
        const { name, description, profileImage, profileImagePublicId, profileImageSettings, isAllMemberGroup } = req.body;
        
        let members = req.body.members || [];
        if (isAllMemberGroup) {
            const allUsers = await User.find({}, "_id");
            members = allUsers.map(u => u._id);
        } else {
            // ✅ Auto-add all admins and main admin
            const admins = await User.find({ $or: [{ role: "admin" }, { isAdmin: true }, { isMainAdmin: true }] }, "_id");
            const adminIds = admins.map(a => a._id.toString());
            
            // Merge existing members with admins and the creator
            members = [...new Set([...members.map(m => m.toString()), ...adminIds, req.user.id])];
        }

        const newGroup = new Group({
            name,
            description,
            profileImage: profileImage || "/default-group.jpg",
            profileImagePublicId: profileImagePublicId || null,
            profileImageSettings: profileImageSettings || { x: 0, y: 0, zoom: 1, width: 100, height: 100 },
            members,
            admin: req.user.id,
            isAllMemberGroup: !!isAllMemberGroup
        });

        await newGroup.save();
        // 🔔 Notify members in background for speed
        setImmediate(async () => {
            try {
                const senderInfo = { 
                    _id: req.user.id, 
                    name: req.user.name, 
                    profilePicture: req.user.profilePicture 
                };

                const notifications = members.map(memberId => ({
                    sender: req.user.id,
                    receiver: memberId,
                    type: "group_joined",
                    message: `You have joined group "${newGroup.name}"`,
                    groupId: newGroup._id
                }));

                await Notification.insertMany(notifications);

                if (req.io) {
                    notifications.forEach(note => {
                        req.io.to(note.receiver.toString()).emit("newNotification", {
                            ...note,
                            sender: senderInfo,
                            createdAt: new Date(),
                            isRead: false
                        });
                    });
                }
            } catch (err) {
                console.error("❌ Background notification error:", err);
            }
        });

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
            .populate("members", "name profilePicture role enrollmentNumber employeeId")
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
            .populate("sender", "name profilePicture role employeeId");

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
        const { allowFacultyMessaging, description, name, profileImage, profileImagePublicId, profileImageSettings, oldImageUrl } = req.body;
        
        // 🧹 Cloudinary cleanup for old image if being replaced
        if (oldImageUrl && oldImageUrl.includes("res.cloudinary.com") && !oldImageUrl.includes("default-group.jpg")) {
            if (profileImage !== oldImageUrl) {
                const publicId = extractPublicId(oldImageUrl);
                if (publicId) {
                    try {
                        await cloudinary.uploader.destroy(publicId);
                        console.log(`🗑 Deleted old group image: ${publicId}`);
                    } catch (err) {
                        console.error("❌ Failed to delete old group image:", err);
                    }
                }
            }
        }

        const updateData = { allowFacultyMessaging, description, name };
        if (profileImage !== undefined) updateData.profileImage = profileImage || "/default-group.jpg";
        if (profileImagePublicId !== undefined) updateData.profileImagePublicId = profileImagePublicId;
        if (profileImageSettings !== undefined) updateData.profileImageSettings = profileImageSettings;

        await Group.findByIdAndUpdate(
            req.params.groupId,
            { $set: updateData }
        );

        const updatedGroup = await Group.findById(req.params.groupId)
            .populate("members", "name profilePicture role enrollmentNumber employeeId")
            .populate("admin", "name profilePicture");

        res.json(updatedGroup);
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

        const oldMemberIds = group.members.map(m => m.toString());
        // Merge and remove duplicates
        const updatedMembers = [...new Set([...oldMemberIds, ...membersToAdd.map(m => m.toString())])];
        
        const newMemberIds = updatedMembers.filter(id => !oldMemberIds.includes(id));
        
        group.members = updatedMembers;
        await group.save();

        // 🔔 Notify members in background for speed
        setImmediate(async () => {
            try {
                if (newMemberIds.length === 0) return;

                const senderInfo = { 
                    _id: req.user.id, 
                    name: req.user.name, 
                    profilePicture: req.user.profilePicture 
                };

                const notifications = newMemberIds.map(memberId => ({
                    sender: req.user.id,
                    receiver: memberId,
                    type: "group_added",
                    message: `You have been added to group "${group.name}"`,
                    groupId: group._id
                }));

                await Notification.insertMany(notifications);

                if (req.io) {
                    notifications.forEach(note => {
                        req.io.to(note.receiver.toString()).emit("newNotification", {
                            ...note,
                            sender: senderInfo,
                            createdAt: new Date(),
                            isRead: false
                        });
                    });
                }
            } catch (err) {
                console.error("❌ Background invitation notification error:", err);
            }
        });

        const updatedGroup = await Group.findById(req.params.groupId)
            .populate("members", "name profilePicture role enrollmentNumber employeeId")
            .populate("admin", "name profilePicture");

        res.json({ message: "Members added successfully", group: updatedGroup });
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

        // 🔔 Notify in background for speed
        setImmediate(async () => {
            try {
                const notification = new Notification({
                    sender: req.user.id,
                    receiver: memberId,
                    type: "group_removed",
                    message: `You have been removed from group "${group.name}"`,
                    groupId: group._id
                });
                await notification.save();
                if (req.io) {
                    req.io.to(memberId.toString()).emit("newNotification", {
                        ...notification.toObject(),
                        sender: { _id: req.user.id, name: req.user.name, profilePicture: req.user.profilePicture },
                        createdAt: new Date(),
                        isRead: false
                    });
                }
            } catch (err) {
                console.error("❌ Background removal notification error:", err);
            }
        });

        const updatedGroup = await Group.findById(groupId)
            .populate("members", "name profilePicture role enrollmentNumber employeeId")
            .populate("admin", "name profilePicture");

        res.json({ message: "Member removed", group: updatedGroup });
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

// @route   DELETE /api/groups/:groupId/image
// @desc    Remove group profile image and revert to default (Admin only)
router.delete("/:groupId/image", checkAuth, checkAdmin, async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        // Delete from Cloudinary if not default
        if (group.profileImage && group.profileImage.includes("res.cloudinary.com") && !group.profileImage.includes("default-group.jpg")) {
            const publicId = extractPublicId(group.profileImage);
            if (publicId) {
                try {
                    await cloudinary.uploader.destroy(publicId);
                    console.log(`🗑 Deleted group image for reset: ${publicId}`);
                } catch (err) {
                    console.error("❌ Cloudinary deletion failed:", err);
                }
            }
        }

        group.profileImage = "/default-group.jpg";
        group.profileImagePublicId = null;
        group.profileImageSettings = { x: 0, y: 0, zoom: 1, width: 100, height: 100 };
        await group.save();

        const updatedGroup = await Group.findById(req.params.groupId)
            .populate("members", "name profilePicture role enrollmentNumber employeeId")
            .populate("admin", "name profilePicture");

        res.json({ message: "Group image removed", group: updatedGroup });
    } catch (err) {
        console.error("Error deleting group image:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Helper to extract Cloudinary public ID
function extractPublicId(imageUrl) {
    try {
        imageUrl = imageUrl.split("?")[0];
        const afterUpload = imageUrl.split("/upload/")[1];
        if (!afterUpload) return null;
        const noVersion = afterUpload.replace(/v\d+\//, "");
        return noVersion.substring(0, noVersion.lastIndexOf(".")) || noVersion;
    } catch (e) {
        return null;
    }
}

// @route   DELETE /api/groups/:groupId
// @desc    Delete a group (Admin only)
router.delete("/:groupId", checkAuth, checkAdmin, async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        const memberIds = group.members || [];
        const groupName = group.name;

        // 🔔 Background Batch Notification for speed
        setImmediate(async () => {
            try {
                if (memberIds.length === 0) return;

                const senderInfo = { 
                    _id: req.user.id, 
                    name: req.user.name, 
                    profilePicture: req.user.profilePicture 
                };

                const notifications = memberIds.map(memberId => ({
                    sender: req.user.id,
                    receiver: memberId,
                    type: "group_disbanded",
                    message: `The Group "${groupName}" is disbanded`,
                    groupId: group._id
                }));

                await Notification.insertMany(notifications);

                if (req.io) {
                    notifications.forEach(note => {
                        req.io.to(note.receiver.toString()).emit("newNotification", {
                            ...note,
                            sender: senderInfo,
                            createdAt: new Date(),
                            isRead: false
                        });
                    });
                }
            } catch (err) {
                console.error("❌ Background disband notification error:", err);
            }
        });

        // Delete group messages
        await GroupMessage.deleteMany({ groupId: req.params.groupId });
        
        // Delete the group itself
        await Group.findByIdAndDelete(req.params.groupId);

        res.json({ message: "Group and its messages deleted successfully" });
    } catch (err) {
        console.error("Error deleting group:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
