#!/usr/bin/env node
// scripts/initKnowledgeBase.js
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const dotenv = require('dotenv');
const documentProcessor = require('../services/documentProcessor');

// Load environment variables
dotenv.config({ path: './variables.env' });

// Define knowledge base directory
const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH || './knowledge';

// Ensure knowledge base directory exists
if (!fs.existsSync(knowledgeBasePath)) {
  fs.mkdirSync(knowledgeBasePath, { recursive: true });
  console.log(`Created knowledge base directory at ${knowledgeBasePath}`);
}

// Setup Commander
program
  .version('1.0.0')
  .description('Knowledge Base Management for SwiftStart RAG System');

// Add command to initialize knowledge base
program
  .command('init')
  .description('Initialize or refresh the knowledge base')
  .action(async () => {
    try {
      console.log('Initializing knowledge base...');
      const documents = await documentProcessor.processAllDocuments();
      console.log(`Processed ${documents.length} document chunks`);
      
      const vectorStore = await documentProcessor.createVectorStore(documents);
      console.log('Vector store created successfully');
    } catch (error) {
      console.error(`Error initializing knowledge base: ${error.message}`);
      process.exit(1);
    }
  });

// Add command to add a file to the knowledge base
program
  .command('add <file>')
  .description('Add a markdown file to the knowledge base')
  .action(async (file) => {
    try {
      // Ensure file exists
      if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        process.exit(1);
      }
      
      // Ensure file is markdown
      if (!file.endsWith('.md')) {
        console.error('Only markdown (.md) files are supported');
        process.exit(1);
      }
      
      // Copy file to knowledge base directory
      const fileName = path.basename(file);
      const destination = path.join(knowledgeBasePath, fileName);
      
      fs.copyFileSync(file, destination);
      console.log(`Added ${fileName} to knowledge base`);
      
      // Refresh knowledge base
      console.log('Refreshing knowledge base...');
      const documents = await documentProcessor.processAllDocuments();
      console.log(`Processed ${documents.length} document chunks`);
      
      const vectorStore = await documentProcessor.createVectorStore(documents);
      console.log('Vector store created successfully');
    } catch (error) {
      console.error(`Error adding file to knowledge base: ${error.message}`);
      process.exit(1);
    }
  });

// Add command to list knowledge base files
program
  .command('list')
  .description('List all files in the knowledge base')
  .action(() => {
    try {
      const files = fs.readdirSync(knowledgeBasePath)
        .filter(file => file.endsWith('.md'));
      
      if (files.length === 0) {
        console.log('No files found in knowledge base');
        return;
      }
      
      console.log('Knowledge base files:');
      files.forEach((file, index) => {
        const stats = fs.statSync(path.join(knowledgeBasePath, file));
        const size = (stats.size / 1024).toFixed(2);
        const modified = stats.mtime.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        console.log(`${index + 1}. ${file} (${size} KB, modified: ${modified})`);
      });
    } catch (error) {
      console.error(`Error listing knowledge base files: ${error.message}`);
      process.exit(1);
    }
  });

// Add command to remove a file from the knowledge base
program
  .command('remove <file>')
  .description('Remove a file from the knowledge base')
  .action(async (file) => {
    try {
      const filePath = path.join(knowledgeBasePath, file);
      
      // Ensure file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${file}`);
        process.exit(1);
      }
      
      // Remove file
      fs.unlinkSync(filePath);
      console.log(`Removed ${file} from knowledge base`);
      
      // Refresh knowledge base
      console.log('Refreshing knowledge base...');
      const documents = await documentProcessor.processAllDocuments();
      console.log(`Processed ${documents.length} document chunks`);
      
      const vectorStore = await documentProcessor.createVectorStore(documents);
      console.log('Vector store created successfully');
    } catch (error) {
      console.error(`Error removing file from knowledge base: ${error.message}`);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}