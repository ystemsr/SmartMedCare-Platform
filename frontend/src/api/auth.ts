import http from './http';
import type { ApiResponse } from '../types/common';
import type {
  LoginRequest,
  LoginResponse,
  UserInfo,
  CaptchaChallengeResponse,
  CaptchaVerifyResponse,
  TrajectoryPoint,
  ChangePasswordRequest,
} from '../types/auth';

/** User login */
export function login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
  return http.post('/auth/login', data);
}

/** Get current user info and permissions */
export function getMe(): Promise<ApiResponse<UserInfo>> {
  return http.get('/auth/me');
}

/** Refresh access token */
export function refreshToken(refresh_token: string): Promise<ApiResponse<LoginResponse>> {
  return http.post('/auth/refresh', { refresh_token });
}

/** Logout current session */
export function logout(): Promise<ApiResponse<null>> {
  return http.post('/auth/logout');
}

/** Change password */
export function changePassword(data: ChangePasswordRequest): Promise<ApiResponse<null>> {
  return http.post('/auth/change-password', data);
}

/** Create a captcha challenge */
export function createCaptchaChallenge(session_id: string): Promise<ApiResponse<CaptchaChallengeResponse>> {
  return http.post('/auth/captcha', { session_id });
}

/** Verify captcha challenge */
export function verifyCaptchaChallenge(data: {
  session_id: string;
  challenge_id: string;
  x: number;
  y: number;
  trajectory: TrajectoryPoint[];
}): Promise<ApiResponse<CaptchaVerifyResponse>> {
  return http.post('/auth/captcha/verify', data);
}
