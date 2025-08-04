import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import setupWebSocket from './routes/gameRoutes.js';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
import http from 'http';
import { Server } from 'socket.io';
const server = http.createServer(app);
// Middleware
app.use(cors({
  origin: ['https://onefocus.onrender.com', 'http://localhost:5173'],// or your frontend URL
  credentials: true
}));

app.use(express.json());

// MongoDB connection
connectmongo(process.env.MONGODB_URI);
async function connectmongo(url) {
  mongoose.connect(url)
  .then(()=>console.log("mongoDb connected"))
  .catch((err)=>console.log("error",err));
}

// User Schema
import User from './models/User.js';

app.get('/', (req, res) => {
  res.send('✅ OneFocus server is running');
});




const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

setupWebSocket(io);


// Routes

import GameRoom from './models/GameRoom.js';

app.get('/api/games/:roomId', async (req, res) => {
  try {
    const room = await GameRoom.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

import { nanoid } from 'nanoid'; // or use UUID

app.post('/api/games/create', async (req, res) => {
  const { hostUid } = req.body;
  const roomId = nanoid(8);
  const newRoom = new GameRoom({ roomId, participants: [hostUid] });
  await newRoom.save();
  res.json({ roomId });
});

app.put('/api/users/:uid/clear-invite', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.invitedToRoomId = null;
    await user.save();
    res.json({ message: 'Invite cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.get('/api/users/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const existingUser = await User.findOne({ uid: req.body.uid });
    if (existingUser) {
      return res.json(existingUser);
    }
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/users/:uid', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { uid: req.params.uid },
      req.body,
      { new: true, upsert: true }
    );
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/api/users/:uid/focus-session', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.focusSessions.push(req.body);
    user.studyStats.totalStudyTime += req.body.duration;
    user.studyStats.sessionsCompleted += 1;
    user.studyStats.points += Math.floor(req.body.duration / 60) * 10;
    user.studyStats.lastStudyDate = new Date();
    
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await User.find({})
      .sort({ 'studyStats.points': -1 })
      .limit(50)
      .select('displayName email studyStats.points studyStats.totalStudyTime studyStats.sessionsCompleted');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/users/:uid/friends-leaderboard', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const friendUids = user.friends.map(f => f.uid);
    friendUids.push(req.params.uid); // Include current user
    
    const friendsData = await User.find({ uid: { $in: friendUids } })
      .sort({ 'studyStats.points': -1 })
      .select('uid displayName email studyStats.points studyStats.totalStudyTime studyStats.sessionsCompleted');
    
    res.json(friendsData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/users/:uid/send-friend-request', async (req, res) => {
  try {
    const { targetEmail } = req.body;
    const sender = await User.findOne({ uid: req.params.uid });
    const target = await User.findOne({ email: targetEmail });
    
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (target.uid === req.params.uid) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }
    
    // Check if already friends
    const alreadyFriends = target.friends.some(f => f.uid === req.params.uid);
    if (alreadyFriends) {
      return res.status(400).json({ message: 'Already friends' });
    }
    
    // Check if request already sent
    const requestExists = target.friendRequests.some(r => r.from === req.params.uid);
    if (requestExists) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }
    
    target.friendRequests.push({
      from: req.params.uid,
      fromName: sender.displayName || sender.email,
      fromEmail: sender.email
    });
    
    await target.save();
    res.json({ message: 'Friend request sent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/users/:uid/accept-friend-request', async (req, res) => {
  try {
    const { fromUid } = req.body;
    const user = await User.findOne({ uid: req.params.uid });
    const friend = await User.findOne({ uid: fromUid });
    
    if (!user || !friend) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Remove friend request
    user.friendRequests = user.friendRequests.filter(r => r.from !== fromUid);
    
    // Add to friends list
    user.friends.push({
      uid: friend.uid,
      displayName: friend.displayName || friend.email,
      email: friend.email
    });
    
    friend.friends.push({
      uid: user.uid,
      displayName: user.displayName || user.email,
      email: user.email
    });
    
    await user.save();
    await friend.save();
    
    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/users/:uid/reject-friend-request', async (req, res) => {
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

app.post('/api/users/:uid/videos', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.videoGallery.push(req.body);
    await user.save();
    res.json(user.videoGallery);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

});



