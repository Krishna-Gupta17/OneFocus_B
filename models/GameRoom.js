// models/GameRoom.js
import mongoose from 'mongoose';

const gameRoomSchema = new mongoose.Schema({
  host: String,
  participants: [String], // array of user UIDs
  status: { type: String, default: 'waiting' }, // 'waiting', 'in-progress', 'ended'
  invited: [String], // invited UIDs
  endTimes: { type: Map, of: Number }, // { uid: timestamp }
});

export default mongoose.model('GameRoom', gameRoomSchema);
