/** Login request payload */
export interface LoginRequest {
  username: string;
  password: string;
  captcha_id: string;
  captcha_code: string;
}

/** Login response data */
export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: number;
    username: string;
    real_name: string;
    roles: string[];
  };
}

/** Role info attached to a user */
export interface RoleInfo {
  id: number;
  name: string;
  display_name: string;
}

/** Full user info from GET /auth/me */
export interface UserInfo {
  id: number;
  username: string;
  real_name: string;
  phone?: string;
  email?: string;
  status?: string;
  roles: string[];
  permissions: string[];
  created_at?: string;
}

/** Captcha response from GET /auth/captcha */
export interface CaptchaResponse {
  captcha_id: string;
  captcha_image: string;
}

/** Change password request */
export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}
