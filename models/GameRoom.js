import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  winnerUid: { type: String, required: true },
  winnerName: { type: String, required: true },
  targetTime: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

const gameRoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  hostUid: { type: String, required: true },
  participants: [{ type: String }],
  matchHistory: [matchSchema], // ✅ Embed matchSchema for structure + timestamps
});

export default mongoose.model('GameRoom', gameRoomSchema);