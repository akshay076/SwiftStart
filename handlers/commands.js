// handlers/commands.js
const langflowService = require('../services/langflow');
const slackService = require('../services/slack');
const checklistController = require('../controllers/checklist');

/**
 * Handle the /askbuddy command
 * @param {object} payload - The Slack command payload
 * @returns {Promise<void>}
 */
async function handleAskBuddyCommand(payload) {
  const { text, channel_id } = payload;
  
  try {
    // Get answer from Langflow
    const answer = await langflowService.queryLangflow(text);
    
    // Send the response back to Slack
    await slackService.sendMessage(channel_id, answer);
  } catch (error) {
    console.error('Error processing askbuddy command:', error);
    await slackService.sendMessage(channel_id, "Sorry, I encountered an error processing your request.");
  }
}

/**
 * Handle the /create-checklist command (manager-only)
 * @param {object} payload - The Slack command payload
 * @returns {Promise<void>}
 */
async function handleCreateChecklistCommand(payload) {
  const { text, user_id, channel_id } = payload;
  
  try {
    // Verify the user is a manager
    const isManager = await checklistController.isUserManager(user_id);
    
    if (!isManager) {
      return await slackService.sendMessage(channel_id, 
        "Sorry, only managers can create onboarding checklists for team members."
      );
    }
    
    // Parse the role specification
    const { role, targetUser, isForOtherUser } = checklistController.parseRoleSpecification(text);
    
    if (isForOtherUser) {
      try {
        // Verify the target user exists
        const targetUserInfo = await slackService.getUserInfo(targetUser);
        const targetUserId = targetUserInfo.id;
        
        // Get the checklist for the specified role
        const rawChecklist = await checklistController.getChecklist(role);
        
        // Parse the checklist text into structured items
        const checklistItems = checklistController.parseChecklistItems(rawChecklist);
        
        // Store the checklist data
        const checklistId = checklistController.storeChecklist(
          targetUserId,
          user_id, // manager ID
          role,
          checklistItems
        );
        
        // Open a DM channel with the target user
        const dmChannelId = await slackService.openDirectMessageChannel(targetUserId);
        
        // Create interactive checklist blocks
        const checklistBlocks = checklistController.createInteractiveChecklistBlocks(
          checklistId,
          role,
          checklistItems,
          user_id // manager ID
        );
        
        // Send the interactive checklist to the target user's DM
        await slackService.sendMessageWithBlocks(dmChannelId, 
          `Your onboarding checklist for ${role} role:`,
          checklistBlocks
        );
        
        // Notify the manager that the checklist was sent
        await slackService.sendMessage(channel_id, 
          `✅ Onboarding checklist for ${role} has been sent to <@${targetUserId}>`
        );
        
      } catch (error) {
        console.error('Error sending checklist to target user:', error);
        await slackService.sendMessage(channel_id, 
          `I couldn't send the checklist to @${targetUser}. Please verify the username and try again.`
        );
      }
    } else {
      // No target user specified
      await slackService.sendMessage(channel_id, 
        "Please specify who this checklist is for using the format: `/create-checklist [role] for @username`"
      );
    }
  } catch (error) {
    console.error('Error creating checklist:', error);
    await slackService.sendMessage(channel_id, 
      "Sorry, I couldn't create that checklist. Please try again."
    );
  }
}

/**
 * Handle the /check-progress command (manager-only)
 * @param {object} payload - The Slack command payload
 * @returns {Promise<void>}
 */
async function handleCheckProgressCommand(payload) {
  const { text, user_id, channel_id } = payload;
  
  try {
    // Verify the user is a manager
    const isManager = await checklistController.isUserManager(user_id);
    
    if (!isManager) {
      return await slackService.sendMessage(channel_id, 
        "Sorry, only managers can check onboarding progress."
      );
    }
    
    // Parse the username from the command
    const targetUsername = text.trim().replace('@', '');
    
    if (!targetUsername) {
      return await slackService.sendMessage(channel_id, 
        "Please specify a user: `/check-progress @username`"
      );
    }
    
    // Get target user info
    try {
      const targetUserInfo = await slackService.getUserInfo(targetUsername);
      const targetUserId = targetUserInfo.id;
      
      // Get checklists for this employee created by this manager
      const checklists = checklistController.getChecklistsByEmployeeAndManager(targetUserId, user_id);
      
      if (checklists.length === 0) {
        return await slackService.sendMessage(channel_id, 
          `No onboarding checklists found for <@${targetUserId}>`
        );
      }
      
      // If multiple checklists, let manager choose which one to view
      if (checklists.length > 1) {
        const blocks = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Found multiple checklists for <@${targetUserId}>. Which one would you like to view?`
            }
          }
        ];
        
        checklists.forEach(list => {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${list.role}* (Created: ${new Date(list.createdAt).toLocaleDateString()})`
            },
            accessory: {
              type: "button",
              text: {
                type: "plain_text",
                text: "View Progress",
                emoji: true
              },
              value: list.id,
              action_id: `view_employee_progress_${list.id}`
            }
          });
        });
        
        return await slackService.sendMessageWithBlocks(channel_id, 
          "Found multiple checklists",
          blocks
        );
      }
      
      // If only one checklist, show progress immediately
      const checklist = checklists[0];
      const progressStats = checklistController.calculateChecklistProgress(checklist);
      
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
            text: `Progress for <@${targetUserId}>: *${progressStats.completedPercentage}%* complete (${progressStats.completedCount}/${progressStats.totalCount} tasks)`
          }
        },
        {
          type: "divider"
        },
        ...checklistController.generateProgressBlocks(checklist)
      ];
      
      await slackService.sendMessageWithBlocks(channel_id, 
        `Onboarding progress for ${targetUserInfo.real_name}`,
        blocks
      );
      
    } catch (error) {
      console.error('Error finding user:', error);
      await slackService.sendMessage(channel_id, 
        `I couldn't find user @${targetUsername}. Please verify the username and try again.`
      );
    }
  } catch (error) {
    console.error('Error checking progress:', error);
    await slackService.sendMessage(channel_id, 
      "Sorry, I encountered an error while checking progress."
    );
  }
}

/**
 * Route and handle Slack slash commands
 * @param {object} payload - The Slack command payload
 * @param {object} res - Express response object for immediate acknowledgment
 */
function handleSlackCommand(payload, res) {
  const { command } = payload;
  
  console.log(`Received command: ${command} with text: ${payload.text}`);
  
  // Send immediate acknowledgment
  res.status(200).send();
  
  // Process commands asynchronously
  if (command === '/askbuddy') {
    handleAskBuddyCommand(payload);
  } 
  else if (command === '/create-checklist') {
    handleCreateChecklistCommand(payload);
  }
  else if (command === '/check-progress') {
    handleCheckProgressCommand(payload);
  }
  else {
    // Unknown command - this shouldn't happen if routes are configured correctly
    // FIXED: Don't try to send a second response, use the Slack API instead
    try {
      if (payload && payload.channel_id) {
        slackService.sendMessage(
          payload.channel_id,
          "I don't recognize that command. Try /askbuddy, /create-checklist, or /check-progress."
        );
      }
    } catch (error) {
      console.error('Error sending command error message:', error);
    }
  }
}

/**
 * Express route handler for Slack commands
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleCommands = (req, res) => {
  try {
    // This function will be used by Express router
    handleSlackCommand(req.body, res);
  } catch (error) {
    console.error('Error in handleCommands:', error);
    
    // Only send a response if one hasn't been sent yet
    if (!res.headersSent) {
      res.status(200).send();
    }
  }
};

module.exports = {
  handleSlackCommand,
  handleAskBuddyCommand,
  handleCreateChecklistCommand,
  handleCheckProgressCommand,
  handleCommands  // Add this export for the router
};