import { Server } from 'socket.io';
import http from 'http';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // adjust as needed
  }
});

// socket.io real-time connection
io.on('connection', (socket) => {
  console.log('🟢 A user connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('send-room-update', (roomId) => {
    io.to(roomId).emit('room-updated');
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
  });
});

export { io };
export default server;
