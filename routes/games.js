import { nanoid } from 'nanoid'; // or use UUID
import GameRoom from '../models/GameRoom.js';
import {Router} from 'express';
const router=Router();
router.post('/create', async (req, res) => {
  const { hostUid } = req.body;
  const roomId = nanoid(8);
const newRoom = new GameRoom({ roomId, hostUid: req.body.hostUid });  await newRoom.save();
  res.json({ roomId });
});

router.get('/:roomId', async (req, res) => {
  try {
    const room = await GameRoom.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;