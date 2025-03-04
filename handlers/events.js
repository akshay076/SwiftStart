// handlers/events.js
const slackService = require('../services/slack');
const config = require('../config');

/**
 * Handle Slack Events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleEvents = (req, res) => {
  // CRITICAL FIX: Handle Slack Events API URL verification challenge
  if (req.body && req.body.type === 'url_verification') {
    console.log('Handling Slack URL verification challenge:', req.body.challenge);
    return res.status(200).json({ challenge: req.body.challenge });
  }
  
  // Handle other events
  const body = req.body;
  
  // Respond to Slack immediately to meet the 3-second requirement
  res.status(200).send();
  
  // Process the event asynchronously
  if (body.event) {
    console.log('Processing Slack event:', body.event.type);
    
    // Handle different event types
    switch (body.event.type) {
      case 'app_mention':
        handleAppMention(body.event);
        break;
      
      case 'message':
        // Only process direct messages, not all messages
        if (body.event.channel_type === 'im') {
          handleDirectMessage(body.event);
        }
        break;
      
      // Add more event types as needed
      
      default:
        console.log(`Unhandled event type: ${body.event.type}`);
    }
  }
};

/**
 * Handle app mention events (when bot is @mentioned in a channel)
 * @param {Object} event - Slack event data
 */
async function handleAppMention(event) {
  try {
    const { text, channel, user } = event;
    
    // Remove the bot mention from the text
    const cleanText = text.replace(/<@[A-Z0-9]+>/, '').trim();
    
    // If no text after removing the mention, send help message
    if (!cleanText) {
      await slackService.sendMessage(
        channel,
        `Hi <@${user}>! You can ask me any onboarding-related questions or use the following commands:\n` +
        `• \`/askbuddy [question]\` - Ask any onboarding question\n` +
        `• \`/create-checklist [role] for @username\` - Create an onboarding checklist (managers only)\n` +
        `• \`/check-progress @username\` - Check onboarding progress (managers only)`
      );
      return;
    }
    
    // Process the mention as a question
    const langflowService = require('../services/langflow');
    const response = await langflowService.getLangflowResponse(cleanText);
    
    await slackService.sendMessage(channel, response);
  } catch (error) {
    console.error('Error handling app mention:', error);
    // Try to notify the user of the error
    try {
      await slackService.sendMessage(
        event.channel,
        "Sorry, I encountered an error while processing your question. Please try again."
      );
    } catch (innerError) {
      console.error('Error sending error notification:', innerError);
    }
  }
}

/**
 * Handle direct message events (DMs to the bot)
 * @param {Object} event - Slack event data
 */
async function handleDirectMessage(event) {
  try {
    // Ignore messages from the bot itself
    if (event.bot_id || event.user === config.slack.botUserId) {
      return;
    }
    
    const { text, channel, user } = event;
    
    // Process the DM as a question
    const langflowService = require('../services/langflow');
    const response = await langflowService.getLangflowResponse(text);
    
    await slackService.sendMessage(channel, response);
  } catch (error) {
    console.error('Error handling direct message:', error);
    // Try to notify the user of the error
    try {
      await slackService.sendMessage(
        event.channel,
        "Sorry, I encountered an error while processing your message. Please try again."
      );
    } catch (innerError) {
      console.error('Error sending error notification:', innerError);
    }
  }
}

module.exports = {
  handleEvents
};