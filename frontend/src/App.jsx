import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Overview from "./views/Overview.jsx"
import Patients from "./views/Patients.jsx"
import Microgrid from "./views/Microgrid.jsx"
import Departments from "./views/Departments.jsx"
import Alerts from "./views/Alerts.jsx"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Overview />} />
        <Route path="/patients"    element={<Patients />} />
        <Route path="/microgrid"   element={<Microgrid />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/alerts"      element={<Alerts />} />
        {/* Catch-all: redirect unknown paths to overview */}
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
