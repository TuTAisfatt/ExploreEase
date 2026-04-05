import { useAuthContext } from '../context/AuthContext';

const useAuth = () => {
  const { user, userProfile, loading, refreshProfile } = useAuthContext();
  return { user, userProfile, loading, refreshProfile, isAuthenticated: !!user };
};

export default useAuth;
