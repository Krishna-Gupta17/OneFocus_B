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

  updateProgress: (roomId, uid, time) => {
    const room = gameRooms.get(roomId);
    if (room && room.progress.has(uid)) {
      room.progress.set(uid, time);
      return time >= room.targetTime && !room.winner;
    }
    return false;
  },

  declareWinner: (roomId, uid, displayName) => {
    const room = gameRooms.get(roomId);
    if (room && !room.winner) {
      room.winner = uid;
      room.winnerName = displayName;
      return { uid, displayName };
    }
    return null;
  },

  getRoom: (roomId) => gameRooms.get(roomId),
  removeRoom: (roomId) => {
    gameRooms.delete(roomId);
  },

};

export default game;