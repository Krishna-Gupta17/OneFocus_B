import GameRoomModel from '../models/GameRoom.js';
import User from '../models/User.js';
import game from '../models/gameState.js';

const onlineUsers = new Map(); // uid -> socket.id

const setupWebSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 WebSocket connected:', socket.id);

    socket.on('joinRoom', async ({ roomId, uid }) => {
      try {
        socket.join(roomId);
        onlineUsers.set(uid, socket.id);
        io.emit('onlineUsersUpdate', Array.from(onlineUsers.keys()));

        let room = await GameRoomModel.findOne({ roomId });
        if (!room) {
          room = new GameRoomModel({ roomId, hostUid: uid, participants: [uid] });
          await room.save();
        } else if (!room.participants.includes(uid)) {
          room.participants.push(uid);
          await room.save();
        }

        if (!game.getRoom(roomId)) {
          game.createRoom(roomId, room.hostUid);
        }
        game.addParticipant(roomId, uid);

        io.to(roomId).emit('roomUpdate', room.participants);
      } catch (err) {
        console.error('❌ joinRoom error:', err);
      }
    });

    socket.on('inviteFriend', async ({ friendId, roomId }) => {
      try {
        const user = await User.findOne({ uid: friendId });
        if (user) {
          user.invitedToRoomId = roomId;
          await user.save();
          io.emit(`invite-${friendId}`, { roomId });
        }
      } catch (err) {
        console.error('❌ inviteFriend error:', err);
      }
    });

    socket.on('startGame', ({ roomId, targetTime }) => {
      try {
        game.setTargetTime(roomId, targetTime);
        io.to(roomId).emit('gameStarted', { targetTime });
      } catch (err) {
        console.error('❌ startGame error:', err);
      }
    });

    socket.on('progressUpdate', async ({ roomId, uid, time }) => {
  const reachedTarget = game.updateProgress(roomId, uid, time);
  if (reachedTarget) {
    const user = await User.findOne({ uid }); // 👈 get user name
    const displayName = user?.displayName || "Unknown";
    io.to(roomId).emit('declarewinner', { roomId, winnerUid: uid, winnerName: displayName });
  }
});

    socket.on('declareWinner', async ({ roomId, winnerUid, winnerName }) => {
      try {
        const result = await game.declareWinner(roomId, winnerUid, winnerName);

        if (!result) {
          console.warn(`⚠️ declareWinner failed: room missing or winner already declared for room ${roomId}`);
          return;
        }

        const { uid, displayName } = result;
        io.to(roomId).emit('winnerAnnounced', { winnerUid: uid, winnerName: displayName });

        const room = await GameRoomModel.findOne({ roomId });
        if (room) {
          const targetTime = game.getRoom(roomId)?.targetTime || 0;
          room.matchHistory.push({
            winnerUid: uid,
            winnerName: displayName,
            targetTime: game.getRoom(roomId)?.targetTime || 0,
          });
          await room.save();
        }

        game.removeRoom(roomId);
        console.log(`✅ Match stored for ${roomId} — Winner: ${displayName}`);
      } catch (err) {
        console.error('❌ declareWinner error:', err);
      }
    });

    socket.on('getMatchHistory', async ({ roomId }) => {
      try {
        const room = await GameRoomModel.findOne({ roomId });
        if (room) {
          socket.emit('matchHistory', room.matchHistory);
        }
      } catch (err) {
        console.error('❌ getMatchHistory error:', err);
      }
    });

    socket.on('disconnect', () => {
      try {
        for (const [uid, sid] of onlineUsers.entries()) {
          if (sid === socket.id) {
            onlineUsers.delete(uid);
            break;
          }
        }
        io.emit('onlineUsersUpdate', Array.from(onlineUsers.keys()));
        console.log('❌ Socket disconnected:', socket.id);
      } catch (err) {
        console.error('❌ disconnect error:', err);
      }
    });
  });
};

export default setupWebSocket;