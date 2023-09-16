//Squarepants@7west
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require("fs");
const path = require('path');
const app = express();

//syllabus, modules, pages, files
// const thisIsSaisToken = 'Bearer 1016~Gkgpf5ZYLq6OW13oDzRVkazWyVCnnzGRDwCWw9ykPYMqkQe0RqkaqWOnzKv4HWCb';

const { JSONLoader } = require("langchain/document_loaders/fs/json");
const { OpenAI } = require("langchain/llms/openai");
const { RetrievalQAChain } = require("langchain/chains");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { CheerioWebBaseLoader } = require("langchain/document_loaders/web/cheerio");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");

// 1. Import document loaders for different file formats
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
//const { JSONLoader } = require("langchain/document_loaders/fs/json");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { CSVLoader } = require("langchain/document_loaders/fs/csv");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { UnstructuredLoader }  = require("langchain/document_loaders/fs/unstructured");
const { PromptTemplate } = require("langchain/prompts");

const loader = new DirectoryLoader("./documents", {
  ".json": (path) => new JSONLoader(path),
  ".txt": (path) => new TextLoader(path),
  ".csv": (path) => new CSVLoader(path),
  ".pdf": (path) => new PDFLoader(path),
  ".html": (path) => new UnstructuredLoader(path),
  ".pptx": (path) => new UnstructuredLoader(path)
});

let vectorStore;

const CANVAS_API_URL = 'https://canvas.instructure.com/api/v1';
app.use(cors());


//(Test): This is just for grabbing the current classes 
/*
  Example Courses:
  "courseIds": [
        10160000000458756 (error),
        10160000000453772 (no permission),
        10160000000471300 (working),
        10160000000486056,
        10160000000487242,
        10160000000456078,
        10160000000464024,
        10160000000471516,
        10160000000488680
    ]
*/


// 8. Define a function to normalize the content of the documents
function normalizeDocuments(docs) {
  return docs.map((doc) => {
    if (typeof doc.pageContent === "string") {
      return doc.pageContent;
    } else if (Array.isArray(doc.pageContent)) {
      return doc.pageContent.join("\n");
    }
  });
}

// API to get module data for a specific course.
app.get('/getModuleData', async (req, res) => {
  const { course_id, canvas_api_token } = req.query; // Extract parameters from the query.

  if (!course_id || !canvas_api_token) {
    return res.status(400).json({ error: 'course_id and canvas_api_token are required' });
  }

  try {
    const response = await axios.get(`https://canvas.instructure.com/api/v1/courses/${course_id}/modules?include[]=items`, {
      headers: {
        Authorization: `Bearer ${canvas_api_token}`
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error(`Error fetching modules: ${error}`);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

app.get('/getCourseIds', async (req, res) => {
  const canvas_api_token = req.query.canvas_api_token;
  
  if (!canvas_api_token) {
    return res.status(400).json({ error: 'canvas_api_token is required' });
  }

  try {
    const response = await axios.get(`${CANVAS_API_URL}/courses`, {
      headers: {
        'Authorization': `Bearer ${canvas_api_token}`
      }
    });

    const courseIds = response.data.map(course => course.id);
    return res.json({ courseIds });

  } catch (error) {
    console.error('Error fetching course IDs:', error);
    return res.status(500).json({ error: 'Failed to fetch course IDs' });
  }
});

app.get('/getSyllabus', async (req, res) => {
  const courseId = req.query.courseId;
  const canvas_api_token = req.query.canvas_api_token;

  console.log(courseId);
  console.log(canvas_api_token);
  if (!courseId || !canvas_api_token) {
    return res.status(400).json({ error: 'courseId and canvas_api_token are required' });
  }

  try {
    const response = await axios.get(`${CANVAS_API_URL}/courses/${courseId}?include[]=syllabus_body`, {
      headers: {
        'Authorization': `Bearer ${canvas_api_token}`
      }
    });
    return res.json({ syllabus: response.data.syllabus_body });
  } catch (error) {
    console.error('Error fetching syllabus:', error);
    res.status(200).json({ message: "No syllabus available" });
  }
}); 

app.get('/createDatabase', async (req, res) => {
  const { course_id, canvas_api_token } = req.query;

  if (!course_id || !canvas_api_token) {
    return res.status(400).json({ error: 'course_id and canvas_api_token are required' });
  }

  try {

    const [syllabus, modules] = await Promise.all([
      axios.get("http://localhost:3500/getSyllabus"),
      axios.get("http://localhost:3500/getModuleData"),
    ]);

    console.log(syllabus);
    console.log(modules);
    /*
    const syllabusJsonString = JSON.stringify(syllabus, null, 2);
    const modulesJsonString = JSON.stringify(modules,null,2); 

    const directoryPath = path.join(__dirname, `coursesData/${course_id}`);

    const syllabusFilePath = path.join(directoryPath, 'syllabus.json');
    const modulesFilePath = path.join(directoryPath, 'modules.json');
    
    // Make sure the directory exists, and if not, create it
    if (!fs.existsSync(directoryPath)){
      fs.mkdirSync(directoryPath, { recursive: true });
    }

    // Write the JSON string to a file
    fs.writeFileSync(syllabusFilePath, syllabusJsonString);
    fs.writeFileSync(modulesFilePath, modulesJsonString);

    const docs = await loader.load();

    const VECTOR_STORE_PATH = directoryPath;

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
    });

    const normalizedDocs = normalizeDocuments(docs);
    const splitDocs = await textSplitter.createDocuments(normalizedDocs);

    vectorStore = await HNSWLib.fromDocuments(
      splitDocs,
      new OpenAIEmbeddings({openAIApiKey: "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",
      verbose: true // Optional, set to true if you want verbose logging)
  }));


   // have to fix the "error" start
    */
  } 
  catch (error) {
    console.error(`Error creating database: ${error}`);
    res.status(500).json({ error: 'Failed to create database' });
  }
});



// need to make an api
//   -> "/getSyllabus   public description"
//   -> "/getSyllabus (req,res) (Done)"
//        -> given courseID
//        -> return html 
//   -> "/getModules" 
//   -> "/getPages"
//   -> "/getFiles"
//        -> return url
//        -> turn url into pdf
//      
//  -> "/createCourseDatabase(req,res)"
//       -> first grab syallbus, modules,dpages, and files
//       -> if the couseIDFile Does not exist
  //       -> create database under coursesData and name the data-file with the course-id
  //       -> we will store the 
// -> "/queryDatabase"
//    -> req -> will be just some JSON messages
//    -> res -> will also be a json

// Start the server
app.listen(3500, () => {
  console.log('Server running on port 3500'); // Console log to indicate server is running
});
