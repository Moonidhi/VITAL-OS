import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Overview from './views/Overview.jsx'
import Patients from './views/Patients.jsx'
import Microgrid from './views/Microgrid.jsx'
import Departments from './views/Departments.jsx'
import Analytics from './views/Analytics.jsx'
import Alerts from './views/Alerts.jsx'

import { ToastProvider } from './components/Toast.jsx'
import ToastContainer from './components/Toast.jsx'
import PageTransition from './components/PageTransition.jsx'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PageTransition><Overview /></PageTransition>} />
          <Route path="/patients" element={<PageTransition><Patients /></PageTransition>} />
          <Route path="/microgrid" element={<PageTransition><Microgrid /></PageTransition>} />
          <Route path="/departments" element={<PageTransition><Departments /></PageTransition>} />
          <Route path="/analytics" element={<PageTransition><Analytics /></PageTransition>} />
          <Route path="/alerts" element={<PageTransition><Alerts /></PageTransition>} />
          {/* Catch-all: redirect unknown paths to overview */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer />
    </ToastProvider>
  )
}
