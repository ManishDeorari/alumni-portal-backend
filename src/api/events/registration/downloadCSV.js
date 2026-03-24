const Registration = require("../../../../models/Registration");
const Event = require("../../../../models/Event");

const downloadCSV = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const registrations = await Registration.find({ eventId })
      .populate("userId", "name email enrollmentNumber");

    if (registrations.length === 0) {
      return res.status(404).json({ message: "No registrations found" });
    }

    const baseFields = Object.keys(event.registrationFields || {}).filter(field => event.registrationFields[field] === true);
    const baseHeaders = baseFields.map(field => field.replace(/([A-Z])/g, ' $1').trim());
    
    const headers = [...baseHeaders, "Is Group", "Group Members", "Registration Date"];
    
    // Add custom questions to headers
    event.customQuestions.forEach(q => headers.push(q.question));

    let csvContent = headers.map(h => `"${h}"`).join(",") + "\n";

    registrations.forEach(reg => {
      const user = reg.userId || {};
      const row = [];

      baseFields.forEach(field => {
        let answer = reg.answers?.get ? reg.answers.get(field) : reg.answers?.[field];
        if (!answer) answer = user[field] || "";
        row.push(`"${String(answer).replace(/"/g, '""')}"`);
      });

      row.push(`"${reg.isGroup ? "Yes" : "No"}"`);
      row.push(`"${reg.groupMembers.map(m => m.name).join("; ") || ""}"`);
      row.push(`"${new Date(reg.registeredAt).toLocaleString()}"`);

      // Add answers to custom questions
      event.customQuestions.forEach(q => {
        const answer = reg.answers?.get ? reg.answers.get(q.question) : reg.answers?.[q.question];
        row.push(`"${String(answer || "").replace(/"/g, '""')}"`);
      });

      csvContent += row.join(",") + "\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=registrations_${event.title.replace(/\s+/g, "_")}.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("CSV download error:", error);
    res.status(500).json({ message: "Error generating CSV" });
  }
};

module.exports = downloadCSV;
