import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UnitList from './pages/Archive/Units/UnitList'
import CadreList from './pages/Archive/Cadres/CadreList'
import KnowledgeList from './pages/Archive/Knowledge/KnowledgeList'
import PlanList from './pages/Plan/Plans/PlanList'
import PlanCreateWizard from './pages/Plan/Plans/PlanCreateWizard'
import GroupList from './pages/Plan/Groups/GroupList'
import GroupDetailPage from './pages/Plan/Groups/GroupDetailPage'
import DraftList from './pages/Execution/Drafts/DraftList'
import ClueList from './pages/Execution/Clues/ClueList'
import RectificationList from './pages/Execution/Rectifications/RectificationList'
import RectificationDetail from './pages/Execution/Rectifications/RectificationDetail'
import ProgressPage from './pages/Execution/Progress/ProgressPage'
import DocumentList from './pages/Execution/Documents/DocumentList'
import UserList from './pages/Admin/Users/UserList'
import AuditLog from './pages/Admin/Audit/AuditLog'
import RoleList from './pages/Admin/Roles/RoleList'
import ModuleConfig from './pages/Admin/Modules/ModuleConfig'
import FieldOptionsConfig from './pages/Admin/Fields/FieldOptionsConfig'
import SystemConfigPage from './pages/Admin/Configs/SystemConfigPage'
import BackupPage from './pages/Admin/Backup/BackupPage'
import InitWizard from './pages/Init/InitWizard'
import { useEffect, useState } from 'react'
import { getMe } from './api/auth'

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/init', element: <InitWizard /> },
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
      // 巡察计划
      { path: 'plans', element: <PlanList /> },
      { path: 'plans/new', element: <PlanCreateWizard /> },
      { path: 'plans/:id', element: <PlanList /> },
      // 巡察组
      { path: 'groups', element: <GroupList /> },
      { path: 'groups/:id', element: <GroupDetailPage /> },
      // 执行管理
      { path: 'execution/drafts', element: <DraftList /> },
      { path: 'execution/clues', element: <ClueList /> },
      { path: 'execution/rectifications', element: <RectificationList /> },
      { path: 'execution/rectifications/:id', element: <RectificationDetail /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'documents', element: <DocumentList /> },
      // 系统管理
      { path: 'admin/users', element: <UserList /> },
      { path: 'admin/audit', element: <AuditLog /> },
      { path: 'admin/roles', element: <RoleList /> },
      { path: 'admin/modules', element: <ModuleConfig /> },
      { path: 'admin/fields', element: <FieldOptionsConfig /> },
      { path: 'admin/configs', element: <SystemConfigPage /> },
      { path: 'admin/backup', element: <BackupPage /> },
    ],
  },
])

function App() {
  const [checkingInit, setCheckingInit] = useState(true)

  useEffect(() => {
    // Check if system needs initialization
    const checkInit = async () => {
      // Only check auth if token exists — avoids 401 that clears localStorage
      if (!localStorage.getItem('token')) {
        setCheckingInit(false)
        return
      }
      try {
        await getMe()
      } catch {
        // If 401, system might need init - will redirect to login or init
      } finally {
        setCheckingInit(false)
      }
    }
    checkInit()
  }, [])

  if (checkingInit) {
    return null
  }

  return <RouterProvider router={router} />
}

export default App
