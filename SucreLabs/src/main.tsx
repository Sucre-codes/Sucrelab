import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import PanelPage from './PanelPage.tsx'
import ResearchLabPage from './ResearchLabPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/panel/:session_id" element={<PanelPage />} />
        <Route path="/research-lab/:project_id" element={<ResearchLabPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
