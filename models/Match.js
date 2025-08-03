import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  participants: [String],
  durations: { type: Map, of: Number }, // key: uid, value: seconds
  winner: String,
  createdAt: { type: Date, default: Date.now }
});

export default  mongoose.model('Match', matchSchema);
