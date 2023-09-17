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
const { ChatOpenAI } = require("langchain/chat_models/openai");

// 1. Import document loaders for different file formats
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
//const { JSONLoader } = require("langchain/document_loaders/fs/json");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { CSVLoader } = require("langchain/document_loaders/fs/csv");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { UnstructuredLoader }  = require("langchain/document_loaders/fs/unstructured");
const { PromptTemplate } = require("langchain/prompts");


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

async function downloadFile(course_id, url) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
  });

  const contentType = response.headers['content-type'];
  let fileType = null;
  
  if (contentType === 'application/pdf') {
    fileType = 'pdf';
  } else if (contentType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    fileType = 'pptx';
  } else {
    console.log('Skipping file with unsupported content type:', contentType);
    return;
  }

  const contentDisposition = response.headers['content-disposition'];
  let fileName = 'unknown';
  
  if (contentDisposition) {
    const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (matches && matches.length > 1) {
      fileName = matches[1].replace(/['"]/g, ''); // Remove quotes
    }
  }

  // Ensure the directory exists
  const dirPath = path.resolve(__dirname, `coursesData/${course_id}`);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  const outputPath = path.join(dirPath, `${fileName}.${fileType}`);
  const writer = fs.createWriteStream(outputPath);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

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

    const courseNames = response.data.map(course => course.name);
    const courseIds = response.data.map(course => course.id);
    return res.json({ courseNames, courseIds });

  } catch (error) {
    console.error('Error fetching course IDs:', error);
    return res.status(500).json({ error: 'Failed to fetch course IDs' });
  }
});

// API endpoint to load course documents into LangChain
app.post('/loadCourse', async (req, res) => {
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

app.get('/queryDatabase', async (req, res) => {
  const { course_id, question} = req.query;
  const VECTOR_STORE_PATH = `coursesVectorStore/${course_id}`;

  try {
    const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo",openAIApiKey: "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"});
    vectorStore = await HNSWLib.load(
      VECTOR_STORE_PATH,
      new OpenAIEmbeddings({openAIApiKey: "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",
      verbose: true})
    );

    const template = `You are a helpful Canvas AI guide to an interface for students work with school 
    documents and orgnaizes student info. Use the following pieces of context to answer the question at the end.
    If you don't know the answer, just say that you don't know, don't try to make up an answer. Only use the following information provided to form 
    your answer, do not use any outside or prior knowledge.
    Be as specfic as possible, use your knowledge source from the vector database, and provide a highly intelligent yet concise
    response to the query. Provide information specific to the course, do not give general advice, and specfically give information regarding
    the course in hand.
    {context}
    Question: {question}
    Helpful Answer:`;
    
    const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
      prompt: PromptTemplate.fromTemplate(template),
      returnSourceDocuments: true
    });
    
    const response = await chain.call({
      query: `${question}`
    });
      

      console.log(response);
      // res.send("My name is Jeff Bezos"); // Don't use res.send() here if you plan to use res.json() later

      res.status(200).json({
          success: true,
          message: "We are chilling"
      });

  } catch (error) {
      console.error("Error:", error);
      res.status(500).json({
          success: false,
          message: "Error"
      });
  }
});

app.get('/createDatabase', async (req, res) => {
  const { course_id, canvas_api_token } = req.query;

  if (!course_id || !canvas_api_token) {
    return res.status(400).json({ error: 'courseId and canvas_api_token are required' });
  }

  try {

    console.log("bro help me please")

    
    const syllabus = await axios.get("http://localhost:3500/getSyllabus", {
        params: {
          courseId: course_id,
          canvas_api_token: canvas_api_token
        }
      })
    

    const modules = await axios.get("http://localhost:3500/getModuleData", {
        params: {
          course_id: course_id,
          canvas_api_token: canvas_api_token
        }
      })

    const files = await axios.get("http://localhost:3500/getFiles", {
        params: {
          course_id: course_id,
          canvas_api_token: canvas_api_token
        }
      })
    //console.log(modules);
    //console.log(syllabus);
    //res.json("yolo");
    
    //console.log(syllabus.data.syllabus);
    
    const syllabusHTML = syllabus.data.syllabus;
    const modulesJsonString = JSON.stringify(modules.data,null,2); 
    
    const directoryPath = path.join(__dirname, `coursesData/${course_id}`);
    const vectorDatabasePath = path.join(__dirname, `coursesVectorStore/${course_id}`);
    

    const syllabusFilePath = path.join(directoryPath, 'syllabus.html');
    const modulesFilePath = path.join(directoryPath, 'modules.json');
    
    //console.log(syllabusFilePath);
    //console.log(modulesFilePath);
    
    // Make sure the directory exists, and if not, create it
    if (!fs.existsSync(directoryPath)){
      fs.mkdirSync(directoryPath, { recursive: true });
    }
    if (!fs.existsSync(vectorDatabasePath)){
      fs.mkdirSync(vectorDatabasePath, { recursive: true });
    }
    
    // Write the JSON string to a file
    fs.writeFile(syllabusFilePath, syllabusHTML, function(err) {
      if(err) {
          return console.log(err);
      }
      console.log("The HTML file was saved!");
  });
    fs.writeFileSync(modulesFilePath, modulesJsonString);
    
    for (const file of files.data.urls) {
      await downloadFile(course_id, file);
    }

    const loader = new DirectoryLoader(directoryPath, {
      ".json": (path) => new JSONLoader(path),
      ".txt": (path) => new TextLoader(path),
      ".csv": (path) => new CSVLoader(path),
      ".pdf": (path) => new PDFLoader(path),
      ".html": (path) => new UnstructuredLoader(path),
      ".pptx": (path) => new UnstructuredLoader(path)
    });

    const docs = await loader.load();
    
    
    const VECTOR_STORE_PATH = vectorDatabasePath;
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

  await vectorStore.save(VECTOR_STORE_PATH);
   // have to fix the "error" start
    
   res.send('Ma Name is Eron Mux')
   
  } 
  catch (error) {
    console.error(`Error creating database: ${error}`);
    res.status(500).json({ error: 'Failed to create database' });
  }
});

app.get('/getPages', async (req, res) => {
  const courseId = req.query.courseId;
  const canvas_api_token = req.query.canvas_api_token;

  if (!courseId || !canvas_api_token) {
    return res.status(400).json({ error: 'courseId and canvas_api_token are required' });
  }

  try {
    const response = await axios.get(`${CANVAS_API_URL}/courses/${courseId}/pages?include[]=body`, {
      headers: {
        'Authorization': `Bearer ${canvas_api_token}`
      }
    });
    const data = response.data.map(page => page.body);
    return res.json({data});
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(200).json({ message: "No pages available" });
  }
});

app.get('/getFiles', async (req, res) => {
  const courseId = req.query.course_id;
  const canvas_api_token = req.query.canvas_api_token;

  if (!courseId || !canvas_api_token) {
    return res.status(400).json({ error: 'courseId and canvas_api_token are required' });
  }

  try {
    const response = await axios.get(`${CANVAS_API_URL}/courses/${courseId}/files`, {
      headers: {
        'Authorization': `Bearer ${canvas_api_token}`
      }
    });
    const urls = response.data.map(file => file.url);
    return res.json({ urls });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(200).json({ message: "No files available" });
  }
});


// need to make an api
//   -> "/getSyllabus   public description"
//   -> "/getSyllabus (req,res) (Done)"
//        -> given courseID
//        -> return html 
//   -> "/getModules (Done)" 
//   -> "/getPages"
//   -> "/getFiles"
//   -> "/assignments"
//        -> return url
//        -> turn url into pdf
//   -> "/rubrics"
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
