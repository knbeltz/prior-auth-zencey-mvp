import { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import api from '../utils/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  preferences: {
    theme: 'light' | 'dark';
    notifications: {
      email: boolean;
      inApp: boolean;
    };
  };
  patientGroups: Array<{
    group: {
      _id: string;
      name: string;
      description: string;
    };
    permission: 'view' | 'edit' | 'admin';
  }>;
  notifications: Array<{
    _id: string;
    type: string;
    message: string;
    isRead: boolean;
    relatedGroup?: string;
    createdAt: string;
  }>;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'CLEAR_ERROR' };

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  loading: true,
  error: null,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        loading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        loading: false,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        loading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        loading: false,
        error: null,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  updatePreferences: (preferences: Partial<User['preferences']>) => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await api.get('/auth/me');
          
          if (response.data.success) {
            dispatch({
              type: 'AUTH_SUCCESS',
              payload: {
                user: response.data.user,
                token,
              },
            });
          } else {
            localStorage.removeItem('token');
            delete api.defaults.headers.common['Authorization'];
            dispatch({ type: 'LOGOUT' });
          }
        } catch (error) {
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
          dispatch({ type: 'LOGOUT' });
        }
      } else {
        dispatch({ type: 'LOGOUT' });
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      if (response.data.success) {
        const { user, token } = response.data;
        
        localStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, token },
        });

        notifications.show({
          title: 'Welcome back!',
          message: `Hello, ${user.firstName}!`,
          color: 'green',
        });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      
      notifications.show({
        title: 'Login Failed',
        message,
        color: 'red',
      });
      
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await api.post('/auth/register', data);

      if (response.data.success) {
        const { user, token } = response.data;
        
        localStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, token },
        });

        notifications.show({
          title: 'Account Created',
          message: `Welcome, ${user.firstName}!`,
          color: 'green',
        });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      
      notifications.show({
        title: 'Registration Failed',
        message,
        color: 'red',
      });
      
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    dispatch({ type: 'LOGOUT' });
    
    notifications.show({
      title: 'Logged Out',
      message: 'You have been successfully logged out',
      color: 'blue',
    });
  };

  const forgotPassword = async (email: string) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      
      if (response.data.success) {
        notifications.show({
          title: 'Reset Email Sent',
          message: 'Check your email for password reset instructions',
          color: 'green',
        });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to send reset email';
      notifications.show({
        title: 'Error',
        message,
        color: 'red',
      });
      throw error;
    }
  };

  const resetPassword = async (token: string, password: string) => {
    try {
      const response = await api.post('/auth/reset-password', {
        token,
        password,
      });

      if (response.data.success) {
        const { user, token: newToken } = response.data;
        
        localStorage.setItem('token', newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, token: newToken },
        });

        notifications.show({
          title: 'Password Reset',
          message: 'Your password has been successfully reset',
          color: 'green',
        });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Password reset failed';
      notifications.show({
        title: 'Reset Failed',
        message,
        color: 'red',
      });
      throw error;
    }
  };

  const updatePreferences = async (preferences: Partial<User['preferences']>) => {
    try {
      const response = await api.put('/auth/preferences', preferences);
      
      if (response.data.success) {
        dispatch({
          type: 'UPDATE_USER',
          payload: { preferences: response.data.preferences },
        });

        notifications.show({
          title: 'Preferences Updated',
          message: 'Your preferences have been saved',
          color: 'green',
        });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update preferences';
      notifications.show({
        title: 'Update Failed',
        message,
        color: 'red',
      });
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      
      if (response.data.success) {
        dispatch({
          type: 'UPDATE_USER',
          payload: response.data.user,
        });
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updatePreferences,
    clearError,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};