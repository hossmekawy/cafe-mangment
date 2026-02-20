import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">POS Terminal</h2>
          <p className="text-textMuted">Welcome back, {user?.name || user?.username}. Select an action below.</p>
      </div>

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
  );
};

export default Dashboard;
