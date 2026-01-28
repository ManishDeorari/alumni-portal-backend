const mongoose = require("mongoose");

const PointsSystemConfigSchema = new mongoose.Schema({
    profileCompletionPoints: { type: Number, default: 50 },
    connectionPoints: { type: Number, default: 10 },
    postPoints: { type: Number, default: 10 },
    postLimitCount: { type: Number, default: 3 },
    postLimitDays: { type: Number, default: 7 },
    rolloverDate: { type: Date },
    lastRolloverExecutedAt: { type: Date },
});

module.exports = mongoose.model("PointsSystemConfig", PointsSystemConfigSchema);
