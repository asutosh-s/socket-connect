import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'https://asutosh-swain.vercel.app', // Replace with your React app URL
        methods: ['GET', 'POST'],
    },
});
app.get('/', (req, res) => {
    res.send('Server is running');
});

let rooms = {};

io.on('connection', (socket) => {
    console.log("New client connected");

    socket.on('joinRoom', ({ roomId, userName }) => {

        if (!rooms[roomId]) {
            rooms[roomId] = { players: [], currentPlayer: null };
        }

        if (rooms[roomId].players.length >= 2) {
            socket.emit('roomFull');
            return;
        }

        rooms[roomId].players.push({ id: socket.id, name: userName });
        socket.join(roomId);

        if (rooms[roomId].players.length === 1) {
            rooms[roomId].currentPlayer = 1;
            socket.emit('currentPlayer', 1);
        } else if (rooms[roomId].players.length === 2) {
            rooms[roomId].currentPlayer = 1;
            socket.emit('currentPlayer', 2);
        }

        io.to(roomId).emit('gameState', rooms[roomId]);
    });

    socket.on('startGame', (roomId) => {
        rooms[roomId].currentPlayer = 1;
        io.to(roomId).emit('gameState', rooms[roomId]);
        socket.broadcast.to(roomId).emit('gameStarted');
    })

    socket.on('updateData', ({roomId,startValue,playerWinValue,gameOverValue}) => {
        socket.broadcast.to(roomId).emit('dataUpdate', {startValue,playerWinValue,gameOverValue});
    })

    socket.on('makeMove', (roomId) => {
        const room = rooms[roomId];
        if (!room) return;

        room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
        io.to(roomId).emit('gameState', rooms[roomId]);
    });

    socket.on('updateGrid', ({roomId, tempGrid}) => {
        const room = rooms[roomId];
        if (!room) return;

        socket.broadcast.to(roomId).emit('gridUpdate', tempGrid);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');

        // Remove the player from the room
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(player => player.id === socket.id);

            if (playerIndex !== -1) {
                // Remove the player from the room
                room.players.splice(playerIndex, 1);

                // If the room is empty, remove the room from the mapping
                if (room.players.length === 0) {
                    delete rooms[roomId];
                } else {
                    // Reassign the currentPlayer if necessary
                    if (room.currentPlayer === room.players[playerIndex]?.role) {
                        // Move to the next player
                        room.currentPlayer = room.players[0].role; // Assuming player1 is always present
                    }

                    // Notify remaining players about the change
                    io.to(roomId).emit('gameState', room);
                    io.to(roomId).emit('currentPlayer', room.currentPlayer);
                }
            }
        }
    });
});

server.listen(3001, () => {
    console.log('server running at http://localhost:3001');
});