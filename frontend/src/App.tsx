import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UnitList from './pages/Archive/Units/UnitList'
import CadreList from './pages/Archive/Cadres/CadreList'
import KnowledgeList from './pages/Archive/Knowledge/KnowledgeList'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="archive/units" element={<UnitList />} />
        <Route path="archive/cadres" element={<CadreList />} />
        <Route path="archive/knowledge" element={<KnowledgeList />} />
      </Route>
    </Routes>
  )
}

export default App
