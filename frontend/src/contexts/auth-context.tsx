import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "@/types/index";
import { apiService } from "@/api/apiService";
import { wsClient } from "@/api/webSocketClient";

type AuthState = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
};

interface RegisterData {
  name:     string
  email:    string
  password: string
}

interface ProfileData {
  avatar: File | null;
}
type AuthContextType = AuthState & {
  login: (token: string, user?: User | null) => Promise<void>;
  logout: () => void;
  loginWithCredentials?: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => void;
  completeRegistration: (profileData: ProfileData) => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const STORAGE_KEY = "facetime_auth";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [registerData, setRegisterData] = useState<RegisterData | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { token?: string; user?: User };
      if (parsed.token) setToken(parsed.token);
      if (parsed.user) setUser(parsed.user);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const payload = { token, user };
    if (token || user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [token, user]);

  const login = async (t: string, u?: User | null) => {
    setToken(t);
    wsClient.setWsUrl(process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws");
    wsClient.setToken(t); 
    wsClient.connect();
    if (u) {
      setUser(u);
      return;
    }
    try {
      apiService.getMe()
      .then(me => {
        if (me) {
          setUser(me)
        }
      })

    } catch {
      // ignore - caller may supply user later
    }
  };

  const loginWithCredentials = async (email: string, password: string) => {
    const res = await apiService.login(email, password);
    if (!res || !res.token) {
      throw new Error("login failed");
    }
    await login(res.token, res.user ?? null);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
   // clear token in ws client and disconnect
   wsClient.setToken(null);
   wsClient.disconnect();
  };

  const register = (userData: RegisterData) => {
    try {
      setRegisterData(userData);
    }
    catch(error: any) {
      console.log("Error while registering: " + error);
    }
  }

  const completeRegistration = async (profileData: ProfileData) => {
     if (!registerData) {
      console.log("Registration data doesnot exist roll back to registration page")
      //TODO: rollback to registration page
      return
     }
     apiService.register(registerData.name, registerData.email, registerData.password)
     .then(res => {
        if (!res) {
          //TODO: error handling
          return
        }
        if (res.token) setToken(res.token)
        if (res.user) setUser(res.user)
     })
  }

  const refreshUser = async () => {
    if (!token) return;
    try {
      await apiService.getMe()
      .then(me => {
        if (me) {
          setUser(me)
        }
      })
    } catch {
      // ignore

    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token,
    login,
    loginWithCredentials,
    register,
    completeRegistration,
    logout,
    refreshUser,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}