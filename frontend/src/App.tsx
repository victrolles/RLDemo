import './App.css'
import './pages/Inference.css'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Inference from './pages/Inference'
import Layout from './components/Layout'

function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route index element={<Home />} />
          <Route path="/inference/" element={<Inference />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}

export default App
