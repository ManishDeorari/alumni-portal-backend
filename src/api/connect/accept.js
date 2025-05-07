router.post("/accept", authMiddleware, async (req, res) => {
    const { fromUserId } = req.body;
  
    try {
      const currentUser = await User.findById(req.user.id);
      const fromUser = await User.findById(fromUserId);
  
      if (!fromUser) return res.status(404).json({ message: "User not found" });
  
      // Add to connections if not already connected
      if (!currentUser.connections.includes(fromUser._id)) {
        currentUser.connections.push(fromUser._id);
        fromUser.connections.push(currentUser._id);
      }
  
      // Remove from connectionRequests
      currentUser.connectionRequests = currentUser.connectionRequests.filter(
        (id) => id.toString() !== fromUserId
      );
  
      await currentUser.save();
      await fromUser.save();
  
      res.json({ message: "Connection accepted" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  