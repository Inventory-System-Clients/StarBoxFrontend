import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const billsAPI = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await axios.get(`${API}/bills?${params}`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  create: async (billData) => {
    const response = await axios.post(`${API}/bills`, billData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  update: async (id, billData) => {
    const response = await axios.put(`${API}/bills/${id}`, billData, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await axios.patch(`${API}/bills/${id}/status`, { status }, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  delete: async (id) => {
    const response = await axios.delete(`${API}/bills/${id}`, {
      headers: getAuthHeader()
    });
    return response.data;
  }
};

export const categoriesAPI = {
  getAll: async () => {
    const response = await axios.get(`${API}/categories`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  create: async (name) => {
    const response = await axios.post(`${API}/categories`, { name }, {
      headers: getAuthHeader()
    });
    return response.data;
  }
};

export const reportsAPI = {
  getDashboard: async () => {
    const response = await axios.get(`${API}/reports/dashboard`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  getAlerts: async () => {
    const response = await axios.get(`${API}/reports/alerts`, {
      headers: getAuthHeader()
    });
    return response.data;
  },

  export: async (format = 'pdf') => {
    const response = await axios.get(`${API}/reports/export?format=${format}`, {
      headers: getAuthHeader(),
      responseType: 'blob'
    });
    return response.data;
  }
};
