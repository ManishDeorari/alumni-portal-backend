const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");

const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Only admin or the creator can delete
    if (!req.user.isAdmin && event.createdBy.toString() !== (req.user._id || req.user.id).toString()) {
      return res.status(403).json({ message: "Not authorized to delete this event" });
    }

    // Delete all registrations associated with this event
    await Registration.deleteMany({ eventId: event._id });
    
    // Delete the event itself
    await Event.findByIdAndDelete(req.params.id);

    res.json({ message: "Event and associated registrations deleted successfully" });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({ message: "Error deleting event" });
  }
};

module.exports = deleteEvent;
