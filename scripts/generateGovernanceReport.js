#!/usr/bin/env node
// scripts/generateGovernanceReport.js
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './variables.env' });

// Define log directory
const logPath = process.env.GOVERNANCE_LOG_PATH || './logs/governance';

// Setup Commander
program
  .version('1.0.0')
  .description('Governance Reporting Tool for SwiftStart');

// Add command to generate a governance report
program
  .command('generate')
  .description('Generate a governance report')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
  .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
  .option('-o, --output <file>', 'Output file')
  .action(async (options) => {
    try {
      // Set default dates if not provided
      const endDate = options.end ? new Date(options.end) : new Date();
      const startDate = options.start 
        ? new Date(options.start) 
        : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days before end date
      
      console.log(`Generating governance report from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
      // Get all log files
      const logFiles = fs.readdirSync(logPath)
        .filter(file => file.endsWith('-governance.log'))
        .filter(file => {
          const fileDate = new Date(file.split('-governance.log')[0]);
          return fileDate >= startDate && fileDate <= endDate;
        })
        .map(file => path.join(logPath, file));
      
      if (logFiles.length === 0) {
        console.log('No log files found for the specified date range');
        return;
      }
      
      console.log(`Found ${logFiles.length} log files`);
      
      // Parse log files
      const events = [];
      for (const file of logFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            events.push(event);
          } catch (error) {
            console.warn(`Error parsing log line: ${error.message}`);
          }
        }
      }
      
      console.log(`Parsed ${events.length} events`);
      
      // Generate statistics
      const stats = {
        totalEvents: events.length,
        eventTypes: {},
        piiDetections: 0,
        biasDetections: 0,
        contentFilters: 0,
        queryErrors: 0
      };
      
      events.forEach(event => {
        // Count event types
        stats.eventTypes[event.eventType] = (stats.eventTypes[event.eventType] || 0) + 1;
        
        // Count specific events
        if (event.eventType === 'pii_detected') {
          stats.piiDetections++;
        } else if (event.eventType === 'bias_detected') {
          stats.biasDetections++;
        } else if (event.eventType === 'content_filtered') {
          stats.contentFilters++;
        } else if (event.eventType === 'query_error') {
          stats.queryErrors++;
        }
      });
      
      // Generate report
      const report = {
        title: 'SwiftStart AI Governance Report',
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        },
        summary: {
          totalEvents: stats.totalEvents,
          totalPiiDetections: stats.piiDetections,
          totalBiasDetections: stats.biasDetections,
          totalContentFilters: stats.contentFilters,
          totalQueryErrors: stats.queryErrors
        },
        eventBreakdown: stats.eventTypes,
        generatedAt: new Date().toISOString()
      };
      
      // Output report
      const reportJson = JSON.stringify(report, null, 2);
      
      if (options.output) {
        fs.writeFileSync(options.output, reportJson);
        console.log(`Report written to ${options.output}`);
      } else {
        console.log('===== GOVERNANCE REPORT =====');
        console.log(reportJson);
      }
      
      // Generate CSV summary if output is specified
      if (options.output) {
        const csvPath = options.output.replace(/\.json$/, '.csv');
        const csvContent = [
          'Date,Event Type,Count',
          ...Object.entries(stats.eventTypes).map(([type, count]) => `${report.period.start} to ${report.period.end},${type},${count}`)
        ].join('\n');
        
        fs.writeFileSync(csvPath, csvContent);
        console.log(`CSV summary written to ${csvPath}`);
      }
    } catch (error) {
      console.error(`Error generating governance report: ${error.message}`);
      process.exit(1);
    }
  });

// Add command to view recent events
program
  .command('recent [count]')
  .description('Show recent governance events')
  .action(async (count = 10) => {
    try {
      // Convert count to number
      count = parseInt(count);
      
      // Get most recent log file
      const logFiles = fs.readdirSync(logPath)
        .filter(file => file.endsWith('-governance.log'))
        .sort()
        .reverse();
      
      if (logFiles.length === 0) {
        console.log('No log files found');
        return;
      }
      
      // Read events from most recent log file
      let events = [];
      for (const file of logFiles) {
        const filePath = path.join(logPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        lines.forEach(line => {
          try {
            const event = JSON.parse(line);
            events.push(event);
          } catch (error) {
            // Skip invalid lines
          }
        });
        
        if (events.length >= count) {
          break;
        }
      }
      
      // Sort events by timestamp (newest first)
      events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Limit events to requested count
      events = events.slice(0, count);
      
      console.log(`=== Recent ${events.length} Governance Events ===`);
      events.forEach((event, i) => {
        const time = new Date(event.timestamp).toLocaleString();
        console.log(`\n[${i + 1}] ${event.eventType} (${time})`);
        
        // Print event details without timestamp and eventType
        const { timestamp, eventType, ...details } = event;
        console.log(JSON.stringify(details, null, 2));
      });
    } catch (error) {
      console.error(`Error showing recent events: ${error.message}`);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}