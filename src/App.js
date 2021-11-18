import logo from './logo.svg';
import { Reflections } from './reflections';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>
          <img src={logo} className="App-logo" alt="logo" />
          Crypto Reflections
        </h1>
      </header>
      <Reflections />
    </div>
  );
}

export default App;
