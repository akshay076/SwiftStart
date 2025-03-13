// handlers/events.js
const slackService = require('../services/slack');
const config = require('../config');
const checklistController = require('../controllers/checklist');

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
  
  // Respond to Slack immediately to meet the 3-second requirement
  res.status(200).send();
  
  // Handle other events
  const body = req.body;
  
  // Process the event asynchronously
  if (body.event) {
    console.log('Processing Slack event:', body.event.type);
    
    // IMPORTANT: Check if this event is from a slash command
    // If the event text starts with a slash, it's likely a duplicate of a command
    // and we should ignore it to prevent double-processing
    if (body.event.text && body.event.text.trim().startsWith('/')) {
      console.log('Ignoring event that appears to be a slash command:', body.event.text);
      return;
    }
    
    // Also ignore events with subtype (like message_changed, etc.)
    if (body.event.subtype) {
      console.log('Ignoring event with subtype:', body.event.subtype);
      return;
    }
    
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
    
    // Send a "thinking" message
    await slackService.sendMessage(
      channel,
      `I'm looking into that for you, <@${user}>. Just a moment...`
    );
    
    // Process the mention as a question
    const langflowService = require('../services/langflow');
    const response = await langflowService.queryLangflow(cleanText);
    
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
    
    // Check if the message looks like a slash command
    if (text.startsWith('/')) {
      console.log('Ignoring DM that looks like a slash command:', text);
      await slackService.sendMessage(
        channel,
        `It looks like you're trying to use a slash command. Please use slash commands in the message input, not in a DM. For example, type "/askbuddy" followed by your question.`
      );
      return;
    }

    // Check if user is a manager for RAI metrics display
    const isManager = await checklistController.isUserManager(user);
    
    // Send a "thinking" message
    await slackService.sendMessage(
      channel,
      `I'm working on your question, <@${user}>. This might take a moment...`
    );
    
    // Process the DM as a question
    const langflowService = require('../services/langflow');
    const responsibleAIService = require('../services/responsibleAI');

    let response;
    let raiMetrics = null;

    try {
      if (typeof langflowService.queryLangflowWithMetrics === 'function') {
        // Use enhanced query with metrics if available
        const result = await langflowService.queryLangflowWithMetrics(text);
        response = result.message;
        raiMetrics = result.raiMetrics;
      } else {
        // Fall back to standard query
        response = await langflowService.queryLangflow(text);
        
        // Generate basic metrics
        const isPIIDetected = text.toLowerCase().includes('personal') || 
                              text.toLowerCase().includes('private') || 
                              text.toLowerCase().includes('information');
        
        const isBiasDetected = text.toLowerCase().includes('gender') || 
                               text.toLowerCase().includes('age') || 
                               text.toLowerCase().includes('race');
        
        raiMetrics = responsibleAIService.generateMetrics(
          text,
          response,
          isPIIDetected,
          isBiasDetected
        );
      }
      // Send response with RAI metrics for managers
      if (isManager && raiMetrics) {
        await slackService.sendMessageWithRAI(channel, response, raiMetrics, true);
      } else {
        await slackService.sendMessage(channel, response);
      }
      
    } catch (queryError) {
      console.error('Error querying Langflow:', queryError);
      await slackService.sendMessage(
        channel,
        "I'm sorry, but I couldn't get a response from my knowledge base. Please try again in a few minutes."
      );
    }
    
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