// User Schema
import User from '../models/User.js';
import Match from '../models/Match.js'; // your Match schema
import {Router} from 'express';
const router=Router();

router.post('/', async (req, res) => {
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

router.get('/:uid', async (req, res) => {
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

router.put('/:uid/clear-invite', async (req, res) => {
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

router.put('/:uid/', async (req, res) => {
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

router.post('/:uid/focus-session', async (req, res) => {
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

router.get('/:uid/friends-leaderboard', async (req, res) => {
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

router.post('/:uid/send-friend-request', async (req, res) => {
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




router.post('/:uid/accept-friend-request', async (req, res) => {
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

router.post('/:uid/reject-friend-request', async (req, res) => {
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

router.post('/videos', async (req, res) => {
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

router.get('/:uid/match-history', async (req, res) => {
  const { uid } = req.params;

  try {
    // Find matches where the user is a participant
    const matches = await Match.find({ participants: uid }).lean();

    const enrichedMatches = await Promise.all(
      matches.map(async match => {
        // Fetch user details for all participants
        const users = await User.find({ uid: { $in: match.participants } }).lean();
        const userMap = Object.fromEntries(users.map(u => [u.uid, u.name]));

        const players = match.participants.map(pid => ({
          uid: pid,
          name: userMap[pid] || 'Unknown',
          time: match.durations?.[pid] || 0
        }));

        return {
          id: match._id,
          createdAt: match.createdAt,
          winner: userMap[match.winner] || 'Unknown',
          players
        };
      })
    );

    // Sort by most recent
    enrichedMatches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(enrichedMatches);
  } catch (error) {
    console.error('Error fetching match history:', error);
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});



export default router;