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
const { RetrievalQAChain } = require("langchain/chains");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { ChatOpenAI } = require("langchain/chat_models/openai");

// 1. Import document loaders for different file formats
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
//const { JSONLoader } = require("langchain/document_loaders/fs/json");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { CSVLoader } = require("langchain/document_loaders/fs/csv");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { UnstructuredLoader }  = require("langchain/document_loaders/fs/unstructured");
const { PromptTemplate } = require("langchain/prompts");
const { ConversationalRetrievalQAChain } = require("langchain/chains");
const { BufferMemory } = require("langchain/memory");

const { ChatMessageHistory } = require("langchain/memory");
const { HumanMessage, AIMessage, SystemMessage } = require("langchain/schema");  
const { DocxLoader } = require("langchain/document_loaders/fs/docx");
const CANVAS_API_URL = 'https://canvas.instructure.com/api/v1';
const { htmlToText } = require('html-to-text');
app.use(cors());

let vectorStore;
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

async function downloadFile(course_id, url, canvas_api_token) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    headers: {
      Authorization: `Bearer ${canvas_api_token}`
    }
  });

 // console.log(response);
  
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
  const { course_id, messages} = req.query;
  const VECTOR_STORE_PATH = `coursesVectorStore/${course_id}`;

  
  try {
    const pastMessages = messages.map((msg) => {
      if (msg.sender === "user") {
        return new HumanMessage(msg.message);
      } else if (msg.sender === "assistant") {
        return new AIMessage(msg.message);
      } else {
        return new SystemMessage(msg.message);
      }
    });

    const template = `You are a helpful Canvas AI that has access on numerous documents for a specifc course taken by
    a student in an school platform called Canvas. Students will come to you to query specific questions about the course, and you will use your
    knowledge base of the provided student Canvas documents to respond with a highly detailed and helpful answer to the student. Do not be vague,
    nor deny the student's request, nor send them to an external source. Use your student document knowledge base to best help the student, and make
    sure to base your answers from your document base, and
    {context}
    Question: {question}
    Helpful Answer:`;
    const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo",openAIApiKey: "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"});
    vectorStore = await HNSWLib.load(
      VECTOR_STORE_PATH,
      new OpenAIEmbeddings({openAIApiKey: "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",
      verbose: true})
    );

  
   // console.log("hell??")
    const memory = new BufferMemory({
      memoryKey: "chat_history",
      chatHistory: new ChatMessageHistory(pastMessages),
      returnMessages: true
    });

    /*
    const chain = ConversationalRetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
      prompt: PromptTemplate.fromTemplate(template),
      returnSourceDocuments: true,
      memory,

    });
    */
    const fasterModel = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      openAIApiKey: "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"
    });
    const slowerModel = new ChatOpenAI({
      modelName: "gpt-4",
      openAIApiKey: "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"
    });
   const chain = ConversationalRetrievalQAChain.fromLLM(
    slowerModel,
    vectorStore.asRetriever(),
    {
      returnSourceDocuments: true,
      memory: new BufferMemory({
        memoryKey: "chat_history",
        inputKey: "question", // The key for the input to the chain
        outputKey: "text", // The key for the final conversational output of the chain
        returnMessages: true, // If using with a chat model (e.g. gpt-3.5 or gpt-4)
      }),
      questionGeneratorChainOptions: {
        llm: fasterModel,
      },
    }
  );
    const result = await chain.call({
      question: messages[messages.length-1].message
    });
    console.log(result);
    
    /*
    const memory = new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
      chatHistory: new ChatMessageHistory(pastMessages),
    });

    const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo",openAIApiKey: "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"});
    */
   

   
    /*
    const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
      prompt: PromptTemplate.fromTemplate(template),
      returnSourceDocuments: true
    });
    */
   /*
    const chain = ConversationalRetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
      prompt: PromptTemplate.fromTemplate(template),
      returnSourceDocuments: true,
      memory
    });

    const response = await chain.call({
      question: `${messages[messages.length-1].message}`
    });
    */
    const newMessages = [
      ...messages,
      { message: result.text, sender: "assistant", direction: "incoming" }
    ];

     
      // res.send("My name is Jeff Bezos"); // Don't use res.send() here if you plan to use res.json() later

      res.status(200).send(newMessages);

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

  
  const vectorStoreState = path.join(__dirname, `coursesVectorStore/${course_id}`);

  
  if(fs.existsSync(vectorStoreState)) {
    res.send('we are done boy thats on elon');
    return;
  }
  
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
    

    /*
    const modules = await axios.get("http://localhost:3500/getModuleData", {
        params: {
          course_id: course_id,
          canvas_api_token: canvas_api_token
        }
      })
      */
     const files = await axios.get("http://localhost:3500/getFiles", {
         params: {
           course_id: course_id,
           canvas_api_token: canvas_api_token
         }
       })
    
    
    const syllabusText = htmlToText(syllabus.data.syllabus, {
      wordWrap: 130
    });

    //const modulesJsonString = JSON.stringify(modules.data,null,2); 
    
    const directoryPath = path.join(__dirname, `coursesData/${course_id}`);
    const vectorDatabasePath = path.join(__dirname, `coursesVectorStore/${course_id}`);
    

    const syllabusFilePath = path.join(directoryPath, 'syllabus.txt');
    //const modulesFilePath = path.join(directoryPath, 'modules.json');
    
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
    fs.writeFile(syllabusFilePath, syllabusText, function(err) {
      if(err) {
          return console.log(err);
      }
      console.log("The Text file was saved!");
  });

  
   // fs.writeFileSync(modulesFilePath, modulesJsonString);
     console.log(files)
     for (const file of files.data.urls) {
       await downloadFile(course_id, file, canvas_api_token);
     }


     const options = {
      apiKey: "yPnRhsNp8sYzmjJ2aL4JFiaPqo8T1G",
    };

    const loader = new DirectoryLoader(directoryPath, {
      ".json": (path) => new JSONLoader(path),
      ".txt": (path) => new TextLoader(path),
      ".csv": (path) => new CSVLoader(path),
      ".pdf": (path) => new PDFLoader(path),
      ".docx":  (path) => new DocxLoader(path),
      ".html": (path) => new UnstructuredLoader(path,options),
      ".pptx": (path) => new UnstructuredLoader(path,options)
    });
    
    const docs = await loader.load();
    
    
    const VECTOR_STORE_PATH = vectorDatabasePath;
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000,
      chunkOverlap: 200
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
   
   //res.send('bin chillin')
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
