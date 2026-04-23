import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BasicLayout from '../layouts/BasicLayout';
import BlankLayout from '../layouts/BlankLayout';
import Spinner from '../components/ui/Spinner';
import { useAuthStore, getHomeRoute } from '../store/auth';

// Lazy-loaded pages
const LoginPage = lazy(() => import('../pages/login/LoginPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const ElderListPage = lazy(() => import('../pages/elders/ElderListPage'));
const ElderDetailPage = lazy(() => import('../pages/elders/ElderDetailPage'));
const ElderArchivePage = lazy(() => import('../pages/elders/ElderArchivePage'));
const AlertListPage = lazy(() => import('../pages/alerts/AlertListPage'));
const AlertDetailPage = lazy(() => import('../pages/alerts/AlertDetailPage'));
const FollowupPlanPage = lazy(() => import('../pages/followups/FollowupPlanPage'));
const InterventionPage = lazy(() => import('../pages/interventions/InterventionPage'));
const AssessmentPage = lazy(() => import('../pages/assessments/AssessmentPage'));
const PersonalAccountPage = lazy(() => import('../pages/accounts/PersonalAccountPage'));
const DoctorPage = lazy(() => import('../pages/doctors/DoctorPage'));
const FamilyMemberPage = lazy(() => import('../pages/family/FamilyMemberPage'));
const ElderLayout = lazy(() => import('../layouts/ElderLayout'));
const ElderHomePage = lazy(() => import('../pages/elder-portal/ElderHomePage'));
const ElderHealthPage = lazy(() => import('../pages/elder-portal/ElderHealthPage'));
const ElderInvitePage = lazy(() => import('../pages/elder-portal/ElderInvitePage'));
const ElderPersonalPage = lazy(() => import('../pages/elder-portal/ElderPersonalPage'));
const ElderSurveysPage = lazy(() => import('../pages/elder-portal/ElderSurveysPage'));
const FamilyRegisterPage = lazy(() => import('../pages/family/FamilyRegisterPage'));
const FamilyLayout = lazy(() => import('../layouts/FamilyLayout'));
const FamilyHomePage = lazy(() => import('../pages/family-portal/FamilyHomePage'));
const FamilyElderHealthPage = lazy(() => import('../pages/family-portal/FamilyElderHealthPage'));
const BigDataDashboardPage = lazy(() => import('../pages/bigdata/BigDataDashboardPage'));
const MLInferencePage = lazy(() => import('../pages/bigdata/MLInferencePage'));
const JobManagerPage = lazy(() => import('../pages/bigdata/JobManagerPage'));
const HdfsBrowserPage = lazy(() => import('../pages/bigdata/HdfsBrowserPage'));
const HiveQueryPage = lazy(() => import('../pages/bigdata/HiveQueryPage'));
const BigDataAnalyticsPage = lazy(() => import('../pages/bigdata/BigDataAnalyticsPage'));
const AIChatPage = lazy(() => import('../pages/ai/AIChatPage'));
const AIConfigPage = lazy(() => import('../pages/ai/AIConfigPage'));

const PageLoading: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '50vh',
    }}
  >
    <Spinner size="lg" />
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const RoleBasedRedirect: React.FC = () => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  if (!token) return <Navigate to="/login" replace />;
  const target = user ? getHomeRoute(user.roles) : '/dashboard';
  return <Navigate to={target} replace />;
};

const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route element={<BlankLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register/family" element={<FamilyRegisterPage />} />
        </Route>

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
          <Route path="/followups" element={<FollowupPlanPage />} />
          <Route path="/interventions" element={<InterventionPage />} />
          <Route path="/assessments" element={<AssessmentPage />} />
          <Route path="/doctors" element={<DoctorPage />} />
          <Route path="/family-members" element={<FamilyMemberPage />} />
          <Route path="/accounts/personal" element={<PersonalAccountPage />} />
          <Route path="/bigdata" element={<BigDataDashboardPage />} />
          <Route path="/bigdata/inference" element={<MLInferencePage />} />
          <Route path="/bigdata/jobs" element={<JobManagerPage />} />
          <Route path="/bigdata/hdfs" element={<HdfsBrowserPage />} />
          <Route path="/bigdata/hive" element={<HiveQueryPage />} />
          <Route path="/bigdata/analytics" element={<BigDataAnalyticsPage />} />
          <Route path="/ai/config" element={<AIConfigPage />} />
        </Route>

        {/* Full-screen AI chat — open to every authenticated role.
         * `/ai` = empty state; `/ai/:id` = viewing a conversation. */}
        <Route
          path="/ai"
          element={
            <ProtectedRoute>
              <AIChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai/:id"
          element={
            <ProtectedRoute>
              <AIChatPage />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <ElderLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/elder" element={<ElderHomePage />} />
          <Route path="/elder/health" element={<ElderHealthPage />} />
          <Route path="/elder/surveys" element={<ElderSurveysPage />} />
          <Route path="/elder/invite" element={<ElderInvitePage />} />
          <Route path="/elder/personal" element={<ElderPersonalPage />} />
        </Route>

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

        <Route path="*" element={<RoleBasedRedirect />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
