import GameRoomModel from '../models/GameRoom.js';
import User from '../models/User.js';
import game from '../models/gameState.js';

const onlineUsers = new Map(); // uid -> socket.id
const socketToUserRoom = new Map(); // socket.id -> { uid, roomId }

const storeMatchResult = async ({ roomId, winnerUid, winnerName }) => {
  const room = await GameRoomModel.findOne({ roomId });
  if (!room) return;

  room.matchHistory.push({
    winnerUid,
    winnerName,
    targetTime: game.getRoom(roomId)?.targetTime || 0,
  });
  await room.save();
};

const setupWebSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 WebSocket connected:', socket.id);

    socket.on('userOnline', ({ uid }) => {
      if (!uid) return;
      onlineUsers.set(uid, socket.id);
      io.emit('onlineUsersUpdate', Array.from(onlineUsers.keys()));
    });

    socket.on('joinRoom', async ({ roomId, uid }) => {
      try {
        socket.join(roomId);
        onlineUsers.set(uid, socket.id);
        socketToUserRoom.set(socket.id, { uid, roomId }); // Track socket -> user -> room mapping
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

    socket.on('leaveRoom', async ({ roomId, uid }) => {
      try {
        if (!roomId || !uid) return;

        socket.leave(roomId);
        
        // Clean up socket mapping
        for (const [sid, info] of socketToUserRoom.entries()) {
          if (info.uid === uid && info.roomId === roomId) {
            socketToUserRoom.delete(sid);
            break;
          }
        }

        const room = await GameRoomModel.findOne({ roomId });
        if (!room) return;

        const gameRoom = game.getRoom(roomId);
        const matchInProgress = Boolean(gameRoom?.targetTime) && !gameRoom?.winner;
        const isHost = room.hostUid === uid;

        if (isHost) {
          await GameRoomModel.deleteOne({ roomId });
          game.removeRoom(roomId);
          io.to(roomId).emit('roomDeleted', { roomId, reason: 'host-left' });
          socket.emit('roomDeleted', { roomId, reason: 'host-left' });
          return;
        }

        room.participants = room.participants.filter((participantUid) => participantUid !== uid);

        if (room.participants.length === 0) {
          await GameRoomModel.deleteOne({ roomId });
          game.removeRoom(roomId);
          return;
        }

        await room.save();
        const remainingCount = game.removeParticipant(roomId, uid);
        io.to(roomId).emit('roomUpdate', room.participants);

        if (matchInProgress && remainingCount === 1) {
          const winnerUid = room.participants[0];
          const user = await User.findOne({ uid: winnerUid });
          const winnerName = user?.displayName || user?.email || 'Unknown';
          const result = game.declareWinner(roomId, winnerUid, winnerName);

          if (result) {
            io.to(roomId).emit('winnerAnnounced', { winnerUid, winnerName });
            await storeMatchResult({ roomId, winnerUid, winnerName });
            game.removeRoom(roomId);
          }
        }
      } catch (err) {
        console.error('❌ leaveRoom error:', err);
      }
    });

    socket.on('inviteFriend', async ({ friendId, roomId }) => {
      try {
        const room = await GameRoomModel.findOne({ roomId });
        if (!room) return;
        if (room.participants.includes(friendId)) return;

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

    socket.on('startGame', async ({ roomId, targetTime }) => {
      try {
        const room = await GameRoomModel.findOne({ roomId });
        if (!room) {
          socket.emit('startGameError', { message: 'Room not found.' });
          return;
        }

        if ((room.participants || []).length < 2) {
          socket.emit('startGameError', { message: 'At least 2 players are required to start the game.' });
          return;
        }

        game.setTargetTime(roomId, targetTime);
        io.to(roomId).emit('gameStarted', { targetTime });
      } catch (err) {
        console.error('❌ startGame error:', err);
      }
    });

    socket.on('progressUpdate', async ({ roomId, uid, time, checkpoint }) => {
      try {
        const result = game.updateProgress(roomId, uid, time);
        io.to(roomId).emit('progressBroadcast', {
          roomId,
          uid,
          time,
          checkpoint,
          updatedAt: Date.now(),
        });

        if (result) {
          if (result.type === 'tie') {
            // Declare a tie
            game.declareTie(roomId);
            io.to(roomId).emit('tieAnnounced', { 
              message: 'Both players are on the same level! It\'s a Tie!' 
            });
            await storeMatchResult({ roomId, winnerUid: 'tie', winnerName: 'Tie' });
            game.removeRoom(roomId);
          } else if (result.type === 'winner') {
            // Declare a single winner
            const user = await User.findOne({ uid: result.player });
            const displayName = user?.displayName || 'Unknown';
            game.declareWinner(roomId, result.player, displayName);
            io.to(roomId).emit('winnerAnnounced', { roomId, winnerUid: result.player, winnerName: displayName });
            await storeMatchResult({ roomId, winnerUid: result.player, winnerName: displayName });
            game.removeRoom(roomId);
          }
        }
      } catch (err) {
        console.error('❌ progressUpdate error:', err);
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

        await storeMatchResult({ roomId, winnerUid: uid, winnerName: displayName });

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

    socket.on('disconnect', async () => {
      try {
        // Get user and room info from socket mapping
        const userRoomInfo = socketToUserRoom.get(socket.id);
        socketToUserRoom.delete(socket.id);

        // Remove from online users
        for (const [uid, sid] of onlineUsers.entries()) {
          if (sid === socket.id) {
            onlineUsers.delete(uid);
            break;
          }
        }
        io.emit('onlineUsersUpdate', Array.from(onlineUsers.keys()));

        // If user was in a room during a match, trigger auto-win logic
        if (userRoomInfo) {
          const { uid, roomId } = userRoomInfo;
          const room = await GameRoomModel.findOne({ roomId });
          if (!room) {
            console.log(`ℹ️ Room ${roomId} not found during disconnect cleanup`);
            return;
          }

          const gameRoom = game.getRoom(roomId);
          const matchInProgress = Boolean(gameRoom?.targetTime) && !gameRoom?.winner;

          if (matchInProgress && room.participants.length > 1) {
            // Remove disconnected user from room
            room.participants = room.participants.filter((participantUid) => participantUid !== uid);
            await room.save();
            const remainingCount = game.removeParticipant(roomId, uid);
            io.to(roomId).emit('roomUpdate', room.participants);

            // If only one player remains, declare them as winner
            if (remainingCount === 1) {
              const winnerUid = room.participants[0];
              const user = await User.findOne({ uid: winnerUid });
              const winnerName = user?.displayName || user?.email || 'Unknown';
              const result = game.declareWinner(roomId, winnerUid, winnerName);

              if (result) {
                io.to(roomId).emit('winnerAnnounced', { winnerUid, winnerName });
                await storeMatchResult({ roomId, winnerUid, winnerName });
                game.removeRoom(roomId);
                console.log(`✅ Auto-win for ${winnerName} due to opponent disconnect in room ${roomId}`);
              }
            }
          }
        }

        console.log('❌ Socket disconnected:', socket.id);
      } catch (err) {
        console.error('❌ disconnect error:', err);
      }
    });
  });
};

export default setupWebSocket;