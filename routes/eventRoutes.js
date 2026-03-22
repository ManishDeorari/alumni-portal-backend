const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const createEvent = require("../src/api/events/event/createEvent");
const { getEvents, getEventById } = require("../src/api/events/event/getEvents");
const deleteEvent = require("../src/api/events/event/deleteEvent");

// ---------------- GET ALL EVENTS ----------------
router.get("/", auth, getEvents);

// ---------------- GET SINGLE EVENT ----------------
router.get("/:id", auth, getEventById);

// ---------------- CREATE EVENT (Admin only) ----------------
router.post("/", auth, createEvent);

// ---------------- DELETE EVENT (Admin only) ----------------
router.delete("/:id", auth, deleteEvent);

module.exports = router;
