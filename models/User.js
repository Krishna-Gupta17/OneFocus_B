import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true  },
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

export default mongoose.model('User', userSchema);