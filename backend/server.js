//Squarepants@7west
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const studentToken = '1016~Gkgpf5ZYLq6OW13oDzRVkazWyVCnnzGRDwCWw9ykPYMqkQe0RqkaqWOnzKv4HWCb';

const { OpenAI } = require("langchain/llms/openai");
const { RetrievalQAChain } = require("langchain/chains");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { CheerioWebBaseLoader } = require("langchain/document_loaders/web/cheerio");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");

// 1. Import document loaders for different file formats
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
const { JSONLoader } = require("langchain/document_loaders/fs/json");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { CSVLoader } = require("langchain/document_loaders/fs/csv");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");



// Initialize Express App
const app = express();

// Middleware for handling CORS issues
app.use(cors());

app.get('/langBoi', async (req, res) => {
  //const studentToken = req.query.studentToken; // Fetching the student token from query parameters
 
  const loader = new CheerioWebBaseLoader(
    "https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm"
  );
  const data = await loader.load();
  
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 0,
  });
  
  const splitDocs = await textSplitter.splitDocuments(data);

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: "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",
    verbose: true // Optional, set to true if you want verbose logging
  });

  const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);

  const relevantDocs = await vectorStore.similaritySearch("What is the time complexity of this solution?");

  console.log(relevantDocs.length);
  res.send(relevantDocs)

});

// API endpoint to fetch courses from Canvas
app.get('/courses', async (req, res) => {
  console.log(req.params);
  // const studentToken = req.query.studentToken; // Fetching the student token from query parameters
 
  //res.send("hello")
  
  try {
    const response = await axios.get('https://canvas.instructure.com/api/v1/courses?include[]=syllabus_body', {
      headers: {
        Authorization: `Bearer ${studentToken}`, // Using the student token to authenticate API request
      },
    });
    return res.json(response.data); // Return fetched courses data
  } catch (error) {
    console.error('Error fetching courses:', error); // Log any errors
    return res.status(500).json({ error: 'An error occurred while fetching courses' }); // Return error message
  }
  
});

// Start the server
app.listen(3500, () => {
  console.log('Server running on port 3500'); // Console log to indicate server is running
});
