import mongoose from 'mongoose';

const gameRoomSchema = new mongoose.Schema({
  host: String,
  participants: [String],
  status: { type: String, default: 'waiting' }, // 'waiting' | 'in-progress'
  startTime: Date,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('GameRoom', gameRoomSchema);
