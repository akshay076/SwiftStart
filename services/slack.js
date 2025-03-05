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
    
    // Ensure message is never empty (Slack requires non-empty text)
    const safeMessage = message || "ㅤ"; // Use invisible character if empty
    
    const response = await axios.post('https://slack.com/api/chat.postMessage', {
      channel: channelId,
      text: safeMessage
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

// services/slack.js - Improved error handling for sendMessageWithBlocks

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
    
    // Ensure fallbackText is never empty (Slack requires non-empty text)
    const safeFallbackText = fallbackText || "Message with blocks";
    
    // Ensure blocks is a valid array
    if (!Array.isArray(blocks) || blocks.length === 0) {
      console.warn('No blocks provided, falling back to regular message');
      return await sendMessage(channelId, safeFallbackText);
    }
    
    // Log detailed information about the request
    console.log('Block count:', blocks.length);
    
    // Validate blocks before sending to catch obvious errors
    for (let i = 0; i < blocks.length; i++) {
      if (!blocks[i].type) {
        console.error(`Block at index ${i} is missing required 'type' field:`, blocks[i]);
        blocks[i] = {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Error: Invalid block format"
          }
        };
      }
    }
    
    // Prepare the request data
    const requestData = {
      channel: channelId,
      text: safeFallbackText,
      blocks: blocks
    };
    
    // Log the first few blocks for debugging (to avoid overly long logs)
    console.log('First 2 blocks:', JSON.stringify(blocks.slice(0, 2), null, 2));
    console.log(`Total block count: ${blocks.length}`);
    
    const response = await axios.post('https://slack.com/api/chat.postMessage', requestData, {
      headers: {
        'Authorization': `Bearer ${config.slack.botToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Check for Slack API errors
    if (!response.data.ok) {
      console.error('Slack API error:', response.data.error);
      
      if (response.data.error === 'invalid_blocks') {
        console.error('Block validation failed. Dumping block data:');
        console.error(JSON.stringify(blocks, null, 2));
        
        // Try to identify which block is causing the issue
        if (blocks.length > 1) {
          console.log('Attempting to identify problematic block...');
          for (let i = 0; i < blocks.length; i++) {
            console.log(`Testing block ${i}: ${blocks[i].type}`);
          }
        }
        
        // Fall back to simple message if blocks failed
        console.log('Falling back to simple message without blocks');
        return await sendMessage(channelId, `${safeFallbackText} (Note: Could not display rich content due to formatting issues)`);
      }
      
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    console.log('Successfully sent message with blocks');
    return response.data;
  } catch (error) {
    console.error('Error sending Slack blocks:', error.message);
    
    // Log the detailed error information
    if (error.response) {
      console.error('Slack response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    // Attempt to fall back to a simple message
    try {
      console.log('Falling back to simple message');
      return await sendMessage(channelId, `${fallbackText} (Note: Could not display rich content due to an error)`);
    } catch (fallbackError) {
      console.error('Error sending fallback message:', fallbackError);
      throw error; // Throw the original error
    }
  }
}


/**
 * Get user information from Slack
 * @param {string} userId - The ID or username of the user
 * @returns {Promise<object>} - The user information
 */
async function getUserInfo(userId) {
  try {
    console.log(`Getting user info for: ${userId}`);
    
    // First, handle Slack mention format <@USERID|username>
    const mentionMatch = String(userId).match(/<@([A-Z0-9]+)(?:\|[^>]+)?>/);
    if (mentionMatch) {
      userId = mentionMatch[1]; // Extract the ID part
      console.log(`Extracted user ID from mention format: ${userId}`);
    }
    
    // Also handle @username format by removing the @ prefix
    if (String(userId).startsWith('@')) {
      userId = userId.substring(1);
      console.log(`Removed @ prefix: ${userId}`);
    }
    
    // If it looks like a user ID (starts with U), use direct lookup
    if (String(userId).startsWith('U')) {
      console.log(`Looking up user by ID: ${userId}`);
      const response = await axios.get('https://slack.com/api/users.info', {
        params: { user: userId },
        headers: { Authorization: `Bearer ${config.slack.botToken}` }
      });
      
      if (!response.data.ok) {
        console.error(`Error looking up user by ID: ${response.data.error}`);
        throw new Error(`Slack API error: ${response.data.error}`);
      }
      
      return response.data.user;
    } 
    // Otherwise, try to find the user by listing all users
    else {
      console.log(`Looking up user by name: ${userId}`);
      
      try {
        // Get all users in the workspace
        const response = await axios.get('https://slack.com/api/users.list', {
          headers: { Authorization: `Bearer ${config.slack.botToken}` }
        });
        
        if (!response.data.ok) {
          console.error(`Error listing users: ${response.data.error}`);
          throw new Error(`Slack API error: ${response.data.error}`);
        }
        
        // Search for the user by name
        const user = response.data.members.find(member => 
          member.name.toLowerCase() === userId.toLowerCase() || 
          (member.profile && member.profile.display_name && 
           member.profile.display_name.toLowerCase() === userId.toLowerCase())
        );
        
        if (user) {
          console.log(`Found user by name lookup: ${user.id}`);
          return user;
        } else {
          console.error(`User not found in member list: ${userId}`);
          throw new Error(`User not found: ${userId}`);
        }
      } catch (error) {
        console.error(`Error in user list lookup: ${error.message}`);
        throw error;
      }
    }
  } catch (error) {
    console.error(`getUserInfo error: ${error.message}`);
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
    console.log(`Opening DM channel with user: ${userId}`);
    
    const response = await axios.post('https://slack.com/api/conversations.open', {
      users: userId
    }, {
      headers: {
        'Authorization': `Bearer ${config.slack.botToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.data.ok) {
      console.error(`Error opening DM channel: ${response.data.error}`);
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    console.log(`Successfully opened DM channel: ${response.data.channel.id}`);
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

// Add to services/slack.js

/**
 * Update an existing Slack message with new blocks
 * @param {string} channelId - Channel ID
 * @param {string} messageTs - Message timestamp
 * @param {string} text - New text
 * @param {Array} blocks - New blocks
 * @returns {Promise<object>} - Slack API response
 */
async function updateMessage(channelId, messageTs, text, blocks) {
  try {
    console.log(`Updating message in channel ${channelId}, ts ${messageTs}`);
    
    // Ensure text is never empty (Slack requires non-empty text)
    const safeText = text || "Updated message";
    
    const requestData = {
      channel: channelId,
      ts: messageTs,
      text: safeText
    };
    
    // Only add blocks if provided
    if (blocks && blocks.length > 0) {
      requestData.blocks = blocks;
    }
    
    const response = await axios.post('https://slack.com/api/chat.update', requestData, {
      headers: {
        'Authorization': `Bearer ${config.slack.botToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.data.ok) {
      console.error('Error updating Slack message:', response.data.error);
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error updating Slack message:', error);
    throw error;
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
  handleInteractionPayload,
  updateMessage
};