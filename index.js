import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // or your frontend URL
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
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  displayName: { type: String, default: '' },
  profilePicture: { type: String, default: '' },
  bio: { type: String, default: '' },
  studyStats: {
    totalStudyTime: { type: Number, default: 0 },
    sessionsCompleted: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    lastStudyDate: { type: Date, default: Date.now }
  },
  friends: [{
    uid: String,
    displayName: String,
    email: String,
    addedAt: { type: Date, default: Date.now }
  }],
  friendRequests: [{
    from: String,
    fromName: String,
    fromEmail: String,
    sentAt: { type: Date, default: Date.now }
  }],
  tasks: [{
    id: String,
    title: String,
    completed: Boolean,
    priority: String,
    dueDate: Date,
    createdAt: { type: Date, default: Date.now }
  }],
  focusSessions: [{
    date: { type: Date, default: Date.now },
    duration: Number,
    focusPercentage: Number,
    tasksCompleted: Number,
    sessionType: String
  }],
  videoGallery: [{
    id: String,
    url: String,
    title: String,
    thumbnail: String,
    addedAt: { type: Date, default: Date.now }
  }],
  settings: {
    focusThreshold: { type: Number, default: 75 },
    studyReminders: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true }
  }
});

const User = mongoose.model('User', userSchema);
app.get('/', (req, res) => {
  res.send('✅ OneFocus server is running');
});

// Routes
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

});

