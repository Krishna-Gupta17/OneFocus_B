import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  participants: [String], // array of user UIDs
  durations: { type: Map, of: Number }, // uid -> time in seconds
  winner: String, // UID of winner
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Match', matchSchema);