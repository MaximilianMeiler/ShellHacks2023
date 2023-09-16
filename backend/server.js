//Squarepants@7west
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require("fs");
const path = require('path');
const app = express();

//syllabus, modules, pages, files
// const thisIsSaisToken = 'Bearer 1016~Gkgpf5ZYLq6OW13oDzRVkazWyVCnnzGRDwCWw9ykPYMqkQe0RqkaqWOnzKv4HWCb';

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
const { UnstructuredLoader }  = require("langchain/document_loaders/fs/unstructured");
const { PromptTemplate } = require("langchain/prompts");

const loader = new DirectoryLoader("./documents", {
  ".json": (path) => new JSONLoader(path),
  ".txt": (path) => new TextLoader(path),
  ".csv": (path) => new CSVLoader(path),
  ".pdf": (path) => new PDFLoader(path),
});
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


// API to get module data for a specific course.
app.get('/getModuleData', async (req, res) => {
  const { course_id, canvas_api_token } = req.query; // Extract parameters from the query.

  if (!course_id || !canvas_api_token) {
    return res.status(400).json({ error: 'course_id and canvas_api_token are required' });
  }

  //console.log(`https://canvas.instructure.com/api/v1/courses/${course_id}/modules?include[]=items`);
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

// API endpoint to load course documents into LangChain
app.post('/loadCourse/', async (req, res) => {
  const canvasKey = req.body.key;
  const courseId = req.body.courseId;
  if (!canvasKey || !courseId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  await fs.writeFile(`backend/${canvasKey}.txt`, courseId);
  res.sendStatus(201);
});

// API endpoint to get course syllabus
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

// API to get module data for a specific course.
app.get('/getModuleData', async (req, res) => {
  const { course_id, canvas_api_token } = req.query; // Extract parameters from the query.

  if (!course_id || !canvas_api_token) {
    return res.status(400).json({ error: 'course_id and canvas_api_token are required' });
  }

  try {
    const response = await axios.get(`https://your-canvas-instance/api/v1/courses/${course_id}/modules?include[]=items`, {
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
// need to make an api
//   -> "/getSyllabus public description"
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
