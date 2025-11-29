import { User, Call } from '@/types/index';

type ApiResponse<T = any> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: any;
};

class ApiService {
  private API_ENDPOINT = '';
  private token: string | null = null;

  constructor(endpoint = '') {
    if (endpoint) this.API_ENDPOINT = endpoint;
  }

  setEndpoint(endpoint: string) {
    this.API_ENDPOINT = endpoint;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T = any>(path: string, opts: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = this.API_ENDPOINT.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((opts.headers as Record<string, string>) || {}),
    };
    if (!(opts.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(url, { ...opts, headers });
    const text = await res.text();
    let data: any = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }

    if (!res.ok) {
      return { ok: false, status: res.status, error: data };
    }
    return { ok: true, status: res.status, data };
  }

  // Auth
  async login(email: string, password: string): Promise<{ token?: string; user?: User } | undefined> {
    const r = await this.request<{ token: string; user: User }>('auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) return undefined;
    this.setToken(r.data!.token);
    return r.data;
  }

  async register(name: string, email: string, password: string, avatar?: File): Promise<{ token?: string; user?: User } | undefined> {
    // If avatar provided, send multipart/form-data
    if (avatar) {
      const form = new FormData();
      form.append("name", name);
      form.append("email", email);
      form.append("password", password);
      form.append("avatar", avatar, avatar.name);

      const r = await this.request<{ token: string; user: User }>('auth/register', {
        method: 'POST',
        body: form,
      });
      if (!r.ok) return undefined;
      this.setToken(r.data!.token);
      return r.data;
    }

    // fallback: JSON body
    const r = await this.request<{ token: string; user: User }>('auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (!r.ok) return undefined;
    this.setToken(r.data!.token);
    return r.data;
  }

  // Upload avatar separately after registration (optional)
  async uploadAvatar(userId: string, file: File): Promise<string | undefined> {
    const form = new FormData();
    form.append("avatar", file, file.name);
    const r = await this.request<{ url: string }>(`users/${userId}/avatar`, {
      method: "POST",
      body: form,
    });
    return r.ok ? r.data!.url : undefined;
  }

  async logout(): Promise<boolean> {
    const r = await this.request('auth/logout', { method: 'POST' });
    if (r.ok) this.setToken(null);
    return r.ok;
  }

  async getMe(): Promise<User | undefined> {
    const r = await this.request<User>('auth/me', { method: 'GET' });
    return r.ok ? r.data : undefined;
  }

  // Users
  async getUsers(q?: string, page?: number, limit?: number): Promise<User[] | undefined> {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (page != null) params.set('page', String(page));
    if (limit != null) params.set('limit', String(limit));
    const path = 'users' + (params.toString() ? `?${params.toString()}` : '');
    const r = await this.request<User[]>(path, { method: 'GET' });
    return r.ok ? r.data : undefined;
  }

  async getUser(id: string): Promise<User | undefined> {
    const r = await this.request<User>(`users/${id}`, { method: 'GET' });
    return r.ok ? r.data : undefined;
  }

  async createUser(user: Partial<User>): Promise<User | undefined> {
    const r = await this.request<User>('users', { method: 'POST', body: JSON.stringify(user) });
    return r.ok ? r.data : undefined;
  }

  async updateUser(id: string, user: Partial<User>): Promise<User | undefined> {
    const r = await this.request<User>(`users/${id}`, { method: 'PUT', body: JSON.stringify(user) });
    return r.ok ? r.data : undefined;
  }

  // Contacts
  async getContacts(userId: string): Promise<User[] | undefined> {
    const r = await this.request<User[]>(`users/${userId}/contacts`, { method: 'GET' });
    return r.ok ? r.data : undefined;
  }

  async addContact(userId: string, contactId: string): Promise<boolean> {
    const r = await this.request('contacts', {
      method: 'POST',
      body: JSON.stringify({ userId, contactId }),
    });
    return r.ok;
  }

  async deleteContact(userId: string, contactId: string): Promise<boolean> {
    const r = await this.request('contacts', {
      method: 'DELETE',
      body: JSON.stringify({ userId, contactId }),
    });
    return r.ok;
  }

  // Calls / signaling (REST helpers; actual SDP exchange via WS)
  async createCall(callerId: number, calleeIds: number[], options?: any): Promise<Call | undefined> {
    const r = await this.request<Call>('calls', { method: 'POST', body: JSON.stringify({ callerId, calleeIds, options }) });
    return r.ok ? r.data : undefined;
  }

  async getCall(callId: string): Promise<Call | undefined> {
    const r = await this.request<Call>(`calls/${callId}`, { method: 'GET' });
    return r.ok ? r.data : undefined;
  }

  async joinCall(callId: string, userId: number): Promise<boolean> {
    const r = await this.request(`calls/${callId}/join`, { method: 'POST', body: JSON.stringify({ userId }) });
    return r.ok;
  }

  async acceptCall(callId: string, userId: number): Promise<boolean> {
    const r = await this.request(`calls/${callId}/accept`, { method: 'POST', body: JSON.stringify({ userId }) });
    return r.ok;
  }

  async leaveCall(callId: string, userId: number): Promise<boolean> {
    const r = await this.request(`calls/${callId}/leave`, { method: 'POST', body: JSON.stringify({ userId }) });
    return r.ok;
  }

  async endCall(callId: string): Promise<boolean> {
    const r = await this.request(`calls/${callId}/end`, { method: 'POST' });
    return r.ok;
  }

  async getCallParticipants(callId: string): Promise<any[] | undefined> {
    const r = await this.request<any[]>(`calls/${callId}/participants`, { method: 'GET' });
    return r.ok ? r.data : undefined;
  }

  // History
  async addHistory(call: Call): Promise<boolean> {
    const r = await this.request('history', { method: 'POST', body: JSON.stringify(call) });
    return r.ok;
  }

  async getUserHistory(userId: string): Promise<Call[] | undefined> {
    const r = await this.request<Call[]>(`users/${userId}/history`, { method: 'GET' });
    return r.ok ? r.data : undefined;
  }

  async getHistory(id: string): Promise<Call | undefined> {
    const r = await this.request<Call>(`history/${id}`, { method: 'GET' });
    return r.ok ? r.data : undefined;
  }

  // Media control helpers
  async publishTrack(callId: string, publisherId: number, trackMeta: any): Promise<boolean> {
    const r = await this.request(`calls/${callId}/publish`, { method: 'POST', body: JSON.stringify({ publisherId, trackMeta }) });
    return r.ok;
  }

  async renegotiate(callId: string, targetUserId?: number): Promise<boolean> {
    const r = await this.request(`calls/${callId}/renegotiate`, { method: 'POST', body: JSON.stringify({ targetUserId }) });
    return r.ok;
  }
}

export const apiService = new ApiService();