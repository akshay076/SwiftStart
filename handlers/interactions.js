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
    const { actions, user, channel } = payload;
    
    if (!actions || !actions.length) {
      console.error('No actions found in payload');
      return;
    }
    
    console.log(`Processing ${actions.length} actions`);
    
    for (const action of actions) {
      // Record detailed info about the action
      console.log(`Action Details:`);
      console.log(`- ID: ${action.action_id}`);
      console.log(`- Type: ${action.type}`);
      console.log(`- Value: ${action.value}`);
      
      // Process the action based on its action_id prefix
      if (action.action_id.startsWith('toggle_item_')) {
        await handleItemToggle(action, payload);
      } else if (action.action_id.startsWith('view_progress_')) {
        await handleViewProgress(action, payload);
      } else {
        console.log(`Unhandled action type: ${action.action_id}`);
      }
    }
  } catch (error) {
    console.error('Error in handleBlockActions:', error);
    console.error(error.stack);
  }
};

/**
 * Handle item toggle button click
 * @param {object} action - The action data
 * @param {object} payload - The full payload
 */
async function handleItemToggle(action, payload) {
  try {
    console.log('====== TOGGLE ACTION DEBUG ======');
    console.log('Action ID:', action.action_id);
    console.log('Action Value:', action.value); // This should contain the full item ID
    
    if (!action.value) {
      console.error('Action value is missing - cannot identify item');
      return;
    }
    
    // Get all checklists
    const checklists = checklistController.getAllChecklists();
    
    // Find the item directly using the full item ID from action.value
    let targetChecklist = null;
    let targetItem = null;
    
    // Look through all checklists for the item with this ID
    for (const checklist of Object.values(checklists)) {
      // Use the exact item ID from the action value for reliable matching
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
        "Sorry, I couldn't find the task you clicked on. Please try again."
      );
      return;
    }
    
    console.log(`Found item: "${targetItem.text}" in checklist: ${targetChecklist.role}`);
    
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
      // Send a confirmation message
      await slackService.sendMessage(
        payload.channel.id,
        isCompleted
          ? `✅ You marked "*${targetItem.text}*" as complete`
          : `⭕ You marked "*${targetItem.text}*" as incomplete`
      );
      
      // Update the message to show the new state
      // This would require additional code to update the original message
      
      // Notify the manager if item was completed
      if (isCompleted) {
        console.log('Notifying manager of progress');
        await notifyManagerOfProgress(targetChecklist, targetItem.id, payload.user.id);
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

module.exports = {
  handleInteractions
};