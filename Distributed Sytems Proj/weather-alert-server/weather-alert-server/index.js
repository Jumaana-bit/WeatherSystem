const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const redis = require('redis');
const path = require('path');
const bodyParser = require('body-parser'); // For parsing JSON in requests

// Create an Express application
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const cors = require('cors');
app.use(cors());

// Redis client for regular commands (saving preferences)
const redisClientForCommands = redis.createClient({
    url: 'redis://127.0.0.1:6379'
});

// Redis client for Pub/Sub (subscribing to channels)
const redisClientForPubSub = redis.createClient({
    url: 'redis://127.0.0.1:6379'
});

// Middleware to parse JSON bodies
app.use(bodyParser.json());

async function startRedis() {
    try {
        // Connect both Redis clients
        await redisClientForCommands.connect();
        await redisClientForPubSub.connect();
        
        console.log('Redis clients connected');

        // Subscribe to Redis channels using the pub/sub client
        await redisClientForPubSub.subscribe('weather_alerts', (message) => {
            io.emit('weather_alerts', message);
            console.log(`Message received on weather_alerts: ${message}`);
        });

        await redisClientForPubSub.subscribe('weather_updates', (message) => {
            io.emit('weather_updates', message);
            console.log(`Message received on weather_updates: ${message}`);
        });

        redisClientForPubSub.subscribe('weather_alerts', (message) => {
            console.log("Message received on weather_alerts:", message);
            
            if (message === 'evacuate') {
                io.emit('evacuation_alert', 'evacuate');
                console.log("Evacuation alert emitted to frontend:", message);
            } else {
                io.emit('weather_alerts', message);
            }
        });

        console.log('Subscribed to channels: weather_alerts, weather_updates');
    } catch (error) {
        console.error('Redis connection error:', error);
    }
}

startRedis();

// Serve the index.html file when accessing the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle saving user preferences (POST request)
app.post('/api/preferences', async (req, res) => {
    const { temperature, windSpeed, humidity } = req.body;
    
    // Store the preferences using the regular Redis client
    try {
        await redisClientForCommands.hSet('user_preferences', 'temperature', temperature);
        await redisClientForCommands.hSet('user_preferences', 'windSpeed', windSpeed);
        await redisClientForCommands.hSet('user_preferences', 'humidity', humidity);

        res.json({ message: 'Preferences saved successfully!' });
    } catch (error) {
        console.error('Error saving preferences:', error);
        res.status(500).json({ message: 'Failed to save preferences' });
    }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('A user connected');
    
    // Handle client disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
