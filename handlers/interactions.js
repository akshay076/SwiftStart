// handlers/interactions.js
const checklistController = require('../controllers/checklist');
const slackService = require('../services/slack');
const axios = require('axios');
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
    console.log('Action IDs:', payload.actions?.map(a => a.action_id).join(', '));
    
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
  }
};

/**
 * Handle block action interactions
 * @param {Object} payload - Interaction payload
 */
const handleBlockActions = async (payload) => {
  try {
    const { actions, user, channel } = payload;
    
    if (!actions || !actions.length) {
      console.error('No actions found in payload');
      return;
    }
    
    console.log(`Processing ${actions.length} actions`);
    console.log('Action IDs:', actions.map(a => a.action_id).join(', '));
    
    for (const action of actions) {
      // Record detailed info about the action
      console.log(`Action: ${action.action_id}`);
      console.log(`- Type: ${action.type}`);
      console.log(`- Value: ${action.value}`);
      console.log(`- Style: ${action.style}`);
      
      // Handle different action types
      if (action.action_id.startsWith('tgl_')) {
        await handleItemToggle(action, payload, user.id, channel.id);
      } else if (action.action_id.startsWith('view_progress_')) {
        await handleViewProgress(action, payload);
      }
    }
  } catch (error) {
    console.error('Error in handleBlockActions:', error);
  }
};

/**
 * Handle item toggle button click
 * @param {object} action - The action data
 * @param {object} payload - The full payload
 * @param {string} userId - The user ID who performed the action
 * @param {string} channelId - The channel ID where the action was performed
 */
async function handleItemToggle(action, payload, userId, channelId) {
  try {
    // Very verbose logging to debug the issue
    console.log('====== TOGGLE ACTION DEBUG ======');
    console.log('Action:', JSON.stringify(action));
    console.log('- ActionID:', action.action_id);
    console.log('- Value:', action.value);
    
    // We'll check all available checklists and items
    const checklists = checklistController.getAllChecklists();
    console.log(`Checking ${Object.keys(checklists).length} checklists`);
    
    // Instead of trying to parse the action_id, we'll try to match against all item IDs
    let targetChecklist = null;
    let targetItem = null;
    
    // Log all checklist IDs for debugging
    console.log('Available checklists:');
    for (const [id, checklist] of Object.entries(checklists)) {
      console.log(`- ${id}: ${checklist.role} (${checklist.items.length} items)`);
    }
    
    // Find the first matching item across all checklists
    for (const checklist of Object.values(checklists)) {
      for (const item of checklist.items) {
        // For debugging, log some item info
        console.log(`Checking item ${item.id}: "${item.text.substring(0, 20)}..." (completed: ${item.completed})`);
        
        // Try different ways to match the item
        if (action.action_id.includes(item.id.substring(0, 6)) || 
            (action.value && action.value.includes(item.id.substring(0, 6)))) {
          targetChecklist = checklist;
          targetItem = item;
          console.log(`FOUND MATCH: ${item.id} - "${item.text}"`);
          break;
        }
      }
      if (targetItem) break;
    }
    
    if (!targetChecklist || !targetItem) {
      console.error('Could not find any matching item for this action');
      // Instead of failing, let's try to update the UI anyway as a visual response
      try {
        // Send a message to acknowledge the click
        await slackService.sendMessage(
          channelId,
          "I received your click, but couldn't find the associated task. Please try again or contact support."
        );
      } catch (msgError) {
        console.error('Error sending acknowledgment message:', msgError);
      }
      return;
    }
    
    // Toggle the completion state
    const isCompleted = !targetItem.completed;
    console.log(`Setting item "${targetItem.text}" to ${isCompleted ? 'completed' : 'not completed'}`);
    
    // Update the item in our data store
    const updated = checklistController.updateChecklistItemStatus(
      targetChecklist.id,
      targetItem.id,
      isCompleted
    );
    
    console.log(`Item update result: ${updated}`);
    
    if (updated) {
      // Send a confirmation message to indicate the action was processed
      await slackService.sendMessage(
        channelId,
        isCompleted
          ? `✅ You marked "*${targetItem.text}*" as complete`
          : `⭕ You marked "*${targetItem.text}*" as incomplete`
      );
      
      // Notify the manager
      if (isCompleted) {
        console.log('Notifying manager of progress');
        await notifyManagerOfProgress(targetChecklist, targetItem.id, userId);
      }
    }
  } catch (error) {
    console.error('Error handling item toggle:', error);
    console.error(error.stack);
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
    
    // Extract checklist ID from action_id
    let checklistIdPart = null;
    
    if (action.action_id.startsWith('vp_')) {
      checklistIdPart = action.action_id.substring(3);
    } else if (action.action_id.startsWith('view_prog_')) {
      checklistIdPart = action.action_id.substring(10);
    } else if (action.action_id.startsWith('view_progress_')) {
      checklistIdPart = action.action_id.substring(14);
    }
    
    if (!checklistIdPart) {
      console.error('Could not parse action_id for progress view:', action.action_id);
      return;
    }
    
    // Find the checklist by ID prefix
    const checklists = checklistController.getAllChecklists();
    let targetChecklist = null;
    
    for (const checklist of Object.values(checklists)) {
      if (checklist.id.startsWith(checklistIdPart)) {
        targetChecklist = checklist;
        break;
      }
    }
    
    // If we couldn't find by ID prefix, look for any checklist owned by this user
    if (!targetChecklist) {
      const userChecklists = Object.values(checklists).filter(
        checklist => checklist.employeeId === payload.user.id
      );
      
      if (userChecklists.length > 0) {
        targetChecklist = userChecklists[0]; // Use the first one
        console.log('Using first available user checklist:', targetChecklist.id);
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
    console.log('Calculated progress:', progress);
    
    // Send progress summary directly in channel
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
      
      // Only add these sections if there are items to show
      if (completedItems.length > 0) {
        categoryBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Completed:*\n${completedItems.map(item => `✅ ${item.text}`).join('\n')}`
          }
        });
      }
      
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
    await slackService.sendMessage(
      payload.channel.id,
      "Sorry, I encountered an error showing your progress. Please try again."
    );
  }
}

module.exports = {
  handleInteractions
};