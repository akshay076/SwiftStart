// services/pulseScheduler.js
class PulseScheduler {
    constructor() {
      this.schedules = new Map();
      this.intervalId = null;
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
      // For hackathon demo purposes, we'll use a simple schedule
      // In real implementation, this would be more sophisticated
      
      // Create 2-3 random check times during work hours
      const workHours = [9, 10, 11, 12, 13, 14, 15, 16, 17];
      const checkTimes = [];
      
      // Create 2 random times
      for (let i = 0; i < 2; i++) {
        const hour = workHours[Math.floor(Math.random() * workHours.length)];
        const minute = Math.floor(Math.random() * 60);
        checkTimes.push({ hour, minute });
      }
      
      this.schedules.set(userId, {
        userId,
        teamId,
        channelId,
        checkTimes,
        lastPulseDate: null // Track last pulse date to avoid duplicates
      });
      
      console.log(`Scheduled pulse checks for user ${userId} at times:`, 
        checkTimes.map(t => `${t.hour}:${t.minute.toString().padStart(2, '0')}`).join(', ')
      );
      
      return checkTimes;
    }
    
    // Check if it's time to send pulses
    async checkAndSendPulses() {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const today = now.toDateString();
      
      // Demo: For hackathon we'll just do a simplified check
      for (const [userId, schedule] of this.schedules.entries()) {
        // Skip if already sent a pulse today (avoid spam in demo)
        if (schedule.lastPulseDate === today) continue;
        
        // Check if current time matches any scheduled time (±1 minute)
        const shouldSendPulse = schedule.checkTimes.some(time => {
          return time.hour === currentHour && 
                 Math.abs(time.minute - currentMinute) <= 1;
        });
        
        if (shouldSendPulse) {
          try {
            await this.sendPulseCheck(schedule.userId, schedule.channelId);
            schedule.lastPulseDate = today;
            this.schedules.set(userId, schedule);
          } catch (error) {
            console.error(`Error sending pulse to user ${userId}:`, error);
          }
        }
      }
    }
    
    // Send a pulse check to user
    async sendPulseCheck(userId, channelId) {
      try {
        // Get random dimension to check (vary the questions)
        const dimensions = ['energy', 'focus', 'stress', 'connection'];
        const dimension = dimensions[Math.floor(Math.random() * dimensions.length)];
        
        // Create pulse question based on dimension
        let questionText;
        let actionPrefix;
        
        switch (dimension) {
          case 'energy':
            questionText = "📊 *Quick Well-being Pulse*\n\nHow would you rate your energy level right now?";
            actionPrefix = "energy";
            break;
          case 'focus':
            questionText = "📊 *Quick Well-being Pulse*\n\nHow's your focus/concentration at the moment?";
            actionPrefix = "focus";
            break;
          case 'stress':
            questionText = "📊 *Quick Well-being Pulse*\n\nWhat's your current stress level?";
            actionPrefix = "stress";
            break;
          case 'connection':
            questionText = "📊 *Quick Well-being Pulse*\n\nHow connected do you feel with your team today?";
            actionPrefix = "connection";
            break;
        }
        
        // Create blocks with proper emoji based on dimension
        const pulseBlocks = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: questionText
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { 
                  type: "plain_text", 
                  text: dimension === 'stress' ? "😌 Low" : "😴 Low", 
                  emoji: true 
                },
                value: "low",
                action_id: `${actionPrefix}_low`
              },
              {
                type: "button",
                text: { 
                  type: "plain_text", 
                  text: "😐 Medium", 
                  emoji: true 
                },
                value: "medium",
                action_id: `${actionPrefix}_medium`
              },
              {
                type: "button",
                text: { 
                  type: "plain_text", 
                  text: dimension === 'stress' ? "😰 High" : "⚡ High", 
                  emoji: true 
                },
                value: "high",
                action_id: `${actionPrefix}_high`
              }
            ]
          }
        ];
        
        // Send the message
        const slackService = require('./slackService'); // Adjust path as needed
        await slackService.sendMessageWithBlocks(
          channelId,
          "Well-being check-in",
          pulseBlocks
        );
        
        console.log(`Sent ${dimension} pulse check to user ${userId}`);
        return true;
      } catch (error) {
        console.error('Error sending automated pulse:', error);
        throw error;
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