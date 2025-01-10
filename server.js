const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid'); 
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let rooms = {};  // Stocke les salles avec leurs joueurs et l'état du jeu

io.on('connection', (socket) => {
    console.log('Un utilisateur s\'est connecté:', socket.id);

    // Création d'une nouvelle partie
    socket.on('createGame', () => {
        const roomCode = uuidv4();
        rooms[roomCode] = {
            players: [socket.id], // Ajoute le premier joueur
            board: Array(9).fill(null), // Plateau de jeu vide
            currentTurn: 'X', // "X" commence toujours
            gameActive: true // Partie en cours
        };
        socket.join(roomCode);
        socket.emit('gameCreated', roomCode);
        console.log(`Partie créée avec le code : ${roomCode}`);
    });

    // Rejoindre une partie
    socket.on('joinGame', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.players.length === 1) {
            room.players.push(socket.id); // Ajoute le deuxième joueur
            socket.join(roomCode);
            io.to(roomCode).emit('startGame', roomCode);
            console.log(`Le joueur ${socket.id} a rejoint la salle : ${roomCode}`);
        } else {
            socket.emit('joinError', 'Code invalide ou la salle est déjà pleine.');
        }
    });

    // Faire un mouvement
    socket.on('makeMove', ({ roomCode, index, symbol }) => {
        const room = rooms[roomCode];

        if (!room || !room.gameActive) {
            return;
        }

        // Vérifie si c'est bien au joueur actuel de jouer
        if (room.currentTurn !== symbol) {
            return;
        }

        // Vérifie si la case est déjà prise
        if (room.board[index]) {
            return;
        }

        // Marque la case et change de tour
        room.board[index] = symbol;
        io.to(roomCode).emit('moveMade', { index, symbol });

        // Vérifie si quelqu'un a gagné ou s'il y a égalité
        if (checkWin(room.board, symbol)) {
            room.gameActive = false;
            io.to(roomCode).emit('gameOver', { winner: symbol });
        } else if (room.board.every(cell => cell)) {
            room.gameActive = false;
            io.to(roomCode).emit('gameOver', { winner: null }); // Match nul
        } else {
            // Change de tour
            room.currentTurn = symbol === 'X' ? 'O' : 'X';
        }
    });

    // Relancer la partie
    socket.on('restartGame', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;

        // Réinitialise l'état du jeu
        room.board = Array(9).fill(null);
        room.currentTurn = 'X'; // Recommence avec "X"
        room.gameActive = true; // La partie est active

        // Informe tous les joueurs
        io.to(roomCode).emit('gameRestarted');
    });

    // Gestion de la déconnexion
    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté:', socket.id);
    });
});

// Fonction pour vérifier si un joueur a gagné
function checkWin(board, symbol) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Lignes
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colonnes
        [0, 4, 8], [2, 4, 6] // Diagonales
    ];

    return winPatterns.some(pattern => {
        return pattern.every(index => board[index] === symbol);
    });
}



io.on('connection', (socket) => {
    console.log('Un utilisateur s\'est connecté:', socket.id);

    socket.on('leaveGame', (roomCode) => {
    const room = rooms[roomCode];
    if (room) {
        room.players = room.players.filter(player => player !== socket.id);
        
        if (room.players.length === 0) {
            delete rooms[roomCode]; 
        } else {
            socket.to(roomCode).emit('gameLeft');
        }

        socket.emit('gameLeft');
    }
});
});

server.listen(3000, () => {
    console.log('Serveur en cours d\'exécution sur http://localhost:3000');
});
