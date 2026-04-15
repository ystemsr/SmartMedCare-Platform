import axios from 'axios';
import { getToken, removeToken } from '../utils/storage';

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
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

// Unwrap unified response and handle errors
http.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code !== 0) {
      const errorMsg = res.message || '请求失败';
      return Promise.reject(new Error(errorMsg));
    }
    return res;
  },
  (error) => {
    if (error.response?.status === 401) {
      removeToken();
      window.location.href = '/login';
      return Promise.reject(new Error('登录已过期，请重新登录'));
    }
    const msg = error.response?.data?.message || error.message || '网络错误';
    return Promise.reject(new Error(msg));
  },
);

export default http;
