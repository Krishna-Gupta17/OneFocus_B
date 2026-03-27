// utils/gameState.js

const gameRooms = new Map(); // roomId -> gameState

const game = {
  createRoom: (roomId, hostUid) => {
    if (!gameRooms.has(roomId)) {
      gameRooms.set(roomId, {
        hostUid,
        targetTime: null,
        participants: [],
        progress: new Map(),
        winner: null,
        winnerName: null,
        isTie: false,
      });
    }
  },

  setTargetTime: (roomId, time) => {
    const room = gameRooms.get(roomId);
    if (room) {
      room.targetTime = time;
    }
  },

  addParticipant: (roomId, uid) => {
    const room = gameRooms.get(roomId);
    if (room && !room.participants.includes(uid)) {
      room.participants.push(uid);
      room.progress.set(uid, 0);
    }
  },

  removeParticipant: (roomId, uid) => {
    const room = gameRooms.get(roomId);
    if (!room) return 0;

    room.participants = room.participants.filter((participantUid) => participantUid !== uid);
    room.progress.delete(uid);

    if (room.winner === uid) {
      room.winner = null;
      room.winnerName = null;
    }

    if (room.participants.length === 0) {
      gameRooms.delete(roomId);
      return 0;
    }

    return room.participants.length;
  },

  updateProgress: (roomId, uid, time) => {
    const room = gameRooms.get(roomId);
    if (room && room.progress.has(uid)) {
      room.progress.set(uid, time);
      
      // Check if this player reached target time
      if (time >= room.targetTime && !room.winner) {
        // Check if other participants also reached the target time (within 2 second threshold)
        const completedPlayers = [];
        room.progress.forEach((playerTime, playerId) => {
          if (playerTime >= room.targetTime) {
            completedPlayers.push(playerId);
          }
        });
        
        // If 2 or more players completed at approximately the same time, it's a tie
        if (completedPlayers.length >= 2) {
          return { type: 'tie', players: completedPlayers };
        }
        // Otherwise, it's a single winner
        return { type: 'winner', player: uid };
      }
    }
    return null;
  },

  declareWinner: (roomId, uid, displayName) => {
    const room = gameRooms.get(roomId);
    if (room && !room.winner) {
      room.winner = uid;
      room.winnerName = displayName;
      room.isTie = false;
      return { uid, displayName };
    }
    return null;
  },

  declareTie: (roomId) => {
    const room = gameRooms.get(roomId);
    if (room && !room.winner) {
      room.winner = 'tie';
      room.winnerName = 'Tie';
      room.isTie = true;
      return true;
    }
    return false;
  },

  getRoom: (roomId) => gameRooms.get(roomId),
  removeRoom: (roomId) => {
    gameRooms.delete(roomId);
  },

};

export default game;