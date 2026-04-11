import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UnitList from './pages/Archive/Units/UnitList'
import CadreList from './pages/Archive/Cadres/CadreList'
import KnowledgeList from './pages/Archive/Knowledge/KnowledgeList'
import PlanList from './pages/Plan/Plans/PlanList'
import GroupList from './pages/Plan/Groups/GroupList'
import DraftList from './pages/Execution/Drafts/DraftList'
import ClueList from './pages/Execution/Clues/ClueList'
import RectificationList from './pages/Execution/Rectifications/RectificationList'
import UserList from './pages/Admin/Users/UserList'
import AuditLog from './pages/Admin/Audit/AuditLog'
import ModuleConfig from './pages/Admin/Modules/ModuleConfig'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        {/* 档案管理 */}
        <Route path="archive/units" element={<UnitList />} />
        <Route path="archive/cadres" element={<CadreList />} />
        <Route path="archive/knowledge" element={<KnowledgeList />} />
        {/* 计划与底稿 */}
        <Route path="plan/plans" element={<PlanList />} />
        <Route path="plan/groups" element={<GroupList />} />
        <Route path="execution/drafts" element={<DraftList />} />
        {/* 执行管理 */}
        <Route path="execution/clues" element={<ClueList />} />
        <Route path="execution/rectifications" element={<RectificationList />} />
        {/* 系统管理 */}
        <Route path="admin/users" element={<UserList />} />
        <Route path="admin/audit" element={<AuditLog />} />
        <Route path="admin/modules" element={<ModuleConfig />} />
      </Route>
    </Routes>
  )
}

export default App
