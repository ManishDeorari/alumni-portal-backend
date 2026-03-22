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

    // Define CSV headers based on registration fields and custom questions
    const headers = ["Name", "Email", "Enrollment Number", "Is Group", "Group Members", "Registration Date"];
    
    // Add custom questions to headers
    event.customQuestions.forEach(q => headers.push(q.question));

    let csvContent = headers.join(",") + "\n";

    registrations.forEach(reg => {
      const user = reg.userId || {};
      const row = [
        `"${user.name || ""}"`,
        `"${user.email || ""}"`,
        `"${user.enrollmentNumber || ""}"`,
        reg.isGroup ? "Yes" : "No",
        `"${reg.groupMembers.map(m => m.name).join("; ") || ""}"`,
        new Date(reg.registeredAt).toLocaleString(),
      ];

      // Add answers to custom questions
      event.customQuestions.forEach(q => {
        const answer = reg.answers.get ? reg.answers.get(q.question) : reg.answers[q.question];
        row.push(`"${answer || ""}"`);
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
