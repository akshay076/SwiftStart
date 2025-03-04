// routes/slack.js
const express = require('express');
const router = express.Router();

// Import handler modules
const commandsHandler = require('../handlers/commands');
const eventsHandler = require('../handlers/events');
const interactionsHandler = require('../handlers/interactions');

// Log that router is loading
console.log('Loading Slack routes...');
console.log('Commands handler:', typeof commandsHandler.handleCommands);
console.log('Events handler:', typeof eventsHandler.handleEvents);
console.log('Interactions handler:', typeof interactionsHandler.handleInteractions);

// Route slash commands to the handler
router.post('/commands', commandsHandler.handleCommands);

// Route events and interactions
router.post('/events', eventsHandler.handleEvents);
router.post('/interactions', interactionsHandler.handleInteractions);

console.log('Slack routes loaded successfully');

module.exports = router;