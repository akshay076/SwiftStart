// services/slack.js
const axios = require('axios');
const config = require('../config');

/**
 * Send a message to a Slack channel
 * @param {string} channelId - The ID of the channel to send to
 * @param {string} message - The message to send
 * @returns {Promise<object>} - The Slack API response
 */
async function sendMessage(channelId, message) {
  try {
    console.log(`Sending message to Slack channel ${channelId}`);
    
    const response = await axios.post('https://slack.com/api/chat.postMessage', {
      channel: channelId,
      text: message
    }, {
      headers: {
        'Authorization': `Bearer ${config.slack.botToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.data.ok) {
      console.error('Slack API error:', response.data.error);
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error sending Slack message:', error.message);
    throw error;
  }
}

/**
 * Send a message with blocks to a Slack channel
 * @param {string} channelId - The ID of the channel to send to
 * @param {string} fallbackText - Fallback text for notifications
 * @param {Array} blocks - The Slack blocks to send
 * @returns {Promise<object>} - The Slack API response
 */
async function sendMessageWithBlocks(channelId, fallbackText, blocks) {
  try {
    console.log(`Sending blocks to Slack channel ${channelId}`);
    
    const response = await axios.post('https://slack.com/api/chat.postMessage', {
      channel: channelId,
      text: fallbackText,
      blocks: blocks
    }, {
      headers: {
        'Authorization': `Bearer ${config.slack.botToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.data.ok) {
      console.error('Slack API error:', response.data.error);
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error sending Slack blocks:', error.message);
    throw error;
  }
}

/**
 * Get user information from Slack
 * @param {string} userId - The ID or username of the user
 * @returns {Promise<object>} - The user information
 */
async function getUserInfo(userId) {
  try {
    // Determine if we're working with a user ID or username
    const method = userId.startsWith('U') ? 'users.info' : 'users.lookupByEmail';
    const param = userId.startsWith('U') ? { user: userId } : { email: `${userId}@yourcompany.com` };
    
    const response = await axios.get(`https://slack.com/api/${method}`, {
      params: param,
      headers: { Authorization: `Bearer ${config.slack.botToken}` }
    });
    
    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    return response.data.user;
  } catch (error) {
    console.error('Error getting user info:', error.message);
    throw error;
  }
}

/**
 * Open a direct message channel with a user
 * @param {string} userId - The ID of the user
 * @returns {Promise<string>} - The channel ID of the DM
 */
async function openDirectMessageChannel(userId) {
  try {
    const response = await axios.post('https://slack.com/api/conversations.open', {
      users: userId
    }, {
      headers: {
        'Authorization': `Bearer ${config.slack.botToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    return response.data.channel.id;
  } catch (error) {
    console.error('Error opening DM channel:', error.message);
    throw error;
  }
}

/**
 * Handle interaction payloads from Slack
 * @param {object} payload - The interaction payload
 * @returns {Promise<void>}
 */
async function handleInteractionPayload(payload) {
  try {
    // Handle different types of interactions
    if (payload.type === 'block_actions') {
      return handleBlockActions(payload);
    } else if (payload.type === 'view_submission') {
      return handleViewSubmission(payload);
    }
  } catch (error) {
    console.error('Error handling interaction payload:', error);
  }
}

/**
 * Handle block action interactions (buttons, checkboxes, etc.)
 * @param {object} payload - The block action payload
 * @returns {Promise<void>}
 */
async function handleBlockActions(payload) {
  const actions = payload.actions || [];
  
  for (const action of actions) {
    if (action.action_id.startsWith('toggle_item_')) {
      await handleToggleItem(action, payload);
    } else if (action.action_id.startsWith('view_progress_')) {
      await handleViewProgress(action, payload);
    } else if (action.action_id.startsWith('view_employee_progress_')) {
      await handleViewEmployeeProgress(action, payload);
    }
  }
}

/**
 * Handle checklist item toggle
 * @param {object} action - The action data
 * @param {object} payload - The full payload
 * @returns {Promise<void>}
 */
async function handleToggleItem(action, payload) {
  // Extract checklist ID and item ID from action_id
  // Format: toggle_item_[checklistId]_[itemId]
  const parts = action.action_id.split('_');
  const checklistId = parts[2];
  const itemId = parts[3];
  
  // Determine new state
  const isCompleted = (action.selected_options || []).length > 0;
  
  // This function would be imported from your checklist controller
  const checklistController = require('../controllers/checklist');
  
  // Update the item status
  const updated = checklistController.updateChecklistItemStatus(
    checklistId,
    itemId,
    isCompleted
  );
  
  if (updated) {
    // Get the updated checklist
    const checklist = checklistController.getChecklistById(checklistId);
    
    // Optionally, notify the manager of progress
    if (isCompleted && checklist) {
      notifyManagerOfProgress(checklist, itemId, payload.user.id);
    }
  }
}

/**
 * Notify a manager when an employee completes a checklist item
 * @param {object} checklist - The checklist object
 * @param {string} itemId - The completed item ID
 * @param {string} employeeId - The employee Slack ID
 * @returns {Promise<void>}
 */
async function notifyManagerOfProgress(checklist, itemId, employeeId) {
  try {
    const { managerId } = checklist;
    const item = checklist.items.find(i => i.id === itemId);
    
    if (!item) return;
    
    // Open a DM with the manager
    const dmChannelId = await openDirectMessageChannel(managerId);
    
    // Send notification
    await sendMessage(dmChannelId, 
      `<@${employeeId}> has completed the task "${item.text}" on their ${checklist.role} onboarding checklist.`
    );
    
    // Calculate new progress
    const checklistController = require('../controllers/checklist');
    const progress = checklistController.calculateChecklistProgress(checklist);
    
    // If this completion reaches a milestone (25%, 50%, 75%, 100%), send a summary
    if (progress.completedPercentage === 25 || 
        progress.completedPercentage === 50 || 
        progress.completedPercentage === 75 || 
        progress.completedPercentage === 100) {
      
      await sendMessage(dmChannelId, 
        `🎉 <@${employeeId}> has reached ${progress.completedPercentage}% completion of their onboarding checklist!\n` +
        `They have completed ${progress.completedCount} out of ${progress.totalCount} tasks.`
      );
    }
  } catch (error) {
    console.error('Error notifying manager of progress:', error);
    // Non-critical error, so we just log it and continue
  }
}

/**
 * Handle view progress button click
 * @param {object} action - The action data
 * @param {object} payload - The full payload
 * @returns {Promise<void>}
 */
async function handleViewProgress(action, payload) {
  // Extract checklist ID from action_id
  const checklistId = action.action_id.replace('view_progress_', '');
  
  // Get the checklist
  const checklistController = require('../controllers/checklist');
  const checklist = checklistController.getChecklistById(checklistId);
  
  if (!checklist) {
    // Checklist not found
    await sendMessage(payload.channel.id, "Sorry, I couldn't find that checklist.");
    return;
  }
  
  // Generate progress summary
  const progress = checklistController.calculateChecklistProgress(checklist);
  
  // Create progress modal
  try {
    await axios.post('https://slack.com/api/views.open', {
      trigger_id: payload.trigger_id,
      view: {
        type: "modal",
        title: {
          type: "plain_text",
          text: "Onboarding Progress"
        },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Onboarding Progress: ${checklist.role}*`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${progress.completedPercentage}%* complete (${progress.completedCount}/${progress.totalCount} tasks)`
            }
          },
          ...checklistController.generateProgressBlocks(checklist)
        ]
      }
    }, {
      headers: {
        'Authorization': `Bearer ${config.slack.botToken}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error opening progress modal:', error);
    await sendMessage(payload.channel.id, 
      "Sorry, I encountered an error showing your progress. Please try again."
    );
  }
}

/**
 * Handle view employee progress button click (for managers)
 * @param {object} action - The action data
 * @param {object} payload - The full payload
 * @returns {Promise<void>}
 */
async function handleViewEmployeeProgress(action, payload) {
  // Extract checklist ID from action_id
  const checklistId = action.action_id.replace('view_employee_progress_', '');
  
  // Get the checklist
  const checklistController = require('../controllers/checklist');
  const checklist = checklistController.getChecklistById(checklistId);
  
  if (!checklist) {
    // Checklist not found
    await sendMessage(payload.channel.id, "Sorry, I couldn't find that checklist.");
    return;
  }
  
  // Verify the requester is the manager
  if (payload.user.id !== checklist.managerId) {
    await sendMessage(payload.channel.id, "Sorry, only the manager who created this checklist can view its progress.");
    return;
  }
  
  // Generate progress summary
  const progress = checklistController.calculateChecklistProgress(checklist);
  
  // Create blocks for progress display
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Onboarding Progress: ${checklist.role}`,
        emoji: true
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Progress for <@${checklist.employeeId}>: *${progress.completedPercentage}%* complete (${progress.completedCount}/${progress.totalCount} tasks)`
      }
    },
    {
      type: "divider"
    },
    ...checklistController.generateProgressBlocks(checklist)
  ];
  
  // Send progress summary
  await sendMessageWithBlocks(payload.channel.id, 
    `Onboarding progress for employee`,
    blocks
  );
}

/**
 * Handle view submission interactions (modal submissions)
 * @param {object} payload - The view submission payload
 * @returns {Promise<void>}
 */
async function handleViewSubmission(payload) {
  // This would handle any modal form submissions
  // Currently not needed for the basic implementation
}

module.exports = {
  sendMessage,
  sendMessageWithBlocks,
  getUserInfo,
  openDirectMessageChannel,
  handleInteractionPayload
};