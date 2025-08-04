// models/GameRoom.js
import mongoose from 'mongoose';

const gameRoomSchema = new mongoose.Schema({
  roomId: String,
  hostUid: String,
  participants: [String],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('GameRoom', gameRoomSchema);
