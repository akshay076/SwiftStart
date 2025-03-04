// controllers/checklist.js
const langflowService = require('../services/langflow');
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
    return await langflowService.queryLangflow(query);
  } else {
    // For unknown roles, return the general checklist
    const query = `Get me the general onboarding checklist`;
    return await langflowService.queryLangflow(query);
  }
}

/**
 * Parse a role specification from command text
 * @param {string} text - The command text
 * @returns {object} - The parsed role information
 */
function parseRoleSpecification(text) {
  // Check for format: "[role] for @username"
  const forUserPattern = /^(.*?)\s+for\s+@([^\s]+)$/;
  const forUserMatch = text.match(forUserPattern);
  
  if (forUserMatch) {
    return {
      role: forUserMatch[1].trim(),
      targetUser: forUserMatch[2].trim(),
      isForOtherUser: true
    };
  }
  
  // Just a role for the current user
  return {
    role: text.trim(),
    isForOtherUser: false
  };
}

/**
 * Check if a user is a manager (placeholder until AAD integration)
 * @param {string} userId - Slack user ID to check
 * @returns {Promise<boolean>} - Whether the user is a manager
 */
async function isUserManager(userId) {
  try {
    // This is a placeholder until AAD integration
    // In production, you would query AAD to check if the user is a manager
    
    // For now, we'll check if the user has "manager" in their title
    const userInfo = await slackService.getUserInfo(userId);
    const title = userInfo.profile?.title || '';
    
    // Check for manager indicators in the title
    const managerKeywords = ['manager', 'director', 'lead', 'head', 'chief', 'vp', 'president', 'ceo', 'cto', 'cfo', 'coo'];
    return managerKeywords.some(keyword => title.toLowerCase().includes(keyword));
  } catch (error) {
    console.error('Error checking if user is manager:', error);
    // Default to false for safety
    return false;
  }
}

/**
 * Parse checklist text into structured items
 * @param {string} checklistText - Raw checklist text from Langflow
 * @returns {Array} - Array of checklist items with their categories
 */
function parseChecklistItems(checklistText) {
  const items = [];
  let currentCategory = "General";
  
  // Split into lines and process each line
  const lines = checklistText.split('\n');
  
  lines.forEach(line => {
    line = line.trim();
    
    // Skip empty lines
    if (!line) return;
    
    // Check if this is a category header (markdown heading)
    if (line.startsWith('##') || line.startsWith('**')) {
      currentCategory = line.replace(/^##\s*|\*\*/g, '').trim();
    } 
    // Check if this is a checklist item (bullet point)
    else if (line.startsWith('-') || line.startsWith('*') || line.match(/^\d+\.\s/)) {
      const itemText = line.replace(/^-|\*|\d+\.\s/, '').trim();
      if (itemText) {
        items.push({
          id: helpers.generateUniqueId(),
          text: itemText,
          category: currentCategory,
          completed: false,
          completedAt: null
        });
      }
    }
  });
  
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
 * Create interactive checklist blocks for Slack
 * @param {string} checklistId - ID of the checklist
 * @param {string} role - Role title
 * @param {Array} items - Checklist items
 * @param {string} managerId - ID of the manager
 * @returns {Array} - Slack blocks for interactive checklist
 */
function createInteractiveChecklistBlocks(checklistId, role, items, managerId) {
  const blocks = [
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
  
  // Add each category and its items
  Object.entries(categorizedItems).forEach(([category, categoryItems]) => {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${category}*`
      }
    });
    
    categoryItems.forEach(item => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: item.completed ? `~${item.text}~` : item.text
        },
        accessory: {
          type: "checkboxes",
          action_id: `toggle_item_${checklistId}_${item.id}`,
          options: [
            {
              text: {
                type: "plain_text",
                text: "Complete",
                emoji: true
              },
              value: `complete_${item.id}`
            }
          ],
          initial_options: item.completed ? [
            {
              text: {
                type: "plain_text",
                text: "Complete",
                emoji: true
              },
              value: `complete_${item.id}`
            }
          ] : []
        }
      });
    });
  });
  
  // Add a button to view progress
  blocks.push(
    {
      type: "divider"
    },
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
          action_id: `view_progress_${checklistId}`,
          style: "primary"
        }
      ]
    }
  );
  
  return blocks;
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
  generateProgressBlocks
};