const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");

const getEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate("createdBy", "name profilePicture")
      .sort({ createdAt: -1 });

    // If needed, we could add registration counts here for each event
    const eventsWithCounts = await Promise.all(events.map(async (event) => {
      const registrationCount = await Registration.countDocuments({ eventId: event._id });
      let isRegistered = false;
      if (req.user) {
        const reg = await Registration.findOne({ eventId: event._id, userId: req.user._id });
        isRegistered = !!reg;
      }
      const ev = event.toObject();
      return { ...ev, content: ev.description, user: ev.createdBy, registrationCount, isRegistered };
    }));

    res.json({ posts: eventsWithCounts });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Error fetching events" });
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("createdBy", "name profilePicture");
    if (!event) return res.status(404).json({ message: "Event not found" });

    const registrationCount = await Registration.countDocuments({ eventId: event._id });
    
    // Check if the current user is registered
    let isRegistered = false;
    if (req.user) {
      const registration = await Registration.findOne({ eventId: event._id, userId: req.user._id || req.user.id });
      isRegistered = !!registration;
    }

    const ev = event.toObject();
    res.json({ ...ev, content: ev.description, user: ev.createdBy, registrationCount, isRegistered });
  } catch (error) {
    res.status(500).json({ message: "Error fetching event" });
  }
};

module.exports = { getEvents, getEventById };
