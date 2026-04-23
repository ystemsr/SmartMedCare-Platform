import React, { useEffect, useState } from 'react';
import { Alert, Spinner } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import {
  getElderSelf,
  getElderHealthRecords,
  getElderFamily,
  getElderFollowups,
  getCurrentWeather,
  type WeatherInfo,
} from '@/api/elderPortal';
import WelcomeBanner from '@/components/elder-portal/WelcomeBanner';
import HealthStatusCard, {
  type HealthStatusData,
} from '@/components/elder-portal/HealthStatusCard';
import RemindersCard, {
  type ReminderItem,
} from '@/components/elder-portal/RemindersCard';
import DoctorCard, { type DoctorInfo } from '@/components/elder-portal/DoctorCard';
import FamilyCard, { type FamilyMember } from '@/components/elder-portal/FamilyCard';
import RecentFollowupCard, {
  type RecentFollowup,
} from '@/components/elder-portal/RecentFollowupCard';
import PendingSurveysCard, {
  type PendingItem,
} from '@/components/elder-portal/PendingSurveysCard';
import { listMySurveys } from '@/api/surveys';
import { listMyPredictionTasks } from '@/api/predictions';

interface ElderProfile {
  id: number;
  name: string;
  gender?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  address?: string | null;
}

interface HealthRecord {
  id: number;
  recorded_at?: string | null;
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  heart_rate?: number | null;
  blood_glucose?: number | null;
  created_at: string;
}

// TODO: replace with backend reminders endpoint once available.
const MOCK_REMINDERS: ReminderItem[] = [
  { id: 'm1', label: '按时服用降压药', time: '08:00' },
  { id: 'm2', label: '测量血压并记录', time: '10:00' },
  { id: 'm3', label: '喝一杯温水', time: '15:00' },
];

const ElderHomePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [recordsLoading, setRecordsLoading] = useState(false);
  const [healthData, setHealthData] = useState<HealthStatusData>({
    bloodPressure: '--',
    heartRate: '--',
    bloodGlucose: '--',
    lastRecordAt: null,
  });

  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [familyLoading, setFamilyLoading] = useState(false);

  const [followup, setFollowup] = useState<RecentFollowup | null>(null);
  const [followupLoading, setFollowupLoading] = useState(false);

  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);

  // TODO: backend currently has no doctor-elder link; show placeholder until added.
  const doctor: DoctorInfo | null = null;

  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const res = await getElderSelf();
        setProfile(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取个人信息失败');
      } finally {
        setProfileLoading(false);
      }
    };
    void fetchProfile();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadWeather = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError(null);
        const res = await getCurrentWeather();
        if (!cancelled) setWeather(res.data || null);
      } catch (err) {
        if (!cancelled) {
          setWeather(null);
          setWeatherError(err instanceof Error ? err.message : '天气获取失败');
        }
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    };

    void loadWeather();
    // Weather data is refreshed server-side; poll every 10 minutes for a fresh snapshot.
    const timer = window.setInterval(loadWeather, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const elderId = user?.elder_id;
    if (!elderId) return;

    const fetchHealth = async () => {
      setRecordsLoading(true);
      try {
        const res = await getElderHealthRecords(elderId, { page: 1, page_size: 1 });
        const items: HealthRecord[] = res.data?.items || [];
        const latest = items[0];
        if (latest) {
          const bp =
            latest.blood_pressure_systolic && latest.blood_pressure_diastolic
              ? `${latest.blood_pressure_systolic}/${latest.blood_pressure_diastolic}`
              : '--';
          setHealthData({
            bloodPressure: bp,
            heartRate: latest.heart_rate != null ? String(latest.heart_rate) : '--',
            bloodGlucose:
              latest.blood_glucose != null ? String(latest.blood_glucose) : '--',
            lastRecordAt: latest.recorded_at || latest.created_at,
          });
        }
      } catch {
        // Health summary is optional; keep defaults on failure.
      } finally {
        setRecordsLoading(false);
      }
    };

    const fetchFamily = async () => {
      setFamilyLoading(true);
      try {
        const res = await getElderFamily();
        setFamily(Array.isArray(res.data) ? res.data : []);
      } catch {
        setFamily([]);
      } finally {
        setFamilyLoading(false);
      }
    };

    const fetchFollowup = async () => {
      setFollowupLoading(true);
      try {
        const res = await getElderFollowups(elderId, { page: 1, page_size: 1 });
        const items: RecentFollowup[] = res.data?.items || [];
        setFollowup(items[0] ?? null);
      } catch {
        setFollowup(null);
      } finally {
        setFollowupLoading(false);
      }
    };

    const fetchSurveys = async () => {
      setSurveysLoading(true);
      try {
        const [s, p] = await Promise.all([
          listMySurveys({ status: 'pending', limit: 10 }),
          listMyPredictionTasks({ status: 'pending_elder', limit: 10 }),
        ]);
        const merged: PendingItem[] = [];
        (s.data.items || []).forEach((t) =>
          merged.push({
            key: `surv-${t.id}`,
            kind: 'survey',
            title: t.title,
            fields_count: t.requested_fields.length,
            doctor_name: t.doctor_name,
          }),
        );
        (p.data.items || []).forEach((t) =>
          merged.push({
            key: `pred-${t.id}`,
            kind: 'prediction',
            title: t.title,
            fields_count: t.elder_requested_fields.length,
            doctor_name: t.doctor_name,
          }),
        );
        setPendingItems(merged);
      } catch {
        setPendingItems([]);
      } finally {
        setSurveysLoading(false);
      }
    };

    void fetchHealth();
    void fetchFamily();
    void fetchFollowup();
    void fetchSurveys();
  }, [user?.elder_id]);

  if (profileLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Alert severity="error" variant="filled">
        {error}
      </Alert>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <WelcomeBanner
        name={profile?.name}
        weather={weather}
        weatherLoading={weatherLoading}
        weatherError={weatherError}
      />

      <div
        className="grid grid-cols-1 lg:grid-cols-2"
        style={{ display: 'grid', gap: 20 }}
      >
        <HealthStatusCard data={healthData} loading={recordsLoading} />
        <PendingSurveysCard items={pendingItems} loading={surveysLoading} />
      </div>

      <div
        className="grid grid-cols-1 lg:grid-cols-2"
        style={{ display: 'grid', gap: 20 }}
      >
        <RemindersCard items={MOCK_REMINDERS} />
        <RecentFollowupCard followup={followup} loading={followupLoading} />
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{ display: 'grid', gap: 20 }}
      >
        <DoctorCard doctor={doctor} />
        <FamilyCard members={family} loading={familyLoading} />
      </div>
    </div>
  );
};

export default ElderHomePage;
