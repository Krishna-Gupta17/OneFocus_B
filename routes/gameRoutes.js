import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import GameRoom from '../models/GameRoom.js';
import Match from '../models/Match.js';

// 🧑‍🤝‍🧑 Get friend list for a user
router.get('/api/friends/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const friends = await User.find({ uid: { $in: user.friends || [] } });

    res.json(
      friends.map(f => ({
        uid: f.uid,
        name: f.name,
        avatarUrl: f.avatarUrl || null, // ✅ Add this line
      }))
    );
  } catch (err) {
    console.error('Error fetching friends:', err);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});


// 🎮 Create a new game room
router.post('/api/rooms', async (req, res) => {
  const { host } = req.body;
  try {
    const newRoom = await GameRoom.create({
      host,
      participants: [host]
    });
    res.json(newRoom);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// 🔍 Get game room by ID
router.get('/api/games/:roomId', async (req, res) => {
  try {
    const room = await GameRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching room' });
  }
});

// 📨 Invite a friend to the room
router.put('/api/games/:roomId/invite', async (req, res) => {
  const { friendId } = req.body;
  try {
    const room = await GameRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (!room.participants.includes(friendId)) {
      room.participants.push(friendId);
      await room.save();
    }
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: 'Error inviting friend' });
  }
});

// ▶️ Start the match
router.put('/api/games/:roomId/start', async (req, res) => {
  try {
    const room = await GameRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    room.status = 'in-progress';
    room.startTime = new Date();
    await room.save();
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: 'Failed to start match' });
  }
});

// 🛑 End the match and save to Match collection
router.put('/api/games/:roomId/end', async (req, res) => {
  try {
    const room = await GameRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const now = Date.now();
    const durations = {};
    room.participants.forEach(uid => {
      const start = room.startTime ? new Date(room.startTime).getTime() : now;
      const timeSpent = Math.floor((now - start) / 1000);
      durations[uid] = timeSpent;
    });

    const winner = Object.entries(durations).sort((a, b) => b[1] - a[1])[0][0];

    await Match.create({
      participants: room.participants,
      durations,
      winner
    });

    await room.remove();

    res.json({ message: 'Match ended and saved', winner });
  } catch (err) {
    res.status(500).json({ error: 'Failed to end match' });
  }
});

export default router;
