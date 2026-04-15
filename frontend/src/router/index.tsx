import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import BasicLayout from '../layouts/BasicLayout';
import BlankLayout from '../layouts/BlankLayout';
import { useAuthStore } from '../store/auth';

// Lazy-loaded pages
const LoginPage = lazy(() => import('../pages/login/LoginPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const ElderListPage = lazy(() => import('../pages/elders/ElderListPage'));
const ElderDetailPage = lazy(() => import('../pages/elders/ElderDetailPage'));
const ElderArchivePage = lazy(() => import('../pages/elders/ElderArchivePage'));
const AlertListPage = lazy(() => import('../pages/alerts/AlertListPage'));
const AlertDetailPage = lazy(() => import('../pages/alerts/AlertDetailPage'));
const FollowupPlanPage = lazy(() => import('../pages/followups/FollowupPlanPage'));
const FollowupRecordPage = lazy(() => import('../pages/followups/FollowupRecordPage'));
const InterventionPage = lazy(() => import('../pages/interventions/InterventionPage'));
const AssessmentPage = lazy(() => import('../pages/assessments/AssessmentPage'));
const ElderAccountPage = lazy(() => import('../pages/accounts/ElderAccountPage'));
const PersonalAccountPage = lazy(() => import('../pages/accounts/PersonalAccountPage'));
const UserPage = lazy(() => import('../pages/system/UserPage'));
const RolePage = lazy(() => import('../pages/system/RolePage'));
const FamilyRegisterPage = lazy(() => import('../pages/family/FamilyRegisterPage'));
const FamilyLayout = lazy(() => import('../layouts/FamilyLayout'));
const FamilyHomePage = lazy(() => import('../pages/family-portal/FamilyHomePage'));
const FamilyElderHealthPage = lazy(() => import('../pages/family-portal/FamilyElderHealthPage'));

/** Loading fallback for lazy-loaded pages */
const PageLoading: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
    <Spin size="large" />
  </div>
);

/** Protected route wrapper — redirects to login if no token */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Public routes */}
        <Route element={<BlankLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register/family" element={<FamilyRegisterPage />} />
        </Route>

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <BasicLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/elders" element={<ElderListPage />} />
          <Route path="/elders/:id" element={<ElderDetailPage />} />
          <Route path="/elders/:id/archive" element={<ElderArchivePage />} />
          <Route path="/alerts" element={<AlertListPage />} />
          <Route path="/alerts/:id" element={<AlertDetailPage />} />
          <Route path="/followups/plans" element={<FollowupPlanPage />} />
          <Route path="/followups/records" element={<FollowupRecordPage />} />
          <Route path="/interventions" element={<InterventionPage />} />
          <Route path="/assessments" element={<AssessmentPage />} />
          <Route path="/accounts/elders" element={<ElderAccountPage />} />
          <Route path="/accounts/personal" element={<PersonalAccountPage />} />
          <Route path="/system/users" element={<UserPage />} />
          <Route path="/system/roles" element={<RolePage />} />
        </Route>

        {/* Family portal routes */}
        <Route
          element={
            <ProtectedRoute>
              <FamilyLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/family" element={<FamilyHomePage />} />
          <Route path="/family/elder" element={<FamilyElderHealthPage />} />
          <Route path="/family/personal" element={<PersonalAccountPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
