import './App.css';
import {useEffect, useState} from "react";
import axios from "axios";



function App() {
  const [key, setKey] = useState(localStorage.getItem("key") === null ? "" : localStorage.getItem("key"));


  const submitKey = () => {
    setKey(document.getElementById("keyField").value);
    localStorage.setItem("key", document.getElementById("keyField").value)
  }

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [courseId, setCourseId] = useState(-1);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      // Replace with your Node.js API URL and student token
      const response = await axios.get('http://localhost:3500/courses', {params: {key}});
      console.log(response.data); 
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
    console.log(courses);
  };

  return (
    <div className="App">
      <header className="App-header">
        <p className="keyText">
          Enter Canvas API key:
        </p>
        <input type="text" id="keyField" placeholder={key}></input>
        <button className="submitKeyButton" onClick={() => submitKey()}>Submit</button>

      </header>


      <div>
        <h1>Canvas Courses</h1>
        <button onClick={fetchCourses}>
          Fetch Courses
        </button>

        {loading ? <p>Loading...</p> : <></>}

        <select onChange={(e) => console.log(e.target.selectedIndex)}>
          {courses.map((course) => (
            <option>{course.name}</option>
          ))}
        </select>


        <ul>
          {courses.map((course, index) => (
            <li key={index}>
            {course.name}
            <div dangerouslySetInnerHTML={{ __html: course.syllabus_body || 'No syllabus available' }} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
