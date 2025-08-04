import GameRoom from '../models/GameRoom.js';
import User from '../models/User.js';

const onlineUsers = new Map(); // uid -> socket.id

const setupWebSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 WebSocket connected:', socket.id);

    socket.on('joinRoom', async ({ roomId, uid }) => {
      socket.join(roomId);
      onlineUsers.set(uid, socket.id);
      io.emit('onlineUsersUpdate', Array.from(onlineUsers.keys()));

      const room = await GameRoom.findOne({ roomId });
      if (room && !room.participants.includes(uid)) {
        room.participants.push(uid);
        await room.save();
      }

      const updated = await GameRoom.findOne({ roomId });
      io.to(roomId).emit('roomUpdate', updated.participants);
    });

    socket.on('inviteFriend', async ({ friendId, roomId }) => {
      const user = await User.findOne({ uid: friendId });
      if (user) {
        user.invitedToRoomId = roomId;
        await user.save();
        io.emit(`invite-${friendId}`, { roomId });
      }
    });

    socket.on('disconnect', () => {
      for (const [uid, sid] of onlineUsers.entries()) {
        if (sid === socket.id) {
          onlineUsers.delete(uid);
          break;
        }
      }
      io.emit('onlineUsersUpdate', Array.from(onlineUsers.keys()));
      console.log('❌ Socket disconnected:', socket.id);
    });
  });
};

export default setupWebSocket;
