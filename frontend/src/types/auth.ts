/** Login request payload */
export interface LoginRequest {
  username: string;
  password: string;
  captcha_token: string;
  session_id: string;
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

/** Captcha challenge response from POST /auth/captcha */
export interface CaptchaChallengeResponse {
  challenge_id: string;
  width: number;
  height: number;
  thumb_y: number;
  thumb_width: number;
  thumb_height: number;
  image: string;
  thumb: string;
  expires_at: string;
}

/** Trajectory point recorded during slider drag */
export interface TrajectoryPoint {
  x: number;
  t: number;
}

/** Captcha verify response from POST /auth/captcha/verify */
export interface CaptchaVerifyResponse {
  captcha_token: string;
}

/** Change password request */
export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}
