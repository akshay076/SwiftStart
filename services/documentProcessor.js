// services/documentProcessor.js
const fs = require('fs').promises;
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Google Generative AI for embeddings
let embeddingModel;

// Vector store (simple in-memory implementation)
let documents = [];
let documentEmbeddings = [];

// Initialize the embedding model
async function initEmbeddingModel() {
  try {
    if (!embeddingModel) {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    }
    return embeddingModel;
  } catch (error) {
    console.error('Error initializing embedding model:', error);
    return null;
  }
}

/**
 * Generate embeddings for text
 * @param {string} text - Text to embed
 * @returns {Promise<Array<number>>} - Embedding vector
 */
async function generateEmbedding(text) {
  try {
    const model = await initEmbeddingModel();
    if (!model) {
      console.error('Embedding model not initialized');
      return [];
    }
    
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return [];
  }
}

/**
 * Extract metadata from markdown frontmatter
 * @param {string} content - File content
 * @returns {Object} - Metadata and content
 */
function extractMetadata(content) {
  const metadataRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(metadataRegex);
  
  if (!match) {
    return { metadata: {}, content };
  }
  
  const metadataStr = match[1];
  const remainingContent = match[2];
  
  // Parse metadata
  const metadata = {};
  const metadataLines = metadataStr.split('\n');
  metadataLines.forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      const value = valueParts.join(':').trim();
      // Remove quotes if present
      metadata[key.trim()] = value.replace(/^"(.*)"$/, '$1');
    }
  });
  
  return { metadata, content: remainingContent };
}

/**
 * Extract section identifiers from markdown content
 * @param {string} content - Markdown content
 * @returns {Array} - Array of sections with identifiers
 */
function extractSections(content) {
  const sectionRegex = /# \[SECTION:([\w-]+)\] (.*?)(?=\n# \[SECTION:|$)/gs;
  const h2SectionRegex = /## \[SECTION:([\w-]+)\] (.*?)(?=\n## \[SECTION:|(?=\n# \[SECTION:)|$)/gs;
  
  const sections = [];
  let sectionMatch;
  
  // Extract main sections (H1)
  while ((sectionMatch = sectionRegex.exec(content)) !== null) {
    const sectionId = sectionMatch[1];
    const sectionContent = sectionMatch[0];
    const sectionTitle = sectionMatch[2].trim();
    
    // Extract subsections (H2) within this section
    const subsections = [];
    let subsectionMatch;
    const subsectionContent = sectionContent;
    
    while ((subsectionMatch = h2SectionRegex.exec(subsectionContent)) !== null) {
      const subsectionId = subsectionMatch[1];
      const subsectionText = subsectionMatch[0];
      const subsectionTitle = subsectionMatch[2].trim();
      
      subsections.push({
        id: subsectionId,
        title: subsectionTitle,
        content: subsectionText,
        parentId: sectionId
      });
    }
    
    sections.push({
      id: sectionId,
      title: sectionTitle,
      content: sectionContent,
      subsections
    });
  }
  
  // If no sections found with identifiers, return the whole content as one section
  if (sections.length === 0) {
    sections.push({
      id: 'MAIN',
      title: 'Main Content',
      content,
      subsections: []
    });
  }
  
  return sections;
}

/**
 * Split text into chunks
 * @param {string} text - Text to split
 * @param {number} chunkSize - Maximum chunk size
 * @param {number} overlap - Overlap between chunks
 * @returns {Array<string>} - Text chunks
 */
function splitTextIntoChunks(text, chunkSize = 1000, overlap = 200) {
  if (!text) return [];
  
  const words = text.split(/\s+/);
  const chunks = [];
  
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    chunks.push(chunk);
  }
  
  return chunks;
}

/**
 * Process documents and create embeddings
 * @param {string} documentsDir - Path to documents directory
 * @returns {Promise<Object>} - Vector store with documents
 */
async function processDocuments(documentsDir = 'knowledge') {
  try {
    console.log(`Processing documents from ${documentsDir}`);
    const absPath = path.resolve(process.cwd(), documentsDir);
    
    // Check if directory exists
    try {
      await fs.access(absPath);
    } catch (err) {
      console.error(`Directory ${absPath} does not exist`);
      return { success: false, error: `Directory ${documentsDir} does not exist` };
    }
    
    // Get all files in the directory
    const files = await fs.readdir(absPath);
    const textFiles = files.filter(file => path.extname(file).match(/\.(txt|md|json)$/i));
    
    console.log(`Found ${textFiles.length} text files to process`);
    
    // Clear existing documents
    documents = [];
    documentEmbeddings = [];
    
    // Process each file
    for (const file of textFiles) {
      const filePath = path.join(absPath, file);
      console.log(`Processing file: ${file}`);
      
      try {
        // Read file content
        const content = await fs.readFile(filePath, 'utf8');
        
        // Extract metadata
        const { metadata, content: textContent } = extractMetadata(content);
        const fileMetadata = {
          filename: file,
          ...metadata
        };
        
        // Extract sections with identifiers
        const sections = extractSections(textContent);
        
        // Process each section
        for (const section of sections) {
          // Process main section
          const mainChunks = splitTextIntoChunks(section.content);
          
          for (const [i, chunk] of mainChunks.entries()) {
            // Skip empty chunks
            if (!chunk.trim()) continue;
            
            // Add document
            documents.push({
              pageContent: chunk,
              metadata: {
                ...fileMetadata,
                source: file,
                sectionId: section.id,
                sectionTitle: section.title,
                chunk: i,
                chunkCount: mainChunks.length
              }
            });
            
            // Generate embedding for chunk
            const embedding = await generateEmbedding(chunk);
            if (embedding && embedding.length > 0) {
              documentEmbeddings.push(embedding);
            } else {
              console.error(`Failed to generate embedding for chunk ${i} in ${file}`);
              // Add a placeholder embedding for consistency
              documentEmbeddings.push([]);
            }
          }
          
          // Process subsections separately
          for (const subsection of section.subsections) {
            const subChunks = splitTextIntoChunks(subsection.content);
            
            for (const [i, chunk] of subChunks.entries()) {
              // Skip empty chunks
              if (!chunk.trim()) continue;
              
              // Add document
              documents.push({
                pageContent: chunk,
                metadata: {
                  ...fileMetadata,
                  source: file,
                  sectionId: subsection.id,
                  sectionTitle: subsection.title,
                  parentSectionId: section.id,
                  parentSectionTitle: section.title,
                  chunk: i,
                  chunkCount: subChunks.length
                }
              });
              
              // Generate embedding for chunk
              const embedding = await generateEmbedding(chunk);
              if (embedding && embedding.length > 0) {
                documentEmbeddings.push(embedding);
              } else {
                console.error(`Failed to generate embedding for subsection chunk ${i} in ${file}`);
                // Add a placeholder embedding for consistency
                documentEmbeddings.push([]);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
      }
    }
    
    console.log(`Finished processing documents. Total chunks indexed: ${documents.length}`);
    
    return { 
      success: true, 
      count: documents.length
    };
  } catch (error) {
    console.error('Error processing documents:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @returns {number} - Similarity score
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

/**
 * Search for similar documents
 * @param {string} query - Query to search for
 * @param {number} k - Number of results to return
 * @returns {Promise<Array>} - Array of documents
 */
async function similaritySearch(query, k = 5) {
  try {
    console.log(`Searching for documents similar to: "${query}"`);
    
    // Check if documents have been processed
    if (documents.length === 0) {
      console.log('No documents processed yet. Processing documents...');
      await processDocuments();
      
      // If still no documents, return empty array
      if (documents.length === 0) {
        console.error('No documents available for search');
        return [];
      }
    }
    
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding || queryEmbedding.length === 0) {
      console.error('Failed to generate embedding for query');
      return [];
    }
    
    // Calculate similarities
    const similarities = documentEmbeddings.map((docEmbedding, index) => ({
      document: documents[index],
      score: cosineSimilarity(queryEmbedding, docEmbedding)
    }));
    
    // Sort by score (descending)
    const sortedResults = similarities
      .filter(item => item.score > 0) // Filter out zero scores
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
    
    console.log(`Found ${sortedResults.length} relevant documents`);
    
    // Return documents
    return sortedResults.map(item => ({
      ...item.document,
      score: item.score
    }));
  } catch (error) {
    console.error('Error in similarity search:', error);
    return [];
  }
}

/**
 * Load or create vector store
 * @returns {Promise<Object>} - Vector store object
 */
async function loadOrCreateVectorStore() {
  // If no documents have been processed, do so now
  if (documents.length === 0) {
    await processDocuments();
  }
  
  return {
    documents,
    documentEmbeddings,
    similaritySearch
  };
}

module.exports = {
  processDocuments,
  loadOrCreateVectorStore,
  similaritySearch,
  generateEmbedding
};