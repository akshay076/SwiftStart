// handlers/wellbeing.js
const slackService = require('../services/slack');

/**
 * Handle demo command to showcase WellSense360
 * @param {Object} payload - Slack command payload
 */
async function handleDemoCommand(payload) {
  const { user_id, channel_id } = payload;
  
  try {
    // Send intro message
    await slackService.sendMessage(
      channel_id,
      "🚀 *Welcome to the WellSense360 Demo!*\n\nI'll walk you through how our continuous well-being measurement works."
    );
    
    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Explain the automated pulse checks
    await slackService.sendMessage(
      channel_id,
      "WellSense360 automatically sends short pulse checks at variable times throughout the workday:"
    );
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Show an example pulse - mock it directly here since we don't have the scheduler yet
    const pulseBlocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "📊 *Quick Well-being Pulse*\n\nHow would you rate your energy level right now?"
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { 
              type: "plain_text", 
              text: "😴 Low", 
              emoji: true 
            },
            value: "low",
            action_id: "energy_low"
          },
          {
            type: "button",
            text: { 
              type: "plain_text", 
              text: "😐 Medium", 
              emoji: true 
            },
            value: "medium",
            action_id: "energy_medium"
          },
          {
            type: "button",
            text: { 
              type: "plain_text", 
              text: "⚡ High", 
              emoji: true 
            },
            value: "high",
            action_id: "energy_high"
          }
        ]
      }
    ];
    
    await slackService.sendMessageWithBlocks(
      channel_id,
      "Well-being pulse check",
      pulseBlocks
    );
    
    // Wait for demo response, then continue
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Explain data collection
    await slackService.sendMessage(
      channel_id,
      "Each response is anonymized and aggregated with team data. Individual responses are never shared with management."
    );
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Show mock team dashboard
    await slackService.sendMessage(
      channel_id,
      "Based on continuous measurements, leadership gets anonymized team insights:"
    );
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock insights
    const insightBlocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Team Well-being Insights",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Team Energy Trend (Last 14 Days)*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "```\nEnergy: ▁▂▃▂▁▂▃▄▅▆▅▄▅▇\n         Mon          Fri          Wed\n```"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Key Insights*\n• Energy levels typically dip on Mondays\n• Team's overall energy has increased 23% this week\n• 2 team members reported lower energy today"
        }
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Dimension Breakdown*"
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: "*Physical:* 72% 📈"
          },
          {
            type: "mrkdwn",
            text: "*Mental:* 68% 📉"
          },
          {
            type: "mrkdwn",
            text: "*Social:* 85% ↔️"
          },
          {
            type: "mrkdwn",
            text: "*Financial:* 77% 📈"
          }
        ]
      }
    ];
    
    await slackService.sendMessageWithBlocks(
      channel_id,
      "Team well-being insights",
      insightBlocks
    );
    
    // Send mock GenAI-generated recommendations
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const recommendationBlocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "AI-Generated Recommendations",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Based on current patterns:*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "1️⃣ Consider lighter meeting load on Monday mornings to address the energy dip pattern we're seeing consistently at the start of each week."
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "2️⃣ Mental dimension shows a 5% downward trend over two weeks - promote existing mental health resources and consider scheduling recovery time after the recent product launch."
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "3️⃣ Recent successful intervention: Flexible lunch hours has correlated with a 15% improvement in afternoon energy levels across the team."
        }
      }
    ];
    
    await slackService.sendMessageWithBlocks(
      channel_id,
      "Well-being recommendations",
      recommendationBlocks
    );
    
    // Finish demo
    await new Promise(resolve => setTimeout(resolve, 4000));
    await slackService.sendMessage(
      channel_id,
      "That's the WellSense360 experience! \n\n*Key benefits:*\n• Continuous vs. periodic measurement\n• Minimal employee effort (< 5 seconds per pulse)\n• Actionable insights for leaders\n• Privacy-preserving design\n• AI-powered recommendations\n\nTry `/enroll` to start receiving automated pulses, or `/insights` to view the insights dashboard."
    );
  } catch (error) {
    console.error('Error in demo:', error);
    await slackService.sendMessage(
      channel_id,
      "Sorry, I encountered an error during the demo."
    );
  }
}

/**
 * Handle insights command to show well-being dashboard
 * @param {Object} payload - Slack command payload
 */
async function handleInsightsCommand(payload) {
  const { user_id, channel_id } = payload;
  
  try {
    // For hackathon, we'll just show mock insights
    const insightBlocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Team Well-being Insights",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Team Energy Trend (Last 14 Days)*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "```\nEnergy: ▁▂▃▂▁▂▃▄▅▆▅▄▅▇\n         Mon          Fri          Wed\n```"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Key Insights*\n• Energy levels typically dip on Mondays\n• Team's overall energy has increased 23% this week\n• 2 team members reported lower energy today"
        }
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Dimension Breakdown*"
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: "*Physical:* 72% 📈"
          },
          {
            type: "mrkdwn",
            text: "*Mental:* 68% 📉"
          },
          {
            type: "mrkdwn",
            text: "*Social:* 85% ↔️"
          },
          {
            type: "mrkdwn",
            text: "*Financial:* 77% 📈"
          }
        ]
      }
    ];
    
    await slackService.sendMessageWithBlocks(
      channel_id,
      "Team well-being insights",
      insightBlocks
    );
    
    // Send mock recommendations
    const recommendationBlocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "AI-Generated Recommendations",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Based on current patterns:*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "1️⃣ Consider lighter meeting load on Monday mornings"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "2️⃣ Mental dimension shows downward trend - promote mental health resources"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "3️⃣ Recent successful intervention: Flexible lunch hours (+15% energy)"
        }
      }
    ];
    
    await slackService.sendMessageWithBlocks(
      channel_id,
      "Team well-being recommendations",
      recommendationBlocks
    );
  } catch (error) {
    console.error('Error sending insights:', error);
    await slackService.sendMessage(
      channel_id,
      "Sorry, I encountered an error showing your insights."
    );
  }
}

/**
 * Handle enrollment for automated well-being pulses
 * @param {Object} payload - Slack command payload
 */
async function handleEnrollCommand(payload) {
  const { user_id, channel_id, team_id } = payload;
  
  try {
    // For hackathon, we'll just simulate enrollment
    
    // Send confirmation
    await slackService.sendMessage(
      channel_id,
      `✅ *You're enrolled in WellSense360!*\n\nYou'll receive automated well-being pulse checks throughout your workday.\n\nThese brief check-ins help measure team well-being patterns while respecting your privacy.\n\nType \`/insights\` anytime to see anonymized team insights.`
    );
    
    // For hackathon demo purposes, also send a pulse immediately
    // In production, we'd set up a real scheduler
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Send a sample pulse
    const pulseBlocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "📊 *Quick Well-being Pulse*\n\nHow would you rate your energy level right now?"
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { 
              type: "plain_text", 
              text: "😴 Low", 
              emoji: true 
            },
            value: "low",
            action_id: "energy_low"
          },
          {
            type: "button",
            text: { 
              type: "plain_text", 
              text: "😐 Medium", 
              emoji: true 
            },
            value: "medium",
            action_id: "energy_medium"
          },
          {
            type: "button",
            text: { 
              type: "plain_text", 
              text: "⚡ High", 
              emoji: true 
            },
            value: "high",
            action_id: "energy_high"
          }
        ]
      }
    ];
    
    await slackService.sendMessageWithBlocks(
      channel_id,
      "First well-being pulse check",
      pulseBlocks
    );
    
  } catch (error) {
    console.error('Error enrolling in well-being pulses:', error);
    await slackService.sendMessage(
      channel_id,
      "Sorry, I encountered an error enrolling you in well-being measurements."
    );
  }
}

module.exports = {
  handleDemoCommand,
  handleInsightsCommand,
  handleEnrollCommand
};