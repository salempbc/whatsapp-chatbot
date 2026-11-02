const { createApp, ref, computed, onMounted, watch, onErrorCaptured, nextTick } = window.Vue || Vue || {};

const rawTg = window.Telegram?.WebApp;

const isTgVersionAtLeast = (ver) => {
  try {
    return Boolean(rawTg?.isVersionAtLeast?.(ver));
  } catch (_) {
    return false;
  }
};

const safeHaptic = {
  impactOccurred: (style) => {
    try {
      if (isTgVersionAtLeast('6.1') && typeof rawTg?.HapticFeedback?.impactOccurred === 'function') {
        rawTg.HapticFeedback.impactOccurred(style);
      }
    } catch (_) {}
  },
  notificationOccurred: (type) => {
    try {
      if (isTgVersionAtLeast('6.1') && typeof rawTg?.HapticFeedback?.notificationOccurred === 'function') {
        rawTg.HapticFeedback.notificationOccurred(type);
      }
    } catch (_) {}
  },
  selectionChanged: () => {
    try {
      if (isTgVersionAtLeast('6.1') && typeof rawTg?.HapticFeedback?.selectionChanged === 'function') {
        rawTg.HapticFeedback.selectionChanged();
      }
    } catch (_) {}
  }
};

const safeBackButton = {
  show: () => {
    try {
      if (isTgVersionAtLeast('6.1') && typeof rawTg?.BackButton?.show === 'function') {
        rawTg.BackButton.show();
      }
    } catch (_) {}
  },
  hide: () => {
    try {
      if (isTgVersionAtLeast('6.1') && typeof rawTg?.BackButton?.hide === 'function') {
        rawTg.BackButton.hide();
      }
    } catch (_) {}
  },
  onClick: (cb) => {
    try {
      if (isTgVersionAtLeast('6.1') && typeof rawTg?.BackButton?.onClick === 'function') {
        rawTg.BackButton.onClick(cb);
      }
    } catch (_) {}
  },
  offClick: (cb) => {
    try {
      if (isTgVersionAtLeast('6.1') && typeof rawTg?.BackButton?.offClick === 'function') {
        rawTg.BackButton.offClick(cb);
      }
    } catch (_) {}
  }
};

const safeAlert = (msg) => {
  try {
    if (isTgVersionAtLeast('6.2') && typeof rawTg?.showAlert === 'function') {
      return rawTg.showAlert(msg);
    }
  } catch (_) {}
  alert(msg);
};

const safeConfirm = (msg, cb) => {
  try {
    if (isTgVersionAtLeast('6.2') && typeof rawTg?.showConfirm === 'function') {
      return rawTg.showConfirm(msg, cb);
    }
  } catch (_) {}
  const confirmed = confirm(msg);
  if (typeof cb === 'function') cb(confirmed);
  return confirmed;
};

// Resilient Telegram bridge with graceful degradation across all platforms
const tg = {
  get initData() { return rawTg?.initData || ''; },
  get initDataUnsafe() { return rawTg?.initDataUnsafe || {}; },
  get colorScheme() { return rawTg?.colorScheme || 'light'; },
  get themeParams() { return rawTg?.themeParams || {}; },
  get platform() { return rawTg?.platform || 'unknown'; },
  get version() { return rawTg?.version || '6.0'; },
  isVersionAtLeast: (ver) => isTgVersionAtLeast(ver),
  expand: () => { try { rawTg?.expand?.(); } catch (_) {} },
  ready: () => { try { rawTg?.ready?.(); } catch (_) {} },
  close: () => { try { rawTg?.close?.(); } catch (_) {} },
  setHeaderColor: (color) => {
    try {
      if (isTgVersionAtLeast('6.1')) rawTg?.setHeaderColor?.(color);
    } catch (_) {}
  },
  setBackgroundColor: (color) => {
    try {
      if (isTgVersionAtLeast('6.1')) rawTg?.setBackgroundColor?.(color);
    } catch (_) {}
  },
  setBottomBarColor: (color) => {
    try {
      if (isTgVersionAtLeast('7.10')) rawTg?.setBottomBarColor?.(color);
    } catch (_) {}
  },
  HapticFeedback: safeHaptic,
  BackButton: safeBackButton,
  showAlert: safeAlert,
  showConfirm: safeConfirm,
  onEvent: (eventType, eventHandler) => {
    try {
      if (typeof rawTg?.onEvent === 'function') {
        rawTg.onEvent(eventType, eventHandler);
      }
    } catch (_) {}
  },
  offEvent: (eventType, eventHandler) => {
    try {
      if (typeof rawTg?.offEvent === 'function') {
        rawTg.offEvent(eventType, eventHandler);
      }
    } catch (_) {}
  },
  openLink: (url, options) => {
    try {
      if (rawTg?.openLink) {
        rawTg.openLink(url, options);
        return;
      }
    } catch (_) {}
    window.open(url, '_blank');
  },
  openTelegramLink: (url) => {
    try {
      if (isTgVersionAtLeast('6.1') && rawTg?.openTelegramLink) {
        rawTg.openTelegramLink(url);
        return;
      }
    } catch (_) {}
    window.open(url, '_blank');
  }
};

try {
  tg.expand();
  tg.ready();
} catch (_) {}

if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=14').then((reg) => {
      reg.update().catch(() => {});
    }).catch(() => {});
  });
}

const app = createApp({
  setup() {
    // Theme Management (Supports Telegram Dark/Light + System + Manual Toggle)
    const isDark = ref(false);

    const applyTheme = () => {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const tgDark = tg.colorScheme === 'dark';
      const saved = localStorage.getItem('theme_pref');
      const darkActive = saved ? (saved === 'dark') : (tgDark || prefersDark);
      
      isDark.value = darkActive;
      if (darkActive) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    };

    const toggleTheme = () => {
      isDark.value = !isDark.value;
      localStorage.setItem('theme_pref', isDark.value ? 'dark' : 'light');
      if (isDark.value) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    };

    applyTheme();
    if (tg.onEvent) tg.onEvent('themeChanged', applyTheme);

    // Navigation State
    const currentTab = ref('members'); // 'members', 'upcoming', 'templates', 'settings', 'memberForm', 'templateForm'
    const memberView = ref('cards'); // 'cards' | 'families'

    // Offline State & PWA Directory Cache
    const isOfflineMode = ref(!navigator.onLine);
    const offlineCacheTime = ref(null);

    // Disaster Recovery & Backup Health
    const backupHealth = ref(null);
    const backupVerifying = ref(false);

    // Modal and Form States (declared early for BackButton tracking)
    const eventModalOpen = ref(false);
    const taskModalOpen = ref(false);
    const userModalOpen = ref(false);
    const inviteModalOpen = ref(false);
    const wishModal = ref({
      open: false,
      loading: false,
      sending: false,
      member: null,
      type: 'birthday',
      style: 'pastoral',
      text: '',
      photo: null
    });
    const importModal = ref({
      open: false,
      parsing: false,
      importing: false,
      parsedMembers: [],
      error: ''
    });

    // Unified BackButton management across all tabs, forms, and modals
    const updateBackButtonState = () => {
      const isSubForm = ['memberForm', 'templateForm', 'fastEntry'].includes(currentTab.value);
      const isModalActive = eventModalOpen.value || taskModalOpen.value || userModalOpen.value || inviteModalOpen.value || wishModal.value.open || importModal.value.open;
      if (isSubForm || isModalActive) {
        tg.BackButton.show();
      } else {
        tg.BackButton.hide();
      }
    };

    watch([currentTab, eventModalOpen, taskModalOpen, userModalOpen, inviteModalOpen, () => wishModal.value.open, () => importModal.value.open], () => {
      if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
      updateBackButtonState();
      if (currentTab.value === 'analytics' && typeof loadErrorLogs === 'function') {
        loadErrorLogs();
      }
    });

    tg.onEvent('backButtonClicked', () => {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      // 1. Modals have top priority to close first
      if (wishModal.value.open) { wishModal.value.open = false; return; }
      if (importModal.value.open) { importModal.value.open = false; return; }
      if (eventModalOpen.value) { eventModalOpen.value = false; return; }
      if (taskModalOpen.value) { taskModalOpen.value = false; return; }
      if (userModalOpen.value) { userModalOpen.value = false; return; }
      if (inviteModalOpen.value) { inviteModalOpen.value = false; return; }
      // 2. Sub-forms return to their parent list tab
      if (currentTab.value === 'memberForm' || currentTab.value === 'fastEntry') { currentTab.value = 'members'; return; }
      if (currentTab.value === 'templateForm') { currentTab.value = 'templates'; return; }
    });

    // Core Data Collections
    const members = ref([]);
    const templates = ref([]);
    const upcomingEvents = ref({ birthdays: [], weddings: [] });
    const churchEvents = ref([]);
    const tasks = ref([]);
    const churchStats = ref(null);
    const dataQuality = ref(null);
    const errorLogs = ref([]);
    const errorStats = ref({ total: 0, unresolved: 0 });
    const errorLoading = ref(false);
    const errorFilter = ref('all'); // 'all', 'unresolved', 'resolved', 'telegram', 'express'
    const errorSearch = ref('');
    const expandedErrorId = ref(null);
    const settings = ref({
      sendTime: '06:00',
      reminderTime: '20:00',
      enableBirthdays: true,
      enableWeddings: true,
      customFields: [],
      geminiApiKey: ''
    });
    const testingGemini = ref(false);

    // Search, Filter & Sort State
    const search = ref('');
    const memberFilter = ref('active'); // 'all', 'active', 'inactive', 'married', 'youth', 'elder', 'pastor'
    const sortBy = ref('name'); // 'name', 'birthday', 'wedding'
    const selectedIds = ref([]);

    // UI Loading & Toast State
    const loading = ref(true);
    const saving = ref(false);
    const triggering = ref(false);
    const toastMessage = ref('');
    const dataLoadError = ref('');
    let toastTimeout = null;

    // Component-level error boundary preventing crashes across sub-views
    if (typeof onErrorCaptured === 'function') {
      onErrorCaptured((err, instance, info) => {
        console.warn('🛡️ [VUE ERROR BOUNDARY]: Intercepted component failure safely:', err?.message || err, info);
        if (typeof sendClientError === 'function') {
          sendClientError(err, `onErrorCaptured: ${info}`);
        }
        return false; // Prevents error from escalating and breaking entire app shell
      });
    }

    const showToast = (msg) => {
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
      toastMessage.value = msg;
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => { toastMessage.value = ''; }, 3000);
    };

    // Forms
    const defaultForm = () => ({
      name: '',
      gender: 'male',
      role: '',
      phone: '',
      address: '',
      ministry: '',
      status: 'active',
      membershipDate: '',
      adminNotes: '',
      dob: '',
      weddingDate: '',
      isMarried: false,
      spouseName: '',
      spouseGender: 'female',
      familyName: '',
      isChild: false,
      isPastor: false,
      isActive: true,
      customData: {}
    });
    const form = ref(defaultForm());

    const defaultTplForm = () => ({ type: 'birthday', category: 'formal', content: '' });
    const tplForm = ref(defaultTplForm());

    // Standalone Browser and Telegram Authentication
    // Robust detection across Telegram Android, iOS, Desktop, Web (weba/webk), and standalone browsers
    const getTgInitData = () => {
      // 1. Direct from window.Telegram.WebApp.initData
      const direct = window.Telegram?.WebApp?.initData || tg.initData || '';
      if (direct && direct.length > 5) {
        try { sessionStorage.setItem('spbc_tg_init_data', direct); } catch (_) {}
        return direct;
      }

      // 2. Parse from location.hash if present (#tgWebAppData=...)
      try {
        const hash = window.location.hash || '';
        if (hash.includes('tgWebAppData=')) {
          const hashClean = hash.startsWith('#') ? hash.slice(1) : hash;
          const params = new URLSearchParams(hashClean);
          const fromHash = params.get('tgWebAppData');
          if (fromHash && fromHash.length > 5) {
            try { sessionStorage.setItem('spbc_tg_init_data', fromHash); } catch (_) {}
            return fromHash;
          }
        }
      } catch (_) {}

      // 3. Fallback to session-cached initData across reloads inside Telegram
      try {
        const cached = sessionStorage.getItem('spbc_tg_init_data');
        if (cached && cached.length > 5) return cached;
      } catch (_) {}

      return '';
    };

    const isInTelegram = () => {
      // 1. Telegram WebApp platform property (android, ios, tdesktop, macos, weba, webk)
      const platform = window.Telegram?.WebApp?.platform;
      if (platform && platform !== 'unknown') return true;

      // 2. Direct or URL-parsed initData string
      if (getTgInitData().length > 5) return true;

      // 3. User object present in Telegram context
      if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) return true;

      // 4. URL hash indicators from Telegram Web
      const hash = window.location.hash || '';
      if (hash.includes('tgWebAppData=') || hash.includes('tgWebAppVersion=')) return true;

      // 5. Telegram WebApp version property
      if (window.Telegram?.WebApp?.version && window.Telegram.WebApp.version.length > 0) return true;

      // 6. User-Agent contains Telegram
      if (typeof navigator !== 'undefined' && /Telegram/i.test(navigator.userAgent || '')) return true;

      return false;
    };

    const getStoredToken = () => {
      // Telegram WebApp cryptographically verifiable initData only
      const initData = getTgInitData();
      if (initData && initData.length > 5) {
        return initData;
      }
      return '';
    };

    const authToken = ref(getStoredToken());
    const csrfToken = ref(sessionStorage.getItem('spbc_csrf_token') || '');
    const authModalOpen = ref(false);
    const authInputKey = ref('');
    const authError = ref('');
    const authVerifying = ref(false);

    // API Helper with network exception handling & request timeouts
    const apiCall = async (url, method = 'GET', body = null) => {
      // Always re-read initData dynamically (webapp populates it after load)
      const token = authToken.value || getTgInitData() || '';
      const upperMethod = (method || 'GET').toUpperCase();
      const opts = {
        method: upperMethod,
        credentials: 'same-origin',
        headers: {}
      };
      if (token) {
        opts.headers['Authorization'] = `Bearer ${token}`;
      }
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(upperMethod) && csrfToken.value) {
        opts.headers['X-CSRF-Token'] = csrfToken.value;
      }
      if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      let res;
      let timeoutId = null;
      try {
        if (typeof AbortController !== 'undefined') {
          const controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), 30000);
          opts.signal = controller.signal;
        }
        res = await fetch(`/api${url}`, opts);
      } catch (netErr) {
        if (netErr?.name === 'AbortError') {
          throw new Error('Request timed out. Please check your internet connection.');
        }
        throw new Error('Network connection failed. Please check your internet connection.');
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      if (res.status === 401) {
        authToken.value = '';
        csrfToken.value = '';
        sessionStorage.removeItem('spbc_csrf_token');
        sessionStorage.removeItem('spbc_auth_session');
        localStorage.removeItem('spbc_auth_token');
        authModalOpen.value = true;
      }
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || `Request failed (${res.status})`);
      }
      return await res.json().catch(() => ({}));
    };

    const verifyAndSavePasscode = async () => {
      if (!authInputKey.value || !authInputKey.value.trim()) {
        authError.value = 'Please enter your Admin Passcode or Secret';
        return;
      }
      authVerifying.value = true;
      authError.value = '';
      try {
        const candidate = authInputKey.value.trim();
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ secret: candidate })
        });
        if (!res.ok) {
          throw new Error('Invalid Admin Passcode or Secret Key');
        }
        const data = await res.json();
        if (data.csrfToken) {
          csrfToken.value = data.csrfToken;
          sessionStorage.setItem('spbc_csrf_token', data.csrfToken);
        }
        // Never store secret in browser storage
        authInputKey.value = '';
        authModalOpen.value = false;
        showToast('🔓 Admin Verified Successfully');
        await loadData();
      } catch (err) {
        authError.value = err.message;
      } finally {
        authVerifying.value = false;
      }
    };

    const logoutStandalone = async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: csrfToken.value ? { 'X-CSRF-Token': csrfToken.value } : {}
        });
      } catch (_) {}
      sessionStorage.removeItem('spbc_csrf_token');
      sessionStorage.removeItem('spbc_auth_session');
      sessionStorage.removeItem('spbc_tg_init_data');
      localStorage.removeItem('spbc_auth_token');
      csrfToken.value = '';
      authToken.value = '';
      currentUser.value = null;
      authModalOpen.value = true;
    };

    // Navigate to /admin auto-login shortcut (cannot use window directly in Vue 3 templates)
    const goToAdminLogin = () => {
      window.location.href = '/admin';
    };

    // User Management State (Full Access Control & CRUD)
    const authorizedUsers = ref([]);
    const superAdminId = ref('');
    const currentUser = ref(null);
    const activeInviteUrl = ref('');
    const generatingInvite = ref(false);
    const userFilter = ref('all'); // 'all', 'active', 'pending', 'suspended'
    const userSearch = ref('');
    const isEditingUser = ref(false);
    const userSaving = ref(false);
    const inviteRole = ref('admin');
    const inviteHours = ref(72);

    const defaultUserPermissions = (role = 'admin') => {
      if (role === 'admin' || role === 'superadmin') {
        return {
          canManageMembers: true,
          canDeleteMembers: true,
          canSendGreetings: true,
          canManageTemplates: true,
          canManageEvents: true,
          canManageTasks: true,
          canExportData: true,
          canManageUsers: true
        };
      }
      if (role === 'pastor') {
        return {
          canManageMembers: true,
          canDeleteMembers: true,
          canSendGreetings: true,
          canManageTemplates: true,
          canManageEvents: true,
          canManageTasks: true,
          canExportData: true,
          canManageUsers: false
        };
      }
      if (role === 'staff') {
        return {
          canManageMembers: true,
          canDeleteMembers: false,
          canSendGreetings: true,
          canManageTemplates: true,
          canManageEvents: true,
          canManageTasks: true,
          canExportData: false,
          canManageUsers: false
        };
      }
      if (role === 'volunteer') {
        return {
          canManageMembers: false,
          canDeleteMembers: false,
          canSendGreetings: true,
          canManageTemplates: false,
          canManageEvents: false,
          canManageTasks: false,
          canExportData: false,
          canManageUsers: false
        };
      }
      return {
        canManageMembers: true,
        canDeleteMembers: false,
        canSendGreetings: true,
        canManageTemplates: false,
        canManageEvents: true,
        canManageTasks: true,
        canExportData: false,
        canManageUsers: false
      };
    };

    const defaultUserForm = () => ({
      telegramId: '',
      name: '',
      username: '',
      role: 'admin',
      status: 'active',
      notes: '',
      permissions: defaultUserPermissions('admin')
    });

    const userForm = ref(defaultUserForm());

    const onUserRoleChange = () => {
      userForm.value.permissions = defaultUserPermissions(userForm.value.role);
    };

    const loadUsers = async () => {
      try {
        const res = await apiCall('/users');
        authorizedUsers.value = res.users || [];
        superAdminId.value = res.superAdminId || '';
        currentUser.value = res.currentUser || null;
      } catch (_) {}
    };

    const filteredAuthorizedUsers = computed(() => {
      if (!Array.isArray(authorizedUsers.value)) return [];
      let list = [...authorizedUsers.value];
      if (userFilter.value === 'active') {
        list = list.filter(u => u && u.status === 'active' && !String(u.telegramId || '').startsWith('pending_invite_'));
      } else if (userFilter.value === 'pending') {
        list = list.filter(u => u && u.status === 'pending');
      } else if (userFilter.value === 'suspended') {
        list = list.filter(u => u && (u.status === 'suspended' || u.status === 'revoked'));
      }
      if (userSearch.value && userSearch.value.trim()) {
        const q = userSearch.value.trim().toLowerCase();
        list = list.filter(u =>
          u && (
            (u.name && String(u.name).toLowerCase().includes(q)) ||
            (u.username && String(u.username).toLowerCase().includes(q)) ||
            (u.telegramId && String(u.telegramId).includes(q)) ||
            (u.role && String(u.role).toLowerCase().includes(q))
          )
        );
      }
      return list;
    });

    const activeUsersCount = computed(() =>
      (Array.isArray(authorizedUsers.value) ? authorizedUsers.value : []).filter(u => u && u.status === 'active' && !String(u.telegramId || '').startsWith('pending_invite_')).length
    );
    const pendingUsersCount = computed(() =>
      (Array.isArray(authorizedUsers.value) ? authorizedUsers.value : []).filter(u => u && u.status === 'pending').length
    );
    const suspendedUsersCount = computed(() =>
      (Array.isArray(authorizedUsers.value) ? authorizedUsers.value : []).filter(u => u && (u.status === 'suspended' || u.status === 'revoked')).length
    );

    const openAddUserModal = () => {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      isEditingUser.value = false;
      userForm.value = defaultUserForm();
      userModalOpen.value = true;
    };

    const openEditUserModal = (u) => {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      isEditingUser.value = true;
      userForm.value = {
        telegramId: u.telegramId,
        name: u.name || '',
        username: u.username || '',
        role: u.role || 'admin',
        status: u.status || 'active',
        notes: u.notes || '',
        permissions: {
          ...defaultUserPermissions(u.role || 'admin'),
          ...(u.permissions || {})
        }
      };
      userModalOpen.value = true;
    };

    const saveUserAction = async () => {
      if (!userForm.value.telegramId || !String(userForm.value.telegramId).trim()) {
        return tg.showAlert("Telegram ID is required (e.g. 123456789)");
      }
      if (!userForm.value.name || !userForm.value.name.trim()) {
        return tg.showAlert("Leader name is required");
      }
      userSaving.value = true;
      try {
        if (isEditingUser.value) {
          await apiCall(`/users/${userForm.value.telegramId}`, 'PUT', userForm.value);
          showToast(`✅ Updated ${userForm.value.name}`);
        } else {
          await apiCall('/users', 'POST', userForm.value);
          showToast(`🎉 Added ${userForm.value.name} as ${userForm.value.role}`);
        }
        await loadUsers();
        userModalOpen.value = false;
      } catch (err) {
        tg.showAlert(err.message);
      } finally {
        userSaving.value = false;
      }
    };

    const deleteUserAction = async (u) => {
      tg.showConfirm(`Permanently delete ${u.name} (ID: ${u.telegramId}) from authorized leaders?`, async (ok) => {
        if (!ok) return;
        try {
          await apiCall(`/users/${u.telegramId}?hard=true`, 'DELETE');
          showToast(`🗑 Deleted ${u.name}`);
          await loadUsers();
        } catch (err) {
          tg.showAlert(err.message);
        }
      });
    };

    const toggleUserStatusAction = async (u) => {
      try {
        await apiCall(`/users/${u.telegramId}/toggle-status`, 'POST');
        const nextState = u.status === 'active' ? 'Suspended' : 'Activated';
        showToast(`${nextState} ${u.name}`);
        await loadUsers();
      } catch (err) {
        tg.showAlert(err.message);
      }
    };

    const openInviteModal = () => {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      inviteRole.value = 'admin';
      inviteHours.value = 72;
      inviteModalOpen.value = true;
    };

    const generateInviteLink = async (role = inviteRole.value, hoursValid = inviteHours.value) => {
      generatingInvite.value = true;
      try {
        const res = await apiCall('/users/invite', 'POST', {
          role: role || inviteRole.value,
          hoursValid: hoursValid || inviteHours.value,
          permissions: defaultUserPermissions(role || inviteRole.value)
        });
        activeInviteUrl.value = res.inviteUrl;
        inviteModalOpen.value = false;
        showToast('🔗 Invite Link generated!');
      } catch (err) {
        showToast('❌ ' + err.message);
      } finally {
        generatingInvite.value = false;
      }
    };

    const copyInviteLink = async () => {
      if (!activeInviteUrl.value) return;
      try {
        await navigator.clipboard.writeText(activeInviteUrl.value);
        showToast('📋 Copied to clipboard!');
      } catch (_) {
        showToast('Link: ' + activeInviteUrl.value);
      }
    };

    const shareInviteWhatsApp = () => {
      if (!activeInviteUrl.value) return;
      const text = `⛪ *Salem Primitive Baptist Church (SPBC)*\n\n🕊 Greetings! You are invited to join the church administration bot as an authorized leader.\n\n🔗 *Activate Access:*\n${activeInviteUrl.value}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    };

    const approveUserAction = async (telegramId, role = 'admin', name = '') => {
      try {
        await apiCall('/users/approve', 'POST', {
          telegramId,
          role,
          name,
          permissions: defaultUserPermissions(role)
        });
        showToast(`✅ Approved ${name || 'user'} as ${role}`);
        await loadUsers();
      } catch (err) {
        showToast('❌ ' + err.message);
      }
    };

    const revokeUserAction = async (telegramId, name = '') => {
      tg.showConfirm(`Are you sure you want to revoke bot access for ${name || 'this leader'}?`, async (ok) => {
        if (!ok) return;
        try {
          await apiCall(`/users/${telegramId}`, 'DELETE');
          showToast('🗑 Leader access revoked');
          await loadUsers();
        } catch (err) {
          tg.showAlert(err.message);
        }
      });
    };

    // Load All Data
    const loadData = async () => {
      loading.value = true;
      dataLoadError.value = '';
      try {
        const [mRes, tRes, sRes, uRes, eRes, taskRes, statsRes, dqRes, usersRes, taskStatsRes] = await Promise.all([
          apiCall('/members').catch((e) => { console.warn('Members load fallback:', e); return []; }),
          apiCall('/templates').catch((e) => { console.warn('Templates load fallback:', e); return []; }),
          apiCall('/settings').catch(() => ({ sendTime: '06:00', reminderTime: '20:00', customFields: [] })),
          apiCall('/upcoming?days=30').catch(() => ({ birthdays: [], weddings: [] })),
          apiCall('/events').catch(() => []),
          apiCall('/tasks').catch(() => []),
          apiCall('/reports/stats').catch(() => null),
          apiCall('/reports/data-quality').catch(() => null),
          apiCall('/users').catch(() => ({ users: [], superAdminId: null })),
          apiCall('/tasks/stats').catch(() => null)
        ]);

        members.value = Array.isArray(mRes) ? mRes : (mRes?.members || []);
        if (members.value.length > 0) {
          try {
            localStorage.setItem('spbc_offline_members_cache', JSON.stringify({
              timestamp: Date.now(),
              data: members.value
            }));
            offlineCacheTime.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch (_) {}
        } else {
          // If network returned empty, check offline cache
          try {
            const rawCache = localStorage.getItem('spbc_offline_members_cache');
            if (rawCache) {
              const parsed = JSON.parse(rawCache);
              if (Array.isArray(parsed?.data) && parsed.data.length > 0) {
                members.value = parsed.data;
                isOfflineMode.value = true;
                offlineCacheTime.value = new Date(parsed.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
            }
          } catch (_) {}
        }
        templates.value = Array.isArray(tRes) ? tRes : [];
        settings.value = {
          sendTime: '06:00',
          reminderTime: '20:00',
          enableBirthdays: true,
          enableWeddings: true,
          customFields: [],
          geminiApiKey: '',
          ...(sRes || {})
        };
        upcomingEvents.value = uRes || { birthdays: [], weddings: [] };
        churchEvents.value = Array.isArray(eRes) ? eRes : [];
        tasks.value = Array.isArray(taskRes) ? taskRes : [];
        churchStats.value = statsRes || null;
        dataQuality.value = dqRes || null;
        authorizedUsers.value = usersRes?.users || [];
        superAdminId.value = usersRes?.superAdminId || '';
        currentUser.value = usersRes?.currentUser || null;
        if (taskStatsRes) taskStats.value = taskStatsRes;
      } catch (err) {
        console.error("loadData critical catch:", err);
        // Offline cache fallback
        try {
          const rawCache = localStorage.getItem('spbc_offline_members_cache');
          if (rawCache) {
            const parsed = JSON.parse(rawCache);
            if (Array.isArray(parsed?.data) && parsed.data.length > 0) {
              members.value = parsed.data;
              isOfflineMode.value = true;
              offlineCacheTime.value = new Date(parsed.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              showToast("📶 Offline Directory: Loaded " + members.value.length + " cached members");
            }
          }
        } catch (_) {}
        dataLoadError.value = isOfflineMode.value ? "" : "Unable to connect to server. Check your connection or tap Retry.";
        if (!isOfflineMode.value) showToast("⚠️ Could not load data.");
      } finally {
        loading.value = false;
      }
    };

    onMounted(async () => {
      // Clean any residual legacy secrets
      sessionStorage.removeItem('spbc_auth_session');
      localStorage.removeItem('spbc_auth_token');

      let token = getTgInitData();
      if (token && token.length > 5) {
        authToken.value = token;
        try {
          const vRes = await fetch('/api/auth/verify', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          if (vRes.ok) {
            const vData = await vRes.json();
            if (vData.csrfToken) {
              csrfToken.value = vData.csrfToken;
              sessionStorage.setItem('spbc_csrf_token', vData.csrfToken);
            }
          }
        } catch (_) {}
        await loadData();
      } else {
        // Standalone browser: verify if session cookie is already active
        try {
          const savedCsrf = sessionStorage.getItem('spbc_csrf_token');
          const verifyHeaders = { 'Content-Type': 'application/json' };
          if (savedCsrf) verifyHeaders['X-CSRF-Token'] = savedCsrf;

          let vRes = await fetch('/api/auth/verify', {
            method: 'GET',
            credentials: 'same-origin',
            headers: verifyHeaders
          });
          if (!vRes.ok) {
            vRes = await fetch('/api/auth/verify', {
              method: 'POST',
              credentials: 'same-origin',
              headers: verifyHeaders
            });
          }
          if (vRes.ok) {
            const vData = await vRes.json();
            if (vData.csrfToken) {
              csrfToken.value = vData.csrfToken;
              sessionStorage.setItem('spbc_csrf_token', vData.csrfToken);
            }
            authModalOpen.value = false;
            await loadData();
            return;
          }
        } catch (_) {}
        loading.value = false;
        authModalOpen.value = true;
      }

      import('/js/haptics.js').then(({ initPullToRefresh }) => {
        initPullToRefresh(loadData);
      }).catch(() => {});

      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          if (commandPaletteOpen.value) {
            closeCommandPalette();
          } else {
            openCommandPalette();
          }
        } else if (e.key === 'Escape' && commandPaletteOpen.value) {
          closeCommandPalette();
        }
      });

      // PWA Offline Connectivity Monitors
      try {
        const rawCache = localStorage.getItem('spbc_offline_members_cache');
        if (rawCache) {
          const parsed = JSON.parse(rawCache);
          if (parsed?.timestamp) {
            offlineCacheTime.value = new Date(parsed.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        }
      } catch (_) {}

      window.addEventListener('online', () => {
        isOfflineMode.value = false;
        showToast("🌐 Connection restored - syncing directory...");
        loadData();
      });

      window.addEventListener('offline', () => {
        isOfflineMode.value = true;
        showToast("📶 Offline mode: Using cached church directory");
      });

      // Initialize automated backup health
      loadBackupHealth().catch(() => {});
    });

    // Age Calculator
    const getAge = (dob) => {
      if (!dob) return null;
      const today = new Date();
      const birth = new Date(dob);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return age;
    };

    // Metrics Overview
    const totalCount = computed(() => members.value.length);
    const activeCount = computed(() => members.value.filter(m => m.isActive !== false).length);
    const marriedCount = computed(() => members.value.filter(m => m.isMarried).length);
    const celebrationsCount = computed(() => (upcomingEvents.value.birthdays?.length || 0) + (upcomingEvents.value.weddings?.length || 0));

    // Filtered & Sorted Members
    const filteredMembers = computed(() => {
      let list = [...members.value];

      // Filter by Status / Demographics
      if (memberFilter.value === 'active') list = list.filter(m => m.isActive !== false);
      if (memberFilter.value === 'inactive') list = list.filter(m => m.isActive === false);
      if (memberFilter.value === 'married') list = list.filter(m => m.isMarried);
      if (memberFilter.value === 'pastor') list = list.filter(m => m.isPastor);
      if (memberFilter.value === 'youth') {
        list = list.filter(m => {
          const age = getAge(m.dob);
          return m.isChild || (age !== null && age < 30);
        });
      }
      if (memberFilter.value === 'elder') {
        list = list.filter(m => {
          const age = getAge(m.dob);
          return age !== null && age >= 60;
        });
      }

      // Search Query
      if (search.value) {
        const s = search.value.toLowerCase().trim();
        list = list.filter(m =>
          (m.name || '').toLowerCase().includes(s) ||
          (m.role || '').toLowerCase().includes(s) ||
          (m.familyName || '').toLowerCase().includes(s) ||
          (m.spouseName || '').toLowerCase().includes(s)
        );
      }

      // Sort
      if (sortBy.value === 'name') {
        list.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortBy.value === 'birthday') {
        list.sort((a, b) => (a.birthday || '99-99').localeCompare(b.birthday || '99-99'));
      } else if (sortBy.value === 'wedding') {
        list.sort((a, b) => (a.wedding || '99-99').localeCompare(b.wedding || '99-99'));
      }

      return list;
    });

    // Helper to calculate age from DOB
    const computeAge = (dob) => {
      if (!dob) return null;
      const b = new Date(dob);
      if (isNaN(b.getTime())) return null;
      const now = new Date();
      let age = now.getFullYear() - b.getFullYear();
      const m = now.getMonth() - b.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
      return age >= 0 ? age : null;
    };

    // Grouped Family Units (Legacy map for backward compatibility)
    const groupedFamilies = computed(() => {
      const groups = {};
      for (const m of filteredMembers.value) {
        const famName = m.familyName?.trim() || 'General Roster';
        if (!groups[famName]) groups[famName] = [];
        groups[famName].push(m);
      }
      return groups;
    });

    // Rich Household / Family Tree Structure
    const structuredFamilies = computed(() => {
      const map = new Map();
      const unassigned = [];

      for (const m of filteredMembers.value) {
        const famName = m.familyName?.trim();
        if (famName) {
          if (!map.has(famName)) map.set(famName, []);
          map.get(famName).push(m);
        } else {
          unassigned.push(m);
        }
      }

      const list = [];

      for (const [famName, membersList] of map.entries()) {
        // Hierarchy for Head of Household:
        // 1. Pastor / Elder / Deacon
        // 2. Married male
        // 3. Adult male
        // 4. Any adult
        // 5. First member
        let head = membersList.find(m => m.isPastor || ['pastor', 'elder', 'deacon', 'treasurer', 'secretary'].includes((m.role || '').toLowerCase()));
        if (!head) {
          head = membersList.find(m => m.gender === 'male' && m.isMarried);
        }
        if (!head) {
          head = membersList.find(m => m.gender === 'male' && !m.isChild);
        }
        if (!head) {
          head = membersList.find(m => !m.isChild);
        }
        if (!head) {
          head = membersList[0];
        }

        // Identify spouse of head
        let spouse = null;
        if (head) {
          spouse = membersList.find(m => {
            if (m._id === head._id) return false;
            if (head.spouseId && m._id === head.spouseId) return true;
            if (head.spouseName && m.name && m.name.toLowerCase() === head.spouseName.toLowerCase()) return true;
            if (m.spouseName && head.name && head.name.toLowerCase() === m.spouseName.toLowerCase()) return true;
            return false;
          });
          if (!spouse && head.isMarried) {
            spouse = membersList.find(m => m._id !== head._id && m.gender !== head.gender && m.isMarried);
          }
        }

        // Identify children / dependents
        const children = membersList.filter(m => {
          if (m._id === head?._id || (spouse && m._id === spouse._id)) return false;
          if (m.isChild) return true;
          if (head && m.parentId && m.parentId === head._id) return true;
          if (spouse && m.parentId && m.parentId === spouse._id) return true;
          const age = computeAge(m.dob);
          if (age !== null && age < 18) return true;
          return false;
        });

        // Other household members (elderly parents, relatives, etc.)
        const others = membersList.filter(m => {
          if (m._id === head?._id) return false;
          if (spouse && m._id === spouse._id) return false;
          if (children.some(c => c._id === m._id)) return false;
          return true;
        });

        // Household contact details
        const primaryPhone = head?.phone || spouse?.phone || membersList.find(m => m.phone)?.phone || '';
        const primaryAddress = head?.address || spouse?.address || membersList.find(m => m.address)?.address || '';
        const weddingDate = head?.weddingDate || spouse?.weddingDate || '';
        const weddingKey = head?.wedding || spouse?.wedding || '';

        list.push({
          name: famName,
          isUnassigned: false,
          totalCount: membersList.length,
          head,
          spouse,
          children,
          others,
          allMembers: membersList,
          primaryPhone,
          primaryAddress,
          weddingDate,
          weddingKey
        });
      }

      list.sort((a, b) => a.name.localeCompare(b.name));

      if (unassigned.length > 0) {
        list.push({
          name: 'General Roster (Unassigned Household)',
          isUnassigned: true,
          totalCount: unassigned.length,
          head: null,
          spouse: null,
          children: [],
          others: unassigned,
          allMembers: unassigned,
          primaryPhone: '',
          primaryAddress: '',
          weddingDate: '',
          weddingKey: ''
        });
      }

      return list;
    });

    const householdStats = computed(() => {
      const activeFamilies = structuredFamilies.value.filter(f => !f.isUnassigned);
      const totalHouseholds = activeFamilies.length;
      const totalInHouseholds = activeFamilies.reduce((sum, f) => sum + f.totalCount, 0);
      const unassignedGroup = structuredFamilies.value.find(f => f.isUnassigned);
      const unassignedCount = unassignedGroup ? unassignedGroup.totalCount : 0;
      const avgSize = totalHouseholds > 0 ? (totalInHouseholds / totalHouseholds).toFixed(1) : '0';
      return {
        totalHouseholds,
        totalInHouseholds,
        unassignedCount,
        avgSize
      };
    });

    const addFamilyMember = (familyName) => {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      form.value = { ...defaultForm(), familyName: familyName || '' };
      currentTab.value = 'memberForm';
    };

    const openFamilyWhatsApp = (phone) => {
      if (!phone) return;
      const clean = phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${clean}`, '_blank');
    };

    // Selection
    const selectAll = () => {
      if (selectedIds.value.length === filteredMembers.value.length) {
        selectedIds.value = [];
      } else {
        selectedIds.value = filteredMembers.value.map(m => m._id);
      }
    };

    const bulkAction = async (action, value) => {
      if (!selectedIds.value.length) return;
      const count = selectedIds.value.length;
      tg.showConfirm(`Apply to ${count} members?`, async (ok) => {
        if (!ok) return;
        let payload = null;
        let endpointAction = action;
        if (action === 'active') {
          endpointAction = 'update';
          payload = { isActive: value };
        }
        try {
          await apiCall('/members/bulk', 'POST', { ids: selectedIds.value, action: endpointAction, payload });
          selectedIds.value = [];
          await loadData();
          showToast(`✅ Updated ${count} members`);
        } catch (e) {
          tg.showAlert(e.message);
        }
      });
    };

    // Member Form
    const openMemberForm = (m = null) => {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      const base = m ? { ...defaultForm(), ...m, customData: m.customData || {} } : defaultForm();
      if (base.isPastor && !base.role) {
        base.role = 'Pastor';
      } else if (!base.isPastor && /pastor/i.test(base.role || '')) {
        base.isPastor = true;
      }
      form.value = base;
      currentTab.value = 'memberForm';
    };

    // Unify Role / Designation with isPastor flag automatically
    watch(() => form.value?.role, (newRole) => {
      if (!form.value) return;
      if (/pastor/i.test(newRole || '')) {
        form.value.isPastor = true;
      } else if (newRole && !/pastor/i.test(newRole)) {
        form.value.isPastor = false;
      }
    });

    // Auto-sync isChild when dob is entered
    watch(() => form.value?.dob, (newDob) => {
      if (!form.value || !newDob) return;
      const age = getAge(newDob);
      if (age !== null) {
        form.value.isChild = age < 18;
      }
    });

    const handlePhotoFileInput = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 8 * 1024 * 1024) {
        return tg.showAlert("File is too large! Please choose an image or document under 8MB.");
      }

      const reader = new FileReader();
      reader.onload = () => {
        form.value.photo = reader.result;
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        showToast("📸 Photo attached to profile");
      };
      reader.readAsDataURL(file);
    };

    const saveMember = async () => {
      const trimmedName = (form.value.name || '').trim();
      if (!trimmedName) return tg.showAlert("Full Name is required!");
      if (form.value.isMarried) {
        if (!form.value.spouseName || !form.value.spouseName.trim()) {
          return tg.showAlert("Spouse name is required when Married is enabled.");
        }
        if (form.value.gender && form.value.spouseGender && form.value.gender === form.value.spouseGender) {
          return tg.showAlert("Spouse gender must be different from member gender.");
        }
      }

      const isPastor = /pastor/i.test(form.value.role || '') || Boolean(form.value.isPastor);
      form.value.isPastor = isPastor;

      saving.value = true;
      try {
        const payload = {
          ...form.value,
          name: trimmedName,
          birthday: form.value.dob ? form.value.dob.substring(5) : (form.value.birthday || ''),
          wedding: form.value.isMarried ? (form.value.weddingDate ? form.value.weddingDate.substring(5) : (form.value.wedding || '')) : '',
          spouseName: form.value.isMarried ? (form.value.spouseName || '').trim() : '',
          spouseGender: form.value.isMarried ? form.value.spouseGender : null,
          spouseId: form.value.isMarried && form.value.spouseId ? form.value.spouseId : null,
          parentId: form.value.parentId ? form.value.parentId : null,
          weddingDate: form.value.isMarried ? form.value.weddingDate : ''
        };

        if (!form.value._id) {
          // Pre-save duplicate collision inspection
          const dupRes = await apiCall('/members/check-duplicate', 'POST', payload).catch(() => ({ duplicates: [] }));
          if (dupRes.duplicates && dupRes.duplicates.length > 0) {
            const firstDup = dupRes.duplicates[0];
            const proceed = confirm(`⚠️ Warning: Potential duplicate detected with "${firstDup.name}" (${firstDup.reason}).\n\nDo you want to proceed and save this new member profile?`);
            if (!proceed) {
              saving.value = false;
              return;
            }
          }
        }
        await apiCall(form.value._id ? `/members/${form.value._id}` : '/members', form.value._id ? 'PUT' : 'POST', payload);
        await loadData();
        currentTab.value = 'members';
        showToast("Profile saved successfully");
      } catch (e) {
        tg.showAlert(e.message);
      } finally {
        saving.value = false;
      }
    };

    // ==========================================
    // FAST MEMBER ENTRY MODE (RAPID REGISTRATION)
    // ==========================================
    const defaultFastForm = (retained = {}) => ({
      name: '',
      gender: 'male',
      role: 'Member',
      familyName: retained.familyName || '',
      phone: retained.phone || '',
      address: retained.address || '',
      dob: '',
      ageEstimate: '',
      isChild: false,
      isPastor: false,
      isMarried: false,
      spouseName: '',
      weddingDate: '',
      status: 'active'
    });

    const fastForm = ref(defaultFastForm());
    const retainHousehold = ref(true);
    const fastSessionMembers = ref([]);
    const fastSaving = ref(false);

    // Dynamic known family names for datalist autocomplete
    const existingFamilies = computed(() => {
      const set = new Set();
      for (const m of members.value) {
        if (m.familyName && m.familyName.trim()) {
          set.add(m.familyName.trim());
        }
      }
      return Array.from(set).sort();
    });

    const existingRoles = ['Member', 'Youth', 'Elder', 'Deacon', 'Choir', 'Sunday School', 'Pastor', 'Treasurer', 'Secretary'];

    // Fast Age Estimator
    const handleAgeEstimateChange = () => {
      const val = fastForm.value.ageEstimate;
      if (val === '' || val === null || val === undefined) return;
      const age = parseInt(val, 10);
      if (!isNaN(age) && age >= 0 && age <= 120) {
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - age;
        fastForm.value.dob = `${birthYear}-01-01`;
        if (age < 18) {
          fastForm.value.isChild = true;
          if (fastForm.value.role === 'Member') fastForm.value.role = 'Youth';
        } else {
          fastForm.value.isChild = false;
        }
      }
    };

    const setFastPrefix = (prefix) => {
      const current = fastForm.value.name.replace(/^(Bro\.|Sis\.|Pastor|Master)\s*/i, '').trim();
      fastForm.value.name = prefix + (current ? ' ' + current : ' ');
      const el = document.getElementById('fast-name-input');
      if (el) el.focus();
    };

    const setFastRole = (role) => {
      fastForm.value.role = role;
      if (role === 'Youth' || role === 'Sunday School') {
        fastForm.value.isChild = true;
      }
      if (role === 'Pastor') {
        fastForm.value.isPastor = true;
      }
      if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    };

    const resetFastForm = (keepFamily = true) => {
      const retained = {};
      if (keepFamily && retainHousehold.value) {
        retained.familyName = fastForm.value.familyName;
        retained.phone = fastForm.value.phone;
        retained.address = fastForm.value.address;
      }
      fastForm.value = defaultFastForm(retained);
      setTimeout(() => {
        const el = document.getElementById('fast-name-input');
        if (el) el.focus();
      }, 50);
    };

    const openFastEntry = (prefillFamily = '') => {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      resetFastForm(false);
      if (prefillFamily) {
        fastForm.value.familyName = prefillFamily;
        const match = members.value.find(m => m.familyName === prefillFamily);
        if (match) {
          if (match.address) fastForm.value.address = match.address;
          if (match.phone) fastForm.value.phone = match.phone;
        }
      }
      currentTab.value = 'fastEntry';
      setTimeout(() => {
        const el = document.getElementById('fast-name-input');
        if (el) el.focus();
      }, 100);
    };

    const saveFastMember = async (addAnother = true) => {
      if (!fastForm.value.name || !fastForm.value.name.trim()) {
        tg.showAlert("Please enter member full name!");
        const el = document.getElementById('fast-name-input');
        if (el) el.focus();
        return;
      }

      fastSaving.value = true;
      try {
        const payload = { ...fastForm.value };
        delete payload.ageEstimate;

        if (payload.dob) payload.birthday = payload.dob.substring(5);
        if (payload.weddingDate) payload.wedding = payload.weddingDate.substring(5);

        const newMember = await apiCall('/members', 'POST', payload);
        members.value.unshift(newMember);
        fastSessionMembers.value.unshift(newMember);

        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        showToast(`⚡ Added "${newMember.name}"!`);

        if (addAnother) {
          resetFastForm(true);
        } else {
          currentTab.value = 'members';
          await loadData();
        }
      } catch (e) {
        tg.showAlert(e.message);
      } finally {
        fastSaving.value = false;
      }
    };

    window.addEventListener('keydown', (e) => {
      if (currentTab.value === 'fastEntry') {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          saveFastMember(true);
        }
      }
    });

    // Template Form
    const openTemplateForm = (t = null) => {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      tplForm.value = t ? { ...t } : defaultTplForm();
      currentTab.value = 'templateForm';
    };

    const insertVariable = (varName) => {
      tplForm.value.content = (tplForm.value.content || '') + ` ${varName}`;
      showToast(`Added ${varName}`);
    };

    const saveTemplate = async () => {
      if (!tplForm.value.content || !tplForm.value.content.trim()) {
        return tg.showAlert("Template content cannot be empty!");
      }
      saving.value = true;
      try {
        if (tplForm.value._id) {
          await apiCall(`/templates/${tplForm.value._id}`, 'PUT', tplForm.value);
        } else {
          await apiCall('/templates', 'POST', tplForm.value);
        }
        await loadData();
        currentTab.value = 'templates';
        showToast("Template saved successfully");
      } catch (e) {
        tg.showAlert(e.message);
      } finally {
        saving.value = false;
      }
    };

    const archiveMember = async (id) => {
      tg.showConfirm("Archive this member? They will be removed from active rosters and greetings.", async (ok) => {
        if (!ok) return;
        try {
          await apiCall(`/members/${id}/archive`, 'POST');
          await loadData();
          showToast("Member archived");
          currentTab.value = 'members';
        } catch (e) {
          tg.showAlert(e.message);
        }
      });
    };

    const restoreMember = async (id) => {
      try {
        await apiCall(`/members/${id}/restore`, 'POST');
        await loadData();
        showToast("Member restored to active roster");
      } catch (e) {
        tg.showAlert(e.message);
      }
    };

    // Event Management
    const defaultEventForm = () => ({
      title: '',
      category: 'special_service',
      description: '',
      startDate: new Date().toISOString().slice(0, 10),
      startTime: '09:30',
      venue: 'SPBC Church Hall',
      status: 'scheduled'
    });
    const eventForm = ref(defaultEventForm());
    const eventFilter = ref('all'); // 'all', 'upcoming', 'past'

    const openEventForm = (item = null) => {
      if (item) {
        eventForm.value = {
          _id: item._id,
          title: item.title || '',
          category: item.category || 'special_service',
          description: item.description || '',
          startDate: item.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          startTime: item.startTime || '09:30',
          venue: item.venue || 'SPBC Church Hall',
          status: item.status || 'scheduled'
        };
      } else {
        eventForm.value = defaultEventForm();
      }
      eventModalOpen.value = true;
    };

    const saveEvent = async () => {
      if (!eventForm.value.title || !eventForm.value.startDate) {
        return tg.showAlert("Title and Date are required!");
      }
      saving.value = true;
      try {
        await apiCall(eventForm.value._id ? `/events/${eventForm.value._id}` : '/events', eventForm.value._id ? 'PUT' : 'POST', eventForm.value);
        await loadData();
        eventModalOpen.value = false;
        eventForm.value = defaultEventForm();
        showToast("Church event saved");
      } catch (e) {
        tg.showAlert(e.message);
      } finally {
        saving.value = false;
      }
    };

    const deleteEvent = async (id) => {
      tg.showConfirm("Are you sure you want to delete this event?", async (ok) => {
        if (!ok) return;
        try {
          await apiCall(`/events/${id}`, 'DELETE');
          await loadData();
          showToast("Event deleted");
        } catch (e) {
          tg.showAlert(e.message);
        }
      });
    };

    const exportICS = async () => {
      try {
        const token = authToken.value || getTgInitData() || '';
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/events/export/ics', {
          credentials: 'same-origin',
          headers
        });
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'spbc_church_calendar.ics';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast("📅 Calendar (.ics) export downloaded");
      } catch (err) {
        tg.showAlert(err.message || 'Export failed');
      }
    };

    const filteredChurchEvents = computed(() => {
      let list = [...churchEvents.value];
      const today = new Date().toISOString().slice(0, 10);
      if (eventFilter.value === 'upcoming') {
        list = list.filter(e => {
          const d = e.startDate ? (typeof e.startDate === 'string' ? e.startDate.slice(0, 10) : new Date(e.startDate).toISOString().slice(0, 10)) : '';
          return d >= today;
        });
      } else if (eventFilter.value === 'past') {
        list = list.filter(e => {
          const d = e.startDate ? (typeof e.startDate === 'string' ? e.startDate.slice(0, 10) : new Date(e.startDate).toISOString().slice(0, 10)) : '';
          return d < today;
        });
      }
      return list;
    });

    // Calendar Month Grid View
    const calendarMonth = ref(new Date());
    const calendarMonthDays = computed(() => {
      const year = calendarMonth.value.getFullYear();
      const month = calendarMonth.value.getMonth();
      const firstDayIndex = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const days = [];
      for (let i = 0; i < firstDayIndex; i++) {
        days.push({ day: null, dateStr: null, events: [] });
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateStr = `${year}-${mm}-${dd}`;
        const mmdd = `${mm}-${dd}`;

        const dayEvents = [];
        // Match church events
        churchEvents.value.forEach(e => {
          if (e.startDate === dateStr) dayEvents.push({ label: e.title, type: 'church' });
        });
        // Match birthdays
        members.value.forEach(m => {
          if (m.birthday === mmdd && m.isActive !== false) dayEvents.push({ label: `🎂 ${m.name}`, type: 'birthday' });
          if (m.wedding === mmdd && m.isMarried && m.isActive !== false) dayEvents.push({ label: `💍 ${m.name}`, type: 'wedding' });
        });

        days.push({ day: d, dateStr, events: dayEvents });
      }
      return days;
    });

    const shiftCalendarMonth = (delta) => {
      const d = new Date(calendarMonth.value);
      d.setMonth(d.getMonth() + delta);
      calendarMonth.value = d;
    };

    // Duplicate Member Merger Action
    const mergeMemberAction = async (targetId, sourceId) => {
      tg.showConfirm("Merge these two member records? All details will be consolidated into the primary profile and the duplicate will be archived.", async (ok) => {
        if (!ok) return;
        try {
          await apiCall('/members/merge', 'POST', { targetId, sourceId });
          await loadData();
          if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
          showToast("🎉 Duplicate member merged successfully!");
        } catch (e) {
          tg.showAlert(e.message);
        }
      });
    };

    // ==========================================
    // TASKFLOW & TASK MANAGEMENT
    // ==========================================
    const defaultTaskStats = () => ({
      total: 0,
      active: 0,
      completed: 0,
      overdue: 0,
      totalEstimatedMins: 0,
      completedEstimatedMins: 0
    });
    const taskStats = ref(defaultTaskStats());

    const defaultTaskForm = () => ({
      title: '',
      description: '',
      category: 'general',
      priority: 'medium',
      status: 'todo',
      dueDate: '',
      dueTime: '',
      assignee: 'Admin',
      pinned: false,
      recurring: 'none',
      estimatedTime: '',
      tags: [],
      subtasks: [],
      tagInput: '',
      subtaskInput: ''
    });

    const taskForm = ref(defaultTaskForm());
    const taskFilter = ref('all'); // 'all', 'pending', 'completed', 'overdue'
    const taskPriorityFilter = ref('all'); // 'all', 'low', 'medium', 'high', 'urgent'
    const taskTagFilter = ref('all');
    const taskSearch = ref('');
    const taskSortField = ref('manual'); // 'manual', 'dueDate', 'priority', 'title', 'createdAt'
    const taskSortOrder = ref('asc');

    // Quick Add State
    const quickAddText = ref('');
    const quickAddPriority = ref('medium');
    const quickAddSubmitting = ref(false);

    // Multi-Select State
    const selectedTaskIds = ref([]);

    // Expandable details state per task
    const expandedSubtasks = ref({});
    const expandedNotes = ref({});
    const expandedAttachments = ref({});
    const taskSubtaskInputs = ref({});
    const taskNoteInputs = ref({});

    const loadTasks = async () => {
      try {
        const [taskList, stats] = await Promise.all([
          apiCall('/tasks').catch(() => []),
          apiCall('/tasks/stats').catch(() => defaultTaskStats())
        ]);
        tasks.value = taskList;
        if (stats) taskStats.value = stats;
      } catch (err) {
        console.error("Failed to load tasks", err);
      }
    };

    const executeQuickAdd = async () => {
      if (!quickAddText.value || !quickAddText.value.trim()) {
        return showToast("⚠️ Please enter a task title or command");
      }
      quickAddSubmitting.value = true;
      try {
        await apiCall('/tasks', 'POST', {
          quickAdd: true,
          text: quickAddText.value.trim(),
          priority: quickAddPriority.value
        });
        quickAddText.value = '';
        await loadTasks();
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        showToast("✨ Task added!");
      } catch (err) {
        showToast("❌ " + err.message);
      } finally {
        quickAddSubmitting.value = false;
      }
    };

    const openTaskForm = (item = null) => {
      if (item) {
        taskForm.value = {
          _id: item._id,
          title: item.title || '',
          description: item.description || '',
          category: item.category || 'general',
          priority: item.priority || 'medium',
          status: item.status || (item.completed ? 'completed' : 'todo'),
          dueDate: item.dueDate ? (typeof item.dueDate === 'string' ? item.dueDate.slice(0, 10) : new Date(item.dueDate).toISOString().slice(0, 10)) : '',
          dueTime: item.dueTime || '',
          assignee: item.assignee || 'Admin',
          pinned: !!item.pinned,
          recurring: item.recurring || 'none',
          estimatedTime: item.estimatedTime != null ? String(item.estimatedTime) : '',
          tags: Array.isArray(item.tags) ? [...item.tags] : [],
          subtasks: Array.isArray(item.subtasks) ? JSON.parse(JSON.stringify(item.subtasks)) : [],
          tagInput: '',
          subtaskInput: ''
        };
      } else {
        taskForm.value = defaultTaskForm();
      }
      taskModalOpen.value = true;
    };

    const addTagToForm = () => {
      const val = (taskForm.value.tagInput || '').trim().toLowerCase();
      if (val && !taskForm.value.tags.includes(val)) {
        taskForm.value.tags.push(val);
        taskForm.value.tagInput = '';
      }
    };

    const removeTagFromForm = (tag) => {
      taskForm.value.tags = taskForm.value.tags.filter(t => t !== tag);
    };

    const addSubtaskToForm = () => {
      const val = (taskForm.value.subtaskInput || '').trim();
      if (val) {
        taskForm.value.subtasks.push({ text: val, done: false });
        taskForm.value.subtaskInput = '';
      }
    };

    const removeSubtaskFromForm = (idx) => {
      taskForm.value.subtasks.splice(idx, 1);
    };

    const saveTask = async () => {
      if (!taskForm.value.title || !taskForm.value.title.trim()) {
        return tg.showAlert("Task title is required!");
      }
      saving.value = true;
      try {
        const payload = {
          title: taskForm.value.title.trim(),
          description: taskForm.value.description || '',
          category: taskForm.value.category || 'general',
          priority: taskForm.value.priority || 'medium',
          status: taskForm.value.status || 'todo',
          dueDate: taskForm.value.dueDate || '',
          dueTime: taskForm.value.dueTime || '',
          assignee: taskForm.value.assignee || 'Admin',
          pinned: !!taskForm.value.pinned,
          recurring: taskForm.value.recurring || 'none',
          estimatedTime: taskForm.value.estimatedTime ? parseInt(taskForm.value.estimatedTime, 10) : 0,
          tags: taskForm.value.tags || [],
          subtasks: taskForm.value.subtasks || []
        };
        await apiCall(taskForm.value._id ? `/tasks/${taskForm.value._id}` : '/tasks', taskForm.value._id ? 'PUT' : 'POST', payload);
        await loadTasks();
        taskModalOpen.value = false;
        taskForm.value = defaultTaskForm();
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        showToast("Task saved successfully");
      } catch (e) {
        tg.showAlert(e.message);
      } finally {
        saving.value = false;
      }
    };

    const toggleTaskComplete = async (t) => {
      try {
        await apiCall(`/tasks/${t._id}/toggle`, 'POST');
        await loadTasks();
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
        showToast(t.status === 'completed' || t.completed ? "Task reopened" : "Task marked completed!");
      } catch (e) {
        tg.showAlert(e.message);
      }
    };

    const toggleTaskPinAction = async (t) => {
      try {
        t.pinned = !t.pinned;
        await apiCall(`/tasks/${t._id}/pin`, 'POST');
        await loadTasks();
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        showToast(t.pinned ? "📌 Pinned to top" : "Unpinned");
      } catch (e) {
        tg.showAlert(e.message);
      }
    };

    const deleteTask = async (id) => {
      tg.showConfirm("Are you sure you want to delete this task?", async (ok) => {
        if (!ok) return;
        try {
          await apiCall(`/tasks/${id}`, 'DELETE');
          await loadTasks();
          showToast("Task deleted");
        } catch (e) {
          tg.showAlert(e.message);
        }
      });
    };

    const updateTaskStatus = async (task, newStatus) => {
      try {
        await apiCall(`/tasks/${task._id}`, 'PUT', { status: newStatus });
        task.status = newStatus;
        await loadTasks();
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        showToast(`Moved to ${newStatus}`);
      } catch (e) {
        tg.showAlert(e.message);
      }
    };

    // Subtask actions
    const toggleSubtasksExpanded = (taskId) => {
      expandedSubtasks.value[taskId] = !expandedSubtasks.value[taskId];
    };

    const addSubtaskAction = async (task) => {
      const text = (taskSubtaskInputs.value[task._id] || '').trim();
      if (!text) return;
      try {
        const updated = await apiCall(`/tasks/${task._id}/subtasks`, 'POST', { text });
        task.subtasks = updated.subtasks;
        taskSubtaskInputs.value[task._id] = '';
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      } catch (err) {
        showToast("❌ " + err.message);
      }
    };

    const toggleSubtaskAction = async (task, sub) => {
      try {
        sub.done = !sub.done;
        await apiCall(`/tasks/${task._id}/subtasks/${sub._id}/toggle`, 'POST');
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      } catch (err) {
        sub.done = !sub.done;
        showToast("❌ " + err.message);
      }
    };

    const deleteSubtaskAction = async (task, sub) => {
      try {
        await apiCall(`/tasks/${task._id}/subtasks/${sub._id}`, 'DELETE');
        task.subtasks = task.subtasks.filter(s => s._id !== sub._id);
      } catch (err) {
        showToast("❌ " + err.message);
      }
    };

    // Notes thread actions
    const toggleNotesExpanded = (taskId) => {
      expandedNotes.value[taskId] = !expandedNotes.value[taskId];
    };

    const addNoteAction = async (task) => {
      const text = (taskNoteInputs.value[task._id] || '').trim();
      if (!text) return;
      try {
        const author = currentUser.value?.name || 'Admin';
        const updated = await apiCall(`/tasks/${task._id}/notes`, 'POST', { text, author });
        task.notes = updated.notes;
        taskNoteInputs.value[task._id] = '';
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      } catch (err) {
        showToast("❌ " + err.message);
      }
    };

    const deleteNoteAction = async (task, note) => {
      try {
        await apiCall(`/tasks/${task._id}/notes/${note._id}`, 'DELETE');
        task.notes = task.notes.filter(n => n._id !== note._id);
      } catch (err) {
        showToast("❌ " + err.message);
      }
    };

    // Attachments actions
    const toggleAttachmentsExpanded = (taskId) => {
      expandedAttachments.value[taskId] = !expandedAttachments.value[taskId];
    };

    const handleTaskAttachmentUpload = async (task, event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        return tg.showAlert("File is too large! Maximum attachment size is 5MB.");
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const dataUrl = e.target.result;
          const updated = await apiCall(`/tasks/${task._id}/attachments`, 'POST', {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            data: dataUrl
          });
          task.attachments = updated.attachments;
          if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
          showToast(`📎 Attached ${file.name}`);
        } catch (err) {
          showToast("❌ " + err.message);
        }
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    };

    const deleteTaskAttachmentAction = async (task, att) => {
      try {
        await apiCall(`/tasks/${task._id}/attachments/${att._id}`, 'DELETE');
        task.attachments = task.attachments.filter(a => a._id !== att._id);
        showToast("Attachment removed");
      } catch (err) {
        showToast("❌ " + err.message);
      }
    };

    // Multi-Select & Bulk Actions
    const isTaskSelected = (id) => selectedTaskIds.value.includes(id);

    const toggleSelectTask = (id) => {
      const idx = selectedTaskIds.value.indexOf(id);
      if (idx > -1) {
        selectedTaskIds.value.splice(idx, 1);
      } else {
        selectedTaskIds.value.push(id);
      }
    };

    const selectAllFilteredTasks = () => {
      if (selectedTaskIds.value.length === filteredTasks.value.length) {
        selectedTaskIds.value = [];
      } else {
        selectedTaskIds.value = filteredTasks.value.map(t => t._id);
      }
    };

    const clearSelectedTasks = () => {
      selectedTaskIds.value = [];
    };

    const executeTaskBulkAction = async (action, value = null) => {
      if (!selectedTaskIds.value.length) return;
      try {
        await apiCall('/tasks/bulk', 'POST', {
          ids: selectedTaskIds.value,
          action,
          value
        });
        selectedTaskIds.value = [];
        await loadTasks();
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        showToast(`Bulk ${action} completed`);
      } catch (err) {
        showToast("❌ " + err.message);
      }
    };

    // Helpers
    const formatEstimate = (mins) => {
      if (!mins || mins <= 0) return '';
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h === 0) return `${m}m`;
      if (m === 0) return `${h}h`;
      return `${h}h ${m}m`;
    };

    const formatRelativeDue = (dueDate, dueTime) => {
      if (!dueDate) return '';
      const todayStr = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).toISOString().slice(0, 10);
      const d = dueDate.slice(0, 10);
      const diffMs = new Date(d) - new Date(todayStr);
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const timePart = dueTime ? ` at ${dueTime}` : '';
      if (diffDays === 0) return `Today${timePart}`;
      if (diffDays === 1) return `Tomorrow${timePart}`;
      if (diffDays === -1) return `Yesterday${timePart}`;
      if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
      return `In ${diffDays}d${timePart}`;
    };

    const allTags = computed(() => {
      const tagSet = new Set();
      tasks.value.forEach(t => {
        if (Array.isArray(t.tags)) {
          t.tags.forEach(tag => tagSet.add(tag));
        }
      });
      return Array.from(tagSet);
    });

    const progressPercentage = computed(() => {
      if (!taskStats.value.total) return 0;
      return Math.round((taskStats.value.completed / taskStats.value.total) * 100);
    });

    const overdueTasksCount = computed(() => {
      const todayStr = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).toISOString().slice(0, 10);
      return tasks.value.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && t.dueDate && t.dueDate.slice(0, 10) < todayStr).length;
    });

    const priorityWeights = { urgent: 4, high: 3, medium: 2, low: 1 };

    const filteredTasks = computed(() => {
      let list = [...tasks.value];
      const todayStr = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).toISOString().slice(0, 10);

      // Search filter
      if (taskSearch.value && taskSearch.value.trim()) {
        const q = taskSearch.value.trim().toLowerCase();
        list = list.filter(t => {
          const matchTitle = (t.title || '').toLowerCase().includes(q);
          const matchDesc = (t.description || '').toLowerCase().includes(q);
          const matchAssignee = (t.assignee || '').toLowerCase().includes(q);
          const matchTags = Array.isArray(t.tags) && t.tags.some(tag => tag.toLowerCase().includes(q));
          return matchTitle || matchDesc || matchAssignee || matchTags;
        });
      }

      // Status filter
      if (taskFilter.value === 'pending' || taskFilter.value === 'active') {
        list = list.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && !t.completed);
      } else if (taskFilter.value === 'completed') {
        list = list.filter(t => t.status === 'completed' || t.completed === true);
      } else if (taskFilter.value === 'overdue') {
        list = list.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && !t.completed && t.dueDate && t.dueDate.slice(0, 10) < todayStr);
      }

      // Priority filter
      if (taskPriorityFilter.value && taskPriorityFilter.value !== 'all') {
        list = list.filter(t => t.priority === taskPriorityFilter.value);
      }

      // Tag filter
      if (taskTagFilter.value && taskTagFilter.value !== 'all') {
        list = list.filter(t => Array.isArray(t.tags) && t.tags.includes(taskTagFilter.value));
      }

      // Sort: pinned float to top always!
      list.sort((a, b) => {
        const aPinned = !!a.pinned;
        const bPinned = !!b.pinned;
        if (aPinned !== bPinned) {
          return aPinned ? -1 : 1;
        }

        if (taskSortField.value === 'dueDate') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        } else if (taskSortField.value === 'priority') {
          const wa = priorityWeights[a.priority] || 0;
          const wb = priorityWeights[b.priority] || 0;
          return wb - wa;
        } else if (taskSortField.value === 'title') {
          return (a.title || '').localeCompare(b.title || '');
        } else if (taskSortField.value === 'createdAt') {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        } else {
          // Manual ordering
          return (a.order ?? 0) - (b.order ?? 0);
        }
      });

      return list;
    });

    const deleteTemplate = async () => {
      tg.showConfirm("Delete this template?", async (ok) => {
        if (!ok) return;
        saving.value = true;
        try {
          await apiCall(`/templates/${tplForm.value._id}`, 'DELETE');
          await loadData();
          currentTab.value = 'templates';
          showToast("Template deleted");
        } catch (e) {
          tg.showAlert(e.message);
        } finally {
          saving.value = false;
        }
      });
    };

    // Live AI Wish Preview & Sender Modal
    const openWishModal = async (member, type = 'birthday', style = 'pastoral') => {
      wishModal.value = {
        open: true,
        loading: true,
        sending: false,
        member,
        type,
        style,
        text: '',
        photo: member.photo || null,
        cardDataUrl: null,
        cardGenerating: false
      };

      try {
        const res = await apiCall('/actions/preview-wish', 'POST', {
          memberId: member._id,
          type,
          style,
          forceNew: true
        });
        wishModal.value.text = res.preview;
        wishModal.value.photo = res.photo;
      } catch (err) {
        wishModal.value.text = `இனிய ${type === 'birthday' ? 'பிறந்தநாள்' : 'திருமண நாள்'} வாழ்த்துகள், ${member.name}!`;
      } finally {
        wishModal.value.loading = false;
      }
    };

    const regenerateWish = async (newStyle) => {
      const style = newStyle || wishModal.value.style || 'pastoral';
      wishModal.value.style = style;
      wishModal.value.loading = true;
      wishModal.value.cardDataUrl = null;
      try {
        const res = await apiCall('/actions/preview-wish', 'POST', {
          memberId: wishModal.value.member?._id,
          type: wishModal.value.type,
          style,
          forceNew: true
        });
        if (res && res.preview) {
          wishModal.value.text = res.preview;
          if (res.photo) wishModal.value.photo = res.photo;
          showToast("✨ Fresh greeting card generated!");
        } else {
          showToast("⚠️ Could not generate fresh wish");
        }
      } catch (err) {
        showToast("⚠️ " + (err.message || "Failed to regenerate wish"));
      } finally {
        wishModal.value.loading = false;
      }
    };

    const copyWishToClipboard = async () => {
      if (!wishModal.value.text) return;
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(wishModal.value.text);
          showToast("📋 Copied to clipboard! Ready to paste into WhatsApp.");
        } else {
          showToast("📋 Select and copy the text box above.");
        }
      } catch (err) {
        showToast("📋 Select and copy the text box above.");
      }
    };

    const openWhatsAppWish = () => {
      if (!wishModal.value.text) return;
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      const encoded = encodeURIComponent(wishModal.value.text);
      const url = `https://api.whatsapp.com/send?text=${encoded}`;
      if (tg.openTelegramLink && tg.openLink) {
        tg.openLink(url);
      } else {
        window.open(url, '_blank');
      }
    };

    const generateStatusCardAction = async () => {
      if (!wishModal.value.text) return;
      wishModal.value.cardGenerating = true;
      try {
        const { generateCelebrationCard } = await import('/js/canvasCardGenerator.js');
        const pUrl = wishModal.value.member?._id ? photoUrl(wishModal.value.member._id) : null;
        const dataUrl = await generateCelebrationCard({
          member: wishModal.value.member,
          type: wishModal.value.type,
          text: wishModal.value.text,
          photoSrc: pUrl
        });
        wishModal.value.cardDataUrl = dataUrl;
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        showToast("🎨 Status card generated!");
      } catch (err) {
        showToast("⚠️ Could not generate card: " + (err.message || err));
      } finally {
        wishModal.value.cardGenerating = false;
      }
    };

    const downloadStatusCardAction = () => {
      if (!wishModal.value.cardDataUrl) return;
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
      const a = document.createElement('a');
      a.href = wishModal.value.cardDataUrl;
      const safeName = (wishModal.value.member?.name || 'celebrant').replace(/\s+/g, '_');
      a.download = `SPBC_${safeName}_${wishModal.value.type}_Card.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("📥 Celebratory Card downloaded!");
    };

    // Bulk CSV Import
    const openImportModal = () => {
      importModal.value = {
        open: true,
        parsing: false,
        importing: false,
        parsedMembers: [],
        error: ''
      };
    };

    const parseCSVFile = (event) => {
      const file = event.target.files[0];
      if (!file) return;

      importModal.value.parsing = true;
      importModal.value.error = '';

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
          if (lines.length < 2) throw new Error("CSV has no data rows");

          const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\"\']/g, ''));
          const parsed = [];

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^[\"\']|[\"\']$/g, ''));
            if (!cols[0]) continue;

            const row = {};
            headers.forEach((h, idx) => {
              row[h] = cols[idx] || '';
            });

            parsed.push({
              name: row.name || cols[0],
              gender: (row.gender || cols[1] || 'male').toLowerCase().includes('f') ? 'female' : 'male',
              role: row.role || cols[2] || 'Member',
              dob: row.dob || row.birthday || '',
              weddingDate: row.weddingdate || row.anniversary || '',
              isMarried: Boolean(row.ismarried === 'true' || row.spouse || row.weddingdate),
              spouseName: row.spousename || row.spouse || '',
              familyName: row.familyname || row.family || ''
            });
          }

          importModal.value.parsedMembers = parsed;
          showToast(`✅ Parsed ${parsed.length} members`);
        } catch (err) {
          importModal.value.error = "Failed to parse CSV: " + err.message;
        } finally {
          importModal.value.parsing = false;
        }
      };
      reader.readAsText(file);
    };

    const executeBulkImport = async () => {
      if (!importModal.value.parsedMembers.length) return;
      importModal.value.importing = true;
      try {
        const res = await apiCall('/members/import', 'POST', { members: importModal.value.parsedMembers });
        await loadData();
        importModal.value.open = false;
        showToast(`🎉 Imported ${res.count} members!`);
      } catch (err) {
        importModal.value.error = err.message;
      } finally {
        importModal.value.importing = false;
      }
    };

    // System Settings & Actions
    const saveSettings = async () => {
      saving.value = true;
      try {
        await apiCall('/settings', 'POST', settings.value);
        showToast('Settings saved successfully');
      } catch (e) {
        tg.showAlert(e.message);
      } finally {
        saving.value = false;
      }
    };

    const testGeminiKey = async () => {
      testingGemini.value = true;
      try {
        const res = await apiCall('/actions/test-gemini', 'POST', { apiKey: settings.value.geminiApiKey });
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        showToast('✅ ' + (res.message || 'Gemini API Connected!'));
      } catch (err) {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        showToast('❌ ' + (err.message || 'Gemini connection failed'));
      } finally {
        testingGemini.value = false;
      }
    };

    const triggerAction = async (act) => {
      triggering.value = true;
      try {
        const res = await apiCall(`/actions/${act}`, 'POST');
        if (act === 'trigger-today') {
          showToast(`Success: Prepared ${res.count} celebrations for Admin Review!`);
        } else {
          showToast("🔔 Ping sent to Admin chat!");
        }
      } catch (e) {
        tg.showAlert(e.message);
      } finally {
        triggering.value = false;
      }
    };

    const exportCSV = async () => {
      try {
        const token = authToken.value || getTgInitData() || '';
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/export', {
          credentials: 'same-origin',
          headers
        });
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "church_database.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast("📥 Database downloaded");
      } catch (e) {
        tg.showAlert(e.message || "Export failed");
      }
    };

    const openDirectory = async () => {
      try {
        const token = authToken.value || getTgInitData() || '';
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/directory', {
          credentials: 'same-origin',
          headers
        });
        if (!res.ok) throw new Error('Failed to load directory');
        const html = await res.text();
        const win = window.open('', '_blank');
        if (win) {
          win.document.open();
          win.document.write(html);
          win.document.close();
        } else {
          showToast('Popup blocked. Please allow popups.');
        }
      } catch (e) {
        tg.showAlert(e.message || 'Failed to open directory');
      }
    };

    // System Error Logs Management
    const loadErrorLogs = async () => {
      errorLoading.value = true;
      try {
        let url = `/errors?limit=50`;
        if (errorFilter.value === 'unresolved') url += `&resolved=false`;
        else if (errorFilter.value === 'resolved') url += `&resolved=true`;
        else if (['telegram', 'express', 'system'].includes(errorFilter.value)) url += `&source=${errorFilter.value}`;

        if (errorSearch.value.trim()) {
          url += `&search=${encodeURIComponent(errorSearch.value.trim())}`;
        }

        const res = await apiCall(url);
        errorLogs.value = res.logs || [];
        errorStats.value = {
          total: res.total || 0,
          unresolved: res.unresolvedCount || 0
        };
      } catch (e) {
        // Silently fail or minimal toast if error table is unavailable
      } finally {
        errorLoading.value = false;
      }
    };

    const resolveErrorLogAction = async (id) => {
      try {
        await apiCall(`/errors/${id}/resolve`, 'POST');
        const target = errorLogs.value.find(l => l._id === id);
        if (target) {
          target.resolved = true;
          target.resolvedBy = currentUser.value?.name || 'Admin';
          target.resolvedAt = new Date().toISOString();
        }
        if (errorStats.value.unresolved > 0) errorStats.value.unresolved--;
        showToast("✅ Error marked as resolved");
      } catch (e) {
        tg.showAlert(e.message);
      }
    };

    const deleteErrorLogAction = async (id) => {
      tg.showConfirm("Are you sure you want to delete this error log entry?", async (confirmed) => {
        if (!confirmed) return;
        try {
          await apiCall(`/errors/${id}`, 'DELETE');
          errorLogs.value = errorLogs.value.filter(l => l._id !== id);
          if (errorStats.value.total > 0) errorStats.value.total--;
          showToast("🗑 Error entry deleted");
        } catch (e) {
          tg.showAlert(e.message);
        }
      });
    };

    const clearResolvedErrorsAction = async () => {
      tg.showConfirm("Clear all resolved error logs from the database?", async (confirmed) => {
        if (!confirmed) return;
        try {
          const res = await apiCall('/errors/clear', 'POST', { onlyResolved: true });
          showToast(`🧹 Purged ${res.deletedCount || 0} resolved error entries`);
          await loadErrorLogs();
        } catch (e) {
          tg.showAlert(e.message);
        }
      });
    };

    const toggleErrorExpanded = (id) => {
      expandedErrorId.value = expandedErrorId.value === id ? null : id;
    };

    const copyErrorDetails = (err) => {
      const report = [
        `🚨 **Bug Report / Error Log Details**`,
        `- **Timestamp:** ${new Date(err.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
        `- **Source:** ${err.source.toUpperCase()}`,
        `- **Endpoint / Action:** \`${err.endpoint || 'N/A'}\``,
        `- **Status Code:** ${err.statusCode || 500}`,
        `- **User ID / Name:** ${err.userId || 'anonymous'} (${err.userName || 'N/A'})`,
        `- **Error Message:** \`${err.message}\``,
        ``,
        `**Stack Trace:**`,
        '```',
        err.stack || 'No stack trace captured',
        '```',
        ``,
        `**Context Payload:**`,
        '```json',
        JSON.stringify(err.context || {}, null, 2),
        '```'
      ].join('\n');

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(report)
          .then(() => showToast("📋 Error report copied to clipboard!"))
          .catch(() => tg.showAlert(report));
      } else {
        tg.showAlert(report);
      }
    };

    watch([errorFilter], () => {
      loadErrorLogs();
    });

    // Formatting Helpers
    const getInitials = (name) => {
      if (!name) return '??';
      return name.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase();
    };

    const avatarColors = ['#4f46e5', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0284c7'];
    const avatarStyle = (name = '') => {
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
      const color = avatarColors[Math.abs(hash) % avatarColors.length];
      return { backgroundColor: color };
    };

    const photoUrl = (id) => {
      return `/api/members/${id}/photo`;
    };

    const getCelebrationPill = (mmdd, isToday) => {
      if (isToday) return { label: 'Today 🎉', class: 'bg-emerald-500 text-white font-bold animate-pulse' };
      return { label: mmdd, class: 'bg-indigo-50 text-indigo-700 font-semibold' };
    };

    const getRoleBadge = (m) => {
      if (!m) return null;
      const roleName = (m.role || '').trim();
      const isPastor = Boolean(m.isPastor || /pastor/i.test(roleName));

      if (/associate pastor/i.test(roleName)) {
        return {
          label: 'Associate Pastor',
          class: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
        };
      }
      if (/pastor/i.test(roleName) || isPastor) {
        return {
          label: 'Pastor',
          class: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
        };
      }
      if (/treasurer/i.test(roleName)) {
        return {
          label: 'Treasurer',
          class: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
        };
      }
      if (/secretary/i.test(roleName)) {
        return {
          label: 'Secretary',
          class: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
        };
      }
      if (/elder/i.test(roleName)) {
        return {
          label: 'Elder',
          class: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
        };
      }
      if (/deacon/i.test(roleName)) {
        return {
          label: 'Deacon',
          class: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
        };
      }
      if (/worship/i.test(roleName)) {
        return {
          label: roleName,
          class: 'bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800'
        };
      }
      if (/youth/i.test(roleName)) {
        return {
          label: roleName,
          class: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
        };
      }
      if (/sunday school|teacher/i.test(roleName)) {
        return {
          label: 'Sunday School',
          class: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800'
        };
      }
      if (roleName && !/^member$/i.test(roleName)) {
        return {
          label: roleName,
          class: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        };
      }
      return null;
    };

    const formatEndpoint = (ep) => {
      if (!ep) return '';
      try {
        if (ep.startsWith('http://') || ep.startsWith('https://')) {
          const u = new URL(ep);
          return u.pathname || '/';
        }
      } catch (_) {}
      if (ep.includes('#tgWebAppData') || ep.includes('?')) {
        return ep.split('#')[0].split('?')[0] || ep;
      }
      return ep.length > 35 ? ep.substring(0, 32) + '...' : ep;
    };

    // ==========================================
    // DISASTER RECOVERY & BACKUP INTEGRITY
    // ==========================================
    const loadBackupHealth = async () => {
      try {
        const res = await fetch('/api/backup/health', {
          credentials: 'same-origin',
          headers: authHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.health) {
            backupHealth.value = data.health;
          }
        }
      } catch (_) {}
    };

    const runBackupVerificationAction = async () => {
      backupVerifying.value = true;
      try {
        const res = await fetch('/api/backup/verify', {
          method: 'POST',
          credentials: 'same-origin',
          headers: authHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.health) {
            backupHealth.value = data.health;
            showToast("🛡️ Backup Verified: 100% restorable & healthy");
          }
        } else {
          showToast("⚠️ Backup verification notice received");
        }
      } catch (err) {
        showToast("⚠️ Verification error: " + err.message);
      } finally {
        backupVerifying.value = false;
      }
    };

    // ==========================================
    // GLOBAL COMMAND PALETTE (Ctrl+K / ⌘K)
    // ==========================================
    const commandPaletteOpen = ref(false);
    const commandPaletteQuery = ref('');
    const commandPaletteSelectedIndex = ref(0);

    const openCommandPalette = () => {
      commandPaletteOpen.value = true;
      commandPaletteQuery.value = '';
      commandPaletteSelectedIndex.value = 0;
      nextTick(() => {
        const inp = document.getElementById('command-palette-input');
        if (inp) inp.focus();
      });
    };

    const closeCommandPalette = () => {
      commandPaletteOpen.value = false;
      commandPaletteQuery.value = '';
      commandPaletteSelectedIndex.value = 0;
    };

    const commandPaletteResults = computed(() => {
      const q = commandPaletteQuery.value.trim().toLowerCase();
      const results = [];

      // 1. Core Actions & Navigation
      const actions = [
        { id: 'act:add_member', title: 'Add New Member', subtitle: 'Add a new member to the church directory', icon: '👤', category: 'Action', action: () => openMemberForm() },
        { id: 'act:fast_entry', title: 'Fast Member Entry', subtitle: 'Quickly batch-add family members with presets', icon: '⚡', category: 'Action', action: () => openFastEntry() },
        { id: 'act:add_event', title: 'Schedule Church Event', subtitle: 'Add worship service, prayer vigil, or fellowship', icon: '📅', category: 'Action', action: () => openEventForm() },
        { id: 'act:add_task', title: 'Create Ministry Task', subtitle: 'Add a new administrative follow-up task', icon: '📋', category: 'Action', action: () => openTaskForm() },
        { id: 'act:import_csv', title: 'Import Members CSV', subtitle: 'Bulk import church member roster spreadsheet', icon: '📥', category: 'Action', action: () => openImportModal() },
        { id: 'act:export_csv', title: 'Export Members CSV', subtitle: 'Download church directory as UTF-8 CSV', icon: '📤', category: 'Action', action: () => exportCSV() },
        { id: 'act:export_ics', title: 'Export Church Calendar (.ics)', subtitle: 'Export RFC-compliant calendar feed', icon: '📆', category: 'Action', action: () => exportICS() },
        { id: 'act:tab_wishes', title: 'Wishes & Celebrations', subtitle: 'View today & upcoming birthdays and anniversaries', icon: '✨', category: 'Navigation', action: () => { currentTab.value = 'upcoming'; } },
        { id: 'act:tab_reports', title: 'Church Analytics & Reports', subtitle: 'Demographics, health score, and ratios', icon: '📊', category: 'Navigation', action: () => { currentTab.value = 'analytics'; } },
        { id: 'act:tab_settings', title: 'Church Settings & Logs', subtitle: 'Configure notification times and error logs', icon: '⚙️', category: 'Navigation', action: () => { currentTab.value = 'settings'; } },
        { id: 'act:toggle_theme', title: 'Toggle Light / Dark Mode', subtitle: 'Switch color theme', icon: isDark.value ? '☀️' : '🌙', category: 'Preference', action: () => toggleTheme() }
      ];

      if (!q) {
        return actions;
      }

      // Filter actions
      for (const act of actions) {
        if (act.title.toLowerCase().includes(q) || act.subtitle.toLowerCase().includes(q)) {
          results.push(act);
        }
      }

      // Filter members
      if (members.value && members.value.length > 0) {
        let memberMatches = 0;
        for (const m of members.value) {
          if (memberMatches >= 6) break;
          const nameMatch = m.name && m.name.toLowerCase().includes(q);
          const phoneMatch = m.phone && m.phone.includes(q);
          const familyMatch = m.familyName && m.familyName.toLowerCase().includes(q);
          const roleMatch = m.role && m.role.toLowerCase().includes(q);

          if (nameMatch || phoneMatch || familyMatch || roleMatch) {
            results.push({
              id: `mem:${m._id}`,
              title: m.name,
              subtitle: `${m.role || 'Member'}${m.phone ? ' • ' + m.phone : ''}${m.familyName ? ' • ' + m.familyName : ''}`,
              icon: '👤',
              category: 'Member',
              action: () => openMemberForm(m)
            });
            memberMatches++;
          }
        }
      }

      // Filter church events
      if (churchEvents.value && churchEvents.value.length > 0) {
        let eventMatches = 0;
        for (const ev of churchEvents.value) {
          if (eventMatches >= 4) break;
          if (ev.title?.toLowerCase().includes(q) || ev.category?.toLowerCase().includes(q) || ev.venue?.toLowerCase().includes(q)) {
            results.push({
              id: `ev:${ev._id}`,
              title: ev.title,
              subtitle: `📅 ${ev.startDate || 'Upcoming'}${ev.startTime ? ' at ' + ev.startTime : ''} • ${ev.category || 'Event'}`,
              icon: '📅',
              category: 'Event',
              action: () => openEventForm(ev)
            });
            eventMatches++;
          }
        }
      }

      // Filter tasks
      if (tasks.value && tasks.value.length > 0) {
        let taskMatches = 0;
        for (const t of tasks.value) {
          if (taskMatches >= 4) break;
          if (t.title?.toLowerCase().includes(q) || t.assignee?.toLowerCase().includes(q) || (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))) {
            results.push({
              id: `task:${t._id}`,
              title: t.title,
              subtitle: `Priority: ${t.priority || 'medium'} • Due: ${t.dueDate || 'No date'} • Assignee: ${t.assignee || 'Admin'}`,
              icon: '📋',
              category: 'Task',
              action: () => openTaskForm(t)
            });
            taskMatches++;
          }
        }
      }

      return results;
    });

    const executeCommandPaletteItem = (item) => {
      if (!item) return;
      closeCommandPalette();
      if (typeof item.action === 'function') {
        item.action();
      }
    };

    const navigateCommandPalette = (delta) => {
      const len = commandPaletteResults.value.length;
      if (len === 0) return;
      commandPaletteSelectedIndex.value = (commandPaletteSelectedIndex.value + delta + len) % len;
    };

    return {
      loadData,
      isDark, toggleTheme,
      authToken, csrfToken, authModalOpen, authInputKey, authError, authVerifying, verifyAndSavePasscode, logoutStandalone, goToAdminLogin, isInTelegram,
      currentTab, memberView, members, templates, upcomingEvents, churchEvents, tasks, churchStats, dataQuality, settings,
      search, memberFilter, sortBy, selectedIds,
      loading, saving, triggering, toastMessage, showToast, dataLoadError,
      form, tplForm, wishModal, importModal, eventForm, taskForm,
      eventModalOpen, taskModalOpen, eventFilter, taskFilter,
      totalCount, activeCount, marriedCount, celebrationsCount, overdueTasksCount,
      filteredMembers, groupedFamilies, structuredFamilies, householdStats, filteredChurchEvents, filteredTasks,
      selectAll, bulkAction, openMemberForm, addFamilyMember, openFamilyWhatsApp, saveMember, archiveMember, restoreMember,
      openTemplateForm, saveTemplate, deleteTemplate, insertVariable,
      openEventForm, saveEvent, deleteEvent, exportICS,
      openTaskForm, saveTask, deleteTask, toggleTaskComplete, updateTaskStatus,
      taskStats, taskSearch, taskPriorityFilter, taskTagFilter, taskSortField, taskSortOrder,
      quickAddText, quickAddPriority, quickAddSubmitting, executeQuickAdd,
      selectedTaskIds, isTaskSelected, toggleSelectTask, selectAllFilteredTasks, clearSelectedTasks, executeTaskBulkAction,
      expandedSubtasks, toggleSubtasksExpanded, taskSubtaskInputs, addSubtaskAction, toggleSubtaskAction, deleteSubtaskAction,
      expandedNotes, toggleNotesExpanded, taskNoteInputs, addNoteAction, deleteNoteAction,
      expandedAttachments, toggleAttachmentsExpanded, handleTaskAttachmentUpload, deleteTaskAttachmentAction,
      toggleTaskPinAction, loadTasks, addTagToForm, removeTagFromForm, addSubtaskToForm, removeSubtaskFromForm,
      formatEstimate, formatRelativeDue, allTags, progressPercentage,
      openWishModal, regenerateWish, copyWishToClipboard, openWhatsAppWish, generateStatusCardAction, downloadStatusCardAction,
      openImportModal, parseCSVFile, executeBulkImport,
      handlePhotoFileInput, calendarMonth, calendarMonthDays, shiftCalendarMonth, mergeMemberAction,
      fastForm, retainHousehold, fastSessionMembers, fastSaving, existingFamilies, existingRoles,
      handleAgeEstimateChange, setFastPrefix, setFastRole, resetFastForm, openFastEntry, saveFastMember,
      saveSettings, testGeminiKey, testingGemini, triggerAction, exportCSV, openDirectory,
      errorLogs, errorStats, errorLoading, errorFilter, errorSearch, expandedErrorId,
      loadErrorLogs, resolveErrorLogAction, deleteErrorLogAction, clearResolvedErrorsAction, toggleErrorExpanded, copyErrorDetails,
      authorizedUsers, superAdminId, currentUser, activeInviteUrl, generatingInvite,
      userModalOpen, isEditingUser, userSaving, inviteModalOpen, inviteRole, inviteHours,
      userFilter, userSearch, userForm, filteredAuthorizedUsers,
      activeUsersCount, pendingUsersCount, suspendedUsersCount,
      openAddUserModal, openEditUserModal, onUserRoleChange, saveUserAction, deleteUserAction, toggleUserStatusAction, openInviteModal,
      loadUsers, generateInviteLink, copyInviteLink, shareInviteWhatsApp, approveUserAction, revokeUserAction,
      getAge, computeAge, getInitials, avatarStyle, photoUrl, getCelebrationPill, getRoleBadge, formatEndpoint,
      commandPaletteOpen, commandPaletteQuery, commandPaletteResults, commandPaletteSelectedIndex,
      openCommandPalette, closeCommandPalette, executeCommandPaletteItem, navigateCommandPalette,
      isOfflineMode, offlineCacheTime, backupHealth, backupVerifying, loadBackupHealth, runBackupVerificationAction
    };
  }
});

// Telemetry: report errors from client to server database for CMS inspection
const sendClientError = (err, info = '') => {
  try {
    const msg = err?.message || String(err || '');
    if (msg.includes('WebAppMethodUnsupported')) return;
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        stack: err?.stack || '',
        info,
        userAgent: navigator.userAgent,
        url: window.location.pathname || '/'
      })
    }).catch(() => {});
  } catch (_) {}
};

// Resilient Vue global error handler to prevent blank screen failures
app.config.errorHandler = (err, instance, info) => {
  const errMsg = err?.message || String(err);
  if (errMsg.includes('WebAppMethodUnsupported')) {
    console.warn("ℹ️ Ignored unsupported Telegram client feature:", errMsg);
    return;
  }
  console.error("💥 [VUE ERROR]:", err, info);
  sendClientError(err, `Vue errorHandler (${info})`);
  try {
    if (instance?.showToast) {
      instance.showToast("⚠️ " + (err?.message || "UI Error occurred"));
    }
  } catch (_) {}
};

window.addEventListener("unhandledrejection", (event) => {
  const reasonMsg = event?.reason?.message || String(event?.reason);
  if (reasonMsg.includes('WebAppMethodUnsupported')) {
    console.warn("ℹ️ Ignored unsupported Telegram client feature:", reasonMsg);
    event.preventDefault();
    return;
  }
  console.error("💥 [UNHANDLED REJECTION in WebApp]:", event.reason);
  sendClientError(event.reason, "unhandledrejection");
});

window.addEventListener("error", (event) => {
  const errMsg = event?.error?.message || event?.message || String(event?.error);
  if (errMsg.includes('WebAppMethodUnsupported')) {
    console.warn("ℹ️ Ignored unsupported Telegram client feature:", errMsg);
    return;
  }
  console.error("💥 [GLOBAL ERROR in WebApp]:", event.error);
  sendClientError(event.error || event.message, "global error");
  // Guarantee preloader does not trap user on runtime errors
  const p = document.getElementById('preloader');
  if (p) p.style.display = 'none';
});

try {
  app.mount('#app');
} catch (mountErr) {
  console.error("💥 [VUE MOUNT ERROR]:", mountErr);
  sendClientError(mountErr, "app.mount");
  const p = document.getElementById('preloader');
  if (p) p.style.display = 'none';
}

// Smoothly dismiss preloader once app has mounted
const preloader = document.getElementById('preloader');
if (preloader) {
  preloader.style.opacity = '0';
  setTimeout(() => {
    if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader);
  }, 250);
}

