import type { PaginationParams } from './common';

/** Elder entity */
export interface Elder {
  id: number;
  name: string;
  gender: 'male' | 'female' | 'unknown';
  birth_date: string;
  id_card: string;
  phone: string;
  address: string;
  account_status: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  tags: string[];
  username?: string;
  family_count?: number;
  latest_risk_score?: number | null;
  latest_high_risk?: boolean | null;
  latest_prediction_at?: string | null;
  created_at: string;
  updated_at?: string;
}

/** Create elder request */
export interface ElderCreate {
  name: string;
  gender: 'male' | 'female' | 'unknown';
  birth_date: string;
  id_card: string;
  phone: string;
  address: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  tags?: string[];
}

/** Update elder request */
export interface ElderUpdate extends Partial<ElderCreate> {}

/** Elder list query parameters */
export interface ElderListQuery extends PaginationParams {
  gender?: string;
  tag?: string;
  account_status?: string;
  risk_level?: string;
}

/** Elder tag */
export interface ElderTag {
  id: number;
  name: string;
  count?: number;
}

/** Health record entity */
export interface HealthRecord {
  id: number;
  elder_id: number;
  height_cm?: number;
  weight_kg?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  blood_glucose?: number;
  heart_rate?: number;
  temperature?: number;
  chronic_diseases?: string[];
  allergies?: string[];
  recorded_at: string;
  created_at?: string;
}

/** Create health record request */
export interface HealthRecordCreate {
  height_cm?: number;
  weight_kg?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  blood_glucose?: number;
  heart_rate?: number;
  temperature?: number;
  chronic_diseases?: string[];
  allergies?: string[];
  recorded_at: string;
}

/** Medical record entity */
export interface MedicalRecord {
  id: number;
  elder_id: number;
  visit_date: string;
  hospital_name: string;
  department: string;
  diagnosis: string;
  medications: string[];
  remarks?: string;
  created_at?: string;
}

/** Create medical record request */
export interface MedicalRecordCreate {
  visit_date: string;
  hospital_name: string;
  department: string;
  diagnosis: string;
  medications?: string[];
  remarks?: string;
}

/** Care record entity */
export interface CareRecord {
  id: number;
  elder_id: number;
  care_type: string;
  care_date: string;
  content: string;
  caregiver_name: string;
  created_at?: string;
}

/** Create care record request */
export interface CareRecordCreate {
  care_type: string;
  care_date: string;
  content: string;
  caregiver_name: string;
}
