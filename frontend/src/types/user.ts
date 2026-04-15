/** System user entity (for admin management) */
export interface User {
  id: number;
  username: string;
  real_name: string;
  phone: string;
  email: string;
  status: 'active' | 'disabled';
  roles: { id: number; name: string; display_name: string }[];
  created_at: string;
  updated_at?: string;
}

/** Create user request */
export interface UserCreate {
  username: string;
  real_name: string;
  phone: string;
  email?: string;
  password: string;
  role_ids: number[];
}

/** Update user request */
export interface UserUpdate {
  real_name?: string;
  phone?: string;
  email?: string;
  role_ids?: number[];
  status?: 'active' | 'disabled';
}

/** Role entity */
export interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  permissions?: string[];
  created_at?: string;
}

/** Create role request */
export interface RoleCreate {
  name: string;
  display_name: string;
  description?: string;
}

/** Permission tree node */
export interface PermissionNode {
  key: string;
  title: string;
  children?: PermissionNode[];
}
