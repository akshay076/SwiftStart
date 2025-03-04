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
      // Handle checklist item toggles with various possible action ID formats
      if (action.action_id.startsWith('toggle_') || 
          action.action_id.startsWith('tgl_')) {
        await handleItemToggle(action, user.id, channel.id);
      }
    } else if (action.type === 'button') {
      // Handle button clicks with various possible action ID formats
      if (action.action_id.startsWith('view_prog_') || 
          action.action_id.startsWith('view_progress_') || 
          action.action_id.startsWith('vp_')) {
        await handleViewProgress(action, payload);
      } else if (action.action_id.startsWith('view_emp_') || 
                action.action_id.startsWith('view_employee_progress_')) {
        await handleViewEmployeeProgress(action, payload);
      }
    }
  }
};

/**
 * Handle item toggle button click
 * @param {object} action - The action data
 * @param {string} userId - The user ID who performed the action
 * @param {string} channelId - The channel ID where the action was performed
 */
async function handleItemToggle(action, userId, channelId) {
  try {
    // Extract item ID from action_id format: tgl_[itemId]
    const itemIdPart = action.action_id.replace('tgl_', '');
    
    console.log(`Processing toggle for item with ID part: ${itemIdPart}`);
    
    // Find the item by ID prefix
    const checklists = checklistController.getAllChecklists();
    
    let targetChecklist = null;
    let targetItem = null;
    
    // Search through all checklists to find the matching item
    for (const checklist of Object.values(checklists)) {
      for (const item of checklist.items) {
        if (item.id.startsWith(itemIdPart)) {
          targetChecklist = checklist;
          targetItem = item;
          break;
        }
      }
      if (targetItem) break;
    }
    
    if (!targetChecklist || !targetItem) {
      console.error('Could not find checklist or item for action:', action.action_id);
      return;
    }
    
    // Set item as completed (button toggle always sets to completed state)
    const isCompleted = true;
    
    console.log(`Updating item ${targetItem.id} in checklist ${targetChecklist.id} to completed`);
    
    const updated = checklistController.updateChecklistItemStatus(
      targetChecklist.id,
      targetItem.id,
      isCompleted
    );
    
    if (updated) {
      // Update the message to show item is complete
      try {
        // Get the original message
        const result = await axios.post('https://slack.com/api/chat.update', {
          channel: channelId,
          ts: action.block_id.split('-')[1], // Extract timestamp from block_id
          text: `Items for ${targetItem.category}`,
          blocks: action.blocks.map(block => {
            // Find and update the specific button that was clicked
            if (block.type === 'actions') {
              block.elements = block.elements.map(element => {
                if (element.action_id === action.action_id) {
                  // Change button to show completed state
                  element.text.text = "✓"; // Keep checkmark
                  element.style = "danger"; // Change to red to indicate completed
                  element.confirm = {
                    title: {
                      type: "plain_text",
                      text: "Task already completed"
                    },
                    text: {
                      type: "mrkdwn",
                      text: "This task is marked as complete. No further action needed."
                    },
                    confirm: {
                      type: "plain_text",
                      text: "OK"
                    }
                  };
                }
                return element;
              });
            }
            return block;
          })
        }, {
          headers: {
            'Authorization': `Bearer ${config.slack.botToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!result.data.ok) {
          console.error('Failed to update message:', result.data.error);
        }
      } catch (updateError) {
        console.error('Error updating message:', updateError.message);
      }
      
      // Notify the manager of progress
      console.log('Notifying manager of progress update');
      await notifyManagerOfProgress(targetChecklist, targetItem.id, userId);
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
    
    // Send progress summary directly in channel instead of using a modal
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