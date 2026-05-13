import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

export interface AuthUser {
  id: number;
  characterId: number;
  characterName: string;
  role: 'admin' | 'member' | 'readonly';
  corpMode: boolean;
  compactMode: boolean;
  snapToGrid: boolean;
  showMinimap: boolean;
  panelOrder: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: AuthUser | null }>('/auth/me')
      .then((d) => {
        setUser(d.user);
        if (d.user) {
          localStorage.setItem('nexum:last_character', JSON.stringify({
            characterId:   d.user.characterId,
            characterName: d.user.characterName,
          }));
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
