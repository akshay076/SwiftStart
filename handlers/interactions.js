// handlers/interactions.js
const { updateChecklistProgress } = require('../controllers/checklist');

/**
 * Handle Slack interactive components
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleInteractions = async (req, res) => {
  // Parse the payload
  const payload = JSON.parse(req.body.payload);
  
  // Respond immediately to avoid timeout
  res.status(200).send();
  
  try {
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
  const { actions } = payload;
  
  for (const action of actions) {
    if (action.type === 'checkbox') {
      // Handle checklist item toggles
      await updateChecklistProgress(
        payload.user.id,
        action.action_id,
        action.selected_options.length > 0
      );
    }
    // Add more action type handlers as needed
  }
};

module.exports = {
  handleInteractions
};