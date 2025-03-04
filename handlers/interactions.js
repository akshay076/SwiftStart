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
  const { actions, user, channel } = payload;
  
  for (const action of actions) {
    console.log('Processing action:', action.action_id);
    
    if (action.action_id.startsWith('tgl_')) {
      // Handle checklist item toggle button clicks
      await handleItemToggle(action, payload, user.id, channel.id);
    } else if (action.action_id.startsWith('view_tgl_')) {
      // This is just a view action, no need to do anything
      console.log('Item text button clicked, no action needed');
    } else if (action.action_id.startsWith('vp_')) {
      // Handle view progress button
      await handleViewProgress(action, payload);
    }
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
    console.log('Handling item toggle from button click:', action);
    
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
    
    // Toggle the completion state (if it's already completed, uncomplete it)
    const isCompleted = !targetItem.completed;
    
    console.log(`Updating item ${targetItem.id} in checklist ${targetChecklist.id} to ${isCompleted ? 'completed' : 'not completed'}`);
    
    const updated = checklistController.updateChecklistItemStatus(
      targetChecklist.id,
      targetItem.id,
      isCompleted
    );
    
    if (updated) {
      try {
        // Find which action button was clicked
        const clickedActionIndex = payload.actions.findIndex(a => a.action_id === action.action_id);
        
        if (clickedActionIndex === -1) {
          console.error('Could not find clicked action in payload');
          return;
        }
        
        // Get updated blocks - ONLY update the specific block that contains the clicked button
        const updatedBlocks = payload.message.blocks.map((block, blockIndex) => {
          // Only update the actions block that contains our button
          if (block.type === 'actions') {
            // Check if this block contains our button
            const hasTargetButton = block.elements.some(element => 
              element.action_id === action.action_id
            );
            
            if (hasTargetButton) {
              // This is the block that contains our button, update it
              const updatedElements = block.elements.map(element => {
                if (element.action_id === action.action_id) {
                  // Update the specific button that was clicked
                  // Follow standard UI conventions:
                  // - Completed tasks have GREEN buttons with a checkmark ✓
                  // - Incomplete tasks have RED buttons with an empty circle ○
                  return {
                    ...element,
                    style: isCompleted ? "primary" : "danger",  // Green if completed, Red if not
                    text: {
                      type: "plain_text",
                      text: isCompleted ? "✓" : "○",  // Checkmark if completed, empty circle if not
                      emoji: true
                    }
                  };
                }
                return element;
              });
              
              return {
                ...block,
                elements: updatedElements
              };
            }
          }
          return block;
        });
        
        // Update the message
        const result = await axios.post('https://slack.com/api/chat.update', {
          channel: channelId,
          ts: payload.message.ts,
          blocks: updatedBlocks
        }, {
          headers: {
            'Authorization': `Bearer ${config.slack.botToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!result.data.ok) {
          console.error('Failed to update message:', result.data.error);
        } else {
          console.log('Successfully updated message appearance');
        }
        
        // Notify the manager of progress if item was completed
        if (isCompleted) {
          console.log('Notifying manager of progress update');
          await notifyManagerOfProgress(targetChecklist, targetItem.id, userId);
        }
        
        // Send a confirmation message to the user
        await slackService.sendMessage(
          channelId,
          isCompleted 
            ? `✅ You marked *${targetItem.text}* as complete`
            : `⭕ You marked *${targetItem.text}* as incomplete`
        );
        
      } catch (updateError) {
        console.error('Error updating message:', updateError);
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