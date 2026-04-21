import axios from 'axios';
import { getToken, removeToken } from '../utils/storage';

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  // Serialize array params as repeated keys (`a=1&a=2`) so FastAPI's
  // `List[int] = Query(...)` binding receives them as a list rather than the
  // bracketed `a[]=1&a[]=2` form axios uses by default.
  paramsSerializer: { indexes: null },
});

// Attach bearer token to every request
http.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

interface BackendFieldError {
  field?: string;
  reason?: string;
}

function extractErrorMessage(
  body: { message?: string; errors?: BackendFieldError[] } | undefined,
  fallback: string,
): string {
  if (!body) return fallback;
  const errors = body.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    if (first?.reason) {
      return first.reason;
    }
  }
  return body.message || fallback;
}

// Unwrap unified response and handle errors
http.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code !== 0) {
      return Promise.reject(new Error(extractErrorMessage(res, '请求失败')));
    }
    return res;
  },
  (error) => {
    if (error.response?.status === 401) {
      removeToken();
      window.location.href = '/login';
      return Promise.reject(new Error('登录已过期，请重新登录'));
    }
    const msg = extractErrorMessage(error.response?.data, error.message || '网络错误');
    return Promise.reject(new Error(msg));
  },
);

export default http;
