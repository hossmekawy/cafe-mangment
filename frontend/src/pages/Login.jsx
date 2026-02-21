import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiUser, FiCoffee } from 'react-icons/fi';
import toast from 'react-hot-toast';

const Login = () => {
  const [isPinMode, setIsPinMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, pinLogin } = useAuthStore();
  const { settings, fetchSettings } = useSettingsStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    let res;
    let loadingToast = toast.loading('Authenticating...');

    if (isPinMode) {
        if (!pin || !username) {
            toast.dismiss(loadingToast);
            toast.error("Username and PIN are required.");
            setLoading(false);
            return;
        }
        res = await pinLogin(username, pin);
    } else {
        if (!password || !username) {
            toast.dismiss(loadingToast);
            toast.error("Username and password are required.");
            setLoading(false);
            return;
        }
        res = await login(username, password);
    }

    toast.dismiss(loadingToast);
    setLoading(false);
    
    if (res?.success) {
      toast.success("Welcome back!");
      navigate('/');
    } else {
      toast.error(res?.error || 'Failed to login');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 sm:px-6 lg:px-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0F172A] to-[#0B1120]">
      
      <div className="max-w-md w-full space-y-8 glass-panel p-10 animate-fade-in relative overflow-hidden">
        {/* Decorative flair */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl shadow-2xl"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl shadow-2xl"></div>

        <div className="relative text-center flex flex-col items-center">
          {settings?.logo_base64 ? (
              <img src={settings.logo_base64} alt="Brand Logo" className="w-20 h-20 object-contain mb-4 drop-shadow-lg" />
          ) : (
              <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 border border-primary/50 shadow-lg mb-2">
                  <FiCoffee className="w-10 h-10 text-primary" />
              </div>
          )}
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white mb-2">
            {settings?.brand_name || 'Cafe System'}
          </h2>
          <p className="text-sm text-textMuted font-medium">
            Sign in to access your dashboard
          </p>
        </div>

        <form className="mt-8 space-y-6 relative" onSubmit={handleLogin}>
          
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiUser className="h-5 w-5 text-textMuted" />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="glass-input block w-full pl-10"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            
            {isPinMode ? (
               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                   <FiLock className="h-5 w-5 text-textMuted" />
                 </div>
                 <input
                   id="pin"
                   name="pin"
                   type="password"
                   inputMode="numeric"
                   maxLength={6}
                   required
                   className="glass-input block w-full pl-10 tracking-widest text-center text-xl"
                   placeholder="PIN"
                   value={pin}
                   onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} // Numeric only
                 />
               </div>
            ) : (
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="h-5 w-5 text-textMuted" />
                    </div>
                    <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="glass-input block w-full pl-10"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </div>
        </form>
        
        <div className="text-center mt-6 relative">
            <button 
                type="button"
                onClick={() => {
                    setIsPinMode(!isPinMode);
                    setPin('');
                    setPassword('');
                }}
                className="text-sm font-medium text-primary hover:text-blue-400 transition-colors"
            >
                {isPinMode ? "Use standard password instead" : "Use Staff PIN Code"}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
