const Event = require("../../../../models/Event");

const reactToEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (!(event.reactions instanceof Map)) {
      event.reactions = new Map(Object.entries(event.reactions || {}));
    }

    let userAlreadyReacted = false;
    for (const [key, users] of event.reactions.entries()) {
      const filtered = users.filter(uid => uid.toString() !== userId);
      if (key === emoji && filtered.length !== users.length) {
        userAlreadyReacted = true;
      }
      event.reactions.set(key, filtered);
    }

    if (!userAlreadyReacted) {
      const current = event.reactions.get(emoji) || [];
      event.reactions.set(emoji, [...current, userId]);
    }

    await event.save();

    const updatedEvent = await Event.findById(id)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const ev = updatedEvent.toObject();
    const eventResp = { ...ev, user: ev.createdBy, type: "Event", content: ev.description };

    if (req.io) {
      req.io.emit("postReacted", eventResp);
    }

    res.status(200).json(eventResp);
  } catch (error) {
    console.error("Event reaction error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

const commentOnEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    event.comments.push({
      user: req.user._id,
      text,
      createdAt: new Date(),
    });

    await event.save();

    const updatedEvent = await Event.findById(id)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const ev = updatedEvent.toObject();
    const eventResp = { ...ev, user: ev.createdBy, type: "Event", content: ev.description };

    if (req.io) {
      req.io.emit("updatePost", eventResp);
    }

    res.status(201).json(eventResp);
  } catch (error) {
    console.error("Event comment error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

const editEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (event.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (title) event.title = title;
    if (content) event.description = content;

    await event.save();

    const updatedEvent = await Event.findById(id)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const ev = updatedEvent.toObject();
    const eventResp = { ...ev, user: ev.createdBy, type: "Event", content: ev.description };

    if (req.io) {
      req.io.emit("updatePost", eventResp);
    }

    res.status(200).json(eventResp);
  } catch (error) {
    console.error("Event edit error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteCommentFromEvent = async (req, res) => {
  try {
    const { id: eventId, commentId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    event.comments = event.comments.filter(c => c._id.toString() !== commentId);
    await event.save();

    const updatedEvent = await Event.findById(eventId)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const eventResp = { ...updatedEvent.toObject(), user: updatedEvent.createdBy, type: "Event", content: updatedEvent.description };
    if (req.io) req.io.emit("updatePost", eventResp);
    res.json(eventResp);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const editCommentOnEvent = async (req, res) => {
  try {
    const { id: eventId, commentId } = req.params;
    const { text } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const comment = event.comments.id(commentId);
    if (comment) {
      comment.text = text;
      await event.save();
    }

    const updatedEvent = await Event.findById(eventId)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const eventResp = { ...updatedEvent.toObject(), user: updatedEvent.createdBy, type: "Event", content: updatedEvent.description };
    if (req.io) req.io.emit("updatePost", eventResp);
    res.json(eventResp);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  reactToEvent,
  commentOnEvent,
  editEvent,
  deleteCommentFromEvent,
  editCommentOnEvent,
};
