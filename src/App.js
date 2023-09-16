import './App.css';
import {useEffect, useState} from "react";
import axios from "axios";



function App() {
  const [key, setKey] = useState(localStorage.getItem("key") === null ? "" : localStorage.getItem("key"));


  const submitKey = () => {
    setKey(document.getElementById("keyField").value);
    localStorage.setItem("key", document.getElementById("keyField").value)
    document.getElementById("keyField").value = "";
    window.scrollTo(0,window.innerHeight * 1/100)   // this is an offense against god
    setTimeout(() => {
      window.scrollTo(0,window.innerHeight * 2/100)
      setTimeout(() => {
        window.scrollTo(0,window.innerHeight * 3/100)
        setTimeout(() => {
          window.scrollTo(0,window.innerHeight * 4/100)
          setTimeout(() => {
            window.scrollTo(0,window.innerHeight * 5/100)
            setTimeout(() => {
              window.scrollTo(0,window.innerHeight * 6/100)
              setTimeout(() => {
                window.scrollTo(0,window.innerHeight * 7/100)
                setTimeout(() => {
                  window.scrollTo(0,window.innerHeight * 8/100)
                }, 5)
              }, 4)
            }, 3)
          }, 2)
        }, 3)
      }, 4)
    }, 5)

    fetchCourses();
  }

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [courseId, setCourseId] = useState();

  const fetchCourses = async () => {
    setLoading(true);
    try {
      // Replace with your Node.js API URL and student token
      const response = await axios.get(`http://localhost:3500/courses/`, {params: {"key" : key}});
      console.log(response.data); 
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
    console.log(courses);
  };

  return (
    <div className="App" id="App">
      <header className="AppHeader">
        <p className="keyText">
          Enter Canvas API key:
        </p>
        <input type="text" id="keyField" placeholder={key}></input>
        <button className="submitKeyButton" onClick={() => submitKey()}>Submit</button>

      </header>


      <div className="canvasDisplay">
        <h1>Canvas Courses</h1>
        {/* <button onClick={fetchCourses}>
          Fetch Courses
        </button> */}

        {loading ? <p>Loading...</p> : <></>}

        <select onChange={(e) => setCourseId(e.target.selectedIndex)}>
          {courses.map((course) => (
            <option>{course.name}</option>
          ))}
        </select>

        {courseId >= 0 ? 
        <ul>
          <li key={courseId}>
          {courses[courseId].name}
          <div dangerouslySetInnerHTML={{ __html: courses[courseId].syllabus_body || 'No syllabus available' }} />
          </li>
        </ul>
        : <></>}
      </div>
    </div>
  );
}

export default App;
