// handlers/wellbeing.js
const slackService = require('../services/slack');
const wellnessInsightsService = require('../services/wellnessInsights');

/**
 * Handle demo command to showcase WellSense360
 * @param {Object} payload - Slack command payload
 */
async function handleDemoCommand(payload) {
  const { user_id, channel_id } = payload;
  
  try {
    // Existing demo implementation stays the same
    // (previous implementation from the original file)
    // ... (rest of the existing handleDemoCommand code)
  } catch (error) {
    console.error('Error in demo:', error);
    await slackService.sendMessage(
      channel_id,
      "Sorry, I encountered an error during the demo."
    );
  }
}

/**
 * Handle insights command to show well-being dashboard
 * @param {Object} payload - Slack command payload
 */
async function handleInsightsCommand(payload) {
  const { user_id, channel_id, text } = payload;
  
  try {
    // Check if team insights are requested
    if (text && text.toLowerCase().trim() === 'team') {
      await wellnessInsightsService.sendTeamWellnessInsights(channel_id);
    } else {
      // Personal insights
      await wellnessInsightsService.sendPersonalInsights(user_id, channel_id);
    }
  } catch (error) {
    console.error('Error handling insights command:', error);
    await slackService.sendMessage(
      channel_id,
      "Sorry, I couldn't generate insights at this time."
    );
  }
}

/**
 * Handle enrollment for automated well-being pulses
 * @param {Object} payload - Slack command payload
 */
async function handleEnrollCommand(payload) {
  const { user_id, channel_id, team_id } = payload;
  
  try {
    // Existing implementation from the original file
    // Send confirmation
    await slackService.sendMessage(
      channel_id,
      `✅ *You're enrolled in WellSense360!*\n\nYou'll receive automated well-being pulse checks throughout your workday.\n\nThese brief check-ins help measure team well-being patterns while respecting your privacy.\n\nType \`/insights\` anytime to see anonymized team insights.`
    );
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Use pulse scheduler to create blocks
    const pulseScheduler = require('../services/pulseScheduler');
    const pulseBlocks = pulseScheduler.createPulseCheckBlocks();
    
    // Send the pulse check with blocks
    await slackService.sendMessageWithBlocks(
      channel_id, 
      "WellSense360 Well-being Pulse",
      pulseBlocks
    );
    
  } catch (error) {
    console.error('Error enrolling in well-being pulses:', error);
    await slackService.sendMessage(
      channel_id,
      "Sorry, I encountered an error enrolling you in well-being measurements."
    );
  }
}

module.exports = {
  handleDemoCommand,
  handleInsightsCommand,
  handleEnrollCommand
};