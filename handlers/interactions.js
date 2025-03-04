// handlers/interactions.js
const checklistController = require('../controllers/checklist');
const slackService = require('../services/slack');

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
  const { actions, user, channel } = payload;
  
  for (const action of actions) {
    console.log('Processing action:', action.action_id);
    
    if (action.type === 'checkboxes') {
      // Handle checklist item toggles
      if (action.action_id.startsWith('toggle_')) {
        await handleItemToggle(action, user.id, channel.id);
      }
    } else if (action.type === 'button') {
      // Handle button clicks
      if (action.action_id.startsWith('view_prog_')) {
        await handleViewProgress(action, payload);
      } else if (action.action_id.startsWith('view_emp_')) {
        await handleViewEmployeeProgress(action, payload);
      }
    }
  }
};

/**
 * Handle checklist item toggle
 * @param {object} action - The action data
 * @param {string} userId - The user ID who performed the action
 * @param {string} channelId - The channel ID where the action was performed
 */
async function handleItemToggle(action, userId, channelId) {
  try {
    // Extract checklist ID and item ID from action_id
    // Format: toggle_[checklistId]_[itemId]
    const parts = action.action_id.split('_');
    if (parts.length < 3) {
      console.error('Invalid action_id format:', action.action_id);
      return;
    }
    
    const checklistIdPart = parts[1];
    const itemIdPart = parts[2];
    
    // Find the full checklist ID and item ID that start with these parts
    const checklists = checklistController.getAllChecklists();
    
    let targetChecklist = null;
    let targetItem = null;
    
    for (const checklist of Object.values(checklists)) {
      if (checklist.id.startsWith(checklistIdPart)) {
        targetChecklist = checklist;
        
        for (const item of checklist.items) {
          if (item.id.startsWith(itemIdPart)) {
            targetItem = item;
            break;
          }
        }
        
        if (targetItem) break;
      }
    }
    
    if (!targetChecklist || !targetItem) {
      console.error('Could not find checklist or item for action:', action.action_id);
      return;
    }
    
    // Determine new state
    const isCompleted = (action.selected_options || []).length > 0;
    
    // Update the item status
    console.log(`Updating item ${targetItem.id} in checklist ${targetChecklist.id} to ${isCompleted ? 'completed' : 'incomplete'}`);
    
    const updated = checklistController.updateChecklistItemStatus(
      targetChecklist.id,
      targetItem.id,
      isCompleted
    );
    
    if (updated) {
      // Get the updated checklist
      const refreshedChecklist = checklistController.getChecklistById(targetChecklist.id);
      
      // Optionally, notify the manager of progress
      if (isCompleted && refreshedChecklist) {
        console.log('Notifying manager of progress update');
        await notifyManagerOfProgress(refreshedChecklist, targetItem.id, userId);
      }
    }
  } catch (error) {
    console.error('Error handling item toggle:', error);
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
    // Extract checklist ID from action_id
    const checklistIdPart = action.action_id.replace('view_prog_', '');
    
    // Find the full checklist ID that starts with this part
    const checklists = checklistController.getAllChecklists();
    
    let targetChecklist = null;
    
    for (const checklist of Object.values(checklists)) {
      if (checklist.id.startsWith(checklistIdPart)) {
        targetChecklist = checklist;
        break;
      }
    }
    
    if (!targetChecklist) {
      console.error('Could not find checklist for action:', action.action_id);
      return;
    }
    
    // Calculate progress
    const progress = checklistController.calculateChecklistProgress(targetChecklist);
    
    // Create blocks to show progress
    const blocks = [
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
      }
    ];
    
    // Group items by category
    const categorizedItems = checklistController.groupItemsByCategory(targetChecklist.items);
    
    // Add each category
    for (const [category, items] of Object.entries(categorizedItems)) {
      // Calculate category progress
      const completedInCategory = items.filter(item => item.completed).length;
      const totalInCategory = items.length;
      const categoryPercentage = Math.round((completedInCategory / totalInCategory) * 100);
      
      blocks.push(
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${category}*: ${completedInCategory}/${totalInCategory} complete (${categoryPercentage}%)`
          }
        }
      );
      
      // List items (completed and pending)
      const completedItems = items.filter(item => item.completed);
      const pendingItems = items.filter(item => !item.completed);
      
      if (completedItems.length > 0) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Completed:*\n${completedItems.map(item => `✅ ${item.text}`).join('\n')}`
          }
        });
      }
      
      if (pendingItems.length > 0) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Pending:*\n${pendingItems.map(item => `⬜ ${item.text}`).join('\n')}`
          }
        });
      }
    }
    
    // Send the progress summary
    await slackService.sendMessageWithBlocks(
      payload.channel.id,
      "Here's your onboarding progress:",
      blocks
    );
    
  } catch (error) {
    console.error('Error handling view progress:', error);
    await slackService.sendMessage(
      payload.channel.id,
      "Sorry, I encountered an error showing your progress. Please try again."
    );
  }
}

/**
 * Handle view employee progress button click
 * @param {object} action - The action data
 * @param {object} payload - The full payload
 */
async function handleViewEmployeeProgress(action, payload) {
  try {
    // Extract checklist ID from action_id
    const checklistIdPart = action.action_id.replace('view_emp_', '');
    
    // Find the full checklist ID that starts with this part
    const checklists = checklistController.getAllChecklists();
    
    let targetChecklist = null;
    
    for (const checklist of Object.values(checklists)) {
      if (checklist.id.startsWith(checklistIdPart)) {
        targetChecklist = checklist;
        break;
      }
    }
    
    if (!targetChecklist) {
      console.error('Could not find checklist for action:', action.action_id);
      return;
    }
    
    // Verify the requester is the manager
    if (payload.user.id !== targetChecklist.managerId) {
      await slackService.sendMessage(
        payload.channel.id, 
        "Sorry, only the manager who created this checklist can view its progress."
      );
      return;
    }
    
    // Show the progress
    await showChecklistProgress(targetChecklist, payload.channel.id);
    
  } catch (error) {
    console.error('Error handling view employee progress:', error);
    await slackService.sendMessage(
      payload.channel.id,
      "Sorry, I encountered an error showing the progress. Please try again."
    );
  }
}

/**
 * Show the progress for a checklist
 * @param {object} checklist - The checklist object
 * @param {string} channelId - The channel to send the progress to
 */
async function showChecklistProgress(checklist, channelId) {
  try {
    const progressStats = checklistController.calculateChecklistProgress(checklist);
    
    // Create header blocks
    const headerBlocks = [
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
          text: `Progress for <@${checklist.employeeId}>: *${progressStats.completedPercentage}%* complete (${progressStats.completedCount}/${progressStats.totalCount} tasks)`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: checklistController.createProgressBar(progressStats.completedPercentage)
        }
      },
      {
        type: "divider"
      }
    ];
    
    // Send the header
    await slackService.sendMessageWithBlocks(channelId, 
      `Onboarding progress for ${checklist.role}`,
      headerBlocks
    );
    
    // Group items by category
    const categorizedItems = checklistController.groupItemsByCategory(checklist.items);
    
    // Process each category separately
    for (const [category, items] of Object.entries(categorizedItems)) {
      // Calculate category progress
      const totalInCategory = items.length;
      const completedInCategory = items.filter(item => item.completed).length;
      const categoryPercentage = Math.round((completedInCategory / totalInCategory) * 100);
      
      // Create category blocks
      const categoryBlocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${category}* (${completedInCategory}/${totalInCategory} complete - ${categoryPercentage}%)`
          }
        }
      ];
      
      // Add all items in this category
      const itemTexts = items.map(item => {
        const status = item.completed ? "✅" : "⬜";
        const completedInfo = item.completed && item.completedAt 
          ? ` (completed: ${new Date(item.completedAt).toLocaleDateString()})` 
          : '';
        return `${status} ${item.text}${completedInfo}`;
      });
      
      // Add item list block (if not too long)
      if (itemTexts.join("\n").length <= 3000) {
        categoryBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: itemTexts.join("\n")
          }
        });
      } else {
        // Split into completed and pending if too long
        const completedItems = items.filter(item => item.completed);
        const pendingItems = items.filter(item => !item.completed);
        
        if (completedItems.length > 0) {
          categoryBlocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Completed:*\n${completedItems.map(item => {
                const completedInfo = item.completedAt 
                  ? ` (${new Date(item.completedAt).toLocaleDateString()})` 
                  : '';
                return `✅ ${item.text}${completedInfo}`;
              }).join('\n')}`
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
      }
      
      // Add divider
      categoryBlocks.push({
        type: "divider"
      });
      
      // Send this category
      await slackService.sendMessageWithBlocks(channelId, "", categoryBlocks);
    }
  } catch (error) {
    console.error('Error showing checklist progress:', error);
    await slackService.sendMessage(channelId, 
      "Sorry, I encountered an error showing progress information."
    );
  }
}

module.exports = {
  handleInteractions
};