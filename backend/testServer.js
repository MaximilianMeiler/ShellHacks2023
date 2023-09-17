async function downloadFile() {
  const url = 'https://canvas.instructure.com/files/1016~80585537/download?download_frd=1&verifier=1R6quKLUODW93a6hKJStdbuXBhtEHcqPKIsDKkI2';
  const outputPath = path.resolve(__dirname, 'output2.pdf'); // Change the output path as needed

  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream', // This is crucial for downloading binary files like PDFs
  });

  const writer = fs.createWriteStream(outputPath);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

app.get('/loadDocuments', async (req,res) => {
  
  //I need to know the coureID in the request
  
  //make api call to get the current course syllabu

  //make api call to get the current discussions
  
  //make api calls to get a specfic file 

  //api call to announcments

  
  const options = {
    apiKey: "yPnRhsNp8sYzmjJ2aL4JFiaPqo8T1G",
  };
  
  const loader = new UnstructuredLoader(
    "./documents/output2.pdf",
    options
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
  //const relevantDocs = await vectorStore.similaritySearch("What is step 2 from the Terminal Topic?");

  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo",openAIApiKey: "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"});

const template = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
You have a one in hundred chance to speak in Pirate lingo, in that case make whatever you want, have fun. 
Otherwise, be as specfic as possible, use your knowledge source, and provide a highly intelligent and detailed 
response to the query. Try to cite your sources, and think before you respond. 
{context}
Question: {question}
Helpful Answer:`;

const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
  prompt: PromptTemplate.fromTemplate(template),
});

const response = await chain.call({
  query: "Summarize the postfixed notation problem?"
});
  
  res.send(response);
  console.log(relevantDocs.length);
  res.send(relevantDocs)
  
  
})

//app.get('/ query')
app.get('/langBoi', async (req, res) => {
  //const studentToken = req.query.studentToken; // Fetching the student token from query parameters
 
  const loader = new CheerioWebBaseLoader(
    "https://canvas.instructure.com/files/1016~80585537/download?download_frd=1&verifier=1R6quKLUODW93a6hKJStdbuXBhtEHcqPKIsDKkI2"
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

  //const relevantDocs = await vectorStore.similaritySearch("What is the time complexity of this solution?");


const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo",openAIApiKey: "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"});

const template = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Use three sentences maximum and keep the answer as concise as possible.
Always say "thanks for asking!" at the end of the answer.
{context}
Question: {question}
Helpful Answer:`;

const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
  prompt: PromptTemplate.fromTemplate(template),
});

const response = await chain.call({
  query: "Summarize this document?"
});
  
  res.send(response);

});


// API endpoint to fetch courses from Canvas
app.get('/courses', async (req, res) => {
  const studentToken = req.query.key; // Fetching the student token from query parameters
 
  console.log(studentToken);
  //res.send("hello")
  
  try {
    console.log(studentToken);
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
