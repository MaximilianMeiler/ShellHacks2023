import './App.css';
import {useEffect, useState} from "react";



function App() {
  const [key, setKey] = useState(localStorage.getItem("key") === null ? "" : localStorage.getItem("key"));


  const submitKey = () => {
    setKey(document.getElementById("keyField").value);
    localStorage.setItem("key", document.getElementById("keyField").value)
  }



  return (
    <div className="App">
      <header className="App-header">
        <p className="keyText">
          Enter Canvas API key:
        </p>
        <input type="text" id="keyField" placeholder={key}></input>
        <button className="submitKeyButton" onClick={() => submitKey()}>Submit</button>

      </header>
    </div>
  );
}

export default App;
