require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const morgan = require('morgan');

// Models
const Message = require('./models/Message');
const Project = require('./models/Project');
const Notification = require('./models/Notification');

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const problemRoutes = require('./routes/problemRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const startKeepAlive = require('./utils/keepAlive');
const cron = require('node-cron');
const rankingService = require('./utils/rankingService');

// Middleware
const logger = require('./middleware/logger');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);
app.set('io', io);

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "https://unpkg.com", "'unsafe-inline'", "'unsafe-eval'"],
      "img-src": ["*", "data:", "blob:"],
      "connect-src": ["'self'", "https://api.cloudinary.com"],
    },
  },
}));

// Logging Middleware
app.use(morgan('combined', { 
  stream: { write: (message) => logger.info(message.trim()) } 
}));

app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(express.static('public'));

// Apply Rate Limiting
app.use('/api/auth', authLimiter); // Specific auth limits first
app.use('/api', apiLimiter);      // General API limits second

// Database connection with retry logic
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  logger.error('FATAL ERROR: MONGO_URI is not defined.');
  process.exit(1);
}

const connectDB = async () => {
  try {
    await mongoose.connect(mongoURI);
    logger.info('MongoDB connected successfully');
  } catch (err) {
    logger.error('MongoDB connection error:', err);
    logger.info('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

connectDB();

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected! Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error:', err);
});

// Initial route
app.get('/', (req, res) => {
  res.send('CIVIC API is running');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/feedback', feedbackRoutes);

// Error Handling Middleware (Must be last)
app.use(errorHandler);

// Socket.IO Middleware for Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  const JWT_SECRET = process.env.JWT_SECRET;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Socket User connected: ${socket.user.id}`);
  socket.emit('server_ready', { message: 'Welcome to CIVIC chat', timestamp: Date.now() });

  socket.on('ping_server', (data) => {
    console.log(`[CONSOLE] PING RECEIVED from ${socket.user.id}:`, data);
    logger.info(`PING RECEIVED from ${socket.user.id}: ${JSON.stringify(data)}`);
    socket.emit('pong_server', { received: data, time: Date.now() });
  });

  socket.join(socket.user.id);

  socket.on('disconnect', (reason) => {
    logger.info(`Socket User disconnected: ${socket.user.id}. Reason: ${reason}`);
  });

  socket.on('join_project', async (projectId) => {
    console.log(`[SOCKET_DEBUG] join_project received for: ${projectId}`);
    logger.info(`join_project received for: ${projectId}`);
    try {
      const project = await Project.findById(projectId);
      if (!project) {
        logger.warn(`join_project: Project not found: ${projectId}`);
        return;
      }

      const isOwner = project.owner.toString() === socket.user.id;
      const isCollaborator = project.collaborators.some(c => c.toString() === socket.user.id);
      const isTeamMember = project.teamMembers.some(m => m.user?.toString() === socket.user.id);

      if (isOwner || isCollaborator || isTeamMember) {
        socket.join(projectId);
        logger.info(`User ${socket.user.id} joined project room: ${projectId}`);
      } else {
        logger.warn(`User ${socket.user.id} NOT authorized for project room: ${projectId}. Owner: ${project.owner}, Team: ${project.teamMembers.map(m => m.user)}`);
      }
    } catch (err) {
      logger.error('Error joining project room:', err);
    }
  });

  socket.on('send_message', async (data) => {
    const { projectId, text, repliedToId } = data;
    logger.info(`Received send_message from ${socket.user.id} for project ${projectId}: ${text}`);
    try {
      const project = await Project.findById(projectId);
      if (!project) return;

      const isOwner = project.owner.toString() === socket.user.id;
      const isCollaborator = project.collaborators.some(c => c.toString() === socket.user.id);
      const isTeamMember = project.teamMembers.some(m => m.user?.toString() === socket.user.id);

      if (isOwner || isCollaborator || isTeamMember) {
        const newMessage = new Message({
          sender: socket.user.id,
          project: projectId,
          text,
          repliedTo: repliedToId || null
        });
        await newMessage.save();

        const populatedMessage = await Message.findById(newMessage._id)
          .populate('sender', 'username fullName profileImage')
          .populate({
            path: 'repliedTo',
            populate: { path: 'sender', select: 'username fullName' }
          });

        io.to(projectId).emit('receive_message', populatedMessage);

        const membersToNotify = [
          project.owner.toString(), 
          ...project.collaborators.map(c => c.toString()),
          ...project.teamMembers.map(m => m.user?.toString()).filter(id => id)
        ]
          .filter(id => id !== socket.user.id);

        for (const recipientId of membersToNotify) {
          const notification = new Notification({
            recipient: recipientId,
            sender: socket.user.id,
            type: 'NEW_MSG',
            relatedId: projectId,
            title: `New message in ${project.title}`,
            message: `${populatedMessage.sender.fullName}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`
          });
          logger.info(`Notification created for recipient ${recipientId}`);
          await notification.save();

          io.to(recipientId).emit('new_notification', {
            ...notification.toObject(),
            sender: {
              username: populatedMessage.sender.username,
              fullName: populatedMessage.sender.fullName,
              profileImage: populatedMessage.sender.profileImage
            }
          });
        }
      }
    } catch (err) {
      logger.error('Error sending message:', err);
    }
  });
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  
  // Start keep-alive ping to prevent sleep on platforms like Render
  const serverUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  startKeepAlive(serverUrl);

  // Schedule Coordinator Rankings (Daily at 12 AM)
  cron.schedule('0 0 * * *', async () => {
    logger.info('[Cron] Starting daily coordinator ranking calculation...');
    await rankingService.calculateCoordinatorRankings();
  });
  
  // Optional: Run once on startup if the cache is empty
  // (We'll leave this to the admin or first run for now)
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${err}`);
  // In production, we might want to gracefully shutdown, but for robustness we log and keep going if safe
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  // For uncaught exceptions, it's often safer to exit after logging, but the user asked not to crash
  // We'll log it and the process will continue (though it might be in an inconsistent state)
});
