import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
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
import RoleList from './pages/Admin/Roles/RoleList'
import ModuleConfig from './pages/Admin/Modules/ModuleConfig'
import FieldOptionsConfig from './pages/Admin/Fields/FieldOptionsConfig'

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      // 档案管理
      { path: 'archive/units', element: <UnitList /> },
      { path: 'archive/cadres', element: <CadreList /> },
      { path: 'archive/knowledge', element: <KnowledgeList /> },
      // 计划与底稿
      { path: 'plan/plans', element: <PlanList /> },
      { path: 'plan/groups', element: <GroupList /> },
      { path: 'execution/drafts', element: <DraftList /> },
      // 执行管理
      { path: 'execution/clues', element: <ClueList /> },
      { path: 'execution/rectifications', element: <RectificationList /> },
      // 系统管理
      { path: 'admin/users', element: <UserList /> },
      { path: 'admin/audit', element: <AuditLog /> },
      { path: 'admin/roles', element: <RoleList /> },
      { path: 'admin/modules', element: <ModuleConfig /> },
      { path: 'admin/fields', element: <FieldOptionsConfig /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
