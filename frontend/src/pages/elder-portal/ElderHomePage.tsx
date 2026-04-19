import React, { useEffect, useState } from 'react';
import { Alert, Spinner } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import {
  getElderSelf,
  getElderHealthRecords,
  getElderFamily,
  getElderFollowups,
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
  record_date: string;
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
            lastRecordAt: latest.created_at || latest.record_date,
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

    void fetchHealth();
    void fetchFamily();
    void fetchFollowup();
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
      <WelcomeBanner name={profile?.name} />

      <div
        className="grid grid-cols-1 lg:grid-cols-2"
        style={{ display: 'grid', gap: 20 }}
      >
        <HealthStatusCard data={healthData} loading={recordsLoading} />
        <RemindersCard items={MOCK_REMINDERS} />
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        style={{ display: 'grid', gap: 20 }}
      >
        <DoctorCard doctor={doctor} />
        <FamilyCard members={family} loading={familyLoading} />
        <RecentFollowupCard followup={followup} loading={followupLoading} />
      </div>
    </div>
  );
};

export default ElderHomePage;
