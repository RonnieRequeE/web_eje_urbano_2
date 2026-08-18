import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Shield, 
  MapPin, 
  BookOpen, 
  Cpu, 
  Download, 
  LayoutDashboard, 
  LogOut, 
  Users, 
  AlertTriangle, 
  Smartphone, 
  Home, 
  Lock, 
  UserPlus, 
  ChevronRight,
  Info,
  Activity,
  CheckCircle,
  Bell,
  RefreshCw,
  Menu,
  X
} from 'lucide-react';

export default function App() {
  const [currentPage, setCurrentPage] = useState('home'); // 'home', 'features', 'manual', 'iot', 'download', 'dashboard'
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);

  // Dashboard Stats
  const [stats, setStats] = useState({
    activeAlerts: 0,
    totalUsers: 0,
    totalDevices: 0,
    totalCommunities: 0
  });

  // Lists in dashboard
  const [alertas, setAlertas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [dispositivos, setDispositivos] = useState([]);
  const [dashboardTab, setDashboardTab] = useState('alertas'); // 'alertas', 'usuarios', 'comunidades', 'dispositivos'

  // Form states for creating resources
  const [newComunidad, setNewComunidad] = useState({ nombre: '', descripcion: '' });
  const [newUsuario, setNewUsuario] = useState({ id: '', nombre: '', rol: 'vecino', direccion: '', id_comunidad: '' });
  const [newDispositivo, setNewDispositivo] = useState({ id_usuario: '', mac_address: '', tipo: 'sirena', id_comunidad: '' });
  const [formLoading, setFormLoading] = useState(false);

  const [userProfile, setUserProfile] = useState(null); // { rol, id_comunidad, nombre }
  const [mapTheme, setMapTheme] = useState('dark'); // 'dark' or 'light'
  const [selectedAlerta, setSelectedAlerta] = useState(null); // focused alert coordinates {lat, lng, id}
  const [activeFeatureModal, setActiveFeatureModal] = useState(null); // 'sos' or 'map' or null
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(null);
  const [requestTimestamps, setRequestTimestamps] = useState([]); // for rate limiting / flood protection
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check auth status
  useEffect(() => {
    const loadProfile = async (sessionUser) => {
      if (!sessionUser) {
        setUserProfile(null);
        return;
      }
      try {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('id, nombre, rol, id_comunidad, comunidad:comunidades(nombre)')
          .eq('id', sessionUser.id)
          .single();
        if (profile) {
          setUserProfile({
            id: profile.id,
            nombre: profile.nombre,
            rol: profile.rol,
            id_comunidad: profile.id_comunidad,
            nombre_comunidad: profile.comunidad?.nombre || ''
          });
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user);
        setCurrentPage('dashboard');
      }
      setLoadingUser(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user);
        setCurrentPage('dashboard');
      } else {
        setUserProfile(null);
        if (currentPage === 'dashboard') {
          setCurrentPage('home');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Dashboard Stats & Realtime subscriptions
  useEffect(() => {
    if (!user || currentPage !== 'dashboard') return;

    fetchStats();
    fetchAlertas();
    fetchUsuarios();
    fetchComunidades();
    fetchDispositivos();

    // Subscribe to new Alerts in Realtime!
    const alertsSubscription = supabase
      .channel('realtime_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, (payload) => {
        fetchAlertas();
        fetchStats();
        // Play warning beep if a new active alert arrives
        if (payload.new && payload.new.estado === 'activa') {
          try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
          } catch (e) {
            console.log("Audio feedback error: ", e);
          }
        }
      })
      .subscribe();

    // Subscribe to user list changes
    const usersSubscription = supabase
      .channel('realtime_users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => {
        fetchUsuarios();
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(alertsSubscription);
      supabase.removeChannel(usersSubscription);
    };
  }, [user, currentPage]);

  const fetchStats = async () => {
    try {
      let alertsQuery = supabase.from('alertas').select('*', { count: 'exact', head: true }).eq('estado', 'activa');
      let usersQuery = supabase.from('usuarios').select('*', { count: 'exact', head: true });
      let devicesQuery = supabase.from('dispositivos').select('*', { count: 'exact', head: true });
      let communitiesQuery = supabase.from('comunidades').select('*', { count: 'exact', head: true });

      if (userProfile && userProfile.rol === 'admin' && userProfile.id_comunidad) {
        alertsQuery = alertsQuery.eq('id_comunidad', userProfile.id_comunidad);
        usersQuery = usersQuery.eq('id_comunidad', userProfile.id_comunidad);
        devicesQuery = devicesQuery.eq('id_comunidad', userProfile.id_comunidad);
        communitiesQuery = communitiesQuery.eq('id', userProfile.id_comunidad);
      }

      const { count: activeAlertsCount } = await alertsQuery;
      const { count: usersCount } = await usersQuery;
      const { count: devicesCount } = await devicesQuery;
      const { count: communitiesCount } = await communitiesQuery;

      setStats({
        activeAlerts: activeAlertsCount || 0,
        totalUsers: usersCount || 0,
        totalDevices: devicesCount || 0,
        totalCommunities: communitiesCount || 0
      });
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchAlertas = async () => {
    let query = supabase
      .from('alertas')
      .select('*, emisor:usuarios(nombre), comunidad:comunidades(nombre)');
    
    if (userProfile && userProfile.rol === 'admin' && userProfile.id_comunidad) {
      query = query.eq('id_comunidad', userProfile.id_comunidad);
    }

    const { data } = await query.order('created_at', { ascending: false });
    if (data) setAlertas(data);
  };

  const fetchUsuarios = async () => {
    let query = supabase
      .from('usuarios')
      .select('*, comunidad:comunidades(nombre)');

    if (userProfile && userProfile.rol === 'admin' && userProfile.id_comunidad) {
      query = query.eq('id_comunidad', userProfile.id_comunidad);
    }

    const { data } = await query.order('created_at', { ascending: false });
    if (data) setUsuarios(data);
  };

  const fetchComunidades = async () => {
    let query = supabase.from('comunidades').select('*');

    if (userProfile && userProfile.rol === 'admin' && userProfile.id_comunidad) {
      query = query.eq('id', userProfile.id_comunidad);
    }

    const { data } = await query.order('created_at', { ascending: false });
    if (data) setComunidades(data);
  };

  const fetchDispositivos = async () => {
    let query = supabase
      .from('dispositivos')
      .select('*, usuario:usuarios(nombre), comunidad:comunidades(nombre)');

    if (userProfile && userProfile.rol === 'admin' && userProfile.id_comunidad) {
      query = query.eq('id_comunidad', userProfile.id_comunidad);
    }

    const { data } = await query.order('created_at', { ascending: false });
    if (data) setDispositivos(data);
  };

  // Auth actions
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    // --- SECURITY 1: Flood Protection (Saturación) ---
    const now = Date.now();
    const activeRequests = requestTimestamps.filter(timestamp => now - timestamp < 10000); // last 10 seconds
    if (activeRequests.length >= 10) {
      setLoginError('Saturación de peticiones detectada. Por favor, espera unos segundos.');
      return;
    }
    setRequestTimestamps([...activeRequests, now]);

    // --- SECURITY 2: Brute Force Protection (Intentos) ---
    if (lockUntil && now < lockUntil) {
      const remainingSeconds = Math.ceil((lockUntil - now) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      setLoginError(`Demasiados intentos fallidos. Inténtalo de nuevo en ${remainingMinutes} minuto(s).`);
      return;
    }

    setFormLoading(true);

    // --- SECURITY 3: SQL Injection Protection (Sanitización) ---
    // Remove characters often used in classic SQL injection attempts for fields
    const sanitizedEmail = email.replace(/['";\-/\*]/g, '').trim();
    
    // Validate email pattern to ensure safe input
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      setLoginError('Formato de correo electrónico inválido o malicioso.');
      setFormLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: sanitizedEmail, 
        password: password 
      });
      
      if (error) throw error;
      
      // Verify role in usuarios table using parameter bindings (Supabase JS auto-binds params safely)
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', data.user.id)
        .single();

      if (userError || !userData || !['admin', 'super_admin'].includes(userData.rol)) {
        await supabase.auth.signOut();
        throw new Error('No tienes permisos de administrador para ingresar al panel.');
      }

      // Success: Reset brute force tracker
      setLoginAttempts(0);
      setLockUntil(null);
      setUser(data.user);
      setCurrentPage('dashboard');
    } catch (err) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      if (newAttempts >= 3) {
        const lockTime = now + 5 * 60 * 1000; // 5 minutes lock
        setLockUntil(lockTime);
        setLoginError('Demasiados intentos fallidos. Tu cuenta ha sido bloqueada por 5 minutos.');
      } else {
        setLoginError(`${err.message || 'Error al iniciar sesión'}. Intentos fallidos: ${newAttempts}/3`);
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentPage('home');
  };

  // Toggle Alert status (Deactivate Emergency)
  const handleToggleAlerta = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'activa' ? 'finalizada' : 'activa';
    await supabase
      .from('alertas')
      .update({ estado: nextStatus })
      .eq('id', id);
    fetchAlertas();
    fetchStats();
  };

  // Create Comunidad
  const handleCreateComunidad = async (e) => {
    e.preventDefault();
    if (userProfile && userProfile.rol !== 'super_admin') {
      alert("Solo el Super Administrador puede crear comunidades.");
      return;
    }
    setFormLoading(true);
    const { error } = await supabase
      .from('comunidades')
      .insert([newComunidad]);
    if (!error) {
      setNewComunidad({ nombre: '', descripcion: '' });
      fetchComunidades();
      fetchStats();
    }
    setFormLoading(false);
  };

  // Create Usuario (Vecino)
  const handleCreateUsuario = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    const payload = { ...newUsuario };
    if (userProfile && userProfile.rol === 'admin' && userProfile.id_comunidad) {
      payload.id_comunidad = userProfile.id_comunidad;
    }
    const { error } = await supabase
      .from('usuarios')
      .insert([payload]);
    if (!error) {
      setNewUsuario({ id: '', nombre: '', rol: 'vecino', direccion: '', id_comunidad: '' });
      fetchUsuarios();
      fetchStats();
    } else {
      alert("Error al crear usuario: " + error.message);
    }
    setFormLoading(false);
  };

  // Create Dispositivo
  const handleCreateDispositivo = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    const payload = { ...newDispositivo };
    if (userProfile && userProfile.rol === 'admin' && userProfile.id_comunidad) {
      payload.id_comunidad = userProfile.id_comunidad;
    }
    const { error } = await supabase
      .from('dispositivos')
      .insert([payload]);
    if (!error) {
      setNewDispositivo({ id_usuario: '', mac_address: '', tipo: 'sirena', id_comunidad: '' });
      fetchDispositivos();
      fetchStats();
    } else {
      alert("Error al vincular dispositivo: " + error.message);
    }
    setFormLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex flex-col font-sans relative">
      
      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-[#1E88E5]/5 rounded-full blur-[150px] pointer-events-none -z-10"></div>
      <div className="absolute bottom-10 left-1/3 w-[450px] h-[450px] bg-red-500/5 rounded-full blur-[130px] pointer-events-none -z-10"></div>

      {/* Navigation Header */}
      <header className="px-4 md:px-8 py-4 relative z-50">
        <nav className="max-w-7xl mx-auto glassmorphism rounded-2xl px-6 py-4 flex items-center justify-between">
          <a href="#" onClick={() => { setCurrentPage('home'); setMobileMenuOpen(false); }} className="flex items-center">
            <img src="images/image.png" alt="Eje Urbano Logo" className="h-10 w-auto object-contain rounded-xl" />
          </a>

          {/* Links for desktop visitors */}
          {currentPage !== 'dashboard' && (
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
              <button onClick={() => setCurrentPage('features')} className={`hover:text-[#00E5FF] transition-colors ${currentPage === 'features' ? 'text-[#00E5FF]' : ''}`}>Funcionalidades</button>
              <button onClick={() => setCurrentPage('manual')} className={`hover:text-[#00E5FF] transition-colors ${currentPage === 'manual' ? 'text-[#00E5FF]' : ''}`}>Manual de Usuario</button>
              <button onClick={() => setCurrentPage('iot')} className={`hover:text-[#00E5FF] transition-colors ${currentPage === 'iot' ? 'text-[#00E5FF]' : ''}`}>Hardware IoT</button>
              <button onClick={() => setCurrentPage('download')} className={`hover:text-[#00E5FF] transition-colors ${currentPage === 'download' ? 'text-[#00E5FF]' : ''}`}>Descargas</button>
            </div>
          )}

          {/* Auth controls and Mobile Menu Trigger */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-4">
                  <button onClick={() => setCurrentPage('dashboard')} className="px-4 py-2 rounded-xl bg-sky-950 text-[#00E5FF] border border-[#00E5FF]/20 text-xs font-semibold flex items-center gap-1.5">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Panel Activo
                  </button>
                  <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors" title="Cerrar Sesión">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setCurrentPage('login')} className="px-5 py-2.5 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-semibold text-sm transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5">
                  Acceder al Panel
                </button>
              )}
            </div>

            {/* Mobile Hamburger Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </nav>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-4 right-4 mt-2 glassmorphism rounded-2xl p-6 border border-white/5 flex flex-col gap-4 shadow-2xl animate-fade-in z-[1000]">
            {currentPage !== 'dashboard' && (
              <div className="flex flex-col gap-3">
                <button onClick={() => { setCurrentPage('features'); setMobileMenuOpen(false); }} className={`text-left py-2 px-4 rounded-xl hover:bg-white/5 text-sm font-medium ${currentPage === 'features' ? 'text-[#00E5FF] bg-white/5' : 'text-gray-300'}`}>Funcionalidades</button>
                <button onClick={() => { setCurrentPage('manual'); setMobileMenuOpen(false); }} className={`text-left py-2 px-4 rounded-xl hover:bg-white/5 text-sm font-medium ${currentPage === 'manual' ? 'text-[#00E5FF] bg-white/5' : 'text-gray-300'}`}>Manual de Usuario</button>
                <button onClick={() => { setCurrentPage('iot'); setMobileMenuOpen(false); }} className={`text-left py-2 px-4 rounded-xl hover:bg-white/5 text-sm font-medium ${currentPage === 'iot' ? 'text-[#00E5FF] bg-white/5' : 'text-gray-300'}`}>Hardware IoT</button>
                <button onClick={() => { setCurrentPage('download'); setMobileMenuOpen(false); }} className={`text-left py-2 px-4 rounded-xl hover:bg-white/5 text-sm font-medium ${currentPage === 'download' ? 'text-[#00E5FF] bg-white/5' : 'text-gray-300'}`}>Descargas</button>
              </div>
            )}
            <div className="border-t border-white/5 pt-3 flex flex-col gap-3">
              {user ? (
                <>
                  <button onClick={() => { setCurrentPage('dashboard'); setMobileMenuOpen(false); }} className="w-full py-3 rounded-xl bg-sky-950 text-[#00E5FF] border border-[#00E5FF]/20 text-sm font-semibold flex items-center justify-center gap-1.5">
                    <LayoutDashboard className="w-4 h-4" />
                    Panel Activo
                  </button>
                  <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-semibold flex items-center justify-center gap-1.5">
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </button>
                </>
              ) : (
                <button onClick={() => { setCurrentPage('login'); setMobileMenuOpen(false); }} className="w-full py-3 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] text-white font-bold text-sm text-center">
                  Acceder al Panel
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-grow">
        
        {/* PAGE: HOME */}
        {currentPage === 'home' && (
          <div className="max-w-7xl mx-auto px-4 md:px-8 pt-12 pb-24 md:pt-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              <div className="lg:col-span-7 flex flex-col justify-center text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-950/60 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-semibold self-center lg:self-start mb-6">
                  <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping"></span>
                  Ecosistema Activo de Seguridad Vecinal
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight title-gradient leading-tight mb-6">
                  Seguridad comunitaria inteligente en tus manos
                </h1>
                <p className="text-lg text-gray-400 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8">
                  Eje Urbano unifica una potente aplicación móvil para vecinos con botones de pánico físicos y sirenas sonoras ESP32. Protege a tu comunidad en tiempo real.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <button onClick={() => setCurrentPage('download')} className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-bold transition-all text-center flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25">
                    <Download className="w-5 h-5" />
                    Descargar Aplicación (APK)
                  </button>
                  <button onClick={() => setCurrentPage('manual')} className="w-full sm:w-auto px-8 py-4 rounded-xl border border-gray-700 hover:border-[#00E5FF]/50 hover:bg-gray-900/40 text-gray-300 transition-all text-center font-medium">
                    Conocer más (Manual)
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 flex justify-center items-center">
                <div className="relative w-[286px] h-[620px] rounded-[34px] p-[5px] bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 glow-cyan shadow-2xl overflow-hidden">
                  <div className="w-full h-full rounded-[30px] bg-black relative overflow-hidden flex flex-col">
                    <div className="absolute top-2.5 left-1/2 transform -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-black border border-slate-900 z-30 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                    </div>
                    <div className="flex-1 flex flex-col select-none relative bg-[#0F172A] overflow-hidden">
                      <img src="images/extracted_img_3.png" alt="App Screenshot" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-40 pointer-events-none z-20"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20 border-t border-white/5 pt-16">
              <button onClick={() => setCurrentPage('features')} className="p-6 rounded-2xl glass-card text-left flex flex-col justify-between group">
                <div>
                  <span className="w-10 h-10 rounded-lg bg-sky-950/60 text-[#00E5FF] flex items-center justify-center mb-4 border border-[#00E5FF]/20 group-hover:scale-110 transition-transform">
                    💡
                  </span>
                  <h3 className="text-lg font-bold text-white mb-2">Funcionalidades</h3>
                  <p class="text-sm text-gray-400 leading-relaxed">Conoce el sistema de geolocalización, chat y alertas SOS comunitarias.</p>
                </div>
                <span className="text-xs text-[#00E5FF] font-semibold mt-6 inline-flex items-center gap-1 group-hover:underline">
                  Ver más
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>

              <button onClick={() => setCurrentPage('manual')} className="p-6 rounded-2xl glass-card text-left flex flex-col justify-between group">
                <div>
                  <span className="w-10 h-10 rounded-lg bg-sky-950/60 text-[#00E5FF] flex items-center justify-center mb-4 border border-[#00E5FF]/20 group-hover:scale-110 transition-transform">
                    📖
                  </span>
                  <h3 className="text-lg font-bold text-white mb-2">Manual de Usuario</h3>
                  <p class="text-sm text-gray-400 leading-relaxed">Guía paso a paso sobre el funcionamiento operativo y flujos de usuario.</p>
                </div>
                <span className="text-xs text-[#00E5FF] font-semibold mt-6 inline-flex items-center gap-1 group-hover:underline">
                  Leer manual
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>

              <button onClick={() => setCurrentPage('iot')} className="p-6 rounded-2xl glass-card text-left flex flex-col justify-between group">
                <div>
                  <span className="w-10 h-10 rounded-lg bg-sky-950/60 text-[#00E5FF] flex items-center justify-center mb-4 border border-[#00E5FF]/20 group-hover:scale-110 transition-transform">
                    🔌
                  </span>
                  <h3 className="text-lg font-bold text-white mb-2">Hardware IoT</h3>
                  <p class="text-sm text-gray-400 leading-relaxed">Descubre la sincronización nativa con sirenas y botones ESP32.</p>
                </div>
                <span className="text-xs text-[#00E5FF] font-semibold mt-6 inline-flex items-center gap-1 group-hover:underline">
                  Ver integración
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>

              <button onClick={() => setCurrentPage('download')} className="p-6 rounded-2xl glass-card text-left flex flex-col justify-between group">
                <div>
                  <span className="w-10 h-10 rounded-lg bg-sky-950/60 text-[#00E5FF] flex items-center justify-center mb-4 border border-[#00E5FF]/20 group-hover:scale-110 transition-transform">
                    📥
                  </span>
                  <h3 className="text-lg font-bold text-white mb-2">Descargas</h3>
                  <p class="text-sm text-gray-400 leading-relaxed">Obtén el archivo APK de instalación y los recursos necesarios.</p>
                </div>
                <span className="text-xs text-[#00E5FF] font-semibold mt-6 inline-flex items-center gap-1 group-hover:underline">
                  Ir a descargas
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* PAGE: FEATURES */}
        {currentPage === 'features' && (
          <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 animate-fade-in">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h1 className="text-emerald-400 text-sm font-bold tracking-widest uppercase mb-3">Seguridad Avanzada</h1>
              <p className="text-4xl font-extrabold tracking-tight text-white leading-tight">
                Protección comunitaria en cada segundo
              </p>
              <p className="text-gray-400 mt-4 leading-relaxed">
                Eje Urbano combina geolocalización, hardware IoT y comunicación directa para ofrecer respuesta inmediata ante cualquier peligro. Haz clic en las tarjetas para conocer más detalles.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              
              {/* SOS Card */}
              <div 
                onClick={() => setActiveFeatureModal('sos')}
                className="rounded-3xl p-8 glass-card flex flex-col justify-between cursor-pointer hover:border-red-500/40 hover:shadow-red-500/5 group"
              >
                <div>
                  <span className="w-14 h-14 rounded-2xl bg-red-950/60 text-red-400 border border-red-500/20 flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
                    <AlertTriangle className="w-7 h-7" />
                  </span>
                  <h3 className="text-2xl font-bold text-white mb-4 flex items-center justify-between">
                    Alertas SOS Comunitarias
                    <span className="text-xs text-red-400 font-semibold px-2.5 py-0.5 rounded-full bg-red-950/50 border border-red-500/20">Ver Detalle</span>
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    Envía notificaciones de emergencia con un solo toque. Captura tus coordenadas GPS reales y activa al instante las alertas sonoras y visuales en los celulares de todos los vecinos y administradores dentro de tu comunidad.
                  </p>
                </div>
                <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  <span className="text-xs text-gray-400">Notificación Push Prioritaria</span>
                </div>
              </div>

              {/* Map Card */}
              <div 
                onClick={() => setActiveFeatureModal('map')}
                className="rounded-3xl p-8 glass-card flex flex-col justify-between cursor-pointer hover:border-sky-500/40 hover:shadow-sky-500/5 group"
              >
                <div>
                  <span className="w-14 h-14 rounded-2xl bg-sky-950/60 text-sky-400 border border-sky-500/20 flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
                    <MapPin className="w-7 h-7" />
                  </span>
                  <h3 className="text-2xl font-bold text-white mb-4 flex items-center justify-between">
                    Mapas en Tiempo Real
                    <span className="text-xs text-[#00E5FF] font-semibold px-2.5 py-0.5 rounded-full bg-sky-950/50 border border-sky-500/20">Ver Detalle</span>
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    Visualización dinámica de la ubicación de los incidentes en Google Maps. Ubica exactamente de dónde proviene la señal de auxilio para acudir a prestar asistencia de inmediato.
                  </p>
                </div>
                <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-[#00E5FF]"></span>
                  <span className="text-xs text-gray-400">Integración con Google Maps API</span>
                </div>
              </div>

            </div>

            {/* MODAL: SOS DETAILS */}
            {activeFeatureModal === 'sos' && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
                <div className="glassmorphism border border-red-500/20 max-w-2xl w-full rounded-3xl p-8 shadow-2xl relative">
                  <button 
                    onClick={() => setActiveFeatureModal(null)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl font-bold p-2"
                  >
                    &times;
                  </button>
                  <div className="flex items-center gap-4 mb-6">
                    <span className="w-12 h-12 rounded-xl bg-red-950/60 text-red-400 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6" />
                    </span>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Detalle de Alertas SOS</h3>
                      <p className="text-xs text-red-400 font-semibold uppercase tracking-wider">Ecosistema de Respuesta Rápida</p>
                    </div>
                  </div>
                  <div className="space-y-4 text-sm text-gray-300 leading-relaxed max-h-[400px] overflow-y-auto pr-2">
                    <p>
                      El sistema de <strong>Alertas SOS de Eje Urbano</strong> te permite notificar situaciones críticas a tu comunidad y contactos de confianza al instante:
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-gray-400">
                      <li><strong className="text-white">Botón Físico de Emergencia:</strong> Puedes activar una alerta SOS silenciosa de forma discreta manteniendo presionado el botón de **subir volumen** de tu teléfono por 5 segundos o más, sin necesidad de encender la pantalla.</li>
                      <li><strong className="text-white">Tipos de Alerta Personalizados:</strong> Clasifica tu emergencia en 4 categorías: <em>Pánico (SOS), Robo, Asistencia Médica o Incendio</em>, para recibir la ayuda correspondiente de tus vecinos.</li>
                      <li><strong className="text-white">Alarmas Audibles Instantáneas:</strong> Envía notificaciones de alta prioridad a tus contactos de confianza que sonarán inmediatamente en sus teléfonos, incluso si los tienen en modo silencioso.</li>
                      <li><strong className="text-white">Activación de Sirenas Vecinales:</strong> Dispara de forma automática las sirenas físicas de alerta instaladas en las calles de tu barrio para disuadir cualquier amenaza o delincuente en la zona.</li>
                    </ul>
                  </div>
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                    <button 
                      onClick={() => setActiveFeatureModal(null)}
                      className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all"
                    >
                      Entendido
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL: MAP DETAILS */}
            {activeFeatureModal === 'map' && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
                <div className="glassmorphism border border-sky-500/20 max-w-2xl w-full rounded-3xl p-8 shadow-2xl relative">
                  <button 
                    onClick={() => setActiveFeatureModal(null)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl font-bold p-2"
                  >
                    &times;
                  </button>
                  <div className="flex items-center gap-4 mb-6">
                    <span className="w-12 h-12 rounded-xl bg-sky-950/60 text-[#00E5FF] flex items-center justify-center">
                      <MapPin className="w-6 h-6" />
                    </span>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Detalle de Mapas y Geolocalización</h3>
                      <p className="text-xs text-[#00E5FF] font-semibold uppercase tracking-wider">Monitoreo y Trayecto Seguro</p>
                    </div>
                  </div>
                  <div className="space-y-4 text-sm text-gray-300 leading-relaxed max-h-[400px] overflow-y-auto pr-2">
                    <p>
                      El sistema de geolocalización y mapas dinámicos está diseñado para cuidarte a ti y a tu familia en sus traslados diarios:
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-gray-400">
                      <li><strong className="text-white">Trayecto Seguro ("Acompáñame a casa"):</strong> Te permite definir un tiempo estimado para tu recorrido. Si no marcas que has llegado a salvo y el temporizador expira, tus contactos de confianza recibirán automáticamente una alerta de SOS con tu última ubicación.</li>
                      <li><strong className="text-white">Privacidad Respetada:</strong> La ubicación de tus trayectos normales es confidencial y solo la pueden ver los contactos de confianza que tú elijas. Nadie más, ni los administradores del barrio, pueden ver tus rutas rutinarias.</li>
                      <li><strong className="text-white">Monitoreo Activo de Emergencias:</strong> Cuando activas una alerta de SOS, tu ubicación en el mapa se actualiza continuamente para que tus vecinos puedan ubicarte y acudir a ayudarte rápidamente.</li>
                      <li><strong className="text-white">Llamadas de Auxilio Rápido:</strong> El mapa incluye accesos directos para llamar al instante a los números de emergencia oficiales de Bolivia, como la Policía (110), Ambulancias (118), Bomberos (119) y SAR (123).</li>
                    </ul>
                  </div>
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                    <button 
                      onClick={() => setActiveFeatureModal(null)}
                      className="px-6 py-2.5 rounded-xl bg-[#00E5FF] text-slate-950 font-bold text-sm hover:bg-[#00b0ff] transition-all"
                    >
                      Entendido
                    </button>
                  </div>
                </div>
              </div>
            )}

          </section>
        )}

        {/* PAGE: MANUAL */}
        {currentPage === 'manual' && (
          <section className="max-w-7xl mx-auto px-4 md:px-8 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-4 flex flex-col justify-start lg:sticky lg:top-24 h-fit">
                <h2 className="text-[#00E5FF] text-sm font-bold tracking-widest uppercase mb-3">Guía de Uso Oficial</h2>
                <h1 className="text-4xl font-extrabold text-white tracking-tight mb-6">
                  Manual de Usuario Eje Urbano
                </h1>
                <p className="text-gray-400 leading-relaxed mb-8">
                  Conoce detalladamente las características operativas y flujos del ecosistema móvil y de administración para proteger a tu comunidad.
                </p>
                <a href="#" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-sky-950/60 border border-[#00E5FF]/20 text-[#00E5FF] hover:bg-sky-900/40 text-sm font-semibold transition-all">
                  <BookOpen className="w-5 h-5" />
                  Descargar Manual Completo (PDF)
                </a>
              </div>

              <div className="lg:col-span-8 space-y-6">
                {[
                  { num: 1, title: 'Inicio de Sesión y Acceso Biométrico', desc: 'Ingresa a la aplicación utilizando tu correo registrado y contraseña. Si tu teléfono inteligente posee sensores biométricos de huella o rostro, puedes activar el acceso rápido desde la pantalla de perfil para ingresar sin teclear tus credenciales.' },
                  { num: 2, title: 'Alertas Médicas, Incendio, Robo y SOS', desc: 'El panel de control cuenta con botones específicos para cada situación crítica: Pánico, Robo, Médica, Incendio y SOS. Al activarlos, se capturan tus coordenadas GPS reales y se notifica al instante a todos los vecinos y administradores.' },
                  { num: 3, title: 'Función "Acompáñame a Casa" (Trayecto Seguro)', desc: 'Comparte tu trayecto en tiempo real con tu Círculo de Confianza (familiares y contactos cercanos). Si el temporizador expira sin confirmación, la aplicación les enviará automáticamente una notificación privada con tu última ubicación.' }
                ].map((item) => (
                  <div key={item.num} className="rounded-2xl border border-white/5 bg-gray-900/30 p-6 glass-card">
                    <h4 className="text-xl font-bold text-white flex items-center gap-3 mb-4">
                      <span className="w-7 h-7 rounded-md bg-sky-950 text-[#00E5FF] flex items-center justify-center text-sm font-bold border border-[#00E5FF]/20">{item.num}</span>
                      {item.title}
                    </h4>
                    <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* PAGE: IOT */}
        {currentPage === 'iot' && (
          <section className="max-w-7xl mx-auto px-4 md:px-8 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-6 order-2 lg:order-1 flex justify-center">
                <div className="w-full max-w-lg rounded-3xl p-8 glass-card relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl"></div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                    <span className="text-sm font-bold text-white">Vínculo de Dispositivos (ESP32)</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-950 text-[#00E5FF] border border-[#00E5FF]/20 text-xs font-semibold">Online</span>
                  </div>
                  <div className="space-y-6">
                    {[
                      { num: 1, title: 'Botón Físico / Sirena IoT', desc: 'Microcontroladores conectados vía Wi-Fi o MQTT.' },
                      { num: 2, title: 'Sincronización Supabase', desc: 'Ingreso automático de alertas en tiempo real vía REST API.' },
                      { num: 3, title: 'Notificación Global Push', desc: 'Alarma sonora activada y alertas en móviles en tiempo real.' }
                    ].map((step) => (
                      <div key={step.num} className="flex items-center gap-4 p-4 rounded-xl bg-gray-900/60 border border-white/5">
                        <span className="w-10 h-10 rounded-lg bg-sky-950 text-[#00E5FF] flex items-center justify-center font-bold">{step.num}</span>
                        <div>
                          <h4 className="text-sm font-bold text-white">{step.title}</h4>
                          <p className="text-xs text-gray-400">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 order-1 lg:order-2 flex flex-col justify-center">
                <h2 className="text-[#00E5FF] text-sm font-bold tracking-widest uppercase mb-3">Integración IoT</h2>
                <h1 className="text-4xl font-extrabold text-white tracking-tight mb-6">
                  Sincronización nativa con hardware físico
                </h1>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Eje Urbano no solo se limita a la pantalla de tu móvil. La plataforma está totalmente integrada con la infraestructura de hardware local para proporcionar una experiencia de seguridad activa en el espacio físico.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* PAGE: DOWNLOAD */}
        {currentPage === 'download' && (
          <section className="max-w-7xl mx-auto px-4 md:px-8 py-16">
            <div className="rounded-3xl bg-gradient-to-tr from-sky-950/40 via-slate-900/60 to-gray-900/40 border border-[#00E5FF]/20 p-8 md:p-12 lg:p-16 text-center relative overflow-hidden glow-cyan">
              <div className="absolute -top-24 -left-24 w-72 h-72 bg-sky-500/5 rounded-full blur-3xl"></div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight mb-6 max-w-xl mx-auto leading-tight">
                Protege tu comunidad hoy mismo
              </h1>
              <p className="text-gray-400 text-lg max-w-lg mx-auto mb-10">
                Descarga el instalador APK de Eje Urbano directamente en tu dispositivo Android e intégrate a tu red vecinal de seguridad de inmediato.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="#" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-extrabold tracking-wide transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                  <Download className="w-5 h-5" />
                  Descargar Instalador (Android APK)
                </a>
              </div>
            </div>
          </section>
        )}

        {/* PAGE: LOGIN */}
        {currentPage === 'login' && (
          <section className="max-w-md mx-auto px-4 py-20">
            <div className="glassmorphism rounded-3xl p-8 border border-white/10 shadow-2xl">
              <div className="text-center mb-8">
                <Shield className="w-12 h-12 text-[#00E5FF] mx-auto mb-3" />
                <h2 className="text-2xl font-bold text-white">Acceso Administrativo</h2>
                <p className="text-gray-400 text-sm mt-1">Ingresa tus credenciales autorizadas por Supabase</p>
              </div>

              {loginError && (
                <div className="p-4 mb-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Correo Electrónico</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-gray-800 focus:border-[#00E5FF] focus:outline-none text-white text-sm" 
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Contraseña</label>
                  <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-gray-800 focus:border-[#00E5FF] focus:outline-none text-white text-sm" 
                    placeholder="••••••••"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={formLoading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {formLoading ? 'Verificando...' : 'Iniciar Sesión'}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* PAGE: DASHBOARD */}
        {currentPage === 'dashboard' && user && (
          <section className="max-w-7xl mx-auto px-4 md:px-8 py-8 animate-fade-in">
            
            {/* Header section with realtime status */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
                  <LayoutDashboard className="text-[#00E5FF]" />
                  Consola de Seguridad
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                  {userProfile && userProfile.rol === 'admin' 
                    ? `Monitoreo del sector: ${userProfile.nombre_comunidad || 'Cargando...'}`
                    : 'Monitoreo global de incidencias barriales (Super Admin)'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-950 text-[#00E5FF] border border-[#00E5FF]/20 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse"></span>
                  Conexión Supabase (REST+WS) Activa
                </span>
                <button onClick={fetchStats} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 transition-colors" title="Refrescar">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <div className={`p-6 rounded-2xl glass-card border transition-all ${stats.activeAlerts > 0 ? 'bg-red-500/10 border-red-500/30 animate-pulse' : 'border-white/5'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-gray-400">Alertas Activas</span>
                  <AlertTriangle className={`w-5 h-5 ${stats.activeAlerts > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                </div>
                <h3 className="text-4xl font-extrabold text-white">{stats.activeAlerts}</h3>
                <p className="text-xs text-gray-400 mt-2">Emergencias que requieren atención</p>
              </div>

              <div className="p-6 rounded-2xl glass-card border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-gray-400">Vecinos</span>
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-4xl font-extrabold text-white">{stats.totalUsers}</h3>
                <p className="text-xs text-gray-400 mt-2">Usuarios registrados en el sistema</p>
              </div>

              <div className="p-6 rounded-2xl glass-card border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-gray-400">Dispositivos IoT</span>
                  <Cpu className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-4xl font-extrabold text-white">{stats.totalDevices}</h3>
                <p className="text-xs text-gray-400 mt-2">Sirenas y Botones físicos activos</p>
              </div>

              <div className="p-6 rounded-2xl glass-card border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-gray-400">Comunidades</span>
                  <Home className="w-5 h-5 text-sky-400" />
                </div>
                <h3 className="text-4xl font-extrabold text-white">{stats.totalCommunities}</h3>
                <p className="text-xs text-gray-400 mt-2">Barrios organizados activos</p>
              </div>
            </div>

            {/* Dashboard Navigation Tabs */}
            <div className="flex border-b border-white/5 mb-8">
              {[
                { id: 'alertas', label: 'Alertas Vecinales', count: stats.activeAlerts },
                { id: 'usuarios', label: 'Vecinos Registrados' },
                { id: 'comunidades', label: 'Comunidades' },
                { id: 'dispositivos', label: 'Dispositivos IoT' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDashboardTab(tab.id)}
                  className={`px-6 py-4 font-semibold text-sm transition-all border-b-2 -mb-[2px] ${dashboardTab === tab.id ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-extrabold animate-pulse">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content 1: Alertas */}
            {dashboardTab === 'alertas' && (
              <div className="space-y-6">
                
                {/* Active Alerts Live Map */}
                <div className="rounded-2xl border border-white/5 overflow-hidden h-[400px] relative glow-cyan flex flex-col">
                  {/* Theme Selector Overlay */}
                  <div className="absolute top-3 right-3 z-[1010] bg-slate-900/90 border border-white/10 rounded-xl p-1 flex gap-1 shadow-lg backdrop-blur-md">
                    <button 
                      onClick={() => setMapTheme('dark')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mapTheme === 'dark' ? 'bg-[#00E5FF] text-slate-950 font-bold' : 'text-gray-400 hover:text-white'}`}
                    >
                      Oscuro
                    </button>
                    <button 
                      onClick={() => setMapTheme('light')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mapTheme === 'light' ? 'bg-[#00E5FF] text-slate-950 font-bold' : 'text-gray-400 hover:text-white'}`}
                    >
                      Claro
                    </button>
                  </div>

                  <iframe
                    key={`${alertas.filter(a => a.estado === 'activa').length}-${mapTheme}-${alertas.map(a => a.id + a.estado).join('')}-${selectedAlerta ? selectedAlerta.id : 'none'}`}
                    className="w-full h-full border-0 flex-grow"
                    title="Active Alerts Map"
                    srcDoc={`
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <link rel="icon" type="image/svg+xml" href="images/favicon.svg" />
                        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                        <style>
                          body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: ${mapTheme === 'dark' ? '#0f172a' : '#f8fafc'}; }
                          .custom-marker-wrapper {
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            width: 24px !important;
                            height: 24px !important;
                          }
                          .custom-marker {
                            width: 18px !important;
                            height: 18px !important;
                            border-radius: 50%;
                            background: #ef4444;
                            border: 3px solid #ffffff;
                            box-shadow: 0 0 10px rgba(239, 68, 68, 0.8);
                            box-sizing: border-box;
                            animation: pulse 1.5s infinite;
                          }
                          @keyframes pulse {
                            0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                            70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
                            100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                          }
                          .popup-box {
                            font-family: sans-serif;
                            color: ${mapTheme === 'dark' ? '#f8fafc' : '#0f172a'};
                          }
                          .popup-box h3 { margin: 0 0 5px 0; font-size: 14px; color: #ef4444; }
                          .popup-box p { margin: 0; font-size: 12px; color: ${mapTheme === 'dark' ? '#cbd5e1' : '#334155'}; }
                        </style>
                      </head>
                      <body>
                        <div id="map"></div>
                        <script>
                          var defaultCenter = [-17.3895, -66.1568];
                          var defaultZoom = 6;
                          
                          var focusAlerta = ${selectedAlerta ? JSON.stringify(selectedAlerta) : 'null'};
                          if (focusAlerta && focusAlerta.latitud && focusAlerta.longitud) {
                            defaultCenter = [focusAlerta.latitud, focusAlerta.longitud];
                            defaultZoom = 15;
                          }

                          var map = L.map('map').setView(defaultCenter, defaultZoom);
                          
                          // Load layer depending on selected theme
                          var tileUrl = '${mapTheme === 'dark' ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}';
                          L.tileLayer(tileUrl, {
                            attribution: '&copy; OpenStreetMap'
                          }).addTo(map);

                          var alerts = ${JSON.stringify(alertas.filter(a => a.estado === 'activa' && a.latitud && a.longitud))};
                          var markersGroup = [];

                          alerts.forEach(function(alerta) {
                            var icon = L.divIcon({
                              html: '<div class="custom-marker"></div>',
                              className: 'custom-marker-wrapper',
                              iconSize: [24, 24],
                              iconAnchor: [12, 12]
                            });

                            var popupContent = '<div class="popup-box">' +
                              '<h3>🚨 ' + alerta.tipo + '</h3>' +
                              '<p><strong>Vecino:</strong> ' + (alerta.emisor?.nombre || 'Botón Físico / Anónimo') + '</p>' +
                              '<p><strong>Origen:</strong> ' + alerta.origen + '</p>' +
                              '<p><strong>Comunidad:</strong> ' + (alerta.comunidad?.nombre || 'General') + '</p>' +
                              '</div>';

                            var marker = L.marker([alerta.latitud, alerta.longitud], { icon: icon })
                              .bindPopup(popupContent)
                              .addTo(map);

                            if (focusAlerta && focusAlerta.id === alerta.id) {
                              marker.openPopup();
                            }

                            markersGroup.push([alerta.latitud, alerta.longitud]);
                          });

                          // Only auto-fit bounds if we are not explicitly focusing on an alert
                          if (!focusAlerta && markersGroup.length > 0) {
                            var bounds = L.latLngBounds(markersGroup);
                            map.fitBounds(bounds, { padding: [50, 50] });
                          }
                        </script>
                      </body>
                      </html>
                    `}
                  />
                  {stats.activeAlerts === 0 && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-[1000]">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <h4 className="text-lg font-bold text-white mb-1">Todo Bajo Control</h4>
                      <p className="text-gray-400 text-xs max-w-xs">No hay alertas de emergencia activas en este momento.</p>
                    </div>
                  )}
                </div>

                {/* Alerts List Table with scroll constraints */}
                <div className="glassmorphism rounded-2xl border border-white/5 overflow-hidden">
                  <div className="overflow-x-auto max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                    <table className="w-full text-left text-sm relative">
                      <thead className="bg-slate-900 text-gray-400 uppercase text-xs tracking-wider border-b border-white/5 sticky top-0 z-10 shadow-md">
                        <tr>
                          <th className="px-6 py-4">ID</th>
                          <th className="px-6 py-4">Emisor</th>
                          <th className="px-6 py-4">Tipo</th>
                          <th className="px-6 py-4">Estado</th>
                          <th className="px-6 py-4">Origen</th>
                          <th className="px-6 py-4">Comunidad</th>
                          <th className="px-6 py-4">Reportado</th>
                          <th className="px-6 py-4 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {alertas.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="px-6 py-12 text-center text-gray-500">Ninguna alerta reportada recientemente.</td>
                          </tr>
                        ) : (
                          alertas.map((alerta) => (
                            <tr 
                              key={alerta.id} 
                              onClick={() => {
                                if (alerta.estado === 'activa' && alerta.latitud && alerta.longitud) {
                                  setSelectedAlerta({ latitud: alerta.latitud, longitud: alerta.longitud, id: alerta.id });
                                }
                              }}
                              className={`transition-colors cursor-pointer ${alerta.estado === 'activa' ? 'hover:bg-red-500/5 bg-red-500/2' : 'hover:bg-slate-900/40'}`}
                            >
                              <td className="px-6 py-4 font-mono text-xs text-gray-400">{alerta.id}</td>
                              <td className="px-6 py-4 font-semibold">{alerta.emisor?.nombre || 'Botón Físico / Anónimo'}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${alerta.tipo === 'ROBO' || alerta.tipo === 'SOS' ? 'bg-red-500/10 text-red-400 border-red-500/20' : alerta.tipo === 'MEDICA' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}`}>
                                  {alerta.tipo}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${alerta.estado === 'activa' ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                  {alerta.estado}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-gray-300 flex items-center gap-1">
                                  {alerta.origen === 'app' ? <Smartphone className="w-3.5 h-3.5 text-sky-400" /> : <Cpu className="w-3.5 h-3.5 text-amber-400" />}
                                  {alerta.origen}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-gray-300">{alerta.comunidad?.nombre || 'General'}</td>
                              <td className="px-6 py-4 text-gray-400 text-xs">{new Date(alerta.created_at).toLocaleString()}</td>
                              <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                {alerta.estado === 'activa' ? (
                                  <button 
                                    onClick={() => handleToggleAlerta(alerta.id, alerta.estado)}
                                    className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-500/20"
                                  >
                                    Desactivar Emergencia
                                  </button>
                                ) : (
                                  <span className="text-gray-500 text-xs">Resuelta</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab content 2: Usuarios */}
            {dashboardTab === 'usuarios' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form to create user */}
                <div className="glassmorphism p-6 rounded-2xl h-fit border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <UserPlus className="text-[#00E5FF]" />
                    Registrar Vecino
                  </h3>
                  <form onSubmit={handleCreateUsuario} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">ID único (UUID de Supabase auth)</label>
                      <input 
                        type="text" 
                        required 
                        value={newUsuario.id}
                        onChange={(e) => setNewUsuario({ ...newUsuario, id: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm"
                        placeholder="a0b1c2..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre Completo</label>
                      <input 
                        type="text" 
                        required 
                        value={newUsuario.nombre}
                        onChange={(e) => setNewUsuario({ ...newUsuario, nombre: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm"
                        placeholder="Juan Perez"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Rol</label>
                      <select 
                        value={newUsuario.rol} 
                        onChange={(e) => setNewUsuario({ ...newUsuario, rol: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm"
                      >
                        <option value="vecino">Vecino</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dirección</label>
                      <input 
                        type="text" 
                        required 
                        value={newUsuario.direccion}
                        onChange={(e) => setNewUsuario({ ...newUsuario, direccion: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm"
                        placeholder="Calle Florida #123"
                      />
                    </div>
                    {/* If super_admin, show community selection. If admin, it is auto-bound to their community */}
                    {userProfile && userProfile.rol === 'super_admin' ? (
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Asignar a Comunidad</label>
                        <select 
                          required
                          value={newUsuario.id_comunidad} 
                          onChange={(e) => setNewUsuario({ ...newUsuario, id_comunidad: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm"
                        >
                          <option value="">Seleccione una comunidad</option>
                          {comunidades.map(com => (
                            <option key={com.id} value={com.id}>{com.nombre}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900 border border-gray-800/60 text-xs text-gray-400">
                        Comunidad vinculada automáticamente: <strong className="text-white">{userProfile?.nombre_comunidad || 'Cargando...'}</strong>
                      </div>
                    )}
                    <button type="submit" disabled={formLoading} className="w-full py-2.5 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-bold text-sm transition-all">
                      Registrar Vecino
                    </button>
                  </form>
                </div>

                {/* Users List */}
                <div className="lg:col-span-2 glassmorphism rounded-2xl border border-white/5 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900 text-gray-400 uppercase text-xs border-b border-white/5">
                        <tr>
                          <th className="px-6 py-4">Vecino</th>
                          <th className="px-6 py-4">Rol</th>
                          <th className="px-6 py-4">Dirección</th>
                          <th className="px-6 py-4">Comunidad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {usuarios.map((usu) => (
                          <tr key={usu.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-6 py-4 font-semibold text-white">{usu.nombre}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${usu.rol === 'admin' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                {usu.rol}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-300">{usu.direccion}</td>
                            <td className="px-6 py-4 text-gray-400">{usu.comunidad?.nombre || 'General'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab content 3: Comunidades */}
            {dashboardTab === 'comunidades' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form to create Comunidad */}
                <div className="glassmorphism p-6 rounded-2xl h-fit border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4">Añadir Comunidad</h3>
                  {userProfile && userProfile.rol === 'super_admin' ? (
                    <form onSubmit={handleCreateComunidad} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre del Sector</label>
                        <input 
                          type="text" 
                          required 
                          value={newComunidad.nombre}
                          onChange={(e) => setNewComunidad({ ...newComunidad, nombre: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm"
                          placeholder="Barrio Central"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Descripción</label>
                        <textarea 
                          required 
                          value={newComunidad.descripcion}
                          onChange={(e) => setNewComunidad({ ...newComunidad, descripcion: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm h-24"
                          placeholder="Descripción y límites del barrio..."
                        />
                      </div>
                      <button type="submit" disabled={formLoading} className="w-full py-2.5 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-bold text-sm transition-all">
                        Crear Comunidad
                      </button>
                    </form>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 text-sm text-gray-400 leading-relaxed">
                      Como administrador de sector, solo puedes ver la información de tu comunidad asignada. La creación de nuevos sectores barriales está restringida para el Super Administrador.
                    </div>
                  )}
                </div>

                {/* Communities list */}
                <div className="lg:col-span-2 glassmorphism rounded-2xl border border-white/5 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900 text-gray-400 uppercase text-xs border-b border-white/5">
                        <tr>
                          <th className="px-6 py-4">ID</th>
                          <th className="px-6 py-4">Nombre</th>
                          <th className="px-6 py-4">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {comunidades.map((com) => (
                          <tr key={com.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-6 py-4 text-xs font-mono text-gray-400">{com.id}</td>
                            <td className="px-6 py-4 font-semibold text-white">{com.nombre}</td>
                            <td className="px-6 py-4 text-gray-300">{com.descripcion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab content 4: Dispositivos */}
            {dashboardTab === 'dispositivos' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form to create device */}
                <div className="glassmorphism p-6 rounded-2xl h-fit border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4">Vincular Dispositivo IoT</h3>
                  <form onSubmit={handleCreateDispositivo} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">MAC Address Física</label>
                      <input 
                        type="text" 
                        required 
                        value={newDispositivo.mac_address}
                        onChange={(e) => setNewDispositivo({ ...newDispositivo, mac_address: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm"
                        placeholder="AA:BB:CC:DD:EE:FF"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipo de Dispositivo</label>
                      <select 
                        value={newDispositivo.tipo} 
                        onChange={(e) => setNewDispositivo({ ...newDispositivo, tipo: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm"
                      >
                        <option value="sirena">Sirena</option>
                        <option value="boton_panico">Botón de Pánico</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Asignar a Vecino Responsable</label>
                      <select 
                        required
                        value={newDispositivo.id_usuario} 
                        onChange={(e) => setNewDispositivo({ ...newDispositivo, id_usuario: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm"
                      >
                        <option value="">Seleccione un vecino</option>
                        {usuarios.map(u => (
                          <option key={u.id} value={u.id}>{u.nombre}</option>
                        ))}
                      </select>
                    </div>
                    {/* If super_admin, show community selection. If admin, it is auto-bound */}
                    {userProfile && userProfile.rol === 'super_admin' ? (
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Asignar a Comunidad</label>
                        <select 
                          required
                          value={newDispositivo.id_comunidad} 
                          onChange={(e) => setNewDispositivo({ ...newDispositivo, id_comunidad: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm"
                        >
                          <option value="">Seleccione una comunidad</option>
                          {comunidades.map(com => (
                            <option key={com.id} value={com.id}>{com.nombre}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900 border border-gray-800/60 text-xs text-gray-400">
                        Comunidad vinculada automáticamente: <strong className="text-white">{userProfile?.nombre_comunidad || 'Cargando...'}</strong>
                      </div>
                    )}
                    <button type="submit" disabled={formLoading} className="w-full py-2.5 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-bold text-sm transition-all">
                      Vincular Hardware
                    </button>
                  </form>
                </div>

                {/* Devices list */}
                <div className="lg:col-span-2 glassmorphism rounded-2xl border border-white/5 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900 text-gray-400 uppercase text-xs border-b border-white/5">
                        <tr>
                          <th className="px-6 py-4">MAC Address</th>
                          <th className="px-6 py-4">Tipo</th>
                          <th className="px-6 py-4">Propietario / Responsable</th>
                          <th className="px-6 py-4">Comunidad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dispositivos.map((dev) => (
                          <tr key={dev.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-6 py-4 font-mono text-white font-semibold">{dev.mac_address}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                                {dev.tipo}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-300">{dev.usuario?.nombre || 'No asignado'}</td>
                            <td className="px-6 py-4 text-gray-400">{dev.comunidad?.nombre || 'General'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 md:px-8 py-12 border-t border-white/5 text-center text-sm text-gray-500 w-full mt-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <button onClick={() => setCurrentPage('home')} className="flex items-center gap-2 font-bold text-white">
            <img src="images/image.png" alt="Logo" className="w-6 h-6 object-contain rounded-lg" />
            <span>Eje Urbano</span>
          </button>
          <p>&copy; {new Date().getFullYear()} Eje Urbano. Todos los derechos reservados.</p>
        </div>
      </footer>

    </div>
  );
}
