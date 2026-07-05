import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import PanelPage from './PanelPage.tsx'
import ResearchLabPage from './ResearchLabPage.tsx'
import Login from './Login.tsx'
import Signup from './Signup.tsx'
import RequireAuth from './RequireAuth.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<RequireAuth><App /></RequireAuth>} />
        <Route path="/panel/:session_id" element={<RequireAuth><PanelPage /></RequireAuth>} />
        <Route path="/research-lab/:project_id" element={<RequireAuth><ResearchLabPage /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
