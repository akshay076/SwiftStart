// handlers/interactions.js
const checklistController = require('../controllers/checklist');
const slackService = require('../services/slack');
const config = require('../config');

/**
 * Handle Slack interactive components
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleInteractions = async (req, res) => {
  // Respond immediately to avoid timeout
  res.status(200).send();
  
  try {
    // Parse the payload
    const payload = JSON.parse(req.body.payload);
    
    console.log('Interaction received:', payload.type);
    console.log('User ID:', payload.user?.id);
    console.log('Channel ID:', payload.channel?.id);
    
    if (payload.actions && payload.actions.length > 0) {
      console.log('Action IDs:', payload.actions.map(a => a.action_id).join(', '));
      // IMPORTANT: Log the full action objects for debugging
      console.log('First action details:', JSON.stringify(payload.actions[0], null, 2));
    }
    
    switch (payload.type) {
      case 'block_actions':
        // Handle block actions (e.g., button clicks, checkboxes)
        await handleBlockActions(payload);
        break;
        
      case 'view_submission':
        // Handle modal submissions
        break;
        
      default:
        console.log(`Unknown interaction type: ${payload.type}`);
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    console.error(error.stack);
  }
};

/**
 * Handle block action interactions
 * @param {Object} payload - Interaction payload
 */
const handleBlockActions = async (payload) => {
  try {
    const { actions } = payload;
    
    if (!actions || !actions.length) {
      console.error('No actions found in payload');
      return;
    }
    
    console.log(`Processing ${actions.length} actions`);
    
    for (const action of actions) {
      console.log(`Processing action: ${action.action_id}, value: ${action.value}`);
      
      // Check if this is a wellness pulse response
      const wellnessDimensions = ['energy', 'focus', 'connection', 'growth'];
      const dimensionMatch = wellnessDimensions.find(dim => 
        action.action_id.startsWith(dim) || 
        action.action_id === `pulse_${dim}_${action.value}`
      );
      
      if (dimensionMatch) {
        await handlePulseResponse({
          action_id: action.action_id,
          value: action.value
        }, payload);
      }
      // Existing action handling
      else if (action.action_id.startsWith('toggle_item_')) {
        await handleItemToggle(action, payload);
      } 
      else if (action.action_id.startsWith('view_item_')) {
        console.log('View item action - no additional handling needed');
      }
      else if (action.action_id.startsWith('view_progress_')) {
        await handleViewProgress(action, payload);
      }
      else {
        console.log(`Unhandled action type: ${action.action_id}`);
      }
    }
  } catch (error) {
    console.error('Error in handleBlockActions:', error);
  }
}


// Update the handleItemToggle function in handlers/interactions.js

/**
 * Handle item toggle button click
 * @param {object} action - The action data
 * @param {object} payload - The full payload
 */
async function handleItemToggle(action, payload) {
  try {
    console.log('====== TOGGLE ACTION DEBUG ======');
    console.log('Action ID:', action.action_id);
    console.log('Action Value:', action.value);
    console.log('Message TS:', payload.message?.ts); // Need this to update the message
    
    if (!action.value) {
      console.error('Action value is missing - cannot identify item');
      await slackService.sendMessage(
        payload.channel.id,
        "I couldn't process your request. Please try again."
      );
      return;
    }
    
    // Get all checklists
    const checklists = checklistController.getAllChecklists();
    
    // Find the item directly using the full item ID from action.value
    let targetChecklist = null;
    let targetItem = null;
    
    // Direct lookup based on item ID in value
    for (const checklist of Object.values(checklists)) {
      const item = checklist.items.find(i => i.id === action.value);
      if (item) {
        targetChecklist = checklist;
        targetItem = item;
        break;
      }
    }
    
    if (!targetChecklist || !targetItem) {
      console.error(`Could not find item with ID: ${action.value}`);
      await slackService.sendMessage(
        payload.channel.id,
        "Sorry, I couldn't find the associated task. Please try again."
      );
      return;
    }
    
    console.log(`Found item: "${targetItem.text}" in checklist: ${targetChecklist.role}`);
    
    // Toggle the completion state
    const isCompleted = !targetItem.completed;
    
    // Update the item in our data store
    const updated = checklistController.updateChecklistItemStatus(
      targetChecklist.id,
      targetItem.id,
      isCompleted
    );
    
    if (updated) {
      // Send a confirmation message
      await slackService.sendMessage(
        payload.channel.id,
        isCompleted
          ? `✅ You marked "*${targetItem.text}*" as complete`
          : `⬜ You marked "*${targetItem.text}*" as incomplete`
      );
      
      // Get all items in the same category to rebuild the block
      const categoryItems = targetChecklist.items.filter(
        item => item.category === targetItem.category
      );
      
      // Update the original message with new state if we have the message timestamp
      if (payload.message && payload.message.ts) {
        try {
          // Create updated blocks for this category
          const updatedBlocks = checklistController.createCategoryBlocks(
            targetItem.category, 
            categoryItems, 
            targetChecklist.id
          );
          
          // Use the updateMessage function from slackService
          await slackService.updateMessage(
            payload.channel.id,
            payload.message.ts,
            `Updated items for ${targetItem.category}`,
            updatedBlocks
          );
          
          console.log('Successfully updated message with new button state');
        } catch (updateError) {
          console.error('Error updating message with new button state:', updateError);
          console.error(updateError.stack);
        }
      }
      
      // Only notify the manager at milestone completions (25%, 50%, 75%, 100%)
      const progress = checklistController.calculateChecklistProgress(targetChecklist);
      
      // Check if we've just crossed a milestone threshold by completing this item
      const previousCompleted = progress.completedCount - (isCompleted ? 1 : 0);
      const previousPercentage = Math.round((previousCompleted / progress.totalCount) * 100);
      
      // If we've just crossed a milestone (25%, 50%, 75%, 100%)
      if (isCompleted && 
          (previousPercentage < 25 && progress.completedPercentage >= 25 ||
           previousPercentage < 50 && progress.completedPercentage >= 50 ||
           previousPercentage < 75 && progress.completedPercentage >= 75 ||
           previousPercentage < 100 && progress.completedPercentage >= 100)) {
        
        await notifyManagerOfMilestone(targetChecklist, progress, payload.user.id);
      }
    }
  } catch (error) {
    console.error('Error handling item toggle:', error);
    console.error(error.stack);
    await slackService.sendMessage(
      payload.channel.id,
      "Sorry, I encountered an error processing your request. Please try again."
    );
  }
}

/**
 * Notify a manager when an employee reaches a completion milestone
 * @param {object} checklist - The checklist object
 * @param {object} progress - Progress statistics
 * @param {string} employeeId - The employee Slack ID
 */
async function notifyManagerOfMilestone(checklist, progress, employeeId) {
  try {
    const { managerId, role } = checklist;
    
    // Open a DM with the manager
    const dmChannelId = await slackService.openDirectMessageChannel(managerId);
    
    // Send milestone notification
    await slackService.sendMessage(dmChannelId, 
      `🎉 <@${employeeId}> has reached *${progress.completedPercentage}%* completion of their ${role} onboarding checklist!\n` +
      `They have completed ${progress.completedCount} out of ${progress.totalCount} tasks.`
    );
  } catch (error) {
    console.error('Error notifying manager of milestone:', error);
  }
}

/**
 * Notify a manager when an employee completes a checklist item
 * @param {object} checklist - The checklist object
 * @param {string} itemId - The completed item ID
 * @param {string} employeeId - The employee Slack ID
 */
async function notifyManagerOfProgress(checklist, itemId, employeeId) {
  try {
    const { managerId } = checklist;
    const item = checklist.items.find(i => i.id === itemId);
    
    if (!item) return;
    
    // Open a DM with the manager
    const dmChannelId = await slackService.openDirectMessageChannel(managerId);
    
    // Send notification
    await slackService.sendMessage(dmChannelId, 
      `<@${employeeId}> has completed the task "${item.text}" on their ${checklist.role} onboarding checklist.`
    );
    
    // Calculate new progress
    const progress = checklistController.calculateChecklistProgress(checklist);
    
    // If this completion reaches a milestone (25%, 50%, 75%, 100%), send a summary
    if (progress.completedPercentage === 25 || 
        progress.completedPercentage === 50 || 
        progress.completedPercentage === 75 || 
        progress.completedPercentage === 100) {
      
      await slackService.sendMessage(dmChannelId, 
        `🎉 <@${employeeId}> has reached ${progress.completedPercentage}% completion of their onboarding checklist!\n` +
        `They have completed ${progress.completedCount} out of ${progress.totalCount} tasks.`
      );
    }
  } catch (error) {
    console.error('Error notifying manager of progress:', error);
  }
}

/**
 * Handle view progress button click
 * @param {object} action - The action data
 * @param {object} payload - The full payload
 */
async function handleViewProgress(action, payload) {
  try {
    console.log('Handling progress view request:', action.action_id);
    
    // Extract checklist ID from action_id - standardize the format
    const checklistIdPart = action.action_id.replace('view_progress_', '');
    
    if (!checklistIdPart) {
      console.error('Could not parse action_id for progress view');
      return;
    }
    
    // Find the checklist
    const checklists = checklistController.getAllChecklists();
    let targetChecklist = null;
    
    // Try to find by ID prefix
    for (const checklist of Object.values(checklists)) {
      if (checklist.id.startsWith(checklistIdPart)) {
        targetChecklist = checklist;
        break;
      }
    }
    
    // If not found by ID, check for user's checklists
    if (!targetChecklist) {
      const userChecklists = Object.values(checklists).filter(
        checklist => checklist.employeeId === payload.user.id
      );
      
      if (userChecklists.length > 0) {
        targetChecklist = userChecklists[0];
      }
    }
    
    if (!targetChecklist) {
      console.error('Could not find checklist for progress view');
      await slackService.sendMessage(
        payload.channel.id,
        "Sorry, I couldn't find your checklist. Please contact your manager."
      );
      return;
    }
    
    // Calculate progress
    const progress = checklistController.calculateChecklistProgress(targetChecklist);
    
    // Create header blocks
    const headerBlocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `Your Onboarding Progress: ${targetChecklist.role}`,
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `You've completed *${progress.completedPercentage}%* of your onboarding tasks (${progress.completedCount}/${progress.totalCount} items)`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: checklistController.createProgressBar(progress.completedPercentage)
        }
      },
      {
        type: "divider"
      }
    ];
    
    // Send the header
    await slackService.sendMessageWithBlocks(
      payload.channel.id,
      "Here's your onboarding progress:",
      headerBlocks
    );
    
    // Group items by category
    const categorizedItems = checklistController.groupItemsByCategory(targetChecklist.items);
    
    // Send each category's progress
    for (const [category, items] of Object.entries(categorizedItems)) {
      // Calculate category progress
      const completedInCategory = items.filter(item => item.completed).length;
      const totalInCategory = items.length;
      const categoryPercentage = Math.round((completedInCategory / totalInCategory) * 100);
      
      const categoryBlocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${category}*: ${completedInCategory}/${totalInCategory} complete (${categoryPercentage}%)`
          }
        }
      ];
      
      // Split into completed and pending items
      const completedItems = items.filter(item => item.completed);
      const pendingItems = items.filter(item => !item.completed);
      
      // Add completed items if any
      if (completedItems.length > 0) {
        categoryBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Completed:*\n${completedItems.map(item => `✅ ${item.text}`).join('\n')}`
          }
        });
      }
      
      // Add pending items if any
      if (pendingItems.length > 0) {
        categoryBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Pending:*\n${pendingItems.map(item => `⬜ ${item.text}`).join('\n')}`
          }
        });
      }
      
      // Add a divider
      categoryBlocks.push({
        type: "divider"
      });
      
      // Send this category's progress
      await slackService.sendMessageWithBlocks(
        payload.channel.id,
        `Progress for ${category}`,
        categoryBlocks
      );
    }
  } catch (error) {
    console.error('Error handling view progress:', error);
    console.error(error.stack);
    await slackService.sendMessage(
      payload.channel.id,
      "Sorry, I encountered an error showing your progress. Please try again."
    );
  }
}

// handlers/interactions.js - Update pulse response handling

// Global storage for pulse responses (replace with database in production)
const pulseResponses = new Map();

// Updated handlePulseResponse to handle multiple dimensions
async function handlePulseResponse(action, payload) {
  try {
    // Load configuration
    const config = require('../config/wellbeing-pulse-config.json');
    
    // Extract dimension and response
    const [dimension, response] = action.action_id.split('_');
    
    // Validate dimension and response
    if (!dimension || !response) {
      console.error('Invalid pulse response:', action);
      return;
    }
    
    // Find the dimension in the config
    const dimensionConfig = config.dimensions.find(d => d.id === dimension);
    
    // Generate recommendation
    const recommendations = config.recommendations[response] || [];
    const recommendation = recommendations.length > 0 
      ? recommendations[Math.floor(Math.random() * recommendations.length)]
      : "Keep taking care of yourself and listen to your body and mind.";
    
    // Send response
    await slackService.sendMessage(
      payload.channel.id,
      `Thanks for sharing your ${dimensionConfig?.name || dimension} level! 🌟\n\n*Insight:*\n${recommendation}`
    );
    
    // Optional: Store or process the response
    console.log(`Pulse response - Dimension: ${dimension}, Response: ${response}`);
    
  } catch (error) {
    console.error('Error processing pulse response:', error);
    await slackService.sendMessage(
      payload.channel.id,
      "Sorry, I encountered an error processing your response."
    );
  }
}

/**
 * Generate a personalized recommendation based on dimension and response
 * @param {string} dimension - The wellness dimension
 * @param {string} response - The user's response
 * @returns {string} - Recommendation text
 */
function generateRecommendation(dimension, response) {
  // Load configuration
  const config = require('../config/wellbeing-pulse-config.json');
  
  // Find matching recommendations
  const recommendations = config.recommendations[response] || [];
  
  // Return a random recommendation if available
  if (recommendations.length > 0) {
    return recommendations[Math.floor(Math.random() * recommendations.length)];
  }
  
  // Fallback generic recommendation
  return "Keep taking care of yourself and listen to your body and mind.";
};

module.exports = {
  handlePulseResponse,
  generateRecommendation,
  handleBlockActions
};

module.exports = {
  handleInteractions
};