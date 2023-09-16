import './App.css';
import { useEffect, useState, Link } from "react";
import axios from "axios";
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import { MainContainer, ChatContainer, MessageList, Message, MessageInput, TypingIndicator } from '@chatscope/chat-ui-kit-react';

function App() {
  document.title = "NaviGator";
  const [canvasKey, setCanvasKey] = useState(localStorage.getItem("canvasKey") === null ? "" : localStorage.getItem("canvasKey"));
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentCourseIndex, setCurrentCourseIndex] = useState();
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("canvasKey") && localStorage.getItem("canvasKey").length > 0) {
      fetchCourses();
    }
  }, []);

  const submitCanvasKey = () => {
    setCanvasKey(document.getElementById("canvasKeyField").value);
    localStorage.setItem("canvasKey", document.getElementById("canvasKeyField").value)
    document.getElementById("canvasKeyField").value = "";

    window.scrollTo(0, window.innerHeight * 1 / 100)   // this is an offense against god
    setTimeout(() => {
      window.scrollTo(0, window.innerHeight * 2 / 100)
      setTimeout(() => {
        window.scrollTo(0, window.innerHeight * 3 / 100)
        setTimeout(() => {
          window.scrollTo(0, window.innerHeight * 4 / 100)
          setTimeout(() => {
            window.scrollTo(0, window.innerHeight * 5 / 100)
            setTimeout(() => {
              window.scrollTo(0, window.innerHeight * 6 / 100)
              setTimeout(() => {
                window.scrollTo(0, window.innerHeight * 7 / 100)
                setTimeout(() => {
                  window.scrollTo(0, window.innerHeight * 8 / 100)
                }, 5)
              }, 4)
            }, 2)
          }, 1)
        }, 2)
      }, 4)
    }, 5)

    fetchCourses();
  }

  const fetchCourses = async () => {
    setLoading(true);

    try {
      // Replace with your Node.js API URL and student token
      const response = await axios.get(`http://localhost:3500/courses/`, {
        params: {
          "key": localStorage.getItem("canvasKey")
        }
      });
      console.log(response.data);
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }

    setLoading(false);
    console.log(courses);
  };

  const handleSelectNewCourse = async (newCurrentCourseIndex) => {
    console.log(courses)
    console.log(newCurrentCourseIndex)
    console.log(courses[newCurrentCourseIndex].name)
    // Set messages to empty
    setMessages([
      {
        message: 'Hello, how can I help you?',
        sender: 'Navigator'
      }
    ]);
    // Set course id
    setCurrentCourseIndex(newCurrentCourseIndex);
  };

  const handleSend = async (message) => {
    const newMessage = {
      message: message,
      sender: 'user',
      direction: 'outgoing'
    };

    const newMessages = [...messages, newMessage]; // Add new message to messages array

    // Update messages state
    setMessages(newMessages);

    // Set typing indicator
    setTyping(true);

    // Send message to backend
    await processMessage(newMessages);
  };

  async function processMessage(chatMessages) {

    let apiMessages = chatMessages.map((messageObject) => {
      let role = messageObject.sender === 'user' ? 'user' : 'assistant';
      return {
        role: role,
        content: messageObject.message
      }
    });

    const systemMessage = {
      role: 'system',
      content: 'Your name is Navigator. Explain all concepts like I am a student in this class.'
    }

    const apiRequestBody = {
      'model': 'gpt-3.5-turbo',
      'messages': [systemMessage, ...apiMessages]
    }

    // !! Fix this with a real api call !!
    await fetch('http://localhost:3500/queryDatabase/', {
      method: "POST",
      apicanvasKey: localStorage.getItem("canvasKey"),
      currentCourseIndex: currentCourseIndex,
      body: JSON.stringify(apiRequestBody)
    }).then((data) => {
      return data.json()
    }).then((data) => {
      console.log(data);

      setMessages([...chatMessages, {
        message: 'navigator message',
        sender: 'NaviGator'
      }]);

      setTyping(false);
    });
  }

  return (
    <div className="App" id="App" >
      <header className="AppHeader">
        <p className="canvasKeyText">
          Enter
          <a className="canvasKeyTextLink" href="https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273" target="_blank" rel="noreferrer">
            Canvas Api Key:
          </a>
        </p>
        <input type="text" id="canvasKeyField" className="canvasKeyField" placeholder={canvasKey}></input>
        <button className="submitCanvasKeyButton" onClick={() => submitCanvasKey()}>Submit</button>
      </header>

      <div className="canvasDisplay">
        {loading ? <p>Loading...</p> : <></>}
        {courses.length > 0 ?
          <div>
            <h1>Canvas Courses</h1>
            <select className="classDropdown" onChange={(e) => handleSelectNewCourse(e.target.selectedIndex - 1)}>
              <option selected disabled hidden>Select a course</option>
              {courses.map((course) => (
                <option>{course.name}</option>
              ))}
            </select>


            {currentCourseIndex >= 0 ?
              <div className='chatBox'>
                {/* {courses[currentCourseIndex].name} */}
                {/* <div dangerouslySetInnerHTML={{ __html: courses[currentCourseIndex].syllabus_body || 'No syllabus available' }} /> */}
                <MainContainer >
                  <ChatContainer>
                    <MessageList
                      scrollBehavor='smooth'
                      typingIndicator={typing ? <TypingIndicator content="NaviGator is typing" /> : null}
                    >
                      {messages.map((message, i) => {
                        return <Message key={i} model={message} />
                      })}
                    </MessageList>
                    <MessageInput placeholder="Ask Navigator..." onSend={handleSend} attachButton={false} />
                  </ChatContainer>
                </MainContainer>
              </div>

              : <></>}
          </div>
          : <h1>No courses found!</h1>
        }

      </div>
    </div>
  );
}

export default App;
