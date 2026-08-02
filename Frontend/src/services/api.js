import axios from "axios";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const createAuthHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const authApi = {
  login: async (email, password) => {
    const res = await axios.post(`${API_BASE_URL}/login`, { email, password });
    return res.data;
  },
  register: async (email, password) => {
    const res = await axios.post(`${API_BASE_URL}/register`, { email, password });
    return res.data;
  },
  getMe: async (token) => {
    const res = await axios.get(`${API_BASE_URL}/me`, createAuthHeaders(token));
    return res.data;
  },
};

export const chatApi = {
  listChats: async (token) => {
    const res = await axios.get(`${API_BASE_URL}/chats`, createAuthHeaders(token));
    return res.data;
  },
  createChat: async (token, title = "New Chat") => {
    const res = await axios.post(`${API_BASE_URL}/chats`, { title }, createAuthHeaders(token));
    return res.data;
  },
  deleteChat: async (token, sessionId) => {
    const res = await axios.delete(`${API_BASE_URL}/chats/${sessionId}`, createAuthHeaders(token));
    return res.data;
  },
  getMessages: async (token, sessionId) => {
    const res = await axios.get(`${API_BASE_URL}/chats/${sessionId}/messages`, createAuthHeaders(token));
    return res.data;
  },
  generate: async (token, payload) => {
    const res = await axios.post(`${API_BASE_URL}/generate`, payload, createAuthHeaders(token));
    return res.data;
  },
  getFileUsage: async (token) => {
    const res = await axios.get(`${API_BASE_URL}/file-usage`, createAuthHeaders(token));
    return res.data;
  },
};
