const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const PointsSystemConfig = require("../../models/PointsSystemConfig");
const authenticate = require("../../middleware/authMiddleware");

// Middleware to check for Main Admin
const verifyMainAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user || !user.isMainAdmin) {
            return res.status(403).json({ message: "Access denied. Main Admin only." });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: "Server error verifying admin." });
    }
};

// GET current points configuration
router.get("/config", authenticate, async (req, res) => {
    try {
        let config = await PointsSystemConfig.findOne();
        if (!config) {
            config = await PointsSystemConfig.create({});
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch config" });
    }
});

// UPDATE points configuration (Main Admin only)
router.post("/config", authenticate, verifyMainAdmin, async (req, res) => {
    try {
        const { profileCompletionPoints, connectionPoints, postPoints, postLimitCount, postLimitDays, rolloverDate } = req.body;

        let config = await PointsSystemConfig.findOne();
        if (!config) {
            config = new PointsSystemConfig();
        }

        if (profileCompletionPoints !== undefined) config.profileCompletionPoints = profileCompletionPoints;
        if (connectionPoints !== undefined) config.connectionPoints = connectionPoints;
        if (postPoints !== undefined) config.postPoints = postPoints;
        if (postLimitCount !== undefined) config.postLimitCount = postLimitCount;
        if (postLimitDays !== undefined) config.postLimitDays = postLimitDays;
        if (rolloverDate !== undefined) config.rolloverDate = rolloverDate;

        await config.save();
        res.json({ message: "Configuration updated", config });
    } catch (error) {
        res.status(500).json({ message: "Failed to update config" });
    }
});

// Manual award points (Main Admin only)
router.post("/manual-award", authenticate, verifyMainAdmin, async (req, res) => {
    try {
        const { search, amount, message, category = "other" } = req.body; // search can be name or enrollment number

        if (!search || !amount) {
            return res.status(400).json({ message: "Search term and amount required" });
        }

        const user = await User.findOne({
            $or: [
                { name: search },
                { enrollmentNumber: search }
            ],
            role: "alumni"
        });

        if (!user) {
            return res.status(404).json({ message: "Alumni not found" });
        }

        if (!user.points) user.points = { total: 0 };

        // Award to specific category
        const awardAmount = Number(amount);
        user.points[category] = (user.points[category] || 0) + awardAmount;

        // Ensure total is correctly calculated as sum of all categories plus any previous "uncategorized" total
        // We'll recalculate from all fields to be safe
        const categories = [
            "profileCompletion", "studentEngagement", "referrals",
            "contentContribution", "campusEngagement", "innovationSupport",
            "alumniParticipation", "connections", "posts", "comments",
            "likes", "replies", "other"
        ];

        user.points.total = categories.reduce((sum, cat) => sum + (user.points[cat] || 0), 0);

        // Add notification using Notification model
        try {
            const Notification = require("../../models/Notification");
            const newNotification = new Notification({
                sender: req.user._id,
                receiver: user._id,
                type: "admin_notice",
                message: message || `You have been awarded ${amount} points for ${category.replace(/([A-Z])/g, ' $1').toLowerCase()}.`,
            });
            await newNotification.save();

            if (req.io) {
                const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
                req.io.to(user._id.toString()).emit("newNotification", populatedNotification);
            }
        } catch (noteErr) {
            console.error("❌ Failed to send manual award notice:", noteErr.message);
        }

        res.json({ message: "Points awarded successfully", user: { name: user.name, totalPoints: user.points.total } });
    } catch (error) {
        res.status(500).json({ message: "Server error awarding points" });
    }
});

// Trigger Rollover (Main Admin or scheduled)
router.post("/trigger-rollover", authenticate, verifyMainAdmin, async (req, res) => {
    try {
        const config = await PointsSystemConfig.findOne();
        const now = new Date();

        const currentYear = now.getFullYear().toString();
        const alumniUsers = await User.find({ role: "alumni" });

        for (const user of alumniUsers) {
            // Copy current points to last year
            user.lastYearPoints = {
                year: currentYear,
                total: user.points.total || 0,
            };

            // Reset all current points to 0
            user.points = {
                profileCompletion: 0,
                studentEngagement: 0,
                referrals: 0,
                contentContribution: 0,
                campusEngagement: 0,
                innovationSupport: 0,
                alumniParticipation: 0,
                connections: 0,
                posts: 0,
                comments: 0,
                likes: 0,
                replies: 0,
                other: 0,
                total: 0,
            };

            // Reset point logs
            user.postPointLogs = [];
            user.profileCompletionAwarded = false;

            await user.save();
        }

        if (config) {
            config.lastRolloverExecutedAt = now;
            await config.save();
        }

        res.json({ message: "Rollover executed successfully", usersProcessed: alumniUsers.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Rollover failed" });
    }
});

// Sync all users' points (fix discrepancies)
router.post("/sync-points", authenticate, verifyMainAdmin, async (req, res) => {
    try {
        const alumniUsers = await User.find({ role: "alumni" });
        const categories = [
            "profileCompletion", "studentEngagement", "referrals",
            "contentContribution", "campusEngagement", "innovationSupport",
            "alumniParticipation", "connections", "posts", "comments",
            "likes", "replies", "other"
        ];

        let syncedCount = 0;
        for (const user of alumniUsers) {
            if (!user.points) user.points = { total: 0 };

            const currentTotal = user.points.total || 0;
            const sumOfCategories = categories.reduce((sum, cat) => sum + (user.points[cat] || 0), 0);

            if (currentTotal !== sumOfCategories) {
                const discrepancy = currentTotal - sumOfCategories;
                // Assign discrepancy to 'other' (can be positive or negative to make it match)
                user.points.other = (user.points.other || 0) + discrepancy;
                // Re-verify total
                user.points.total = categories.reduce((sum, cat) => sum + (user.points[cat] || 0), 0);
                await user.save();
                syncedCount++;
            }
        }
        res.json({ message: `Successfully synced ${syncedCount} users.`, syncedCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Sync failed" });
    }
});

module.exports = router;
