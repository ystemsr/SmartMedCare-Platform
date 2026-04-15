export interface FamilyMemberInfo {
  id: number;
  user_id: number;
  elder_id: number;
  relationship: string;
  real_name: string;
  phone: string;
  elder_name: string;
  created_at?: string;
}

export interface FamilyElderInfo {
  elder_id: number;
  name: string;
  gender: string;
  birth_date?: string;
  phone: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  tags: string[];
}

export interface InviteCodeValidation {
  valid: boolean;
  elder_name: string;
  remaining_slots: number;
}
