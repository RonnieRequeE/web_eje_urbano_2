import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  MessageSquare,
  Send,
  Image as ImageIcon,
  Paperclip,
  X,
  Search,
  ShieldCheck,
  Shield,
  User,
  Clock,
  ArrowDown,
  Maximize2,
  Download,
  AlertCircle,
  RefreshCw,
  Lock,
  Building2,
  Users,
  Radio
} from 'lucide-react';

export default function ChatComunitario({ 
  user, 
  userProfile, 
  comunidades = [],
  selectedCommunityId: externalCommunityId,
  onSelectCommunity,
  onMarkAsRead
}) {
  const isSuperAdmin = ['super_admin', 'superadmin'].includes(userProfile?.rol);
  const isAdmin = userProfile?.rol === 'admin';

  // Determinación de la comunidad activa
  // Si es admin: bloqueado a su id_comunidad
  // Si es super_admin: puede seleccionar cualquier comunidad (priorizando Comunidad General en primer lugar)
  const [selectedCommunityId, setSelectedCommunityId] = useState(() => {
    if (externalCommunityId) {
      return String(externalCommunityId);
    }
    if (isAdmin && userProfile?.id_comunidad) {
      return String(userProfile.id_comunidad);
    }
    const general = comunidades.find(c => {
      const name = (c.nombre || '').toLowerCase().trim();
      return name === 'comunidad general' || name.includes('general') || String(c.id) === '1';
    });
    if (general) {
      return String(general.id);
    }
    if (comunidades.length > 0) {
      return String(comunidades[0].id);
    }
    return '';
  });

  // Si cambia la comunidad externa seleccionada desde el dashboard, sincronizar
  useEffect(() => {
    if (externalCommunityId && String(externalCommunityId) !== String(selectedCommunityId)) {
      setSelectedCommunityId(String(externalCommunityId));
    }
  }, [externalCommunityId]);

  // Si cambia la lista de comunidades o el perfil, sincronizar
  useEffect(() => {
    if (isAdmin && userProfile?.id_comunidad) {
      setSelectedCommunityId(String(userProfile.id_comunidad));
    } else if (isSuperAdmin && (!selectedCommunityId || !comunidades.some(c => String(c.id) === String(selectedCommunityId)))) {
      if (externalCommunityId && comunidades.some(c => String(c.id) === String(externalCommunityId))) {
        setSelectedCommunityId(String(externalCommunityId));
      } else {
        const general = comunidades.find(c => {
          const name = (c.nombre || '').toLowerCase().trim();
          return name === 'comunidad general' || name.includes('general') || String(c.id) === '1';
        });
        if (general) {
          setSelectedCommunityId(String(general.id));
        } else if (comunidades.length > 0) {
          setSelectedCommunityId(String(comunidades[0].id));
        }
      }
    }
  }, [isAdmin, isSuperAdmin, userProfile?.id_comunidad, comunidades, externalCommunityId]);

  const handleCommunityChange = (newId) => {
    setSelectedCommunityId(newId);
    if (onSelectCommunity) onSelectCommunity(newId);
    if (onMarkAsRead) onMarkAsRead(newId);
  };

  // Ordenar lista de comunidades para Super Administrador: Comunidad General en PRIMER LUGAR
  const sortedComunidades = useMemo(() => {
    if (!comunidades || comunidades.length === 0) return [];
    
    const generalList = [];
    const othersList = [];

    comunidades.forEach(c => {
      const name = (c.nombre || '').toLowerCase().trim();
      if (name === 'comunidad general' || name.includes('general') || String(c.id) === '1') {
        generalList.push(c);
      } else {
        othersList.push(c);
      }
    });

    return [...generalList, ...othersList];
  }, [comunidades]);

  const activeCommunity = useMemo(() => {
    if (!selectedCommunityId) return null;
    return comunidades.find(c => String(c.id) === String(selectedCommunityId)) || null;
  }, [comunidades, selectedCommunityId]);

  // Estados de mensajes y UI
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Imagen adjunta
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);

  // Referencias para scroll
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Desplazamiento automático al final
  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Detectar scroll del usuario
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setShowScrollBottom(!isNearBottom);
  };

  // Cargar historial de mensajes y suscribirse a Realtime al cambiar de comunidad
  useEffect(() => {
    if (!selectedCommunityId) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    let isMounted = true;
    // Limpiar inmediatamente los mensajes de la comunidad anterior para evitar fantasmas visuales
    setMessages([]);
    setLoadingMessages(true);

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('mensajes')
          .select(`
            id,
            user_id,
            mensaje,
            imagen_url,
            created_at,
            id_comunidad,
            usuarios:user_id (
              id,
              nombre,
              rol
            )
          `)
          .eq('id_comunidad', Number(selectedCommunityId))
          .order('created_at', { ascending: true })
          .limit(100);

        if (error) {
          console.error('Error al consultar mensajes de Supabase:', error);
          throw error;
        }

        if (isMounted) {
          const formatted = (data || []).map(m => ({
            id: m.id,
            userId: m.user_id,
            text: m.mensaje || '',
            imageUrl: m.imagen_url || null,
            createdAt: m.created_at,
            communityId: m.id_comunidad,
            senderName: m.usuarios?.nombre || (m.user_id === user?.id ? (userProfile?.nombre || 'Tú') : 'Vecino'),
            senderRole: m.usuarios?.rol || 'vecino',
            isFromMe: m.user_id === user?.id
          }));
          setMessages(formatted);
          setTimeout(() => scrollToBottom('auto'), 150);
          if (onMarkAsRead) {
            onMarkAsRead(selectedCommunityId);
          }
        }
      } catch (err) {
        console.error('Error al cargar mensajes del chat:', err);
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    };

    loadMessages();

    // Canal Realtime para sincronización instantánea
    const channelName = `realtime_chat_${selectedCommunityId}_${Date.now()}`;
    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes',
          filter: `id_comunidad=eq.${selectedCommunityId}`
        },
        async (payload) => {
          const newRow = payload.new;
          if (!newRow) return;

          // Aislamiento estricto: ignorar si no pertenece exactamente a la comunidad activa
          if (String(newRow.id_comunidad) !== String(selectedCommunityId)) {
            return;
          }

          // Obtener los datos del remitente
          let senderInfo = null;
          try {
            const { data: userData } = await supabase
              .from('usuarios')
              .select('id, nombre, rol')
              .eq('id', newRow.user_id)
              .maybeSingle();
            senderInfo = userData;
          } catch (e) {
            console.error('Error al resolver usuario emisor:', e);
          }

          const newMsgObj = {
            id: newRow.id,
            userId: newRow.user_id,
            text: newRow.mensaje || '',
            imageUrl: newRow.imagen_url || null,
            createdAt: newRow.created_at,
            communityId: newRow.id_comunidad,
            senderName: senderInfo?.nombre || (newRow.user_id === user?.id ? (userProfile?.nombre || 'Tú') : 'Vecino'),
            senderRole: senderInfo?.rol || 'vecino',
            isFromMe: newRow.user_id === user?.id
          };

          if (isMounted) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsgObj.id)) return prev;
              return [...prev, newMsgObj];
            });
            setTimeout(() => scrollToBottom('smooth'), 100);
            if (onMarkAsRead) {
              onMarkAsRead(selectedCommunityId);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [selectedCommunityId, user?.id, userProfile?.nombre]);

  // Manejar selección de imagen
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB.');
      return;
    }

    setSelectedImageFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreviewUrl(preview);
  };

  const handleCancelImage = () => {
    setSelectedImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Enviar mensaje
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !selectedImageFile) || sending || !selectedCommunityId) return;

    setSending(true);
    let uploadedImageUrl = null;

    try {
      // 1. Si hay imagen, subir a Supabase Storage (bucket 'chat-images')
      if (selectedImageFile) {
        setUploadingImage(true);
        const fileExt = selectedImageFile.name.split('.').pop() || 'jpg';
        const cleanFileName = `chat_${user.id}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(cleanFileName, selectedImageFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Error al subir imagen:', uploadError);
          throw new Error('Error al subir la imagen al servidor');
        }

        const { data: publicUrlData } = supabase.storage
          .from('chat-images')
          .getPublicUrl(cleanFileName);

        uploadedImageUrl = publicUrlData?.publicUrl || null;
      }

      // 2. Insertar registro en la tabla mensajes
      const { error: insertError } = await supabase
        .from('mensajes')
        .insert({
          user_id: user.id,
          mensaje: inputText.trim(),
          imagen_url: uploadedImageUrl,
          id_comunidad: Number(selectedCommunityId)
        });

      if (insertError) throw insertError;

      // 3. Limpiar formulario
      setInputText('');
      handleCancelImage();
      setTimeout(() => scrollToBottom('smooth'), 100);
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      alert('No se pudo enviar el mensaje. Verifica tu conexión e inténtalo nuevamente.');
    } finally {
      setSending(false);
      setUploadingImage(false);
    }
  };

  // Acceso rápido para avisos oficiales
  const handleQuickPreset = (presetText) => {
    setInputText(presetText);
  };

  // Filtrado de mensajes por comunidad activa y búsqueda en pantalla
  const filteredMessages = useMemo(() => {
    // Aislamiento estricto: solo mensajes de la comunidad seleccionada
    const communityMessages = messages.filter(
      m => String(m.communityId) === String(selectedCommunityId)
    );
    if (!searchQuery.trim()) return communityMessages;
    const q = searchQuery.toLowerCase();
    return communityMessages.filter(m => 
      m.text.toLowerCase().includes(q) ||
      m.senderName.toLowerCase().includes(q)
    );
  }, [messages, selectedCommunityId, searchQuery]);

  // Formato de hora legible
  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Formato de fecha para separadores de día
  const formatDateSeparator = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Hoy';
      }
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Ayer';
      }
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* HEADER DE CONTROL Y SELECCIÓN DE COMUNIDAD */}
      <div className="p-6 rounded-2xl glass-card border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00E5FF]/20 to-purple-500/20 border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF] shadow-inner">
            <MessageSquare className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-white tracking-tight">Chat Comunitario en Vivo</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                WebSocket Activo
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Canal bidireccional en tiempo real con vecinos, alertas sincronizadas e intercambio de imágenes
            </p>
          </div>
        </div>

        {/* SELECTOR O BLOQUEO DE COMUNIDAD SEGÚN ROL */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {isAdmin ? (
            // ADMIN: Comunidad fija y bloqueada
            <div className="px-4 py-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider block">
                  Comunidad Asignada (Admin)
                </span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  {activeCommunity?.nombre || userProfile?.nombre_comunidad || 'Tu Comunidad'}
                </span>
              </div>
            </div>
          ) : isSuperAdmin ? (
            // SUPER ADMIN: Selector interactivo de cualquier comunidad
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-slate-900/90 p-2.5 rounded-xl border border-purple-500/30 shadow-lg">
              <div className="flex items-center gap-1.5 text-purple-400 px-2 py-1">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Supervisión:</span>
              </div>
              <select
                value={selectedCommunityId}
                onChange={(e) => handleCommunityChange(e.target.value)}
                className="bg-slate-950 text-white font-medium text-sm rounded-lg px-3.5 py-2 border border-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer min-w-[240px]"
              >
                {sortedComunidades.map(com => (
                  <option key={com.id} value={com.id} className="bg-slate-900 text-white">
                    🏘️ {com.nombre} {com.ciudad ? `(${com.ciudad})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-xs text-gray-400">Rol sin permisos asignados</div>
          )}

          {/* Buscador dentro del chat */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en el chat..."
              className="pl-9 pr-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF] w-full sm:w-48 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL DEL CHAT */}
      <div className="rounded-2xl glass-card border border-white/10 overflow-hidden flex flex-col h-[650px] shadow-2xl relative">
        {/* BARRA SUPERIOR DE INFORMACIÓN DE SALA */}
        <div className="px-6 py-3.5 bg-slate-900/95 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20 animate-pulse"></div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{activeCommunity ? activeCommunity.nombre : 'Selecciona una comunidad'}</span>
                {activeCommunity?.ciudad && (
                  <span className="text-xs font-normal text-gray-400">· {activeCommunity.ciudad}</span>
                )}
              </h3>
              <p className="text-[11px] text-gray-400 flex items-center gap-2">
                <span>{filteredMessages.length} mensajes en pantalla</span>
                <span>•</span>
                <span>Notificaciones Push móviles vinculadas</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Presets Rápidos de Administración */}
            {(isSuperAdmin || isAdmin) && (
              <div className="hidden sm:flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => handleQuickPreset('⚠️ Alerta de Evacuación: Peligro inminente. Se solicita a todos los vecinos evacuar inmediatamente hacia los puntos de encuentro seguros de la comunidad y mantener despejadas las vías de acceso.')}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 transition flex items-center gap-1 font-semibold"
                  title="Insertar aviso urgente de evacuación vecinal"
                >
                  <span>⚠️ Alerta de Evacuación</span>
                </button>
                <button
                  onClick={() => handleQuickPreset('🚨 Alerta Atendida: El personal de seguridad y vecinos coordinados ya se encuentran en el lugar.')}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition flex items-center gap-1"
                  title="Insertar aviso de atención en curso"
                >
                  <span>🚨 Alerta Atendida</span>
                </button>
                <button
                  onClick={() => handleQuickPreset('📢 Comunicado: Se recuerda a todos los vecinos mantener sus dispositivos de pánico verificados y las puertas de acceso cerradas.')}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 transition flex items-center gap-1"
                  title="Insertar comunicado general"
                >
                  <span>📢 Comunicado</span>
                </button>
                <button
                  onClick={() => handleQuickPreset('✅ Novedad Superada: La situación ha sido normalizada exitosamente. Gracias a todos por su colaboración.')}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 transition flex items-center gap-1"
                  title="Insertar estado de normalidad"
                >
                  <span>✅ Novedad Superada</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ÁREA DE MENSAJES CON SCROLL */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-950/60"
        >
          {loadingMessages ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
              <RefreshCw className="w-8 h-8 text-[#00E5FF] animate-spin" />
              <p className="text-sm font-medium">Cargando conversación comunitaria...</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-white/10 flex items-center justify-center text-[#00E5FF]">
                <MessageSquare className="w-8 h-8 opacity-60" />
              </div>
              <div className="max-w-md">
                <h4 className="text-lg font-bold text-white">No hay mensajes recientes</h4>
                <p className="text-sm text-gray-400 mt-1">
                  {searchQuery 
                    ? `No se encontraron coincidencias para "${searchQuery}".`
                    : `Inicia la conversación en "${activeCommunity?.nombre || 'la comunidad'}". Los vecinos recibirán tus mensajes en su app móvil al instante.`}
                </p>
              </div>
            </div>
          ) : (
            filteredMessages.map((msg, index) => {
              // Calcular si mostramos separador de fecha
              const prevMsg = filteredMessages[index - 1];
              const showDateSep = !prevMsg || 
                new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

              return (
                <React.Fragment key={msg.id || index}>
                  {showDateSep && (
                    <div className="flex items-center justify-center my-4">
                      <div className="px-3.5 py-1 rounded-full bg-slate-900/90 border border-white/10 text-[11px] font-bold text-gray-400 shadow-sm flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-[#00E5FF]" />
                        <span>{formatDateSeparator(msg.createdAt)}</span>
                      </div>
                    </div>
                  )}

                  <div className={`flex items-start gap-3 ${msg.isFromMe ? 'justify-end' : 'justify-start'}`}>
                    {/* Avatar del emisor si es ajeno */}
                    {!msg.isFromMe && (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-md shrink-0 mt-1 ${
                        msg.senderRole === 'super_admin'
                          ? 'bg-purple-600 text-white ring-2 ring-purple-400/40'
                          : msg.senderRole === 'admin'
                          ? 'bg-cyan-600 text-white ring-2 ring-cyan-400/40'
                          : 'bg-slate-700 text-gray-200'
                      }`}>
                        {msg.senderName ? msg.senderName.charAt(0).toUpperCase() : 'V'}
                      </div>
                    )}

                    {/* Globo de mensaje */}
                    <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3.5 shadow-lg transition-all ${
                      msg.isFromMe
                        ? 'bg-gradient-to-br from-[#00E5FF]/20 to-sky-900/50 border border-[#00E5FF]/40 text-white rounded-tr-none'
                        : 'bg-slate-900/95 border border-white/10 text-gray-200 rounded-tl-none'
                    }`}>
                      {/* Cabecera del globo: Nombre y Rol */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-xs font-bold ${msg.isFromMe ? 'text-[#00E5FF]' : 'text-white'}`}>
                          {msg.isFromMe ? `${msg.senderName} (Tú)` : msg.senderName}
                        </span>

                        {/* Insignia de Rol */}
                        {msg.senderRole === 'super_admin' ? (
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-extrabold flex items-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            SUPER ADMIN
                          </span>
                        ) : msg.senderRole === 'admin' ? (
                          <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-extrabold flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5" />
                            ADMIN
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-gray-400 text-[10px] font-semibold flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            VECINO
                          </span>
                        )}

                        <span className="text-[10px] text-gray-400 ml-auto">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>

                      {/* Imagen si existe */}
                      {msg.imageUrl && (
                        <div className="mb-2 rounded-xl overflow-hidden border border-white/10 relative group">
                          <img
                            src={msg.imageUrl}
                            alt="Adjunto en chat"
                            className="w-full max-h-72 object-cover rounded-xl cursor-pointer transition-transform duration-300 group-hover:scale-102"
                            onClick={() => setFullscreenImage(msg.imageUrl)}
                            loading="lazy"
                          />
                          <button
                            onClick={() => setFullscreenImage(msg.imageUrl)}
                            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                            title="Ver en pantalla completa"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Texto del mensaje */}
                      {msg.text && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.text}
                        </p>
                      )}
                    </div>

                    {/* Avatar propio a la derecha */}
                    {msg.isFromMe && (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-md shrink-0 mt-1 ${
                        isSuperAdmin
                          ? 'bg-purple-600 text-white ring-2 ring-purple-400/40'
                          : 'bg-[#00E5FF] text-slate-950 font-black ring-2 ring-[#00E5FF]/40'
                      }`}>
                        {userProfile?.nombre ? userProfile.nombre.charAt(0).toUpperCase() : 'T'}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* BOTÓN FLOTANTE PARA VOLVER AL FINAL SI EL USUARIO SUBIÓ */}
        {showScrollBottom && (
          <button
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-24 right-8 p-3 rounded-full bg-[#00E5FF] text-slate-950 font-bold shadow-2xl hover:scale-110 active:scale-95 transition-all z-20 flex items-center gap-1.5 text-xs animate-bounce"
            title="Ir al último mensaje"
          >
            <ArrowDown className="w-4 h-4" />
            <span className="font-extrabold">Nuevos</span>
          </button>
        )}

        {/* PREVIEW DE IMAGEN ANTES DE ENVIAR */}
        {imagePreviewUrl && (
          <div className="px-6 py-3 bg-slate-900 border-t border-white/10 flex items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#00E5FF]/40 relative">
                <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Imagen lista para enviar</span>
                <span className="text-[11px] text-gray-400">
                  {selectedImageFile?.name} ({(selectedImageFile?.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            </div>
            <button
              onClick={handleCancelImage}
              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
              title="Cancelar imagen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* CAJA DE ENTRADA / FORMULARIO INFERIOR */}
        <form
          onSubmit={handleSendMessage}
          className="p-4 bg-slate-900/95 border-t border-white/10 flex items-center gap-3"
        >
          {/* Input oculto para subir imágenes */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />

          {/* Botón de adjuntar imagen */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploadingImage}
            className={`p-3 rounded-xl border border-white/10 transition-all ${
              selectedImageFile
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/40'
                : 'bg-slate-800 text-gray-300 hover:text-white hover:bg-slate-700'
            }`}
            title="Adjuntar fotografía o imagen"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Input de texto */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              uploadingImage
                ? 'Subiendo imagen a la nube...'
                : `Escribe un mensaje para los vecinos de ${activeCommunity?.nombre || 'la comunidad'}...`
            }
            disabled={sending || uploadingImage}
            className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF] transition-all"
          />

          {/* Botón Enviar */}
          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedImageFile) || sending || uploadingImage}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-cyan-500 text-slate-950 font-bold hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0 active:scale-95"
          >
            {sending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Enviando...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* MODAL LIGHTBOX DE IMAGEN EN PANTALLA COMPLETA */}
      {fullscreenImage && (
        <div
          onClick={() => setFullscreenImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={fullscreenImage}
              alt="Visualización ampliada"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
            <div className="mt-4 flex items-center gap-3">
              <a
                href={fullscreenImage}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-white/10 flex items-center gap-1.5 transition"
              >
                <Download className="w-4 h-4" />
                Descargar Original
              </a>
              <button
                onClick={() => setFullscreenImage(null)}
                className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold border border-red-500/30 flex items-center gap-1.5 transition"
              >
                <X className="w-4 h-4" />
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
