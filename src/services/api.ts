import { getBaseUrl } from '@/config/api';

export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };

export type DriverLocationPayload = {
  driver_id: string | number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  delivery_id?: string | number | null;
};

export type DriverStatus =
  | 'online'
  | 'offline'
  | 'idle'
  | 'active'
  | 'inactive'
  | 'busy'
  | 'available';

export type TrackingHistoryFilters = {
  start_date?: string;
  end_date?: string;
};
function safeJsonParse(text: string) {
  try { return JSON.parse(text); } catch { return null; }
}

class ApiService {
  private getToken(): string | null { return localStorage.getItem('id_transporte_token') || localStorage.getItem('temp_token'); }
  private getAuthHeader(): Record<string, string> { const t = this.getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const baseUrl = getBaseUrl(endpoint);
      const fullUrl = `${baseUrl}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
        ...(options.headers as Record<string, string> || {}),
      };
      if (options.body instanceof FormData) delete headers['Content-Type'];
      const res = await fetch(fullUrl, { ...options, headers });
      const text = await res.text();
      const data = safeJsonParse(text) ?? text;
      if (!res.ok) {
        const err = (data && typeof data === 'object' && 'error' in data) ? (data as any).error : `HTTP ${res.status}`;
        return { success: false, error: String(err) };
      }
      if (data && typeof data === 'object' && 'success' in data) return data as ApiResponse<T>;
      return { success: true, data: data as T };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Erro de conexao' };
    }
  }

  async getCurrentLocations() { return this.request<Array<any>>('/api/tracking/drivers/current-locations'); }
  async sendDriverLocation(payload: DriverLocationPayload) {
    const body: Record<string, unknown> = {
      driver_id: String(payload.driver_id),
      latitude: payload.latitude,
      longitude: payload.longitude,
    };
    if (typeof payload.accuracy === 'number') body.accuracy = payload.accuracy;
    if (typeof payload.speed === 'number') body.speed = payload.speed;
    if (typeof payload.heading === 'number') body.heading = payload.heading;
    if (payload.delivery_id !== undefined && payload.delivery_id !== null) body.delivery_id = payload.delivery_id;
    return this.request<any>('/api/tracking/location', { method: 'POST', body: JSON.stringify(body) });
  }

  async getTrackingHistory(driverId: string | number, filters?: TrackingHistoryFilters) {
    const params = new URLSearchParams();
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    const query = params.toString();
    const driver = encodeURIComponent(String(driverId));
    const url = query
      ? `/api/tracking/drivers/${driver}/history?${query}`
      : `/api/tracking/drivers/${driver}/history`;
    return this.request<Array<any>>(url);
  }

  async updateDriverStatus(driverId: string | number, status: DriverStatus) {
    const driver = encodeURIComponent(String(driverId));
    return this.request(`/api/tracking/drivers/${driver}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async getDeliveries(filters?: Record<string, string>): Promise<ApiResponse<ApiDelivery[]>> {
    const queryParams = filters && Object.keys(filters).length
      ? `?${new URLSearchParams(filters).toString()}`
      : '';

    return this.request<ApiDelivery[]>(`/api/deliveries${queryParams}`);
  }

  async getDelivery(deliveryId: string | number): Promise<ApiResponse<ApiDelivery>> {
    const id = encodeURIComponent(String(deliveryId));
    return this.request<ApiDelivery>(`/api/deliveries/${id}`);
  }

  async getCanhotos(filters?: Record<string, string>) {
    const queryParams = filters && Object.keys(filters).length
      ? `?${new URLSearchParams(filters).toString()}`
      : '';
    return this.request(`/api/reports/canhotos${queryParams}`);
  }

  async getAuthCompanies() {
    return this.request('/api/auth/companies');
  }

  // Management/service companies (management UI) - hits the companies service
  async getManagementCompanies() {
    return this.request('/api/companies');
  }

  // Backwards-compatible shim: prefer explicit methods getAuthCompanies or getManagementCompanies
  async getCompanies() {
    console.warn('getCompanies() is ambiguous. Use getAuthCompanies() for login or getManagementCompanies() for management.');
    return this.getManagementCompanies();
  }

  async getDrivers(filters?: Record<string, string>) {
    const queryParams = filters && Object.keys(filters).length
      ? `?${new URLSearchParams(filters).toString()}`
      : '';
    return this.request(`/api/drivers${queryParams}`);
  }

  async getDashboardKPIs() {
    return this.request('/api/dashboard/kpis');
  }

  async getSecureFile(url: string): Promise<string | null> {
    try {
      const headers = this.getAuthHeader();
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('getSecureFile error', err);
      return null;
    }
  }

  // Authentication helpers
  async login(credentials: { username: string; password: string }) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async selectCompany(companyId: string) {
    return this.request('/api/auth/select-company', {
      method: 'POST',
      body: JSON.stringify({ company_id: companyId }),
    });
  }

  // Users management
  async getUsers() {
    return this.request('/api/users');
  }

  async createUser(payload: Record<string, any>) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateUser(userId: string | number, payload: Record<string, any>) {
    return this.request(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteUser(userId: string | number) {
    return this.request(`/api/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Drivers management (some apps create a separate driver record)
  async createDriver(payload: Record<string, any>) {
    return this.request('/api/drivers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Vehicles (CRUD)
  async getVehicles() {
    return this.request('/api/vehicles');
  }

  async createVehicle(payload: Record<string, any>) {
    return this.request('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateVehicle(vehicleId: string | number, payload: Record<string, any>) {
    return this.request(`/api/vehicles/${vehicleId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteVehicle(vehicleId: string | number) {
    return this.request(`/api/vehicles/${vehicleId}`, {
      method: 'DELETE',
    });
  }

  // Reports / receipts convenience
  async getReceiptsReport(filters?: Record<string, string>) { const q = filters && Object.keys(filters).length ? `?${new URLSearchParams(filters).toString()}` : ''; return this.request<any>(`/api/reports/receipts${q}`); }

  // Receipts / OCR endpoints
  // Attach an existing receipt to a delivery (wrapper for legacy calls)
  async attachReceipt(deliveryId: string | number, driverId: string | number | null, file: File, options?: { notes?: string; status?: string }) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('delivery_id', String(deliveryId));
    if (driverId) {
      formData.append('driver_id', String(driverId));
    }
    if (options?.notes) {
      formData.append('notes', options.notes);
    }
    if (options?.status) {
      formData.append('status', options.status);
    }
    return this.uploadReceipt(formData);
  }

  async uploadReceipt(formData: FormData) {
    return this.request<any>('/api/receipts/upload', { method: 'POST', body: formData });
  }

  async processReceiptOCR(receiptId: string | number) {
    return this.request<any>(`/api/receipts/${receiptId}/process-ocr`, { method: 'POST' });
  }

  async validateReceipt(receiptId: string | number, payload: Record<string, any>) {
    return this.request<any>(`/api/receipts/${receiptId}/validate`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  // High-level helper used by DeliveryUpload: upload file then trigger OCR and return OCR result
  async smartProcessDocument(file: File) {
    try {
      // Send the file directly to the receipts Document AI endpoint which accepts
      // a multipart/form-data with `file` and does NOT require delivery_id/driver_id.
      const fd = new FormData();
      fd.append('file', file);
      const fullUrl = `${getBaseUrl('/api/receipts/process-documentai')}/api/receipts/process-documentai`;
      const headers = this.getAuthHeader();
      // Do not set Content-Type so the browser sets the correct boundary
      const res = await fetch(fullUrl, { method: 'POST', body: fd, headers });
      const text = await res.text();
      const data = safeJsonParse(text) ?? text;
      if (!res.ok) {
        const err = (data && typeof data === 'object' && 'error' in data) ? (data as any).error : `HTTP ${res.status}`;
        return { success: false, error: String(err) } as ApiResponse<any>;
      }
      if (data && typeof data === 'object' && 'success' in data) return data as ApiResponse<any>;
      return { success: true, data: data as any } as ApiResponse<any>;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Erro interno' } as ApiResponse<any>;
    }
  }

  // Create a delivery from an uploaded SEFAZ document or structured data.
  // Accepts an object with optional fields: file: File, structured: any, summary: any, isSefazValid?: boolean, driver_id?: string|number, notes?: string
  async createDelivery(payload: Record<string, any>) {
    try {
      const fd = new FormData();
      if (payload.file) fd.append('file', payload.file);
      if (payload.structured) fd.append('structured', JSON.stringify(payload.structured));
      if (payload.summary) fd.append('summary', JSON.stringify(payload.summary));
      if (typeof payload.isSefazValid !== 'undefined') fd.append('isSefazValid', payload.isSefazValid ? 'true' : 'false');
      if (payload.driver_id) fd.append('driver_id', String(payload.driver_id));
      if (payload.notes) fd.append('notes', String(payload.notes));

      // POST to the deliveries create-from-sefaz endpoint
      return this.request<any>('/api/deliveries/create-from-sefaz', { method: 'POST', body: fd });
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Erro interno' } as ApiResponse<any>;
    }
  }
}

export const apiService = new ApiService();
export default apiService;
