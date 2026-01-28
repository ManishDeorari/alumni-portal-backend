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
        const { search, amount, message } = req.body; // search can be name or enrollment number

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
        user.points.total = (user.points.total || 0) + Number(amount);

        // Add notification
        user.notifications.push({
            type: "points_awarded",
            message: message || `You have been awarded ${amount} points by the Admin.`,
            date: new Date(),
        });

        await user.save();

        // Emit socket event if needed or just return success
        if (req.io) {
            req.io.to(user._id.toString()).emit("notification", {
                type: "points_awarded",
                message: message || `You have been awarded ${amount} points by the Admin.`,
            });
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

module.exports = router;
