// controllers/checklist.js
const langchainService = require('../services/langchainService');
const slackService = require('../services/slack');
const config = require('../config');
const helpers = require('../utils/helpers');

// In-memory storage for checklists (replace with a database in production)
const checklistsStore = {};

/**
 * Get a checklist for a specific role
 * @param {string} role - The role to get a checklist for
 * @returns {Promise<string>} - The checklist text
 */
async function getChecklist(role) {
  // Normalize the role name (remove spaces, lowercase)
  const normalizedRole = role.toLowerCase().replace(/\s+/g, '-');
  
  // Check if it's a valid role
  if (config.validRoles.includes(normalizedRole)) {
    // Query Langflow with the role to get a dynamically generated checklist
    const query = `Get me the onboarding checklist for a ${role} role`;
    return await langchainService.queryLangflow(query);
  } else {
    // For unknown roles, return the general checklist
    const query = `Get me the general onboarding checklist`;
    return await langchainService.queryLangflow(query);
  }
}

/**
 * Parse a role specification from command text
 * @param {string} text - The command text
 * @returns {object} - The parsed role information
 */
function parseRoleSpecification(text) {
  console.log(`Parsing role specification from: "${text}"`);
  
  // Check for format: "[role] for @username" or "[role] for <@USERID|username>"
  // This regex handles both simple @username and Slack's <@USERID|username> format
  const forUserPattern = /^(.*?)\s+for\s+(?:<@([A-Z0-9]+)(?:\|[^>]+)??>|@([^\s]+))$/;
  const forUserMatch = text.match(forUserPattern);
  
  if (forUserMatch) {
    const role = forUserMatch[1].trim();
    
    // If we matched a Slack mention format <@USERID|username>, use the user ID
    // Otherwise, use the simple @username format
    const targetUser = forUserMatch[2] || forUserMatch[3];
    
    console.log(`Parsed: role="${role}", targetUser="${targetUser}"`);
    
    return {
      role: role,
      targetUser: targetUser,
      isForOtherUser: true
    };
  }
  
  // Just a role for the current user
  console.log(`No target user found, assuming role: "${text.trim()}"`);
  return {
    role: text.trim(),
    isForOtherUser: false
  };
}

// controllers/checklist.js - Updated isUserManager function

/**
 * Check if a user is a manager based on their Slack profile title
 * @param {string} userId - Slack user ID to check
 * @returns {Promise<boolean>} - Whether the user is a manager
 */
async function isUserManager(userId) {
  try {
    console.log(`Checking if user ${userId} is a manager`);
    
    // For development/testing override
    if (process.env.NODE_ENV === 'development' && process.env.ALLOW_ALL_MANAGERS === 'true') {
      console.log('⚠️ DEVELOPMENT MODE: All users are considered managers for testing');
      return true;
    }
    
    // Get the user's profile from Slack
    const userInfo = await slackService.getUserInfo(userId);
    
    if (!userInfo || !userInfo.profile) {
      console.error(`Could not retrieve profile for user ${userId}`);
      return false;
    }
    
    // Check the title field in the user's profile
    const userTitle = userInfo.profile.title || '';
    console.log(`User ${userId} has title: "${userTitle}"`);
    
    // List of keywords that indicate a manager role
    const managerKeywords = [
      'manager', 
      'director', 
      'lead', 
      'head', 
      'chief', 
      'vp', 
      'vice president',
      'president', 
      'ceo', 
      'cto', 
      'cfo', 
      'coo',
      'supervisor'
    ];
    
    // Check if any manager keyword appears in the title
    const isManager = managerKeywords.some(keyword => 
      userTitle.toLowerCase().includes(keyword)
    );
    
    console.log(`User ${userId} ${isManager ? 'IS' : 'IS NOT'} a manager based on title`);
    return isManager;
  } catch (error) {
    console.error('Error checking if user is manager:', error);
    
    // For safety in POC, return false on errors
    return false;
  }
}

/**
 * Parse checklist text into structured items
 * @param {string} checklistText - Raw checklist text from Langflow
 * @returns {Array} - Array of checklist items with their categories
 */
function parseChecklistItems(checklistText) {
  console.log('Parsing checklist text from Langflow:');
  console.log(checklistText);
  
  const items = [];
  let currentCategory = "General";
  
  // Split into lines and process each line
  const lines = checklistText.split('\n');
  
  lines.forEach(line => {
    line = line.trim();
    
    // Skip empty lines
    if (!line) return;
    
    // Check if this is a category header (matches I., II., etc. or roman numerals or just text with a colon)
    if (line.match(/^[IVX]+\.\s.*:$/) || // Roman numerals like "I. First Day:"
        line.match(/^[0-9]+\.\s.*:$/) || // Numeric like "1. First Day:"
        line.match(/^.*:$/) ||           // Any line ending with colon
        line.startsWith('##') ||         // Markdown heading 
        line.startsWith('**')) {         // Bold text
      
      // Extract category name, removing any special characters
      currentCategory = line.replace(/^[IVX]+\.\s|\*\*|##|^[0-9]+\.\s/g, '').replace(/:$/, '').trim();
      console.log(`Found category: ${currentCategory}`);
    } 
    // Check if this is a checklist item (bullet point)
    else if (line.startsWith('-') || line.startsWith('*') || line.match(/^\d+\.\s/)) {
      const itemText = line.replace(/^-|\*|\d+\.\s/, '').trim();
      if (itemText) {
        items.push({
          id: helpers.generateUniqueId(), // Using the imported helpers function
          text: itemText,
          category: currentCategory,
          completed: false,
          completedAt: null
        });
      }
    } else if (line.length > 0) {
      // If it's not empty and doesn't match other patterns, treat as an item
      // This catches items that might not have bullet points
      items.push({
        id: helpers.generateUniqueId(), // Using the imported helpers function
        text: line,
        category: currentCategory,
        completed: false,
        completedAt: null
      });
    }
  });
  
  console.log(`Parsed ${items.length} items across categories`);
  return items;
}

/**
 * Create and store a new checklist
 * @param {string} employeeId - Slack ID of the employee
 * @param {string} managerId - Slack ID of the manager
 * @param {string} role - Role for the checklist
 * @param {Array} items - Parsed checklist items
 * @returns {string} - The checklist ID
 */
function storeChecklist(employeeId, managerId, role, items) {
  const checklistId = helpers.generateUniqueId();
  
  checklistsStore[checklistId] = {
    id: checklistId,
    employeeId,
    managerId,
    role,
    items,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  return checklistId;
}

/**
 * Get a checklist by ID
 * @param {string} id - Checklist ID
 * @returns {object|null} - The checklist or null if not found
 */
function getChecklistById(id) {
  return checklistsStore[id] || null;
}

/**
 * Update a checklist item status
 * @param {string} checklistId - ID of the checklist
 * @param {string} itemId - ID of the item to update
 * @param {boolean} completed - Whether the item is completed
 * @returns {boolean} - Success status
 */
function updateChecklistItemStatus(checklistId, itemId, completed) {
  const checklist = checklistsStore[checklistId];
  if (!checklist) return false;
  
  const item = checklist.items.find(item => item.id === itemId);
  if (!item) return false;
  
  item.completed = completed;
  item.completedAt = completed ? new Date() : null;
  checklist.updatedAt = new Date();
  
  return true;
}

/**
 * Get checklists by employee and/or manager
 * @param {string} employeeId - Slack ID of employee
 * @param {string} managerId - Slack ID of manager
 * @returns {Array} - Matching checklists
 */
function getChecklistsByEmployeeAndManager(employeeId, managerId) {
  return Object.values(checklistsStore).filter(checklist => 
    (employeeId ? checklist.employeeId === employeeId : true) && 
    (managerId ? checklist.managerId === managerId : true)
  );
}

/**
 * Calculate progress statistics for a checklist
 * @param {object} checklist - The checklist object
 * @returns {object} - Progress stats
 */
function calculateChecklistProgress(checklist) {
  const totalCount = checklist.items.length;
  const completedCount = checklist.items.filter(item => item.completed).length;
  const completedPercentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  
  return {
    totalCount,
    completedCount,
    completedPercentage
  };
}

/**
 * Group checklist items by category
 * @param {Array} items - Checklist items
 * @returns {Object} - Items grouped by category
 */
function groupItemsByCategory(items) {
  return items.reduce((acc, item) => {
    const category = item.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});
}

/**
 * Create a visual progress bar
 * @param {number} percentage - Completion percentage
 * @returns {string} - Text-based progress bar
 */
function createProgressBar(percentage) {
  const filledBlocks = Math.floor(percentage / 10);
  const emptyBlocks = 10 - filledBlocks;
  
  const filled = '█'.repeat(filledBlocks);
  const empty = '░'.repeat(emptyBlocks);
  
  return `\`${filled}${empty}\` ${percentage}%`;
}

/**
 * Create interactive checklist blocks for Slack, handling large checklists
 * @param {string} checklistId - ID of the checklist
 * @param {string} role - Role title
 * @param {Array} items - Checklist items
 * @param {string} managerId - ID of the manager
 * @returns {Array} - Array of block arrays, each suitable for sending as a message
 */
function createInteractiveChecklistBlocks(checklistId, role, items, managerId) {
  console.log('Creating interactive checklist blocks');
  console.log(`Checklist ID: ${checklistId}, Role: ${role}, Items: ${items.length}, Manager: ${managerId}`);
  
  // Slack has a limit of 50 blocks per message
  const MAX_BLOCKS_PER_MESSAGE = 45; // Leave buffer for header/footer blocks
  
  // Header blocks - will be part of the first message
  const headerBlocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Onboarding Checklist: ${role}`,
        emoji: true
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Welcome to your onboarding journey! Your manager <@${managerId}> has created this checklist to help you get started. Check off items as you complete them.`
      }
    },
    {
      type: "divider"
    }
  ];
  
  // Group items by category
  const categorizedItems = groupItemsByCategory(items);
  console.log('Categorized items:', Object.keys(categorizedItems));
  
  // Prepare category blocks
  let allCategoryBlocks = [];
  
  // Add each category and its items
  Object.entries(categorizedItems).forEach(([category, categoryItems]) => {
    // Add category header
    allCategoryBlocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${category}*`
      }
    });
    
    // Add item blocks
    categoryItems.forEach(item => {
      // Use a simpler action_id format
      const actionId = `toggle_${checklistId.substring(0, 8)}_${item.id.substring(0, 8)}`;
      
      allCategoryBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: item.completed ? `~${item.text}~` : item.text
        },
        accessory: {
          type: "checkboxes",
          action_id: actionId,
          options: [
            {
              text: {
                type: "plain_text",
                text: "Complete",
                emoji: true
              },
              value: "complete"
            }
          ],
          initial_options: item.completed ? [
            {
              text: {
                type: "plain_text",
                text: "Complete",
                emoji: true
              },
              value: "complete"
            }
          ] : []
        }
      });
    });
    
    // Add a divider after each category
    allCategoryBlocks.push({
      type: "divider"
    });
  });
  
  // Footer blocks - will be part of the last message
  const footerBlocks = [
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Progress Summary",
            emoji: true
          },
          action_id: `view_progr_${checklistId.substring(0, 8)}`,
          style: "primary"
        }
      ]
    }
  ];
  
  // Split blocks into multiple messages if needed
  const messageBlockSets = [];
  
  // First message will have header blocks
  let currentMessageBlocks = [...headerBlocks];
  
  // Add category blocks, creating new messages when needed
  for (let i = 0; i < allCategoryBlocks.length; i++) {
    // If adding this block would exceed the limit, start a new message
    if (currentMessageBlocks.length >= MAX_BLOCKS_PER_MESSAGE) {
      messageBlockSets.push(currentMessageBlocks);
      currentMessageBlocks = []; // Start a new message
    }
    
    currentMessageBlocks.push(allCategoryBlocks[i]);
  }
  
  // Add footer blocks to the last message
  if (currentMessageBlocks.length + footerBlocks.length <= MAX_BLOCKS_PER_MESSAGE) {
    currentMessageBlocks.push(...footerBlocks);
  } else {
    // If footer doesn't fit, add current blocks as a message and create a new one for footer
    messageBlockSets.push(currentMessageBlocks);
    currentMessageBlocks = [...footerBlocks];
  }
  
  // Add the last message
  messageBlockSets.push(currentMessageBlocks);
  
  console.log(`Created ${messageBlockSets.length} messages with a total of ${allCategoryBlocks.length + headerBlocks.length + footerBlocks.length} blocks`);
  
  return messageBlockSets;
}

/**
 * Generate blocks for progress display
 * @param {object} checklist - The checklist object
 * @returns {Array} - Slack blocks for progress display
 */
function generateProgressBlocks(checklist) {
  const blocks = [];
  const categorizedItems = groupItemsByCategory(checklist.items);
  
  Object.entries(categorizedItems).forEach(([category, items]) => {
    // Calculate category progress
    const totalInCategory = items.length;
    const completedInCategory = items.filter(item => item.completed).length;
    const categoryPercentage = Math.round((completedInCategory / totalInCategory) * 100);
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${category}*: ${categoryPercentage}% complete`
      }
    });
    
    // Add progress bar
    const progressBar = createProgressBar(categoryPercentage);
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: progressBar
      }
    });
    
    // Add items
    const itemTexts = items.map(item => {
      const status = item.completed ? "✅" : "⬜";
      const completedInfo = item.completed && item.completedAt 
        ? ` (completed: ${helpers.formatDate(item.completedAt)})` 
        : '';
      return `${status} ${item.text}${completedInfo}`;
    });
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: itemTexts.join("\n")
      }
    });
    
    blocks.push({
      type: "divider"
    });
  });
  
  return blocks;
}

/**
 * Get all checklists (for finding by ID)
 * @returns {Object} - All checklists indexed by ID
 */
function getAllChecklists() {
  return checklistsStore;
}

/**
 * Create a visual progress bar
 * @param {number} percentage - Completion percentage
 * @returns {string} - Text-based progress bar
 */
function createProgressBar(percentage) {
  const filledBlocks = Math.floor(percentage / 10);
  const emptyBlocks = 10 - filledBlocks;
  
  const filled = '█'.repeat(filledBlocks);
  const empty = '░'.repeat(emptyBlocks);
  
  return `\`${filled}${empty}\` ${percentage}%`;
}

/**
 * Create checklist blocks with standardized button structure
 * @param {string} category - Category name
 * @param {Array} items - Items in the category
 * @param {string} checklistId - ID of the checklist
 * @returns {Array} - Blocks for the category
 */
function createCategoryBlocks(category, items, checklistId) {
  const blocks = [];
  
  // Add category header
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${category}*`
    }
  });
  
  // Add instructions
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "Click the buttons to mark items as complete:"
      }
    ]
  });
  
  // Add each item with a standardized button format
  for (const item of items) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: item.completed ? "✅" : "⬜", 
            emoji: true
          },
          style: item.completed ? "primary" : "danger",
          value: item.id, // Store full item ID
          action_id: `toggle_item_${item.id}` // Standardized action_id format
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: item.text.substring(0, 75) + (item.text.length > 75 ? "..." : ""),
            emoji: true
          },
          value: item.id,
          action_id: `view_item_${item.id}`
        }
      ]
    });
  }
  
  return blocks;
}


module.exports = {
  getChecklist,
  parseRoleSpecification,
  isUserManager,
  parseChecklistItems,
  storeChecklist,
  getChecklistById,
  updateChecklistItemStatus,
  getChecklistsByEmployeeAndManager,
  calculateChecklistProgress,
  groupItemsByCategory,
  createProgressBar,
  createInteractiveChecklistBlocks,
  generateProgressBlocks,
  getAllChecklists,
  createCategoryBlocks
};