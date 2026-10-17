import './App.css'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home';
import Inference from './pages/Inference';

function App() {

  return (
    
    <Router>
      <Routes>
          <Route index element={<Home />} />
          <Route path="/inference/" element={<Inference />} />
      </Routes>
    </Router>
  );
}

export default App