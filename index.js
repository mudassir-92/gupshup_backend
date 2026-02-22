const express = require('express');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // lock this down in production
    methods: ['GET', 'POST'],
  },
});

// userId -> socketId mapping
const users = {};

// Consistent room name for any two users
function getRoomName(a, b) {
  return [a, b].sort().join('_');
}

// Helper: find socket id of a user
function getSocketId(userId) {
  return users[userId] ?? null;
}

// Helper: remove user from map by socket id on disconnect
function removeUserBySocketId(socketId) {
  for (let userId in users) {
    if (users[userId] === socketId) {
      delete users[userId];
      console.log(`User unregistered: ${userId}`);
      return;
    }
  }
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // ─── Register ───────────────────────────────────────────────
  socket.on('register', (userId) => {
    users[userId] = socket.id;
    console.log(`Registered: ${userId} -> ${socket.id}`);
  });

  // ─── Call User (A -> B) ──────────────────────────────────────
  // A emits call_user, server notifies B
  socket.on('call_user', ({ from, to }) => {
    console.log(`call_user: ${from} -> ${to}`);
    const sidOfB = getSocketId(to);

    if (sidOfB) {
      io.to(sidOfB).emit('incoming_call', { from });
    } else {
      socket.emit('user_not_found', { userId: to });
    }
  });

  // ─── Call Accepted (B -> A) ──────────────────────────────────
  // B accepted, B joins the room, then notifies A to join too
  socket.on('call_accepted', ({ from, to }) => {
    console.log(`call_accepted: ${from} accepted call from ${to}`);
    const sidOfA = getSocketId(to);
    const room = getRoomName(from, to);

    socket.join(room); // B joins room
    console.log(`${from} joined room: ${room}`);

    if (sidOfA) {
      io.to(sidOfA).emit('call_accepted', { from });
      // A will emit 'join' next to enter the same room
    }
  });

  // ─── Call Rejected (B -> A) ──────────────────────────────────
  socket.on('call_rejected', ({ from, to }) => {
    console.log(`call_rejected: ${from} rejected call from ${to}`);
    const sidOfA = getSocketId(to);

    if (sidOfA) {
      io.to(sidOfA).emit('call_rejected', { from });
    }
  });

  // ─── Join Room (A joins after receiving call_accepted) ───────
  socket.on('join', ({ a, b }) => {
    const room = getRoomName(a, b);
    socket.join(room);
    console.log(`${a} joined room: ${room}`);
  });

  // ─── WebRTC Signaling ────────────────────────────────────────

  // A sends offer to room, B receives it
  socket.on('offer', ({ from, to, offer }) => {
    console.log(`offer: ${from} -> ${to}`);
    // emit to everyone in room EXCEPT sender
    socket.to(getRoomName(from, to)).emit('offer', { offer, from });
  });

  // B sends answer to room, A receives it
  socket.on('answer', ({ from, to, answer }) => {
    console.log(`answer: ${from} -> ${to}`);
    socket.to(getRoomName(from, to)).emit('answer', { answer, from });
  });

  // Both sides relay ICE candidates through the room
  socket.on('ICE', ({ from, to, candidate }) => {
    console.log(`ICE candidate: ${from} -> ${to}`);
    socket.to(getRoomName(from, to)).emit('ICE', { candidate, from });
  });

  // ─── Disconnect ──────────────────────────────────────────────
  socket.on('disconnect', () => {
    removeUserBySocketId(socket.id);
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(8000, () => {
  console.log('Signaling server running on port 8000');
});
