import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
import http from 'http';
import { Server } from 'socket.io';
const server = http.createServer(app);
//import
import setupWebSocket from './routes/gameRoutes.js';
import userRouter from './routes/userRoutes.js';
import gameRouter from './routes/games.js'
import User from './models/User.js';

// Middleware
app.use(cors({
  origin: ['https://onefocused.onrender.com', 'http://localhost:5173'],// or your frontend URL
  credentials: true
}));
app.use(express.json());
// MongoDB connection
connectmongo(process.env.MONGODB_URI);
async function connectmongo(url) {
  mongoose.connect(url)
  .then(()=>console.log("mongoDb connected"))
  .catch((err)=>console.log("error",err));
}

//Socket Connection
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
setupWebSocket(io);

//Routes
app.get('/', (req, res) => {
  res.send(' OneFocus server is running');
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await User.find({})
      .sort({ 'studyStats.points': -1 })
      .limit(50)
      .select('displayName email studyStats.points studyStats.totalStudyTime studyStats.sessionsCompleted');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.use("/api/users",userRouter);
app.use("/api/games",gameRouter);

server.listen(PORT, () => {
  setInterval(() => {
    fetch('https://buggit-trailer.onrender.com/ping')
      .then(() => console.log('Pinged self!'))
      .catch(() => console.log('Self ping failed.'));
  }, 1000 * 60 * 10);
});





