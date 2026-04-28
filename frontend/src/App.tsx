import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import MainLayout from './components/layout/MainLayout'
import Login from './pages/Login'
import { useEffect, useState } from 'react'
import { getMe } from './api/auth'

// Lazy-loaded page components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const GlobalSearch = lazy(() => import('./pages/GlobalSearch/GlobalSearch'))
const UnitList = lazy(() => import('./pages/Archive/Units/UnitList'))
const UnitDetail = lazy(() => import('./pages/Archive/Units/UnitDetail'))
const CadreList = lazy(() => import('./pages/Archive/Cadres/CadreList'))
const CadreDetail = lazy(() => import('./pages/Archive/Cadres/CadreDetail'))
const KnowledgeList = lazy(() => import('./pages/Archive/Knowledge/KnowledgeList'))
const KnowledgeDetail = lazy(() => import('./pages/Archive/Knowledge/KnowledgeDetail'))
const PlanList = lazy(() => import('./pages/Plan/Plans/PlanList'))
const PlanCreateWizard = lazy(() => import('./pages/Plan/Plans/PlanCreateWizard'))
const GroupList = lazy(() => import('./pages/Plan/Groups/GroupList'))
const GroupDetailPage = lazy(() => import('./pages/Plan/Groups/GroupDetailPage'))
const DraftList = lazy(() => import('./pages/Execution/Drafts/DraftList'))
const ClueList = lazy(() => import('./pages/Execution/Clues/ClueList'))
const RectificationList = lazy(() => import('./pages/Execution/Rectifications/RectificationList'))
const RectificationDetail = lazy(() => import('./pages/Execution/Rectifications/RectificationDetail'))
const ProgressPage = lazy(() => import('./pages/Execution/Progress/ProgressPage'))
const DocumentList = lazy(() => import('./pages/Execution/Documents/DocumentList'))
const UserList = lazy(() => import('./pages/Admin/Users/UserList'))
const AuditLog = lazy(() => import('./pages/Admin/Audit/AuditLog'))
const RoleList = lazy(() => import('./pages/Admin/Roles/RoleList'))
const ModuleConfig = lazy(() => import('./pages/Admin/Modules/ModuleConfig'))
const FieldOptionsConfig = lazy(() => import('./pages/Admin/Fields/FieldOptionsConfig'))
const SystemConfigPage = lazy(() => import('./pages/Admin/Configs/SystemConfigPage'))
const BackupPage = lazy(() => import('./pages/Admin/Backup/BackupPage'))
const Notifications = lazy(() => import('./pages/Admin/Notifications/Notifications'))
const Alerts = lazy(() => import('./pages/Admin/Alerts/Alerts'))
const InitWizard = lazy(() => import('./pages/Init/InitWizard'))

// Loading fallback component
const PageLoader = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    color: '#1890ff'
  }}>
    加载中...
  </div>
)

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/init', element: <Suspense fallback={<PageLoader />}><InitWizard /></Suspense> },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Suspense fallback={<PageLoader />}><Dashboard /></Suspense> },
      { path: 'search', element: <Suspense fallback={<PageLoader />}><GlobalSearch /></Suspense> },
      // 档案管理
      { path: 'archive/units', element: <Suspense fallback={<PageLoader />}><UnitList /></Suspense> },
      { path: 'archive/units/:id', element: <Suspense fallback={<PageLoader />}><UnitDetail /></Suspense> },
      { path: 'archive/cadres', element: <Suspense fallback={<PageLoader />}><CadreList /></Suspense> },
      { path: 'archive/cadres/:id', element: <Suspense fallback={<PageLoader />}><CadreDetail /></Suspense> },
      { path: 'archive/knowledge', element: <Suspense fallback={<PageLoader />}><KnowledgeList /></Suspense> },
      { path: 'archive/knowledge/:id', element: <Suspense fallback={<PageLoader />}><KnowledgeDetail /></Suspense> },
      // 巡察计划
      { path: 'plans', element: <Suspense fallback={<PageLoader />}><PlanList /></Suspense> },
      { path: 'plans/new', element: <Suspense fallback={<PageLoader />}><PlanCreateWizard /></Suspense> },
      { path: 'plans/:id', element: <Suspense fallback={<PageLoader />}><PlanList /></Suspense> },
      // 巡察组
      { path: 'groups', element: <Suspense fallback={<PageLoader />}><GroupList /></Suspense> },
      { path: 'groups/:id', element: <Suspense fallback={<PageLoader />}><GroupDetailPage /></Suspense> },
      // 执行管理
      { path: 'execution/drafts', element: <Suspense fallback={<PageLoader />}><DraftList /></Suspense> },
      { path: 'execution/clues', element: <Suspense fallback={<PageLoader />}><ClueList /></Suspense> },
      { path: 'execution/rectifications', element: <Suspense fallback={<PageLoader />}><RectificationList /></Suspense> },
      { path: 'execution/rectifications/:id', element: <Suspense fallback={<PageLoader />}><RectificationDetail /></Suspense> },
      { path: 'progress', element: <Suspense fallback={<PageLoader />}><ProgressPage /></Suspense> },
      { path: 'documents', element: <Suspense fallback={<PageLoader />}><DocumentList /></Suspense> },
      // 系统管理
      { path: 'admin/users', element: <Suspense fallback={<PageLoader />}><UserList /></Suspense> },
      { path: 'admin/audit', element: <Suspense fallback={<PageLoader />}><AuditLog /></Suspense> },
      { path: 'admin/roles', element: <Suspense fallback={<PageLoader />}><RoleList /></Suspense> },
      { path: 'admin/modules', element: <Suspense fallback={<PageLoader />}><ModuleConfig /></Suspense> },
      { path: 'admin/fields', element: <Suspense fallback={<PageLoader />}><FieldOptionsConfig /></Suspense> },
      { path: 'admin/configs', element: <Suspense fallback={<PageLoader />}><SystemConfigPage /></Suspense> },
      { path: 'admin/backup', element: <Suspense fallback={<PageLoader />}><BackupPage /></Suspense> },
      { path: 'admin/notifications', element: <Suspense fallback={<PageLoader />}><Notifications /></Suspense> },
      { path: 'admin/alerts', element: <Suspense fallback={<PageLoader />}><Alerts /></Suspense> },
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
