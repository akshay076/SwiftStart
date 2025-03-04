// routes/slack.js
const express = require('express');
const router = express.Router();

// Import handler modules
const commandsHandler = require('../handlers/commands');
const eventsHandler = require('../handlers/events');
const interactionsHandler = require('../handlers/interactions');

// Make sure we're importing the functions properly
console.log('Commands handler:', typeof commandsHandler.handleSlackCommand);
console.log('Events handler:', typeof eventsHandler.handleEvents);
console.log('Interactions handler:', typeof interactionsHandler.handleInteractions);

// Ensure we're using existing functions
router.post('/commands', commandsHandler.handleSlackCommand);
router.post('/events', eventsHandler.handleEvents);
router.post('/interactions', interactionsHandler.handleInteractions);

module.exports = router;

console.log('Commands handler object:', commandsHandler);
console.log('Events handler object:', eventsHandler);
console.log('Interactions handler object:', interactionsHandler);