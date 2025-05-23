// handlers/commands.js
const langflowService = require('../services/langflow');
const slackService = require('../services/slack');
const checklistController = require('../controllers/checklist');
const wellbeingHandler = require('./wellbeing');

// handlers/commands.js
// Update the handleCommands function

function handleCommands(req, res) {
  try {
    const payload = req.body;
    const { command, text, user_id, channel_id } = payload;
    
    console.log(`Received command: ${command} with text: ${text}`);
    
    // Send immediate acknowledgment to Slack WITH A VISIBLE MESSAGE
    if (command === '/askbuddy') {
      res.status(200).send({
        response_type: 'in_channel',
        text: `I'm looking up the answer to your question, <@${user_id}>. This might take a moment...`
      });
      
      // Process the command asynchronously
      handleAskBuddyCommand(payload);
    } 
    else if (command === '/create-checklist') {
      res.status(200).send({
        response_type: 'in_channel',
        text: 'Creating your checklist...'
      });
      
      // Process the command asynchronously
      handleCreateChecklistCommand(payload);
    }
    else if (command === '/check-progress') {
      res.status(200).send({
        response_type: 'in_channel',
        text: 'Checking progress...'
      });
      
      // Process the command asynchronously
      handleCheckProgressCommand(payload);
    }
    // Add WellSense360 commands here
    else if (command === '/enroll') {
      res.status(200).send({
        response_type: 'ephemeral',
        text: 'Setting up your well-being measurement...'
      });
      
      // Process the command asynchronously
      wellbeingHandler.handleEnrollCommand(payload);
    }
    else if (command === '/insights') {
      res.status(200).send({
        response_type: 'ephemeral',
        text: 'Generating your well-being insights...'
      });
      
      // Process the command asynchronously
      wellbeingHandler.handleInsightsCommand(payload);
    }
    else if (command === '/demo') {
      res.status(200).send({
        response_type: 'ephemeral',
        text: 'Starting the WellSense360 demo...'
      });
      
      // Process the command asynchronously
      wellbeingHandler.handleDemoCommand(payload);
    }
    else {
      // Unknown command - respond immediately
      res.status(200).send({
        text: "I don't recognize that command. Try /askbuddy, /create-checklist, /check-progress, /enroll, /insights, or /demo."
      });
    }
  } catch (error) {
    console.error('Error in handleCommands:', error);
    
    // If we get an error, still send a response to Slack
    res.status(200).send({
      text: "Sorry, I encountered an error processing your command."
    });
  }
}

// handlers/commands.js - Updated handleAskBuddyCommand function

/**
 * Handle the /askbuddy command
 * @param {object} payload - The Slack command payload
 * @returns {Promise<void>}
 */
async function handleAskBuddyCommand(payload) {
  const { text, channel_id, user_id } = payload;
  
  try {
    console.log(`Processing askbuddy command with text: "${text}"`);
    
    // Special command to check if user is a manager - for testing purposes
    if (text.toLowerCase().trim() === 'am i a manager' || 
        text.toLowerCase().trim() === 'check if i am a manager') {
      
      const isManager = await checklistController.isUserManager(user_id);
      
      if (isManager) {
        await slackService.sendMessage(channel_id, 
          "✅ Yes, you are recognized as a manager based on your Slack profile title. " +
          "You can use manager-only commands like `/create-checklist` and `/check-progress`."
        );
      } else {
        const userInfo = await slackService.getUserInfo(user_id);
        const currentTitle = userInfo?.profile?.title || '[No title set]';
        
        await slackService.sendMessage(channel_id, 
          `❌ No, you are not currently recognized as a manager.\n\n` +
          `Your current Slack profile title is: "${currentTitle}"\n\n` +
          `To be recognized as a manager, please update your Slack profile title to include terms like ` +
          `"manager", "director", "lead", etc. Then try this command again.`
        );
      }
      return;
    }
    
    // Regular askbuddy command - get answer from Langflow
    let answer;
    try {
      console.log("Querying Langflow...");
      answer = await langflowService.queryLangflow(text);
      console.log("Received response from Langflow");
    } catch (error) {
      console.error("Error querying Langflow:", error);
      answer = "I'm sorry, but I couldn't get a response in time. The AI service might be experiencing high load. Please try again in a few minutes.";
    }
    
    // Send the response back to Slack
    console.log("Sending final answer to Slack");
    await slackService.sendMessage(channel_id, answer);
    console.log("Final answer sent to Slack");
  } catch (error) {
    console.error('Error processing askbuddy command:', error);
    await slackService.sendMessage(channel_id, "Sorry, I encountered an error processing your request.");
  }
}

/**
 * Create checklist blocks with proper UI colors
 * @param {string} category - Category name
 * @param {Array} items - Items in the category
 * @param {string} checklistId - ID of the checklist
 * @returns {Array} - Blocks for the category
 */
function createCategoryBlocks(category, items, checklistId) {
  const blocks = [];
  
  // Add category header context block
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "Click the buttons to mark items as complete:"
      }
    ]
  });
  
  // Add each item with a button that follows standard UI conventions
  for (const item of items) {
    const actionId = `tgl_${checklistId.substring(0, 4)}_${item.id.substring(0, 8)}`;
    
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: item.completed ? "✓" : "○", // Empty circle if not completed, checkmark if completed
            emoji: true
          },
          style: item.completed ? "primary" : "danger", // Green if completed, red if not
          value: "toggle",
          action_id: actionId
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: item.text,
            emoji: true
          },
          value: "view",
          action_id: `view_${actionId}`
        }
      ]
    });
  }
  
  return blocks;
}

// handlers/commands.js - Updated manager-only commands

/**
 * Handle the /create-checklist command (manager-only)
 * @param {object} payload - The Slack command payload
 * @returns {Promise<void>}
 */
async function handleCreateChecklistCommand(payload) {
  const { text, user_id, channel_id } = payload;
  
  try {
    // Verify the user is a manager - strict check
    const isManager = await checklistController.isUserManager(user_id);
    
    if (!isManager) {
      return await slackService.sendMessage(channel_id, 
        "Sorry, only managers can create onboarding checklists. " +
        "To be recognized as a manager, please update your Slack profile title to include terms like 'manager', 'director', or 'lead'."
      );
    }
    
    // Process the command for managers - rest of function unchanged
    // Parse the role specification
    const { role, targetUser, isForOtherUser } = checklistController.parseRoleSpecification(text);
    
    if (isForOtherUser) {
      try {
        // Verify the target user exists
        const targetUserInfo = await slackService.getUserInfo(targetUser);
        const targetUserId = targetUserInfo.id;
        
        // Log the operation
        console.log(`Creating ${role} checklist for user ${targetUserId} by manager ${user_id}`);
        
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
        
        console.log(`Created checklist with ID: ${checklistId}`);
        
        // Open a DM channel with the target user
        const dmChannelId = await slackService.openDirectMessageChannel(targetUserId);
        
        // Send introduction message
        await slackService.sendMessage(
          dmChannelId,
          `*Onboarding Checklist: ${role}*\n\nHi <@${targetUserId}>, your manager <@${user_id}> has created this interactive onboarding checklist for you. Check off items as you complete them!`
        );
        
        // Group items by category
        const categorizedItems = checklistController.groupItemsByCategory(checklistItems);
        
        // Process each category
        for (const [category, items] of Object.entries(categorizedItems)) {
          console.log(`Sending category ${category} with ${items.length} items`);
          
          // Create blocks for this category
          const blocks = checklistController.createCategoryBlocks(category, items, checklistId);
          
          // Send the blocks for this category
          try {
            await slackService.sendMessageWithBlocks(
              dmChannelId, 
              `Items for ${category}`, 
              blocks
            );
          } catch (error) {
            console.error(`Failed to send blocks for category "${category}":`, error.message);
            
            // Fallback to plain text items
            await slackService.sendMessage(dmChannelId, `*${category}*`);
            for (const item of items) {
              await slackService.sendMessage(dmChannelId, `• ${item.text}`);
            }
          }
        }
        
        // Add view progress button at the end
        const progressBlock = [{
          type: "actions",
          elements: [{
            type: "button",
            text: {
              type: "plain_text",
              text: "View Progress Summary",
              emoji: true
            },
            action_id: `view_progress_${checklistId}`, // Use the full checklist ID
            style: "primary"
          }]
        }];
        
        try {
          await slackService.sendMessageWithBlocks(
            dmChannelId, 
            "Track your progress with the button below:",
            progressBlock
          );
        } catch (buttonError) {
          console.error('Error sending progress button:', buttonError);
          // Fallback message if button fails
          await slackService.sendMessage(dmChannelId, 
            "You can check your progress anytime by asking me 'show my progress'."
          );
        }
        
        // Notify the manager that the checklist was sent
        await slackService.sendMessage(channel_id, 
          `✅ Onboarding checklist for ${role} has been sent to <@${targetUserId}>\n` +
          `You can check their progress anytime with \`/check-progress @${targetUserInfo.name}\``
        );
        
      } catch (error) {
        console.error('Error sending checklist to target user:', error);
        await slackService.sendMessage(channel_id, 
          `I couldn't send the checklist to @${targetUser}. Error: ${error.message}`
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
    console.error(error.stack);
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
    // Verify the user is a manager - strict check
    const isManager = await checklistController.isUserManager(user_id);
    
    if (!isManager) {
      return await slackService.sendMessage(channel_id, 
        "Sorry, only managers can check onboarding progress. " +
        "To be recognized as a manager, please update your Slack profile title to include terms like 'manager', 'director', or 'lead'."
      );
    }
    
    // Parse the username from the command
    const targetUsername = text.trim().replace(/^@/, '');
    
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
              action_id: `view_emp_${list.id.substring(0, 7)}`
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
      await showChecklistProgress(checklist, channel_id);
      
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
    const targetUsername = text.trim().replace(/^@/, '');
    
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
              action_id: `view_emp_${list.id.substring(0, 7)}`
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
      await showChecklistProgress(checklist, channel_id);
      
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
      
      // Add item list block
      categoryBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: itemTexts.join("\n")
        }
      });
      
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
  handleAskBuddyCommand,
  handleCreateChecklistCommand,
  handleCheckProgressCommand,
  handleCommands
};