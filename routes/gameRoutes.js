import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import GameRoom from '../models/GameRoom.js';
import Match from '../models/Match.js';

/* -------------------- FRIEND SYSTEM -------------------- */

// ✅ Get friend list for a user
router.get('/api/friends/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const friendUIDs = user.friends?.map(f => f.uid) || [];
    console.log("friendUID",friendUIDs);
    const friends = await User.find({ uid: { $in: friendUIDs } });

    res.json(friends.map(f => ({
      uid: f.uid,
      name: f.displayName || f.name,
      avatarUrl: f.profilePicture || null,
    })));
  } catch (err) {
    console.error('Error fetching friends:', err);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// ❌ Reject friend request
router.post('/api/users/:uid/reject-friend-request', async (req, res) => {
  const { fromUid } = req.body;
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.friendRequests = user.friendRequests.filter(req => req.from !== fromUid);
    await user.save();

    res.json({ message: 'Friend request rejected' });
  } catch (err) {
    console.error('Error rejecting request:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* -------------------- GAME ROOM SYSTEM -------------------- */

// ✅ Create new game room
router.post('/api/rooms', async (req, res) => {
  const { host, participants = [], status = 'waiting' } = req.body;
  try {
    if (participants.length > 8) {
      return res.status(400).json({ error: 'Cannot exceed 8 participants' });
    }

    const room = await GameRoom.create({
      host,
      participants,
      status,
      invited: []
    });

    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// ✅ Get room by ID
router.get('/api/games/:id', async (req, res) => {
  try {
    const room = await GameRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching room' });
  }
});

// ✅ Invite friend to room
router.put('/api/games/:id/invite', async (req, res) => {
  const { friendId } = req.body;
  try {
    const room = await GameRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (!room.invited.includes(friendId)) {
      room.invited.push(friendId);
      await room.save();
    }

    res.json({ message: 'Friend invited' });
  } catch (err) {
    res.status(500).json({ error: 'Invite failed' });
  }
});

// ✅ Join Room
router.put('/api/games/:id/join', async (req, res) => {
  const { uid } = req.body;
  try {
    const room = await GameRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.participants.length >= 8) {
      return res.status(403).json({ error: 'Room is full (max 8)' });
    }

    const hostUser = await User.findOne({ uid: room.host });
    const isFriend = hostUser?.friends?.some(f => f.uid === uid);
    const isInvited = room.invited.includes(uid);

    if (!isFriend && !isInvited) {
      return res.status(403).json({ error: 'You are not allowed to join this room' });
    }

    if (!room.participants.includes(uid)) {
      room.participants.push(uid);
      await room.save();
    }

    res.json({ message: 'Joined room', room });
  } catch (err) {
    res.status(500).json({ error: 'Join failed' });
  }
});

// ✅ Start Match
router.post('/api/games/:id/start', async (req, res) => {
  try {
    const room = await GameRoom.findByIdAndUpdate(
      req.params.id,
      { status: 'in-progress' },
      { new: true }
    );
    res.json({ message: 'Match started', room });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start match' });
  }
});

// ✅ End Match
router.post('/api/games/:id/end', async (req, res) => {
  const { uid } = req.body;
  try {
    const room = await GameRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (!room.endTimes) room.endTimes = new Map();

    // Save end time
    room.endTimes.set(uid, Date.now());

    if (room.participants.length === room.endTimes.size) {
      room.status = 'ended';
    }

    await room.save();
    res.json({ message: 'Match ended', room });
  } catch (err) {
    res.status(500).json({ error: 'Failed to end match' });
  }
});

export default router;
