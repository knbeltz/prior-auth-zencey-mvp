import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import api from '../utils/api';

interface PatientGroup {
  _id: string;
  name: string;
  description: string;
  owner: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  members: Array<{
    user: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    permission: 'view' | 'edit' | 'admin';
    joinedAt: string;
  }>;
  patients: any[];
  memberCount: number;
  patientCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PatientGroupState {
  patientGroups: PatientGroup[] | null;
  currentGroup: PatientGroup | null;
  loading: boolean;
  error: string | null;
}

type PatientGroupAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: PatientGroup[] }
  | { type: 'FETCH_GROUP_SUCCESS'; payload: PatientGroup }
  | { type: 'FETCH_FAILURE'; payload: string }
  | { type: 'CREATE_SUCCESS'; payload: PatientGroup }
  | { type: 'UPDATE_SUCCESS'; payload: PatientGroup }
  | { type: 'DELETE_SUCCESS'; payload: string }
  | { type: 'CLEAR_ERROR' };

const initialState: PatientGroupState = {
  patientGroups: null,
  currentGroup: null,
  loading: false,
  error: null,
};

const patientGroupReducer = (state: PatientGroupState, action: PatientGroupAction): PatientGroupState => {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        loading: true,
        error: null,
      };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        patientGroups: action.payload,
        loading: false,
        error: null,
      };
    case 'FETCH_GROUP_SUCCESS':
      return {
        ...state,
        currentGroup: action.payload,
        loading: false,
        error: null,
      };
    case 'FETCH_FAILURE':
      return {
        ...state,
        loading: false,
        error: action.payload,
      };
    case 'CREATE_SUCCESS':
      return {
        ...state,
        patientGroups: state.patientGroups ? [...state.patientGroups, action.payload] : [action.payload],
        loading: false,
        error: null,
      };
    case 'UPDATE_SUCCESS':
      return {
        ...state,
        patientGroups: state.patientGroups 
          ? state.patientGroups.map(group => 
              group._id === action.payload._id ? action.payload : group
            )
          : null,
        currentGroup: state.currentGroup?._id === action.payload._id ? action.payload : state.currentGroup,
        loading: false,
        error: null,
      };
    case 'DELETE_SUCCESS':
      return {
        ...state,
        patientGroups: state.patientGroups 
          ? state.patientGroups.filter(group => group._id !== action.payload)
          : null,
        currentGroup: state.currentGroup?._id === action.payload ? null : state.currentGroup,
        loading: false,
        error: null,
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

interface PatientGroupContextType extends PatientGroupState {
  fetchPatientGroups: () => Promise<void>;
  fetchPatientGroup: (id: string) => Promise<void>;
  createPatientGroup: (data: CreatePatientGroupData) => Promise<void>;
  updatePatientGroup: (id: string, data: Partial<CreatePatientGroupData>) => Promise<void>;
  deletePatientGroup: (id: string) => Promise<void>;
  inviteToGroup: (groupId: string, email: string, permission: 'view' | 'edit') => Promise<void>;
  joinGroup: (token: string) => Promise<void>;
  clearError: () => void;
}

interface CreatePatientGroupData {
  name: string;
  description?: string;
}

const PatientGroupContext = createContext<PatientGroupContextType | undefined>(undefined);

export const usePatientGroup = () => {
  const context = useContext(PatientGroupContext);
  if (context === undefined) {
    throw new Error('usePatientGroup must be used within a PatientGroupProvider');
  }
  return context;
};

interface PatientGroupProviderProps {
  children: ReactNode;
}

export const PatientGroupProvider = ({ children }: PatientGroupProviderProps) => {
  const [state, dispatch] = useReducer(patientGroupReducer, initialState);

  const fetchPatientGroups = async () => {
    try {
      dispatch({ type: 'FETCH_START' });
      const response = await api.get('/patient-groups');
      
      if (response.data.success) {
        dispatch({ type: 'FETCH_SUCCESS', payload: response.data.patientGroups });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch patient groups';
      dispatch({ type: 'FETCH_FAILURE', payload: message });
    }
  };

  const fetchPatientGroup = async (id: string) => {
    try {
      dispatch({ type: 'FETCH_START' });
      const response = await api.get(`/patient-groups/${id}`);
      
      if (response.data.success) {
        dispatch({ type: 'FETCH_GROUP_SUCCESS', payload: response.data.patientGroup });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch patient group';
      dispatch({ type: 'FETCH_FAILURE', payload: message });
    }
  };

  const createPatientGroup = async (data: CreatePatientGroupData) => {
    try {
      dispatch({ type: 'FETCH_START' });
      const response = await api.post('/patient-groups', data);
      
      if (response.data.success) {
        dispatch({ type: 'CREATE_SUCCESS', payload: response.data.patientGroup });
        notifications.show({
          title: 'Success',
          message: 'Patient group created successfully',
          color: 'green',
        });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to create patient group';
      dispatch({ type: 'FETCH_FAILURE', payload: message });
      notifications.show({
        title: 'Error',
        message,
        color: 'red',
      });
      throw error;
    }
  };

  const updatePatientGroup = async (id: string, data: Partial<CreatePatientGroupData>) => {
    try {
      dispatch({ type: 'FETCH_START' });
      const response = await api.put(`/patient-groups/${id}`, data);
      
      if (response.data.success) {
        dispatch({ type: 'UPDATE_SUCCESS', payload: response.data.patientGroup });
        notifications.show({
          title: 'Success',
          message: 'Patient group updated successfully',
          color: 'green',
        });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update patient group';
      dispatch({ type: 'FETCH_FAILURE', payload: message });
      notifications.show({
        title: 'Error',
        message,
        color: 'red',
      });
      throw error;
    }
  };

  const deletePatientGroup = async (id: string) => {
    try {
      dispatch({ type: 'FETCH_START' });
      const response = await api.delete(`/patient-groups/${id}`);
      
      if (response.data.success) {
        dispatch({ type: 'DELETE_SUCCESS', payload: id });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to delete patient group';
      dispatch({ type: 'FETCH_FAILURE', payload: message });
      throw error;
    }
  };

  const inviteToGroup = async (groupId: string, email: string, permission: 'view' | 'edit') => {
    try {
      const response = await api.post(`/patient-groups/${groupId}/invite`, {
        email,
        permission,
      });
      
      if (response.data.success) {
        notifications.show({
          title: 'Invitation Sent',
          message: `Invitation sent to ${email}`,
          color: 'green',
        });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to send invitation';
      notifications.show({
        title: 'Error',
        message,
        color: 'red',
      });
      throw error;
    }
  };

  const joinGroup = async (token: string) => {
    try {
      const response = await api.post(`/patient-groups/join/${token}`);
      
      if (response.data.success) {
        // Refresh the patient groups list
        await fetchPatientGroups();
        notifications.show({
          title: 'Success',
          message: 'Successfully joined the patient group',
          color: 'green',
        });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to join group';
      notifications.show({
        title: 'Error',
        message,
        color: 'red',
      });
      throw error;
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: PatientGroupContextType = {
    ...state,
    fetchPatientGroups,
    fetchPatientGroup,
    createPatientGroup,
    updatePatientGroup,
    deletePatientGroup,
    inviteToGroup,
    joinGroup,
    clearError,
  };

  return (
    <PatientGroupContext.Provider value={value}>
      {children}
    </PatientGroupContext.Provider>
  );
};