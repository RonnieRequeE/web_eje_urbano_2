import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabaseClient';
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
  X,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Radio,
  Ban,
  User,
  ShieldCheck,
  ChevronDown,
  Copy,
  Check,
  Mail,
  Phone,
  Calendar,
  FileText,
  BarChart3,
  Clock,
  Sparkles
} from 'lucide-react';

export default function App() {
  const [currentPage, setCurrentPage] = useState('home'); // 'home', 'features', 'manual', 'iot', 'download', 'dashboard'
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);

  // Estados para recuperación de contraseña (OTP)
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: Pedir Correo, 2: Código OTP y Nueva Contraseña
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

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

  const countryCodes = [
    { code: "+591", name: "Bolivia", flag: "🇧🇴" },
    { code: "+54", name: "Argentina", flag: "🇦🇷" },
    { code: "+55", name: "Brasil", flag: "🇧🇷" },
    { code: "+56", name: "Chile", flag: "🇨🇱" },
    { code: "+51", name: "Perú", flag: "🇵🇪" },
    { code: "+57", name: "Colombia", flag: "🇨🇴" },
    { code: "+58", name: "Venezuela", flag: "🇻🇪" },
    { code: "+593", name: "Ecuador", flag: "🇪🇨" },
    { code: "+595", name: "Paraguay", flag: "🇵🇾" },
    { code: "+598", name: "Uruguay", flag: "🇺🇾" },
    { code: "+52", name: "México", flag: "🇲🇽" },
    { code: "+1", name: "Estados Unidos", flag: "🇺🇸" },
    { code: "+34", name: "España", flag: "🇪🇸" }
  ];

  // Form states for creating resources
  const [newComunidad, setNewComunidad] = useState({ nombre: '', descripcion: '' });
  const [newUsuario, setNewUsuario] = useState({ 
    nombre: '', 
    email: '', 
    password: '', 
    direccion: '', 
    rol: 'vecino', 
    id_comunidad: '',
    phoneNo: '',
    countryCode: '+591'
  });
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [userFormMessage, setUserFormMessage] = useState({ type: '', text: '' });
  const [newDispositivo, setNewDispositivo] = useState({ 
    mac_address: '', 
    tipo: 'sirena', 
    zona: '', 
    id_comunidad: '', 
    id_usuario: '', 
    latitud: '', 
    longitud: '', 
    estado: 'activo' 
  });
  const [deviceFormMessage, setDeviceFormMessage] = useState({ type: '', text: '' });
  const [editingComunidad, setEditingComunidad] = useState(null); // { id, nombre, descripcion, estado }
  const [editingUsuario, setEditingUsuario] = useState(null); // { id, nombre, direccion, rol, id_comunidad, phoneNo, countryCode, estado }
  const [editingDispositivo, setEditingDispositivo] = useState(null); // { mac_address, tipo, zona, id_comunidad, id_usuario, latitud, longitud, estado }
  const [comunidadFormMessage, setComunidadFormMessage] = useState({ type: '', text: '' });
  const [formLoading, setFormLoading] = useState(false);

  const [userProfile, setUserProfile] = useState(null); // { id, email, rol, id_comunidad, nombre, direccion, telefono, estado, created_at }
  const [profileOpen, setProfileOpen] = useState(false);

  const [mapTheme, setMapTheme] = useState('dark'); // 'dark' or 'light'
  const [selectedAlerta, setSelectedAlerta] = useState(null); // focused alert coordinates {lat, lng, id}
  const [activeFeatureModal, setActiveFeatureModal] = useState(null); // 'sos' or 'map' or null
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(null);
  const [requestTimestamps, setRequestTimestamps] = useState([]); // for rate limiting / flood protection
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [manageAlerta, setManageAlerta] = useState(null); // Alerta seleccionada para gestionar su estado
  const mapIframeRef = useRef(null); // Referencia al iframe estático de mapa.html
  const alertasRef = useRef(alertas);
  const knownActiveAlertIds = useRef(new Set());
  useEffect(() => {
    alertasRef.current = alertas;
  }, [alertas]);

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
          .select('id, nombre, rol, id_comunidad, direccion, telefono, estado, created_at, comunidad:comunidades(nombre)')
          .eq('id', sessionUser.id)
          .single();
        if (profile) {
          setUserProfile({
            id: profile.id,
            email: sessionUser.email,
            nombre: profile.nombre,
            rol: profile.rol,
            id_comunidad: profile.id_comunidad,
            nombre_comunidad: profile.comunidad?.nombre || '',
            direccion: profile.direccion || '',
            telefono: profile.telefono || '',
            estado: profile.estado || 'activo',
            created_at: profile.created_at || ''
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, async (payload) => {
        const isActiva = payload.new && payload.new.estado === 'activa';
        const isKnownActive = payload.new && knownActiveAlertIds.current.has(payload.new.id);

        if (payload.eventType === 'INSERT' && isActiva) {
          // --- CASO 1: Alerta nueva creada ---
          knownActiveAlertIds.current.add(payload.new.id);

          // 1. Sonar pitido de emergencia
          try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') {
              await audioCtx.resume();
            }
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.6);
          } catch (e) {
            console.log("Audio feedback error: ", e);
          }

          // 2. Conmutar a la pestaña de alertas y mover la vista al mapa
          setDashboardTab('alertas');
          setTimeout(() => {
            const mapEl = document.getElementById('mapa-live-container');
            if (mapEl) {
              mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 60);

          // 3. Descargar la nueva lista completa y actualizar estadísticas
          await fetchAlertas();
          fetchStats();

          // 4. Enfocar inmediatamente el nuevo marcador en el mapa
          const targetLat = payload.new.latitud_actual != null ? Number(payload.new.latitud_actual) : Number(payload.new.latitud);
          const targetLng = payload.new.longitud_actual != null ? Number(payload.new.longitud_actual) : Number(payload.new.longitud);

          if (targetLat && targetLng) {
            setSelectedAlerta({
              latitud: targetLat,
              longitud: targetLng,
              id: payload.new.id
            });

            setTimeout(() => {
              if (mapIframeRef.current && mapIframeRef.current.contentWindow) {
                mapIframeRef.current.contentWindow.postMessage({
                  type: 'FOCUS_MARKER',
                  id: payload.new.id,
                  lat: targetLat,
                  lng: targetLng
                }, '*');
              }
            }, 250);
          }
        } else if (payload.eventType === 'UPDATE') {
          if (isActiva && !isKnownActive) {
            // --- CASO 2: Alerta reactivada o activada desde otro estado ---
            knownActiveAlertIds.current.add(payload.new.id);

            // 1. Sonar pitido de emergencia
            try {
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
              }
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
              gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.start();
              oscillator.stop(audioCtx.currentTime + 0.6);
            } catch (e) {
              console.log("Audio feedback error: ", e);
            }

            // 2. Conmutar a la pestaña de alertas y mover la vista al mapa
            setDashboardTab('alertas');
            setTimeout(() => {
              const mapEl = document.getElementById('mapa-live-container');
              if (mapEl) {
                mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 60);

            // 3. Descargar la nueva lista completa y actualizar estadísticas
            await fetchAlertas();
            fetchStats();

            // 4. Enfocar inmediatamente en el mapa
            const targetLat = payload.new.latitud_actual != null ? Number(payload.new.latitud_actual) : Number(payload.new.latitud);
            const targetLng = payload.new.longitud_actual != null ? Number(payload.new.longitud_actual) : Number(payload.new.longitud);

            if (targetLat && targetLng) {
              setSelectedAlerta({
                latitud: targetLat,
                longitud: targetLng,
                id: payload.new.id
              });

              setTimeout(() => {
                if (mapIframeRef.current && mapIframeRef.current.contentWindow) {
                  mapIframeRef.current.contentWindow.postMessage({
                    type: 'FOCUS_MARKER',
                    id: payload.new.id,
                    lat: targetLat,
                    lng: targetLng
                  }, '*');
                }
              }, 250);
            }
          } else if (isActiva && isKnownActive) {
            // --- CASO 3: Actualización periódica de GPS en tiempo real de una alerta ya activa ---
            // NO sonar pitido, NO re-renderizar tabla ni llamar fetchAlertas()
            const targetLat = payload.new.latitud_actual != null ? Number(payload.new.latitud_actual) : Number(payload.new.latitud);
            const targetLng = payload.new.longitud_actual != null ? Number(payload.new.longitud_actual) : Number(payload.new.longitud);

            // Actualizar discretamente en memoria sin causar re-renderizado ni parpadeos
            alertasRef.current = alertasRef.current.map(a => {
              if (a.id === payload.new.id) {
                return { ...a, ...payload.new };
              }
              return a;
            });

            // Notificar al mapa Leaflet para mover el muñequito en vivo
            if (mapIframeRef.current && mapIframeRef.current.contentWindow && targetLat && targetLng) {
              mapIframeRef.current.contentWindow.postMessage({
                type: 'UPDATE_COORDS',
                id: payload.new.id,
                lat: targetLat,
                lng: targetLng
              }, '*');
            }
          } else if (!isActiva) {
            // --- CASO 4: Alerta atendida / finalizada / falsa alarma ---
            const targetId = payload.new?.id || payload.old?.id;
            if (targetId) knownActiveAlertIds.current.delete(targetId);
            await fetchAlertas();
            fetchStats();
          }
        } else if (payload.eventType === 'DELETE') {
          if (payload.old?.id) knownActiveAlertIds.current.delete(payload.old.id);
          await fetchAlertas();
          fetchStats();
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

  // Escuchar eventos y clicks provenientes del iframe del mapa Leaflet
  useEffect(() => {
    const handleMapMessage = (event) => {
      if (!event.data) return;

      if (event.data.type === 'SELECT_ALERTA') {
        const alertaId = event.data.id;
        const alertaEncontrada = alertasRef.current.find(a => a.id === alertaId);
        if (alertaEncontrada) {
          setSelectedAlerta({
            latitud: alertaEncontrada.latitud,
            longitud: alertaEncontrada.longitud,
            id: alertaEncontrada.id
          });
          
          // Desplazar únicamente el contenedor scrollable de la tabla
          setTimeout(() => {
            const element = document.getElementById(`alerta-row-${alertaId}`);
            if (element) {
              const scrollContainer = element.closest('.overflow-y-auto');
              if (scrollContainer) {
                const elementTop = element.offsetTop;
                const containerHeight = scrollContainer.clientHeight;
                const elementHeight = element.clientHeight;
                scrollContainer.scrollTo({
                  top: elementTop - (containerHeight / 2) + (elementHeight / 2),
                  behavior: 'smooth'
                });
              }
            }
          }, 100);
        }
      } else if (event.data.type === 'MAP_READY') {
        // Enviar tema y alertas apenas Leaflet esté listo en el iframe
        if (mapIframeRef.current && mapIframeRef.current.contentWindow) {
          try {
            mapIframeRef.current.contentWindow.postMessage({
              type: 'SET_THEME',
              theme: mapTheme
            }, '*');
            const activas = alertasRef.current.filter(a => a.estado === 'activa' && a.latitud && a.longitud);
            mapIframeRef.current.contentWindow.postMessage({
              type: 'UPDATE_ALERTS',
              alerts: activas
            }, '*');
          } catch (e) {
            console.error("Error al sincronizar con mapa listo:", e);
          }
        }
      }
    };

    window.addEventListener('message', handleMapMessage);
    return () => window.removeEventListener('message', handleMapMessage);
  }, [mapTheme]);

  // Redimensionar Leaflet sin parpadeo al volver a la pestaña de alertas
  useEffect(() => {
    if (dashboardTab === 'alertas' && mapIframeRef.current && mapIframeRef.current.contentWindow) {
      try {
        mapIframeRef.current.contentWindow.postMessage({ type: 'INVALIDATE_SIZE' }, '*');
      } catch (e) {
        console.error("Error al invalidar tamaño de mapa:", e);
      }
    }
  }, [dashboardTab]);

  // Sincronizar alertas activas con el mapa estático de forma transparente
  useEffect(() => {
    if (mapIframeRef.current && mapIframeRef.current.contentWindow) {
      try {
        const activas = alertas.filter(a => a.estado === 'activa' && a.latitud && a.longitud);
        mapIframeRef.current.contentWindow.postMessage({
          type: 'UPDATE_ALERTS',
          alerts: activas
        }, '*');
      } catch (e) {
        console.error("Error al enviar alertas al mapa:", e);
      }
    }
  }, [alertas]);

  // Enfocar marcador y abrir popup en el mapa estático cuando cambie selectedAlerta
  useEffect(() => {
    if (selectedAlerta && mapIframeRef.current && mapIframeRef.current.contentWindow) {
      try {
        mapIframeRef.current.contentWindow.postMessage({
          type: 'FOCUS_MARKER',
          id: selectedAlerta.id,
          lat: selectedAlerta.latitud,
          lng: selectedAlerta.longitud
        }, '*');
      } catch (e) {
        console.error("Error al enfocar marcador en el mapa:", e);
      }
    }
  }, [selectedAlerta]);

  // Sincronizar tema con el mapa estático
  useEffect(() => {
    if (mapIframeRef.current && mapIframeRef.current.contentWindow) {
      try {
        mapIframeRef.current.contentWindow.postMessage({
          type: 'SET_THEME',
          theme: mapTheme
        }, '*');
      } catch (e) {
        console.error("Error al sincronizar tema con el mapa:", e);
      }
    }
  }, [mapTheme]);

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
    if (data) {
      setAlertas(data);
      const activeIds = new Set();
      const activas = data.filter(a => {
        if (a.estado === 'activa') {
          activeIds.add(a.id);
          return true;
        }
        return false;
      });
      knownActiveAlertIds.current = activeIds;

      if (mapIframeRef.current && mapIframeRef.current.contentWindow) {
        const activasConCoords = activas.filter(a => a.latitud && a.longitud);
        mapIframeRef.current.contentWindow.postMessage({
          type: 'UPDATE_ALERTS',
          alerts: activasConCoords
        }, '*');
      }
    }
    return data;
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
    setEmail('');
    setPassword('');
    setCurrentPage('home');
  };

  // Manejo de recuperación de contraseña vía código OTP de 8 dígitos
  const handleSendResetEmail = async (e) => {
    e?.preventDefault();
    const mail = resetEmail.trim();
    if (!mail) {
      setResetError('Por favor, ingresa tu correo electrónico.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(mail)) {
      setResetError('Formato de correo electrónico inválido.');
      return;
    }
    setResetError('');
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(mail);
      if (error) throw error;
      setResetStep(2);
    } catch (err) {
      setResetError(err.message || 'Error al enviar código de recuperación.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyOtpAndResetPassword = async (e) => {
    e?.preventDefault();
    const code = resetOtpCode.trim();
    if (code.length < 8) {
      setResetError('El código debe tener 8 dígitos.');
      return;
    }
    const hasUpperCase = /[A-Z]/.test(resetNewPassword);
    const hasNumber = /[0-9]/.test(resetNewPassword);
    if (resetNewPassword.length < 6 || !hasUpperCase || !hasNumber) {
      setResetError('La contraseña debe tener al menos 6 caracteres, una mayúscula y un número.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Las contraseñas no coinciden.');
      return;
    }
    setResetError('');
    setResetLoading(true);
    try {
      // 1. Validar el OTP de tipo recovery
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: resetEmail.trim(),
        token: code,
        type: 'recovery'
      });
      if (otpError) throw otpError;

      // 2. Actualizar contraseña del usuario
      const { error: updateError } = await supabase.auth.updateUser({
        password: resetNewPassword
      });
      if (updateError) throw updateError;

      // 3. Cerrar sesión de recuperación para requerir login normal
      await supabase.auth.signOut();

      setResetSuccess('¡Contraseña restablecida con éxito! Ya puedes iniciar sesión con tu nueva contraseña.');
      setEmail(resetEmail.trim());
      setPassword('');
    } catch (err) {
      let msg = err.message || 'Error al restablecer la contraseña.';
      if (msg.includes('Token has expired') || msg.includes('expired')) {
        msg = 'El código ha expirado. Por favor, solicita uno nuevo.';
      } else if (msg.includes('invalid') || msg.includes('Token is invalid')) {
        msg = 'Código de seguridad incorrecto. Revisa el correo recibido.';
      } else if (msg.includes('same password')) {
        msg = 'La nueva contraseña debe ser diferente a la anterior.';
      }
      setResetError(msg);
    } finally {
      setResetLoading(false);
    }
  };

  // Actualizar estado específico de la alerta
  const handleUpdateAlertStatus = async (id, nuevoEstado) => {
    setFormLoading(true);
    const { error } = await supabase
      .from('alertas')
      .update({ estado: nuevoEstado })
      .eq('id', id);
    if (!error) {
      fetchAlertas();
      fetchStats();
      setManageAlerta(null);
    } else {
      alert("Error al actualizar el estado de la alerta: " + error.message);
    }
    setFormLoading(false);
  };

  // Create Comunidad
  const handleCreateComunidad = async (e) => {
    e.preventDefault();
    setComunidadFormMessage({ type: '', text: '' });
    if (userProfile && userProfile.rol !== 'super_admin') {
      setComunidadFormMessage({ type: 'error', text: "Solo el Super Administrador puede crear comunidades." });
      return;
    }
    if (!newComunidad.nombre.trim()) {
      setComunidadFormMessage({ type: 'error', text: "El nombre de la comunidad es obligatorio." });
      return;
    }
    setFormLoading(true);
    const { error } = await supabase
      .from('comunidades')
      .insert([{
        nombre: newComunidad.nombre.trim(),
        descripcion: newComunidad.descripcion.trim() || null
      }]);
    if (!error) {
      setNewComunidad({ nombre: '', descripcion: '' });
      setComunidadFormMessage({ type: 'success', text: "Comunidad creada exitosamente." });
      fetchComunidades();
      fetchStats();
    } else {
      setComunidadFormMessage({ type: 'error', text: "Error al crear: " + error.message });
    }
    setFormLoading(false);
  };

  // Edit Comunidad
  const handleUpdateComunidad = async (e) => {
    e.preventDefault();
    if (!editingComunidad) return;
    setComunidadFormMessage({ type: '', text: '' });
    setFormLoading(true);
    let payload = {
      nombre: editingComunidad.nombre.trim(),
      descripcion: editingComunidad.descripcion ? editingComunidad.descripcion.trim() : null
    };
    if (editingComunidad.estado) {
      payload.estado = editingComunidad.estado;
    }
    const { error } = await supabase
      .from('comunidades')
      .update(payload)
      .eq('id', editingComunidad.id);
    if (!error) {
      setEditingComunidad(null);
      setComunidadFormMessage({ type: 'success', text: "Comunidad actualizada correctamente." });
      fetchComunidades();
      fetchStats();
    } else {
      setComunidadFormMessage({ type: 'error', text: "Error al actualizar comunidad: " + error.message });
    }
    setFormLoading(false);
  };

  // Toggle Comunidad Estado (Borrado Lógico)
  const handleToggleComunidadEstado = async (comunidadId, estadoActual, comunidadNombre) => {
    const nuevoEstado = estadoActual === 'inactivo' ? 'activo' : 'inactivo';
    const accion = nuevoEstado === 'inactivo' ? 'desactivar (borrado lógico)' : 'reactivar';
    if (!window.confirm(`¿Estás seguro de que deseas ${accion} la comunidad "${comunidadNombre}"?`)) {
      return;
    }
    setFormLoading(true);
    setComunidadFormMessage({ type: '', text: '' });
    const { error } = await supabase
      .from('comunidades')
      .update({ estado: nuevoEstado })
      .eq('id', comunidadId);
    if (!error) {
      setComunidadFormMessage({ type: 'success', text: `Comunidad "${comunidadNombre}" ${nuevoEstado === 'inactivo' ? 'desactivada' : 'reactivada'} con éxito.` });
      fetchComunidades();
      fetchStats();
    } else {
      if (error.code === '42703' || error.message?.includes('estado')) {
        setComunidadFormMessage({ 
          type: 'error', 
          text: 'Para usar borrado lógico en comunidades, ejecuta add_estado_comunidades.sql en el SQL Editor de Supabase.' 
        });
      } else {
        setComunidadFormMessage({ type: 'error', text: "Error al cambiar estado de comunidad: " + error.message });
      }
    }
    setFormLoading(false);
  };

  // Create Usuario (Vecino / Admin / Super Admin)
  const handleCreateUsuario = async (e) => {
    e.preventDefault();
    setUserFormMessage({ type: '', text: '' });

    const nombreTrim = newUsuario.nombre.trim();
    const emailTrim = newUsuario.email.trim();
    const passwordVal = newUsuario.password;
    const direccionTrim = newUsuario.direccion.trim();
    const phoneNoTrim = newUsuario.phoneNo.trim();

    // 1. Validaciones idénticas a la App
    const namePattern = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
    if (!namePattern.test(nombreTrim)) {
      setUserFormMessage({ type: 'error', text: 'El nombre solo debe contener letras y espacios' });
      return;
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(emailTrim)) {
      setUserFormMessage({ type: 'error', text: 'Por favor, ingresa un correo electrónico válido' });
      return;
    }

    if (passwordVal.length < 6 || !/[A-Z]/.test(passwordVal) || !/[0-9]/.test(passwordVal)) {
      setUserFormMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres, una letra mayúscula y un número' });
      return;
    }

    const addressPattern = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s,.:\-#]+$/;
    if (!addressPattern.test(direccionTrim)) {
      setUserFormMessage({ type: 'error', text: 'La dirección contiene caracteres no válidos' });
      return;
    }

    if (!/^\d{7,}$/.test(phoneNoTrim)) {
      setUserFormMessage({ type: 'error', text: 'El número de celular debe ser solo dígitos (mínimo 7 números)' });
      return;
    }

    // Determinar la comunidad asignada
    let comunidadId = null;
    if (userProfile && userProfile.rol === 'admin') {
      comunidadId = userProfile.id_comunidad;
    } else if (newUsuario.id_comunidad) {
      comunidadId = Number(newUsuario.id_comunidad);
    }

    if (!comunidadId && newUsuario.rol !== 'super_admin') {
      setUserFormMessage({ type: 'error', text: 'Debes seleccionar o pertenecer a una comunidad' });
      return;
    }

    setFormLoading(true);
    try {
      // Cliente aislado sin almacenamiento de sesión para que el Admin/SuperAdmin no pierda su sesión web
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const telefonoCompleto = `${newUsuario.countryCode}${phoneNoTrim}`;

      const { data, error } = await tempClient.auth.signUp({
        email: emailTrim,
        password: passwordVal,
        options: {
          data: {
            nombre: nombreTrim,
            direccion: direccionTrim,
            rol: newUsuario.rol,
            id_comunidad: comunidadId,
            telefono: telefonoCompleto
          }
        }
      });

      if (error) {
        throw error;
      }

      setUserFormMessage({ 
        type: 'success', 
        text: `¡Usuario ${nombreTrim} registrado con éxito!` 
      });

      // Limpiar campos del formulario
      setNewUsuario({ 
        nombre: '', 
        email: '', 
        password: '', 
        direccion: '', 
        rol: 'vecino', 
        id_comunidad: '',
        phoneNo: '',
        countryCode: '+591'
      });

      // Refrescar lista de usuarios y estadísticas
      fetchUsuarios();
      fetchStats();
    } catch (err) {
      setUserFormMessage({ 
        type: 'error', 
        text: err.message || 'Error al registrar el usuario en Supabase' 
      });
    } finally {
      setFormLoading(false);
    }
  };

  // Abrir formulario de edición de Usuario
  const openEditUsuario = (usu) => {
    let code = '+591';
    let phone = usu.telefono || '';
    if (phone.startsWith('+')) {
      const match = countryCodes.find(c => phone.startsWith(c.code));
      if (match) {
        code = match.code;
        phone = phone.slice(match.code.length);
      }
    }
    setEditingUsuario({
      id: usu.id,
      nombre: usu.nombre || '',
      direccion: usu.direccion || '',
      rol: usu.rol || 'vecino',
      id_comunidad: usu.id_comunidad ? String(usu.id_comunidad) : '',
      phoneNo: phone,
      countryCode: code,
      estado: usu.estado || 'activo'
    });
    setUserFormMessage({ type: '', text: '' });
  };

  // Update Usuario
  const handleUpdateUsuario = async (e) => {
    e.preventDefault();
    if (!editingUsuario) return;
    setUserFormMessage({ type: '', text: '' });

    const nombreTrim = editingUsuario.nombre.trim();
    const direccionTrim = editingUsuario.direccion.trim();
    const phoneNoTrim = editingUsuario.phoneNo.trim();

    const namePattern = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
    if (!namePattern.test(nombreTrim)) {
      setUserFormMessage({ type: 'error', text: 'El nombre solo debe contener letras y espacios' });
      return;
    }

    const addressPattern = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s,.:\-#]+$/;
    if (!addressPattern.test(direccionTrim)) {
      setUserFormMessage({ type: 'error', text: 'La dirección contiene caracteres no válidos' });
      return;
    }

    if (phoneNoTrim && !/^\d{7,}$/.test(phoneNoTrim)) {
      setUserFormMessage({ type: 'error', text: 'El número de celular debe ser solo dígitos (mínimo 7 números)' });
      return;
    }

    let comId = null;
    if (userProfile && userProfile.rol === 'admin') {
      comId = userProfile.id_comunidad;
    } else if (editingUsuario.id_comunidad) {
      comId = Number(editingUsuario.id_comunidad);
    }

    if (!comId && editingUsuario.rol !== 'super_admin') {
      setUserFormMessage({ type: 'error', text: 'Debes seleccionar o pertenecer a una comunidad' });
      return;
    }

    setFormLoading(true);
    const telefonoCompleto = phoneNoTrim ? `${editingUsuario.countryCode}${phoneNoTrim}` : null;
    const { error } = await supabase
      .from('usuarios')
      .update({
        nombre: nombreTrim,
        direccion: direccionTrim,
        rol: editingUsuario.rol,
        id_comunidad: comId,
        estado: editingUsuario.estado,
        telefono: telefonoCompleto
      })
      .eq('id', editingUsuario.id);

    if (!error) {
      setEditingUsuario(null);
      setUserFormMessage({ type: 'success', text: `Usuario "${nombreTrim}" actualizado correctamente.` });
      fetchUsuarios();
      fetchStats();
    } else {
      setUserFormMessage({ type: 'error', text: 'Error al actualizar usuario: ' + error.message });
    }
    setFormLoading(false);
  };

  // Toggle Usuario Estado (Borrado Lógico)
  const handleToggleUsuarioEstado = async (usuarioId, estadoActual, usuarioNombre) => {
    const nuevoEstado = estadoActual === 'deshabilitado' ? 'activo' : 'deshabilitado';
    const accion = nuevoEstado === 'deshabilitado' ? 'deshabilitar (borrado lógico)' : 'reactivar';
    if (!window.confirm(`¿Estás seguro de que deseas ${accion} la cuenta de "${usuarioNombre}"?`)) {
      return;
    }
    setFormLoading(true);
    setUserFormMessage({ type: '', text: '' });
    const { error } = await supabase
      .from('usuarios')
      .update({ estado: nuevoEstado })
      .eq('id', usuarioId);

    if (!error) {
      setUserFormMessage({ 
        type: 'success', 
        text: `Usuario "${usuarioNombre}" ${nuevoEstado === 'deshabilitado' ? 'deshabilitado' : 'reactivado'} con éxito.` 
      });
      fetchUsuarios();
      fetchStats();
    } else {
      setUserFormMessage({ type: 'error', text: 'Error al cambiar estado del usuario: ' + error.message });
    }
    setFormLoading(false);
  };

  // Create Dispositivo IoT (ESP32)
  const handleCreateDispositivo = async (e) => {
    e.preventDefault();
    setDeviceFormMessage({ type: '', text: '' });

    const macTrim = newDispositivo.mac_address.trim().toUpperCase();
    const zonaTrim = newDispositivo.zona.trim();

    if (!macTrim || !zonaTrim) {
      setDeviceFormMessage({ type: 'error', text: 'La dirección MAC y la Zona son obligatorias.' });
      return;
    }

    let comId = null;
    if (userProfile && userProfile.rol === 'admin') {
      comId = userProfile.id_comunidad;
    } else if (newDispositivo.id_comunidad) {
      comId = Number(newDispositivo.id_comunidad);
    }

    let payload = {
      mac_address: macTrim,
      tipo: newDispositivo.tipo,
      zona: zonaTrim,
      estado: 'activo'
    };

    if (newDispositivo.tipo === 'sirena') {
      if (!comId) {
        setDeviceFormMessage({ type: 'error', text: 'Debes asociar la sirena a una comunidad.' });
        return;
      }
      payload.id_comunidad = comId;
      payload.id_usuario = null;
      payload.latitud = null;
      payload.longitud = null;
    } else {
      // Botón físico
      if (!newDispositivo.id_usuario) {
        setDeviceFormMessage({ type: 'error', text: 'Debes asociar el botón a un vecino responsable.' });
        return;
      }
      payload.id_usuario = newDispositivo.id_usuario;
      payload.id_comunidad = comId || null;
      payload.latitud = newDispositivo.latitud ? parseFloat(newDispositivo.latitud) : null;
      payload.longitud = newDispositivo.longitud ? parseFloat(newDispositivo.longitud) : null;
    }

    setFormLoading(true);
    const { error } = await supabase
      .from('dispositivos')
      .insert([payload]);

    if (!error) {
      setDeviceFormMessage({ type: 'success', text: `Dispositivo ${macTrim} registrado con éxito.` });
      setNewDispositivo({ 
        mac_address: '', 
        tipo: 'sirena', 
        zona: '', 
        id_comunidad: '', 
        id_usuario: '', 
        latitud: '', 
        longitud: '', 
        estado: 'activo' 
      });
      fetchDispositivos();
      fetchStats();
    } else {
      setDeviceFormMessage({ type: 'error', text: "Error al registrar dispositivo: " + error.message });
    }
    setFormLoading(false);
  };

  // Abrir formulario de edición de Dispositivo IoT
  const openEditDispositivo = (dev) => {
    setEditingDispositivo({
      mac_address: dev.mac_address,
      tipo: dev.tipo || 'sirena',
      zona: dev.zona || '',
      id_comunidad: dev.id_comunidad ? String(dev.id_comunidad) : '',
      id_usuario: dev.id_usuario || '',
      latitud: dev.latitud !== null && dev.latitud !== undefined ? String(dev.latitud) : '',
      longitud: dev.longitud !== null && dev.longitud !== undefined ? String(dev.longitud) : '',
      estado: dev.estado || 'activo'
    });
    setDeviceFormMessage({ type: '', text: '' });
  };

  // Update Dispositivo IoT
  const handleUpdateDispositivo = async (e) => {
    e.preventDefault();
    if (!editingDispositivo) return;
    setDeviceFormMessage({ type: '', text: '' });

    const zonaTrim = editingDispositivo.zona.trim();
    if (!zonaTrim) {
      setDeviceFormMessage({ type: 'error', text: 'La zona / ubicación es obligatoria.' });
      return;
    }

    let comId = null;
    if (userProfile && userProfile.rol === 'admin') {
      comId = userProfile.id_comunidad;
    } else if (editingDispositivo.id_comunidad) {
      comId = Number(editingDispositivo.id_comunidad);
    }

    let payload = {
      tipo: editingDispositivo.tipo,
      zona: zonaTrim,
      estado: editingDispositivo.estado
    };

    if (editingDispositivo.tipo === 'sirena') {
      if (!comId) {
        setDeviceFormMessage({ type: 'error', text: 'Debes asociar la sirena a una comunidad.' });
        return;
      }
      payload.id_comunidad = comId;
      payload.id_usuario = null;
      payload.latitud = null;
      payload.longitud = null;
    } else {
      if (!editingDispositivo.id_usuario) {
        setDeviceFormMessage({ type: 'error', text: 'Debes asociar el botón a un vecino responsable.' });
        return;
      }
      payload.id_usuario = editingDispositivo.id_usuario;
      payload.id_comunidad = comId || null;
      payload.latitud = editingDispositivo.latitud ? parseFloat(editingDispositivo.latitud) : null;
      payload.longitud = editingDispositivo.longitud ? parseFloat(editingDispositivo.longitud) : null;
    }

    setFormLoading(true);
    const { error } = await supabase
      .from('dispositivos')
      .update(payload)
      .eq('mac_address', editingDispositivo.mac_address);

    if (!error) {
      setEditingDispositivo(null);
      setDeviceFormMessage({ type: 'success', text: `Dispositivo ${editingDispositivo.mac_address} actualizado.` });
      fetchDispositivos();
      fetchStats();
    } else {
      setDeviceFormMessage({ type: 'error', text: 'Error al actualizar dispositivo: ' + error.message });
    }
    setFormLoading(false);
  };

  // Toggle Dispositivo Estado (Borrado Lógico)
  const handleToggleDispositivoEstado = async (macAddress, estadoActual) => {
    const nuevoEstado = estadoActual === 'inactivo' ? 'activo' : 'inactivo';
    const accion = nuevoEstado === 'inactivo' ? 'desactivar (borrado lógico)' : 'reactivar';
    if (!window.confirm(`¿Estás seguro de que deseas ${accion} el dispositivo ${macAddress}?`)) {
      return;
    }
    setFormLoading(true);
    setDeviceFormMessage({ type: '', text: '' });
    const { error } = await supabase
      .from('dispositivos')
      .update({ estado: nuevoEstado })
      .eq('mac_address', macAddress);

    if (!error) {
      setDeviceFormMessage({ 
        type: 'success', 
        text: `Dispositivo ${macAddress} ${nuevoEstado === 'inactivo' ? 'desactivado' : 'reactivado'} con éxito.` 
      });
      fetchDispositivos();
      fetchStats();
    } else {
      setDeviceFormMessage({ type: 'error', text: 'Error al cambiar estado del dispositivo: ' + error.message });
    }
    setFormLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex flex-col font-sans relative overflow-x-hidden w-full">
      
      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-[280px] sm:w-[500px] h-[280px] sm:h-[500px] bg-sky-500/10 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none -z-10"></div>
      <div className="absolute top-1/3 right-1/4 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-[#1E88E5]/5 rounded-full blur-[100px] sm:blur-[150px] pointer-events-none -z-10"></div>
      <div className="absolute bottom-10 left-1/3 w-[250px] sm:w-[450px] h-[250px] sm:h-[450px] bg-red-500/5 rounded-full blur-[90px] sm:blur-[130px] pointer-events-none -z-10"></div>


      {/* Navigation Header */}
      <header className="px-4 md:px-8 py-4 relative z-[200]">
        <nav className="max-w-[95%] mx-auto glassmorphism rounded-2xl px-6 py-4 flex items-center justify-between">
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
                <div className="flex items-center gap-3">
                  {/* Botón rápido a Dashboard si no estamos en él */}
                  {currentPage !== 'dashboard' && (
                    <button 
                      onClick={() => setCurrentPage('dashboard')} 
                      className="px-3.5 py-2 rounded-xl bg-sky-950/80 text-[#00E5FF] border border-[#00E5FF]/30 hover:border-[#00E5FF] hover:bg-sky-900/60 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950/30"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      Ir al Panel
                    </button>
                  )}

                  {/* Panel de Usuario Estético (Pill Trigger + Popover) */}
                  <div className="relative">
                    <button
                      onClick={() => setProfileOpen(!profileOpen)}
                      className={`flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#090E1A]/90 border transition-all duration-200 shadow-lg cursor-pointer ${
                        profileOpen 
                          ? 'border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.25)] bg-[#0c1322]' 
                          : 'border-white/10 hover:border-[#00E5FF]/60 hover:bg-slate-800/80'
                      }`}
                      title="Ver información de perfil"
                    >
                      {/* Avatar con inicial */}
                      <div className="relative">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] flex items-center justify-center font-black text-white text-xs shadow-inner ring-1 ring-[#00E5FF]/50">
                          {userProfile?.nombre ? userProfile.nombre.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U')}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#090E1A] rounded-full"></span>
                      </div>

                      {/* Nombre y Rol */}
                      <div className="text-left hidden lg:block pr-1">
                        <div className="text-xs font-bold text-white tracking-wide max-w-[130px] truncate leading-tight">
                          {userProfile?.nombre || user?.email?.split('@')[0]}
                        </div>
                        <div className="text-[10px] font-semibold text-[#00E5FF] uppercase tracking-wider flex items-center gap-1">
                          <ShieldCheck className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate max-w-[90px]">
                            {userProfile?.rol === 'superadmin' ? 'Super Admin' : userProfile?.rol === 'admin' ? 'Admin Local' : (userProfile?.rol || 'Vecino')}
                          </span>
                        </div>
                      </div>

                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${profileOpen ? 'rotate-180 text-[#00E5FF]' : ''}`} />
                    </button>

                    {/* Backdrop para cerrar al hacer clic afuera */}
                    {profileOpen && (
                      <div 
                        className="fixed inset-0 z-[190] bg-black/30 backdrop-blur-[1px]" 
                        onClick={() => setProfileOpen(false)} 
                      />
                    )}

                    {/* Popover / Menú Detallado del Perfil */}
                    {profileOpen && (
                      <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 rounded-2xl bg-[#090E1A]/95 backdrop-blur-2xl border border-[#00E5FF]/40 shadow-[0_12px_45px_rgba(0,0,0,0.85),0_0_25px_rgba(0,229,255,0.2)] z-[200] p-5 text-white animate-fade-in divide-y divide-white/10">
                        
                        {/* Cabecera del Perfil */}
                        <div className="pb-4 flex items-start gap-3.5">
                          <div className="relative flex-shrink-0">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] flex items-center justify-center font-black text-white text-xl shadow-lg shadow-cyan-500/20 ring-2 ring-[#00E5FF]/60">
                              {userProfile?.nombre ? userProfile.nombre.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U')}
                            </div>
                            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-emerald-500 text-[9px] font-bold text-slate-950 rounded-full border-2 border-slate-900 flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse"></span>
                              Online
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-base font-bold text-white truncate">
                              {userProfile?.nombre || 'Usuario Conectado'}
                            </h4>
                            <p className="text-xs text-gray-400 truncate flex items-center gap-1.5 mt-0.5">
                              <Mail className="w-3 h-3 text-[#00E5FF]/80 flex-shrink-0" />
                              <span className="truncate">{userProfile?.email || user?.email}</span>
                            </p>
                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                userProfile?.rol === 'superadmin'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                  : userProfile?.rol === 'admin'
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}>
                                <ShieldCheck className="w-3 h-3" />
                                {userProfile?.rol === 'superadmin' ? 'Super Admin' : userProfile?.rol === 'admin' ? 'Admin Local' : (userProfile?.rol || 'Vecino')}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                {userProfile?.estado === 'activo' ? 'Activo' : (userProfile?.estado || 'Activo')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Tarjeta de Información Detallada */}
                        <div className="py-4 space-y-2 text-xs">
                          {/* Comunidad / Sector */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                            <div className="flex items-center gap-2 text-gray-400">
                              <Home className="w-3.5 h-3.5 text-[#00E5FF]" />
                              <span>Comunidad:</span>
                            </div>
                            <span className="font-semibold text-gray-200 text-right truncate max-w-[180px]">
                              {userProfile?.nombre_comunidad || (userProfile?.rol === 'superadmin' ? '🌐 Acceso Global (Todas)' : 'No asignada')}
                            </span>
                          </div>

                          {/* Teléfono */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                            <div className="flex items-center gap-2 text-gray-400">
                              <Phone className="w-3.5 h-3.5 text-[#00E5FF]" />
                              <span>Teléfono:</span>
                            </div>
                            <span className="font-semibold text-gray-200">
                              {userProfile?.telefono || 'No registrado'}
                            </span>
                          </div>

                          {/* Dirección */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                            <div className="flex items-center gap-2 text-gray-400">
                              <MapPin className="w-3.5 h-3.5 text-[#00E5FF]" />
                              <span>Dirección:</span>
                            </div>
                            <span className="font-semibold text-gray-200 text-right truncate max-w-[180px]">
                              {userProfile?.direccion || 'No registrada'}
                            </span>
                          </div>

                          {/* Fecha de Registro */}
                          {userProfile?.created_at && (
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                              <div className="flex items-center gap-2 text-gray-400">
                                <Calendar className="w-3.5 h-3.5 text-[#00E5FF]" />
                                <span>Miembro desde:</span>
                              </div>
                              <span className="font-semibold text-gray-200">
                                {new Date(userProfile.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Acciones del Perfil */}
                        <div className="pt-3.5 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setCurrentPage('dashboard');
                              setProfileOpen(false);
                            }}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-600/30 to-[#00E5FF]/20 hover:from-sky-600/50 hover:to-[#00E5FF]/40 border border-[#00E5FF]/40 text-[#00E5FF] hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-950/50 cursor-pointer"
                          >
                            <LayoutDashboard className="w-3.5 h-3.5" />
                            {currentPage === 'dashboard' ? 'Panel Activo' : 'Ir al Panel'}
                          </button>

                          <button
                            onClick={() => {
                              setProfileOpen(false);
                              handleLogout();
                            }}
                            className="py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            title="Cerrar Sesión"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Salir
                          </button>
                        </div>

                      </div>
                    )}
                  </div>
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
          <div className="md:hidden absolute top-full left-4 right-4 mt-2 bg-[#0F172A]/95 border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl animate-fade-in z-[1000] backdrop-blur-lg">
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
                  {/* Tarjeta de Resumen de Usuario en Móvil */}
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-[#00E5FF]/20 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] flex items-center justify-center font-black text-white text-sm shadow-inner ring-1 ring-[#00E5FF]/40 flex-shrink-0">
                      {userProfile?.nombre ? userProfile.nombre.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {userProfile?.nombre || user?.email?.split('@')[0]}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {userProfile?.email || user?.email}
                      </div>
                      <div className="text-[10px] font-semibold text-[#00E5FF] uppercase tracking-wider flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        {userProfile?.rol === 'superadmin' ? 'Super Admin' : userProfile?.rol === 'admin' ? 'Admin Local' : (userProfile?.rol || 'Vecino')}
                      </div>
                    </div>
                  </div>

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
          <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 pb-24 md:pt-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              <div className="lg:col-span-7 flex flex-col justify-center text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-950/60 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-semibold self-center lg:self-start mb-6">
                  <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping"></span>
                  Ecosistema Activo de Seguridad Vecinal
                </div>
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight title-gradient leading-tight mb-6">
                  Seguridad comunitaria inteligente en tus manos
                </h1>
                <p className="text-base sm:text-lg text-gray-400 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8">
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

              <div className="lg:col-span-5 hidden lg:flex justify-center items-center">
                <div className="relative w-[280px] sm:w-[286px] h-[580px] sm:h-[620px] rounded-[34px] p-[5px] bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 glow-cyan shadow-2xl overflow-hidden">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 md:mt-20 border-t border-white/5 pt-16">
              <button onClick={() => setCurrentPage('features')} className="p-6 rounded-2xl glass-card text-left flex flex-col justify-between group">
                <div>
                  <span className="w-10 h-10 rounded-lg bg-sky-950/60 text-[#00E5FF] flex items-center justify-center mb-4 border border-[#00E5FF]/20 group-hover:scale-110 transition-transform">
                    💡
                  </span>
                  <h3 className="text-lg font-bold text-white mb-2">Funcionalidades</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">Conoce el sistema de geolocalización, chat y alertas SOS comunitarias.</p>
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
                  <p className="text-sm text-gray-400 leading-relaxed">Guía paso a paso sobre el funcionamiento operativo y flujos de usuario.</p>
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
                  <p className="text-sm text-gray-400 leading-relaxed">Descubre la sincronización nativa con sirenas y botones ESP32.</p>
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
                  <p className="text-sm text-gray-400 leading-relaxed">Obtén el archivo APK de instalación y los recursos necesarios.</p>
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
          <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16 animate-fade-in">
            <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
              <h1 className="text-emerald-400 text-sm font-bold tracking-widest uppercase mb-3">Seguridad Avanzada</h1>
              <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Protección comunitaria en cada segundo
              </p>
              <p className="text-gray-400 mt-4 leading-relaxed text-sm sm:text-base">
                Eje Urbano combina geolocalización, hardware IoT y comunicación directa para ofrecer respuesta inmediata ante cualquier peligro. Haz clic en las tarjetas para conocer más detalles.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-16">
              
              {/* SOS Card */}
              <div 
                onClick={() => setActiveFeatureModal('sos')}
                className="rounded-3xl p-6 sm:p-8 glass-card flex flex-col justify-between cursor-pointer hover:border-red-500/40 hover:shadow-red-500/5 group"
              >
                <div>
                  <span className="w-14 h-14 rounded-2xl bg-red-950/60 text-red-400 border border-red-500/20 flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
                    <AlertTriangle className="w-7 h-7" />
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center justify-between gap-2">
                    Alertas SOS Comunitarias
                    <span className="text-[10px] text-red-400 font-semibold px-2.5 py-0.5 rounded-full bg-red-950/50 border border-red-500/20 whitespace-nowrap">Ver Detalle</span>
                  </h3>
                  <p className="text-gray-400 leading-relaxed text-sm">
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
                className="rounded-3xl p-6 sm:p-8 glass-card flex flex-col justify-between cursor-pointer hover:border-sky-500/40 hover:shadow-sky-500/5 group"
              >
                <div>
                  <span className="w-14 h-14 rounded-2xl bg-sky-950/60 text-sky-400 border border-sky-500/20 flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
                    <MapPin className="w-7 h-7" />
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center justify-between gap-2">
                    Mapas en Tiempo Real
                    <span className="text-[10px] text-[#00E5FF] font-semibold px-2.5 py-0.5 rounded-full bg-sky-950/50 border border-sky-500/20 whitespace-nowrap">Ver Detalle</span>
                  </h3>
                  <p className="text-gray-400 leading-relaxed text-sm">
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
              <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
                <div className="bg-[#0f172a] border border-red-500/20 max-w-2xl w-full rounded-3xl p-6 sm:p-8 shadow-2xl relative">
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
                      <h3 className="text-xl sm:text-2xl font-bold text-white">Detalle de Alertas SOS</h3>
                      <p className="text-xs text-red-400 font-semibold uppercase tracking-wider">Ecosistema de Respuesta Rápida</p>
                    </div>
                  </div>
                  <div className="space-y-4 text-sm text-gray-300 leading-relaxed max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-2">
                    <p>
                      El sistema de <strong>Alertas SOS de Eje Urbano</strong> te permite notificar situaciones críticas a tu comunidad y contactos de confianza al instante:
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-gray-400 text-xs sm:text-sm">
                      <li><strong className="text-white">Botón Físico de Emergencia:</strong> Puedes activar una alerta SOS silenciosa de forma discreta manteniendo presionado el botón de **subir volumen** de tu teléfono por 5 segundos o más, sin necesidad de encender la pantalla.</li>
                      <li><strong className="text-white">Tipos de Alerta Personalizados:</strong> Clasifica tu emergencia en 4 categorías: <em>Pánico (SOS), Robo, Asistencia Médica o Incendio</em>, para recibir la ayuda correspondiente de tus vecinos.</li>
                      <li><strong className="text-white">Alarmas Audibles Instantáneas:</strong> Envía notificaciones de alta prioridad a tus contactos de confianza que sonarán inmediatamente en sus teléfonos, incluso si los tienen en modo silencioso.</li>
                      <li><strong className="text-white">Activación de Sirenas Vecinales:</strong> Dispara de forma automática las sirenas físicas de alerta instaladas en las calles de tu barrio para disuadir cualquier amenaza o delincuente en la zona.</li>
                    </ul>
                  </div>
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                    <button 
                      onClick={() => setActiveFeatureModal(null)}
                      className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all w-full sm:w-auto"
                    >
                      Entendido
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL: MAP DETAILS */}
            {activeFeatureModal === 'map' && (
              <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
                <div className="bg-[#0f172a] border border-sky-500/20 max-w-2xl w-full rounded-3xl p-6 sm:p-8 shadow-2xl relative">
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
                      <h3 className="text-xl sm:text-2xl font-bold text-white">Detalle de Mapas y Geolocalización</h3>
                      <p className="text-xs text-[#00E5FF] font-semibold uppercase tracking-wider">Monitoreo y Trayecto Seguro</p>
                    </div>
                  </div>
                  <div className="space-y-4 text-sm text-gray-300 leading-relaxed max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-2">
                    <p>
                      El sistema de geolocalización y mapas dinámicos está diseñado para cuidarte a ti y a tu familia en sus traslados diarios:
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-gray-400 text-xs sm:text-sm">
                      <li><strong className="text-white">Trayecto Seguro ("Acompáñame a casa"):</strong> Te permite definir un tiempo estimado para tu recorrido. Si no marcas que has llegado a salvo y el temporizador expira, tus contactos de confianza recibirán automáticamente una alerta de SOS con tu última ubicación.</li>
                      <li><strong className="text-white">Privacidad Respetada:</strong> La ubicación de tus trayectos normales es confidencial y solo la pueden ver los contactos de confianza que tú elijas. Nadie más, ni los administradores del barrio, pueden ver tus rutas rutinarias.</li>
                      <li><strong className="text-white">Monitoreo Activo de Emergencias:</strong> Cuando activas una alerta de SOS, tu ubicación en el mapa se actualiza continuamente para que tus vecinos puedan ubicarte y acudir a ayudarte rápidamente.</li>
                      <li><strong className="text-white">Llamadas de Auxilio Rápido:</strong> El mapa incluye accesos directos para llamar al instante a los números de emergencia oficiales de Bolivia, como la Policía (110), Ambulancias (118), Bomberos (119) y SAR (123).</li>
                    </ul>
                  </div>
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                    <button 
                      onClick={() => setActiveFeatureModal(null)}
                      className="px-6 py-2.5 rounded-xl bg-[#00E5FF] text-slate-950 font-bold text-sm hover:bg-[#00b0ff] transition-all w-full sm:w-auto"
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
                <a 
                  href="Manual_de_Usuario_Eje_Urbano.pdf" 
                  download="Manual_de_Usuario_Eje_Urbano.pdf"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-sky-950/60 border border-[#00E5FF]/20 text-[#00E5FF] hover:bg-sky-900/40 text-sm font-semibold transition-all"
                >
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
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-4 pr-11 py-3 rounded-xl bg-slate-900 border border-gray-800 focus:border-[#00E5FF] focus:outline-none text-white text-sm" 
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetModal(true);
                      setResetEmail(email.trim());
                      setResetOtpCode('');
                      setResetNewPassword('');
                      setResetConfirmPassword('');
                      setResetError('');
                      setResetSuccess('');
                      setResetStep(1);
                    }}
                    className="text-xs text-[#00E5FF] hover:underline font-medium cursor-pointer transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
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

        {/* MODAL RECUPERACIÓN DE CONTRASEÑA (CÓDIGO OTP 6 DÍGITOS) */}
        {showResetModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
            <div className="bg-[#0f172a] border border-[#00E5FF]/30 max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl relative text-left">
              <button 
                onClick={() => {
                  if (!resetLoading) {
                    setShowResetModal(false);
                  }
                }}
                disabled={resetLoading}
                className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${resetSuccess ? 'bg-emerald-950/60 text-emerald-400' : 'bg-cyan-950/60 text-[#00E5FF]'}`}>
                  {resetSuccess ? <CheckCircle className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                </span>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {resetSuccess ? '¡Clave Actualizada!' : (resetStep === 1 ? 'Recuperar Contraseña' : 'Código de Seguridad')}
                  </h3>
                  <p className="text-xs text-gray-400 font-medium">Eje Urbano Seguridad</p>
                </div>
              </div>

              {resetSuccess ? (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-sm leading-relaxed flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
                    <span>{resetSuccess}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
                  >
                    Entendido / Iniciar Sesión
                  </button>
                </div>
              ) : resetStep === 1 ? (
                <form onSubmit={handleSendResetEmail} className="space-y-5">
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Ingresa el correo electrónico asociado a tu cuenta de administrador. Te enviaremos un código de seguridad de 8 dígitos para restablecer tu clave.
                  </p>

                  {resetError && (
                    <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Correo Electrónico</label>
                    <input 
                      type="email" 
                      required 
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        setResetError('');
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-gray-800 focus:border-[#00E5FF] focus:outline-none text-white text-sm" 
                      placeholder="correo@ejemplo.com"
                      disabled={resetLoading}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetModal(false)}
                      disabled={resetLoading}
                      className="w-1/2 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 font-semibold text-sm transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-1/2 py-3.5 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      {resetLoading ? 'Enviando...' : 'Enviar Código'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtpAndResetPassword} className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-gray-800 text-xs text-gray-300">
                    <div>Código de 8 dígitos enviado a: <strong className="text-[#00E5FF]">{resetEmail}</strong></div>
                    <div className="text-[11px] text-gray-400 mt-1">La nueva contraseña debe tener al menos 6 caracteres, una mayúscula y un número.</div>
                  </div>

                  {resetError && (
                    <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Código de 8 dígitos</label>
                    <input 
                      type="text" 
                      required 
                      maxLength={8}
                      value={resetOtpCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                        setResetOtpCode(val);
                        setResetError('');
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-gray-800 focus:border-[#00E5FF] focus:outline-none text-white text-sm tracking-widest font-mono text-center text-lg" 
                      placeholder="12345678"
                      disabled={resetLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Nueva Contraseña</label>
                    <div className="relative">
                      <input 
                        type={showResetNewPassword ? "text" : "password"} 
                        required 
                        value={resetNewPassword}
                        onChange={(e) => {
                          setResetNewPassword(e.target.value);
                          setResetError('');
                        }}
                        className="w-full pl-4 pr-11 py-2.5 rounded-xl bg-slate-900 border border-gray-800 focus:border-[#00E5FF] focus:outline-none text-white text-sm" 
                        placeholder="••••••••"
                        disabled={resetLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {showResetNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Confirmar Contraseña</label>
                    <div className="relative">
                      <input 
                        type={showResetConfirmPassword ? "text" : "password"} 
                        required 
                        value={resetConfirmPassword}
                        onChange={(e) => {
                          setResetConfirmPassword(e.target.value);
                          setResetError('');
                        }}
                        className="w-full pl-4 pr-11 py-2.5 rounded-xl bg-slate-900 border border-gray-800 focus:border-[#00E5FF] focus:outline-none text-white text-sm" 
                        placeholder="••••••••"
                        disabled={resetLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {showResetConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResetStep(1);
                        setResetError('');
                      }}
                      disabled={resetLoading}
                      className="w-1/3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 font-semibold text-xs transition-all cursor-pointer"
                    >
                      Volver
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-2/3 py-3 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      {resetLoading ? 'Cambiando...' : 'Cambiar Contraseña'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* PAGE: DASHBOARD */}
        {currentPage === 'dashboard' && user && (
          <section className="max-w-[95%] mx-auto px-4 md:px-8 py-8 animate-fade-in">
            
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
                  Conexión activa
                </span>
                <button onClick={fetchStats} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 transition-colors" title="Refrescar">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Stats Overview (Funciona ahora como el selector de pestañas) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 mb-10">
              <div 
                onClick={() => setDashboardTab('alertas')}
                className={`p-6 rounded-2xl glass-card transition-all cursor-pointer ${
                  dashboardTab === 'alertas' 
                    ? 'glass-card-active ring-2 ring-[#00E5FF] border-2 border-[#00E5FF]' 
                    : `border border-white/5 opacity-80 hover:opacity-100 ${stats.activeAlerts > 0 ? 'bg-red-500/5 border-red-500/20' : ''}`
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-sm font-semibold ${dashboardTab === 'alertas' ? 'text-[#00E5FF]' : 'text-gray-400'}`}>Alertas Activas</span>
                  <AlertTriangle className={`w-5 h-5 ${stats.activeAlerts > 0 ? 'text-red-500 animate-pulse' : dashboardTab === 'alertas' ? 'text-[#00E5FF]' : 'text-gray-400'}`} />
                </div>
                <h3 className="text-4xl font-extrabold text-white flex items-center justify-between">
                  {stats.activeAlerts}
                  {stats.activeAlerts > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-extrabold animate-pulse">
                      {stats.activeAlerts}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-400 mt-2">Emergencias que requieren atención</p>
                {dashboardTab === 'alertas' && (
                  <div className="mt-3 pt-2 border-t border-[#00E5FF]/20 flex items-center gap-1.5 text-[11px] font-bold text-[#00E5FF]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse"></span> Seleccionado
                  </div>
                )}
              </div>

              <div 
                onClick={() => setDashboardTab('usuarios')}
                className={`p-6 rounded-2xl glass-card transition-all cursor-pointer ${
                  dashboardTab === 'usuarios' 
                    ? 'glass-card-active ring-2 ring-[#00E5FF] border-2 border-[#00E5FF]' 
                    : 'border border-white/5 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-sm font-semibold ${dashboardTab === 'usuarios' ? 'text-[#00E5FF]' : 'text-gray-400'}`}>Vecinos</span>
                  <Users className={`w-5 h-5 ${dashboardTab === 'usuarios' ? 'text-[#00E5FF]' : 'text-emerald-400'}`} />
                </div>
                <h3 className="text-4xl font-extrabold text-white">{stats.totalUsers}</h3>
                <p className="text-xs text-gray-400 mt-2">Usuarios registrados en el sistema</p>
                {dashboardTab === 'usuarios' && (
                  <div className="mt-3 pt-2 border-t border-[#00E5FF]/20 flex items-center gap-1.5 text-[11px] font-bold text-[#00E5FF]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse"></span> Seleccionado
                  </div>
                )}
              </div>

              <div 
                onClick={() => setDashboardTab('dispositivos')}
                className={`p-6 rounded-2xl glass-card transition-all cursor-pointer ${
                  dashboardTab === 'dispositivos' 
                    ? 'glass-card-active ring-2 ring-[#00E5FF] border-2 border-[#00E5FF]' 
                    : 'border border-white/5 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-sm font-semibold ${dashboardTab === 'dispositivos' ? 'text-[#00E5FF]' : 'text-gray-400'}`}>Dispositivos IoT</span>
                  <Cpu className={`w-5 h-5 ${dashboardTab === 'dispositivos' ? 'text-[#00E5FF]' : 'text-amber-400'}`} />
                </div>
                <h3 className="text-4xl font-extrabold text-white">{stats.totalDevices}</h3>
                <p className="text-xs text-gray-400 mt-2">Sirenas y Botones físicos activos</p>
                {dashboardTab === 'dispositivos' && (
                  <div className="mt-3 pt-2 border-t border-[#00E5FF]/20 flex items-center gap-1.5 text-[11px] font-bold text-[#00E5FF]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse"></span> Seleccionado
                  </div>
                )}
              </div>

              <div 
                onClick={() => setDashboardTab('comunidades')}
                className={`p-6 rounded-2xl glass-card transition-all cursor-pointer ${
                  dashboardTab === 'comunidades' 
                    ? 'glass-card-active ring-2 ring-[#00E5FF] border-2 border-[#00E5FF]' 
                    : 'border border-white/5 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-sm font-semibold ${dashboardTab === 'comunidades' ? 'text-[#00E5FF]' : 'text-gray-400'}`}>Comunidades</span>
                  <Home className={`w-5 h-5 ${dashboardTab === 'comunidades' ? 'text-[#00E5FF]' : 'text-sky-400'}`} />
                </div>
                <h3 className="text-4xl font-extrabold text-white">{stats.totalCommunities}</h3>
                <p className="text-xs text-gray-400 mt-2">Barrios organizados activos</p>
                {dashboardTab === 'comunidades' && (
                  <div className="mt-3 pt-2 border-t border-[#00E5FF]/20 flex items-center gap-1.5 text-[11px] font-bold text-[#00E5FF]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse"></span> Seleccionado
                  </div>
                )}
              </div>

              <div 
                onClick={() => setDashboardTab('reportes')}
                className={`p-6 rounded-2xl glass-card transition-all cursor-pointer ${
                  dashboardTab === 'reportes' 
                    ? 'glass-card-active ring-2 ring-[#00E5FF] border-2 border-[#00E5FF]' 
                    : 'border border-white/5 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-sm font-semibold ${dashboardTab === 'reportes' ? 'text-[#00E5FF]' : 'text-gray-400'}`}>Reportes</span>
                  <BarChart3 className={`w-5 h-5 ${dashboardTab === 'reportes' ? 'text-[#00E5FF]' : 'text-purple-400'}`} />
                </div>
                <h3 className="text-4xl font-extrabold text-white flex items-center justify-between">
                  <span>Métricas</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                    Pronto
                  </span>
                </h3>
                <p className="text-xs text-gray-400 mt-2">Exportación y auditoría vecinal</p>
                {dashboardTab === 'reportes' && (
                  <div className="mt-3 pt-2 border-t border-[#00E5FF]/20 flex items-center gap-1.5 text-[11px] font-bold text-[#00E5FF]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse"></span> Seleccionado
                  </div>
                )}
              </div>
            </div>

            {/* Tab content 1: Alertas (Persistente con hidden para evitar recargas y parpadeos del mapa) */}
            <div className={`space-y-6 ${dashboardTab === 'alertas' ? 'block' : 'hidden'}`}>
                
                {/* Active Alerts Live Map */}
                <div id="mapa-live-container" className="rounded-2xl border border-white/5 overflow-hidden h-[550px] relative glow-cyan block">
                  {/* Theme Selector Overlay */}
                  <div className="absolute top-3 right-3 z-20 bg-slate-900/90 border border-white/10 rounded-xl p-1 flex gap-1 shadow-lg backdrop-blur-md">
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
                    ref={mapIframeRef}
                    key="static-leaflet-map"
                    className="w-full border-0 block"
                    style={{ width: '100%', height: '550px', minHeight: '550px' }}
                    title="Active Alerts Map"
                    src="mapa.html"
                    onLoad={() => {
                      if (mapIframeRef.current && mapIframeRef.current.contentWindow) {
                        mapIframeRef.current.contentWindow.postMessage({
                          type: 'SET_THEME',
                          theme: mapTheme
                        }, '*');
                        const activas = alertas.filter(a => a.estado === 'activa' && a.latitud && a.longitud);
                        mapIframeRef.current.contentWindow.postMessage({
                          type: 'UPDATE_ALERTS',
                          alerts: activas
                        }, '*');
                      }
                    }}
                  />
                  {stats.activeAlerts === 0 && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-10">
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
                              id={`alerta-row-${alerta.id}`}
                              onClick={() => {
                                if (alerta.estado === 'activa' && alerta.latitud && alerta.longitud) {
                                  const latest = alertasRef.current.find(a => a.id === alerta.id) || alerta;
                                  const targetLat = latest.latitud_actual != null ? Number(latest.latitud_actual) : Number(latest.latitud);
                                  const targetLng = latest.longitud_actual != null ? Number(latest.longitud_actual) : Number(latest.longitud);
                                  setSelectedAlerta({ latitud: targetLat, longitud: targetLng, id: alerta.id });
                                  
                                  // Enviar de inmediato al iframe para centrar al instante sin desvios
                                  if (mapIframeRef.current && mapIframeRef.current.contentWindow) {
                                    mapIframeRef.current.contentWindow.postMessage({
                                      type: 'FOCUS_MARKER',
                                      id: alerta.id,
                                      lat: targetLat,
                                      lng: targetLng
                                    }, '*');
                                  }

                                  const mapEl = document.getElementById('mapa-live-container');
                                  if (mapEl) {
                                    const rect = mapEl.getBoundingClientRect();
                                    if (rect.top < 0 || rect.bottom > window.innerHeight) {
                                      mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                  }
                                }
                              }}
                              className={`transition-colors cursor-pointer ${selectedAlerta && selectedAlerta.id === alerta.id ? 'bg-sky-500/10 border-l-4 border-l-[#00E5FF] hover:bg-sky-500/20' : alerta.estado === 'activa' ? 'hover:bg-red-500/5 bg-red-500/2' : 'hover:bg-slate-900/40'}`}
                            >
                              <td className="px-6 py-4 font-mono text-xs text-gray-400">{alerta.id}</td>
                              <td className="px-6 py-4 font-semibold">{alerta.emisor?.nombre || 'Botón Físico / Anónimo'}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${alerta.tipo === 'ROBO' || alerta.tipo === 'SOS' ? 'bg-red-500/10 text-red-400 border-red-500/20' : alerta.tipo === 'MEDICA' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}`}>
                                  {alerta.tipo}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${alerta.estado === 'activa' ? 'bg-red-600 text-white shadow-sm shadow-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
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
                              <td className="px-6 py-4 text-right relative" onClick={(e) => e.stopPropagation()}>
                                {alerta.estado === 'activa' ? (
                                  <div className="relative inline-block text-left">
                                    <button 
                                      onClick={() => setManageAlerta(manageAlerta && manageAlerta.id === alerta.id ? null : alerta)}
                                      className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-500/20"
                                    >
                                      Atender Emergencia
                                    </button>

                                    {/* MENU FLOTANTE CONTEXTUAL (Sólo ocupa su propio tamaño) */}
                                    {manageAlerta && manageAlerta.id === alerta.id && (
                                      <div className="origin-top-right absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl bg-[#1e293b] border border-white/10 p-4 z-[2000] animate-fade-in text-left">
                                        <div className="mb-3 border-b border-white/5 pb-2">
                                          <p className="text-[10px] text-gray-400 uppercase font-semibold">Gestionar Alerta</p>
                                          <p className="text-xs text-white truncate">Emisor: {alerta.emisor?.nombre || 'Botón Físico'}</p>
                                        </div>
                                        <div className="space-y-2">
                                          <button 
                                            onClick={() => handleUpdateAlertStatus(alerta.id, 'activa')}
                                            className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-all text-left flex items-center gap-1.5"
                                          >
                                            ⏳ PENDIENTE (ACTIVA)
                                          </button>
                                          <button 
                                            onClick={() => handleUpdateAlertStatus(alerta.id, 'finalizada')}
                                            className="w-full py-2 px-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xs transition-all text-left flex items-center gap-1.5"
                                          >
                                            ✅ ATENDIDA (FINALIZADA)
                                          </button>
                                          <button 
                                            onClick={() => handleUpdateAlertStatus(alerta.id, 'falsa_alarma')}
                                            className="w-full py-2 px-3 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-bold text-xs transition-all text-left flex items-center gap-1.5"
                                          >
                                            ❌ FALSA ALARMA
                                          </button>
                                          <button 
                                            onClick={() => setManageAlerta(null)}
                                            className="w-full py-1.5 text-center text-gray-400 hover:text-white text-xs font-semibold uppercase tracking-wider mt-1"
                                          >
                                            CANCELAR
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${alerta.estado === 'finalizada' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                    {alerta.estado === 'finalizada' ? 'Resuelta' : 'Falsa Alarma'}
                                  </span>
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

            {/* Tab content 2: Usuarios */}
            {dashboardTab === 'usuarios' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form to create/edit user */}
                <div className="glassmorphism p-6 rounded-2xl h-fit border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <UserPlus className="text-[#00E5FF]" />
                      {editingUsuario ? 'Editar Usuario' : 'Registrar Usuario'}
                    </span>
                    {editingUsuario && (
                      <button 
                        type="button"
                        onClick={() => setEditingUsuario(null)}
                        className="text-xs text-gray-400 hover:text-white font-normal"
                      >
                        Cancelar
                      </button>
                    )}
                  </h3>

                  {userFormMessage.text && (
                    <div className={`p-3 rounded-xl mb-4 text-xs font-semibold flex items-center gap-2 ${
                      userFormMessage.type === 'error' 
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
                        : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    }`}>
                      {userFormMessage.type === 'error' ? '⚠️' : '✅'} {userFormMessage.text}
                    </div>
                  )}

                  <form onSubmit={editingUsuario ? handleUpdateUsuario : handleCreateUsuario} className="space-y-4">
                    {/* Nombre Completo */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre Completo</label>
                      <input 
                        type="text" 
                        required 
                        value={editingUsuario ? editingUsuario.nombre : newUsuario.nombre}
                        onChange={(e) => editingUsuario 
                          ? setEditingUsuario({ ...editingUsuario, nombre: e.target.value })
                          : setNewUsuario({ ...newUsuario, nombre: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm focus:border-[#00E5FF] outline-none transition-all"
                        placeholder="Ej. Juan Pérez"
                      />
                    </div>

                    {/* Correo Electrónico (Solo al crear) */}
                    {!editingUsuario && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Correo Electrónico</label>
                        <input 
                          type="email" 
                          required 
                          value={newUsuario.email}
                          onChange={(e) => setNewUsuario({ ...newUsuario, email: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm focus:border-[#00E5FF] outline-none transition-all"
                          placeholder="correo@ejemplo.com"
                        />
                      </div>
                    )}

                    {/* Contraseña con Ojo para Ver/Ocultar (Solo al crear) */}
                    {!editingUsuario && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Contraseña</label>
                        <div className="relative">
                          <input 
                            type={showUserPassword ? "text" : "password"} 
                            required 
                            value={newUsuario.password}
                            onChange={(e) => setNewUsuario({ ...newUsuario, password: e.target.value })}
                            className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm focus:border-[#00E5FF] outline-none transition-all"
                            placeholder="Mín. 6 car., 1 Mayús., 1 Núm."
                          />
                          <button
                            type="button"
                            onClick={() => setShowUserPassword(!showUserPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                          >
                            {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Dirección Domiciliaria */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dirección Domiciliaria</label>
                      <input 
                        type="text" 
                        required 
                        value={editingUsuario ? editingUsuario.direccion : newUsuario.direccion}
                        onChange={(e) => editingUsuario
                          ? setEditingUsuario({ ...editingUsuario, direccion: e.target.value })
                          : setNewUsuario({ ...newUsuario, direccion: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm focus:border-[#00E5FF] outline-none transition-all"
                        placeholder="Calle Florida #123"
                      />
                    </div>

                    {/* Número de Celular con Selector de País */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Número de Celular</label>
                      <div className="flex gap-2">
                        <select
                          value={editingUsuario ? editingUsuario.countryCode : newUsuario.countryCode}
                          onChange={(e) => editingUsuario
                            ? setEditingUsuario({ ...editingUsuario, countryCode: e.target.value })
                            : setNewUsuario({ ...newUsuario, countryCode: e.target.value })
                          }
                          className="w-28 px-2 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-xs focus:border-[#00E5FF] outline-none transition-all"
                        >
                          {countryCodes.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.code}
                            </option>
                          ))}
                        </select>
                        <input 
                          type="tel" 
                          required 
                          value={editingUsuario ? editingUsuario.phoneNo : newUsuario.phoneNo}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (editingUsuario) {
                              setEditingUsuario({ ...editingUsuario, phoneNo: val });
                            } else {
                              setNewUsuario({ ...newUsuario, phoneNo: val });
                            }
                          }}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm focus:border-[#00E5FF] outline-none transition-all"
                          placeholder="71234567"
                        />
                      </div>
                    </div>

                    {/* Rol de Usuario */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Rol del Usuario</label>
                      <select 
                        value={editingUsuario ? editingUsuario.rol : newUsuario.rol} 
                        onChange={(e) => editingUsuario
                          ? setEditingUsuario({ ...editingUsuario, rol: e.target.value })
                          : setNewUsuario({ ...newUsuario, rol: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm focus:border-[#00E5FF] outline-none transition-all"
                      >
                        <option value="vecino">Vecino</option>
                        <option value="admin">Administrador Local</option>
                        {userProfile && userProfile.rol === 'super_admin' && (
                          <option value="super_admin">Super Administrador Global</option>
                        )}
                      </select>
                    </div>

                    {/* If super_admin, show community selection. If admin, it is auto-bound to their community */}
                    {userProfile && userProfile.rol === 'super_admin' ? (
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Asignar a Comunidad</label>
                        <select 
                          required={editingUsuario ? editingUsuario.rol !== 'super_admin' : newUsuario.rol !== 'super_admin'}
                          value={editingUsuario ? editingUsuario.id_comunidad : newUsuario.id_comunidad} 
                          onChange={(e) => editingUsuario
                            ? setEditingUsuario({ ...editingUsuario, id_comunidad: e.target.value })
                            : setNewUsuario({ ...newUsuario, id_comunidad: e.target.value })
                          }
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm focus:border-[#00E5FF] outline-none transition-all"
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

                    {/* Estado de la cuenta al editar */}
                    {editingUsuario && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Estado de la Cuenta</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingUsuario({ ...editingUsuario, estado: 'activo' })}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              editingUsuario.estado === 'activo'
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                : 'bg-slate-900 border-gray-800 text-gray-400 hover:text-white'
                            }`}
                          >
                            ✅ Habilitado
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUsuario({ ...editingUsuario, estado: 'deshabilitado' })}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              editingUsuario.estado === 'deshabilitado'
                                ? 'bg-red-500/20 border-red-500 text-red-400'
                                : 'bg-slate-900 border-gray-800 text-gray-400 hover:text-white'
                            }`}
                          >
                            🚫 Deshabilitado
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button 
                        type="submit" 
                        disabled={formLoading} 
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-bold text-sm transition-all shadow-lg shadow-cyan-500/10 disabled:opacity-50"
                      >
                        {formLoading ? 'Guardando...' : (editingUsuario ? 'Guardar Cambios' : 'Registrar Usuario')}
                      </button>
                      {editingUsuario && (
                        <button
                          type="button"
                          onClick={() => setEditingUsuario(null)}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 font-semibold text-sm transition-all"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Users List */}
                <div className="lg:col-span-2 glassmorphism rounded-2xl border border-white/5 overflow-hidden">
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900 text-gray-400 uppercase text-xs border-b border-white/5 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4">Vecino</th>
                          <th className="px-6 py-4">Rol</th>
                          <th className="px-6 py-4">Celular</th>
                          <th className="px-6 py-4">Dirección</th>
                          <th className="px-6 py-4">Comunidad</th>
                          <th className="px-6 py-4">Estado</th>
                          {userProfile && ['admin', 'super_admin'].includes(userProfile.rol) && (
                            <th className="px-6 py-4 text-right">Acciones</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {usuarios.map((usu) => (
                          <tr key={usu.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-6 py-4 font-semibold text-white">{usu.nombre}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                usu.rol === 'super_admin'
                                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                  : usu.rol === 'admin'
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {usu.rol === 'super_admin' ? 'Super Admin' : usu.rol === 'admin' ? 'Admin' : 'Vecino'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-cyan-400 font-mono text-xs">{usu.telefono || '—'}</td>
                            <td className="px-6 py-4 text-gray-300">{usu.direccion || '—'}</td>
                            <td className="px-6 py-4 text-gray-400">{usu.comunidad?.nombre || 'General'}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                usu.estado === 'deshabilitado'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                {usu.estado === 'deshabilitado' ? 'DESHABILITADO' : 'ACTIVO'}
                              </span>
                            </td>
                            {userProfile && ['admin', 'super_admin'].includes(userProfile.rol) && (
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openEditUsuario(usu)}
                                    className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                                    title="Editar usuario"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleUsuarioEstado(usu.id, usu.estado || 'activo', usu.nombre)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      usu.estado === 'deshabilitado'
                                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                                    }`}
                                    title={usu.estado === 'deshabilitado' ? "Reactivar usuario" : "Deshabilitar usuario (borrado lógico)"}
                                  >
                                    {usu.estado === 'deshabilitado' ? <RefreshCw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                  </button>
                                </div>
                              </td>
                            )}
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
                {/* Form to create/edit Comunidad */}
                <div className="glassmorphism p-6 rounded-2xl h-fit border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                    <span>{editingComunidad ? 'Editar Comunidad' : 'Añadir Comunidad'}</span>
                    {editingComunidad && (
                      <button 
                        onClick={() => setEditingComunidad(null)}
                        className="text-xs text-gray-400 hover:text-white font-normal"
                      >
                        Cancelar
                      </button>
                    )}
                  </h3>

                  {comunidadFormMessage.text && (
                    <div className={`p-3 rounded-xl mb-4 text-xs font-semibold flex items-center gap-2 ${
                      comunidadFormMessage.type === 'error' 
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
                        : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    }`}>
                      {comunidadFormMessage.type === 'error' ? '⚠️' : '✅'} {comunidadFormMessage.text}
                    </div>
                  )}

                  {userProfile && userProfile.rol === 'super_admin' ? (
                    <form onSubmit={editingComunidad ? handleUpdateComunidad : handleCreateComunidad} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre del Sector / Barrio</label>
                        <input 
                          type="text" 
                          required 
                          value={editingComunidad ? editingComunidad.nombre : newComunidad.nombre}
                          onChange={(e) => editingComunidad 
                            ? setEditingComunidad({ ...editingComunidad, nombre: e.target.value })
                            : setNewComunidad({ ...newComunidad, nombre: e.target.value })
                          }
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm focus:border-[#00E5FF] outline-none transition-all"
                          placeholder="Barrio Central"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Descripción</label>
                        <textarea 
                          value={editingComunidad ? (editingComunidad.descripcion || '') : newComunidad.descripcion}
                          onChange={(e) => editingComunidad
                            ? setEditingComunidad({ ...editingComunidad, descripcion: e.target.value })
                            : setNewComunidad({ ...newComunidad, descripcion: e.target.value })
                          }
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm h-24 focus:border-[#00E5FF] outline-none transition-all"
                          placeholder="Descripción y límites del barrio..."
                        />
                      </div>
                      {editingComunidad && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Estado de la Comunidad</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingComunidad({ ...editingComunidad, estado: 'activo' })}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                                (editingComunidad.estado || 'activo') === 'activo'
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                  : 'bg-slate-900 border-gray-800 text-gray-400 hover:text-white'
                              }`}
                            >
                              ✅ Activa
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingComunidad({ ...editingComunidad, estado: 'inactivo' })}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                                editingComunidad.estado === 'inactivo'
                                  ? 'bg-red-500/20 border-red-500 text-red-400'
                                  : 'bg-slate-900 border-gray-800 text-gray-400 hover:text-white'
                              }`}
                            >
                              🚫 Inactiva
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button 
                          type="submit" 
                          disabled={formLoading} 
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-bold text-sm transition-all shadow-lg shadow-cyan-500/10 disabled:opacity-50"
                        >
                          {formLoading ? 'Guardando...' : (editingComunidad ? 'Guardar Cambios' : 'Crear Comunidad')}
                        </button>
                        {editingComunidad && (
                          <button
                            type="button"
                            onClick={() => setEditingComunidad(null)}
                            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 font-semibold text-sm transition-all"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </form>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 text-sm text-gray-400 leading-relaxed">
                      Como administrador de sector, solo puedes ver la información de tu comunidad asignada. La creación y edición de nuevos sectores barriales está restringida para el Super Administrador.
                    </div>
                  )}
                </div>

                {/* Communities list */}
                <div className="lg:col-span-2 glassmorphism rounded-2xl border border-white/5 overflow-hidden">
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900 text-gray-400 uppercase text-xs border-b border-white/5 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4">ID</th>
                          <th className="px-6 py-4">Nombre</th>
                          <th className="px-6 py-4">Descripción</th>
                          <th className="px-6 py-4">Estado</th>
                          {userProfile && userProfile.rol === 'super_admin' && (
                            <th className="px-6 py-4 text-right">Acciones</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {comunidades.map((com) => (
                          <tr key={com.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-6 py-4 text-xs font-mono text-gray-400">{com.id}</td>
                            <td className="px-6 py-4 font-semibold text-white">{com.nombre}</td>
                            <td className="px-6 py-4 text-gray-300">{com.descripcion || 'Sin descripción'}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                com.estado === 'inactivo'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                {com.estado === 'inactivo' ? 'INACTIVA' : 'ACTIVA'}
                              </span>
                            </td>
                            {userProfile && userProfile.rol === 'super_admin' && (
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setEditingComunidad({ 
                                      id: com.id, 
                                      nombre: com.nombre, 
                                      descripcion: com.descripcion || '',
                                      estado: com.estado || 'activo'
                                    })}
                                    className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                                    title="Editar comunidad"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleComunidadEstado(com.id, com.estado || 'activo', com.nombre)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      com.estado === 'inactivo'
                                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                                    }`}
                                    title={com.estado === 'inactivo' ? "Reactivar comunidad" : "Desactivar comunidad (borrado lógico)"}
                                  >
                                    {com.estado === 'inactivo' ? <RefreshCw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab content 4: Dispositivos IoT (ESP32) */}
            {dashboardTab === 'dispositivos' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form to create/edit device */}
                <div className="glassmorphism p-6 rounded-2xl h-fit border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Radio className="text-[#00E5FF]" />
                      {editingDispositivo ? 'Editar Dispositivo IoT' : 'Registrar Dispositivo IoT'}
                    </span>
                    {editingDispositivo && (
                      <button 
                        type="button"
                        onClick={() => setEditingDispositivo(null)}
                        className="text-xs text-gray-400 hover:text-white font-normal"
                      >
                        Cancelar
                      </button>
                    )}
                  </h3>

                  {deviceFormMessage.text && (
                    <div className={`p-3 rounded-xl mb-4 text-xs font-semibold flex items-center gap-2 ${
                      deviceFormMessage.type === 'error' 
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
                        : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    }`}>
                      {deviceFormMessage.type === 'error' ? '⚠️' : '✅'} {deviceFormMessage.text}
                    </div>
                  )}

                  <form onSubmit={editingDispositivo ? handleUpdateDispositivo : handleCreateDispositivo} className="space-y-4">
                    {/* MAC Address */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Dirección MAC (ESP32) {editingDispositivo && '(Identificador Fijo)'}
                      </label>
                      <input 
                        type="text" 
                        required 
                        disabled={!!editingDispositivo}
                        value={editingDispositivo ? editingDispositivo.mac_address : newDispositivo.mac_address}
                        onChange={(e) => !editingDispositivo && setNewDispositivo({ ...newDispositivo, mac_address: e.target.value.toUpperCase() })}
                        className={`w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white font-mono text-sm focus:border-[#00E5FF] outline-none transition-all ${
                          editingDispositivo ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                        placeholder="AA:BB:CC:DD:EE:FF"
                      />
                    </div>

                    {/* Zona / Ubicación descriptiva */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Zona / Ubicación Descriptiva</label>
                      <input 
                        type="text" 
                        required 
                        value={editingDispositivo ? editingDispositivo.zona : newDispositivo.zona}
                        onChange={(e) => editingDispositivo 
                          ? setEditingDispositivo({ ...editingDispositivo, zona: e.target.value })
                          : setNewDispositivo({ ...newDispositivo, zona: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm focus:border-[#00E5FF] outline-none transition-all"
                        placeholder="Ej. Poste Esquina Norte / Domicilio #45"
                      />
                    </div>

                    {/* Tipo de Dispositivo */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipo de Dispositivo</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => editingDispositivo 
                            ? setEditingDispositivo({ ...editingDispositivo, tipo: 'sirena' })
                            : setNewDispositivo({ ...newDispositivo, tipo: 'sirena' })
                          }
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                            (editingDispositivo ? editingDispositivo.tipo : newDispositivo.tipo) === 'sirena'
                              ? 'bg-[#1E88E5]/20 border-[#00E5FF] text-[#00E5FF]'
                              : 'bg-slate-900 border-gray-800 text-gray-400 hover:text-white'
                          }`}
                        >
                          📢 Sirena Comunitaria
                        </button>
                        <button
                          type="button"
                          onClick={() => editingDispositivo 
                            ? setEditingDispositivo({ ...editingDispositivo, tipo: 'boton' })
                            : setNewDispositivo({ ...newDispositivo, tipo: 'boton' })
                          }
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                            (editingDispositivo ? editingDispositivo.tipo : newDispositivo.tipo) === 'boton'
                              ? 'bg-[#1E88E5]/20 border-[#00E5FF] text-[#00E5FF]'
                              : 'bg-slate-900 border-gray-800 text-gray-400 hover:text-white'
                          }`}
                        >
                          🔘 Botón de Vecino
                        </button>
                      </div>
                    </div>

                    {/* Condicional según tipo: Sirena -> Comunidad, Botón -> Vecino + Coordenadas */}
                    {(editingDispositivo ? editingDispositivo.tipo : newDispositivo.tipo) === 'sirena' ? (
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Asociar a Comunidad</label>
                        {userProfile && userProfile.rol === 'super_admin' ? (
                          <select 
                            required
                            value={editingDispositivo ? editingDispositivo.id_comunidad : newDispositivo.id_comunidad} 
                            onChange={(e) => editingDispositivo
                              ? setEditingDispositivo({ ...editingDispositivo, id_comunidad: e.target.value })
                              : setNewDispositivo({ ...newDispositivo, id_comunidad: e.target.value })
                            }
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm focus:border-[#00E5FF] outline-none transition-all"
                          >
                            <option value="">Seleccione una comunidad</option>
                            {comunidades.map(com => (
                              <option key={com.id} value={com.id}>{com.nombre}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="p-3 rounded-xl bg-slate-900 border border-gray-800/60 text-xs text-gray-400">
                            Comunidad vinculada: <strong className="text-white">{userProfile?.nombre_comunidad || 'Cargando...'}</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Selector de Vecino Responsable */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Asociar a Vecino Responsable</label>
                          <select 
                            required
                            value={editingDispositivo ? editingDispositivo.id_usuario : newDispositivo.id_usuario} 
                            onChange={(e) => {
                              const selectedUser = usuarios.find(u => u.id === e.target.value);
                              if (editingDispositivo) {
                                setEditingDispositivo({ 
                                  ...editingDispositivo, 
                                  id_usuario: e.target.value,
                                  id_comunidad: selectedUser?.id_comunidad || editingDispositivo.id_comunidad
                                });
                              } else {
                                setNewDispositivo({ 
                                  ...newDispositivo, 
                                  id_usuario: e.target.value,
                                  id_comunidad: selectedUser?.id_comunidad || newDispositivo.id_comunidad
                                });
                              }
                            }}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-gray-800 text-white text-sm focus:border-[#00E5FF] outline-none transition-all"
                          >
                            <option value="">Seleccione un vecino</option>
                            {usuarios.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.nombre} ({u.comunidad?.nombre || 'General'})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Coordenadas fijas de instalación del botón */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Coordenadas de Instalación (GPS)</label>
                          <div className="grid grid-cols-2 gap-2">
                            <input 
                              type="number" 
                              step="any"
                              value={editingDispositivo ? editingDispositivo.latitud : newDispositivo.latitud}
                              onChange={(e) => editingDispositivo
                                ? setEditingDispositivo({ ...editingDispositivo, latitud: e.target.value })
                                : setNewDispositivo({ ...newDispositivo, latitud: e.target.value })
                              }
                              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-gray-800 text-white font-mono text-xs focus:border-[#00E5FF] outline-none"
                              placeholder="Latitud (-17.3895)"
                            />
                            <input 
                              type="number" 
                              step="any"
                              value={editingDispositivo ? editingDispositivo.longitud : newDispositivo.longitud}
                              onChange={(e) => editingDispositivo
                                ? setEditingDispositivo({ ...editingDispositivo, longitud: e.target.value })
                                : setNewDispositivo({ ...newDispositivo, longitud: e.target.value })
                              }
                              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-gray-800 text-white font-mono text-xs focus:border-[#00E5FF] outline-none"
                              placeholder="Longitud (-66.1568)"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Estado del dispositivo al editar */}
                    {editingDispositivo && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Estado del Dispositivo</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingDispositivo({ ...editingDispositivo, estado: 'activo' })}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              editingDispositivo.estado === 'activo'
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                : 'bg-slate-900 border-gray-800 text-gray-400 hover:text-white'
                            }`}
                          >
                            ✅ Activo (Operativo)
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDispositivo({ ...editingDispositivo, estado: 'inactivo' })}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              editingDispositivo.estado === 'inactivo'
                                ? 'bg-red-500/20 border-red-500 text-red-400'
                                : 'bg-slate-900 border-gray-800 text-gray-400 hover:text-white'
                            }`}
                          >
                            🚫 Inactivo (Desactivado)
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button 
                        type="submit" 
                        disabled={formLoading} 
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-tr from-[#1E88E5] to-[#00E5FF] hover:from-[#1565C0] hover:to-[#00B0FF] text-white font-bold text-sm transition-all shadow-lg shadow-cyan-500/10 disabled:opacity-50"
                      >
                        {formLoading ? 'Guardando...' : (editingDispositivo ? 'Guardar Cambios' : 'Registrar Dispositivo IoT')}
                      </button>
                      {editingDispositivo && (
                        <button
                          type="button"
                          onClick={() => setEditingDispositivo(null)}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 font-semibold text-sm transition-all"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Devices list */}
                <div className="lg:col-span-2 glassmorphism rounded-2xl border border-white/5 overflow-hidden">
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900 text-gray-400 uppercase text-xs border-b border-white/5 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4">MAC Address</th>
                          <th className="px-6 py-4">Tipo</th>
                          <th className="px-6 py-4">Zona / Ubicación</th>
                          <th className="px-6 py-4">Asignado a</th>
                          <th className="px-6 py-4">Estado</th>
                          {userProfile && ['admin', 'super_admin'].includes(userProfile.rol) && (
                            <th className="px-6 py-4 text-right">Acciones</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dispositivos.map((dev) => (
                          <tr key={dev.mac_address} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-6 py-4 font-mono text-white font-semibold text-xs">{dev.mac_address}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                dev.tipo === 'sirena'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {dev.tipo === 'sirena' ? '📢 Sirena' : '🔘 Botón'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-300 text-xs">{dev.zona || '—'}</td>
                            <td className="px-6 py-4 text-gray-400 text-xs">
                              {dev.tipo === 'sirena' 
                                ? `Comunidad: ${dev.comunidad?.nombre || 'General'}`
                                : `Vecino: ${dev.usuario?.nombre || 'Sin asignar'}`}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                dev.estado === 'inactivo'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                {dev.estado ? dev.estado.toUpperCase() : 'ACTIVO'}
                              </span>
                            </td>
                            {userProfile && ['admin', 'super_admin'].includes(userProfile.rol) && (
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openEditDispositivo(dev)}
                                    className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                                    title="Editar dispositivo"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleDispositivoEstado(dev.mac_address, dev.estado || 'activo')}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      dev.estado === 'inactivo'
                                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                                    }`}
                                    title={dev.estado === 'inactivo' ? "Reactivar dispositivo" : "Desactivar dispositivo (borrado lógico)"}
                                  >
                                    {dev.estado === 'inactivo' ? <RefreshCw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab content 5: Reportes (En desarrollo) */}
            {dashboardTab === 'reportes' && (
              <div className="glassmorphism rounded-3xl p-8 md:p-14 border border-white/10 text-center relative overflow-hidden animate-fade-in shadow-2xl">
                {/* Glow decorativo de fondo */}
                <div className="absolute -top-24 -right-24 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[#00E5FF]/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10 max-w-2xl mx-auto">
                  {/* Icono central con aura */}
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600/30 to-[#00E5FF]/30 border border-purple-500/40 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-purple-500/20">
                    <BarChart3 className="w-10 h-10 text-[#00E5FF]" />
                  </div>

                  {/* Badge de estado */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-5">
                    <Clock className="w-3.5 h-3.5" />
                    Módulo en Desarrollo
                  </div>

                  <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4">
                    Centro de Reportes y Auditoría
                  </h2>

                  <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-8">
                    Esta sección se encuentra actualmente <strong className="text-white">en desarrollo</strong>. Muy pronto podrás generar y exportar informes ejecutivos, estadísticas históricas de emergencias y métricas de seguridad vecinal.
                  </p>

                  {/* Tarjetas de avance / próximas funciones */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-8">
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-sm">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-3">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">Reportes en PDF</h4>
                      <p className="text-xs text-gray-400">Informes formales listos para asambleas vecinales.</p>
                      <span className="inline-block mt-3 text-[10px] font-semibold text-purple-400/80 bg-purple-500/10 px-2 py-0.5 rounded-md">
                        En construcción
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-sm">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center text-[#00E5FF] mb-3">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">Hojas de Cálculo</h4>
                      <p className="text-xs text-gray-400">Exportación completa de datos en formato Excel y CSV.</p>
                      <span className="inline-block mt-3 text-[10px] font-semibold text-[#00E5FF]/80 bg-[#00E5FF]/10 px-2 py-0.5 rounded-md">
                        En construcción
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-sm">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">Tiempos de Respuesta</h4>
                      <p className="text-xs text-gray-400">Métricas de velocidad y efectividad de atención.</p>
                      <span className="inline-block mt-3 text-[10px] font-semibold text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        En construcción
                      </span>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-gray-400 text-xs">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Disponible próximamente en la plataforma Eje Urbano</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="max-w-[95%] mx-auto px-4 md:px-8 py-12 border-t border-white/5 text-center text-sm text-gray-500 w-full mt-auto">
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
