import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-textMain p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center glass-panel p-6">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Cafe System Dashboard
            </h1>
            <p className="text-textMuted mt-1">Welcome back, {user?.name || user?.username}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="font-semibold">{user?.role?.toUpperCase()}</p>
            </div>
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Quick Actions / Cards could go here */}
            <div className="glass-panel p-6 hover:border-primary/50 transition-colors">
                <h3 className="text-lg font-semibold mb-2">POS Terminal</h3>
                <p className="text-textMuted text-sm">Open the point of sale interface to take orders.</p>
            </div>
            
            {['manager', 'super_admin'].includes(user?.role) && (
                <div 
                    className="glass-panel p-6 hover:border-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate('/settings')}
                >
                    <h3 className="text-lg font-semibold mb-2 text-accent">Global Settings</h3>
                    <p className="text-textMuted text-sm">Configure VAT, receipt details, and brand name.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
