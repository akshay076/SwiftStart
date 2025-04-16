// services/pulseScheduler.js
const fs = require('fs');
const path = require('path');

class PulseScheduler {
    constructor() {
      // Load configuration
      this.config = this.loadConfiguration();
      this.schedules = new Map();
      this.intervalId = null;
    }
    
    // Load configuration from JSON file
    loadConfiguration() {
      try {
        const configPath = path.join(__dirname, '..', 'config', 'wellbeing-pulse-config.json');
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (error) {
        console.error('Failed to load pulse configuration:', error);
        // Fallback to hardcoded configuration
        return {
          dimensions: [],
          pulseFrequency: {
            minIntervalHours: 2,
            maxIntervalHours: 4,
            workHoursStart: 9,
            workHoursEnd: 17
          }
        };
      }
    }
    
    // Randomly select pulse questions
    selectPulseQuestions() {
      const { dimensions } = this.config;
      
      // Randomly select 3-4 unique dimensions
      const shuffled = dimensions.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, Math.floor(Math.random() * 2) + 3); // 3-4 dimensions
    }
    
    // Start the scheduler for all users
    start() {
      if (this.intervalId) return; // Already running
      
      // Check every minute if it's time to send a pulse
      this.intervalId = setInterval(() => {
        this.checkAndSendPulses();
      }, 60000);
      
      console.log('Pulse scheduler started');
    }
    
    // Schedule pulses for a user
    scheduleForUser(userId, teamId, channelId) {
      const { pulseFrequency } = this.config;
      
      // Create randomized check times during work hours
      const checkTimes = [];
      const workHours = Array.from(
        {length: pulseFrequency.workHoursEnd - pulseFrequency.workHoursStart}, 
        (_, i) => pulseFrequency.workHoursStart + i
      );
      
      // Create 2-3 random times
      for (let i = 0; i < Math.floor(Math.random() * 2) + 2; i++) {
        const hour = workHours[Math.floor(Math.random() * workHours.length)];
        const minute = Math.floor(Math.random() * 60);
        checkTimes.push({ hour, minute });
      }
      
      this.schedules.set(userId, {
        userId,
        teamId,
        channelId,
        checkTimes,
        lastPulseDate: null
      });
      
      console.log(`Scheduled pulse checks for user ${userId} at times:`, 
        checkTimes.map(t => `${t.hour}:${t.minute.toString().padStart(2, '0')}`).join(', ')
      );
      
      return checkTimes;
    }
    
    // Method to create multi-question pulse check blocks
    createPulseCheckBlocks() {
        const config = require('../config/wellbeing-pulse-config.json');
        const { dimensions } = config;
        
        // Ensure we select at least 3 dimensions, even if config has fewer
        const selectedDimensions = dimensions
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.min(3, dimensions.length)); // Take first 3 or all if fewer
        
        const blocks = [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🌈 WellSense360 Quick Check-in",
              emoji: true
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Let's check in on a few dimensions of your well-being:"
            }
          }
        ];
        
        // Add blocks for each selected dimension
        selectedDimensions.forEach((dimension, index) => {
          // Add divider between questions (except first)
          if (index > 0) {
            blocks.push({ type: "divider" });
          }
          
          // Question block
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${dimension.name}*: ${dimension.questions[0].text}`
            }
          });
          
          // Response buttons
          blocks.push({
            type: "actions",
            elements: dimension.questions[0].responseOptions.map(option => ({
              type: "button",
              text: {
                type: "plain_text",
                text: option.text,
                emoji: true
              },
              value: option.value,
              action_id: `${dimension.id}_${option.value}`
            }))
          });
        });
        
        // Context block
        blocks.push({
          type: "context",
          elements: [{
            type: "mrkdwn",
            text: "Your responses help us understand team well-being. 💡"
          }]
        });
        
        return blocks;
      }
    
    // Send a pulse check to user
    async sendPulseCheck(userId, channelId) {
      try {
        const slackService = require('./slack');
        
        // Create pulse check blocks
        const pulseBlocks = this.createPulseCheckBlocks();
        
        // Send the message
        await slackService.sendMessageWithBlocks(
          channelId,
          "WellSense360 Well-being Check",
          pulseBlocks
        );
        
        console.log(`Sent pulse check to user ${userId}`);
        return true;
      } catch (error) {
        console.error('Error sending automated pulse:', error);
        throw error;
      }
    }
    
    // Rest of the implementation remains the same as in the original file
    checkAndSendPulses() {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const today = now.toDateString();
      
      for (const [userId, schedule] of this.schedules.entries()) {
        // Skip if already sent a pulse today
        if (schedule.lastPulseDate === today) continue;
        
        // Check if current time matches any scheduled time (±1 minute)
        const shouldSendPulse = schedule.checkTimes.some(time => 
          time.hour === currentHour && 
          Math.abs(time.minute - currentMinute) <= 1
        );
        
        if (shouldSendPulse) {
          this.sendPulseCheck(schedule.userId, schedule.channelId)
            .then(() => {
              schedule.lastPulseDate = today;
              this.schedules.set(userId, schedule);
            })
            .catch(error => {
              console.error(`Error sending pulse to user ${userId}:`, error);
            });
        }
      }
    }
    
    // Stop the scheduler
    stop() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
        console.log('Pulse scheduler stopped');
      }
    }
}

// Export a singleton instance
const scheduler = new PulseScheduler();
module.exports = scheduler;