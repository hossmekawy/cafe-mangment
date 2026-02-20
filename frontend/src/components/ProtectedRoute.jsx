import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { useEffect } from 'react';

const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, user, isLoading, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified and user role is not in the list, redirect to home/unauthorized
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Otherwise, render the child routes
  return <Outlet />;
};

export default ProtectedRoute;
