const { createApp, ref, computed, onMounted, watch, onErrorCaptured } = window.Vue || Vue || {};

const tg = window.Telegram?.WebApp || {
  expand: () => {},
  ready: () => {},
  initData: "",
  HapticFeedback: {
    impactOccurred: () => {},
    notificationOccurred: () => {},
    selectionChanged: () => {}
  },
  BackButton: { show: () => {}, hide: () => {} },
  onEvent: () => {},
  showAlert: (msg) => alert(msg),
  showConfirm: (msg, cb) => cb(confirm(msg))
};

try {
  tg.expand();
  tg.ready();
} catch (e) {}

if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=7').then((reg) => {
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
      customFields: []
    });

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
      if (direct && direct.length > 5) return direct;

      // 2. Parse from location.hash if present (#tgWebAppData=...)
      try {
        const hash = window.location.hash || '';
        if (hash.includes('tgWebAppData=')) {
          const hashClean = hash.startsWith('#') ? hash.slice(1) : hash;
          const params = new URLSearchParams(hashClean);
          const fromHash = params.get('tgWebAppData');
          if (fromHash && fromHash.length > 5) return fromHash;
        }
      } catch (_) {}

      // 3. Fallback: Telegram User ID from initDataUnsafe if inside Telegram
      const uid = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (uid) return String(uid);

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
      // 1. URL query parameter (?auth=... or ?token=...)
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('auth') || urlParams.get('token');
      if (urlToken) {
        localStorage.setItem('spbc_auth_token', urlToken);
        return urlToken;
      }

      // 2. Telegram WebApp initData or fallback user ID
      const initData = getTgInitData();
      if (initData && initData.length > 5) {
        localStorage.setItem('spbc_auth_token', initData);
        return initData;
      }

      // 3. Cached token in localStorage
      const stored = localStorage.getItem('spbc_auth_token') || '';
      if (stored) return stored;

      // 4. Telegram user ID from unsafe context
      const uid = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (uid) {
        const uidStr = String(uid);
        localStorage.setItem('spbc_auth_token', uidStr);
        return uidStr;
      }

      return '';
    };

    const authToken = ref(getStoredToken());
    const authModalOpen = ref(false);
    const authPasscode = ref('');
    const authError = ref('');
    const authVerifying = ref(false);

    // API Helper with network exception handling & request timeouts
    const apiCall = async (url, method = 'GET', body = null) => {
      // Always re-read initData dynamically (weba populates it after load)
      const token = authToken.value || getTgInitData() || localStorage.getItem('spbc_auth_token') || '';
      const opts = {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      };
      if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      let res;
      let timeoutId = null;
      try {
        if (typeof AbortController !== 'undefined') {
          const controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), 20000);
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

      if (res.status === 401 || res.status === 403) {
        // Only show auth modal if truly NOT in Telegram (standalone browser with no token)
        if (!isInTelegram()) {
          authModalOpen.value = true;
        }
      }
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || `Request failed (${res.status})`);
      }
      return await res.json().catch(() => ({}));
    };

    const verifyAndSavePasscode = async () => {
      if (!authPasscode.value || !authPasscode.value.trim()) {
        authError.value = 'Please enter your Admin Passcode or Secret';
        return;
      }
      authVerifying.value = true;
      authError.value = '';
      try {
        const candidate = authPasscode.value.trim();
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${candidate}`,
            'Content-Type': 'application/json'
          }
        });
        if (!res.ok) {
          throw new Error('Invalid Admin Passcode or Secret Key');
        }
        localStorage.setItem('spbc_auth_token', candidate);
        authToken.value = candidate;
        authModalOpen.value = false;
        authPasscode.value = '';
        showToast('🔓 Admin Verified Successfully');
        await loadData();
      } catch (err) {
        authError.value = err.message;
      } finally {
        authVerifying.value = false;
      }
    };

    const logoutStandalone = () => {
      localStorage.removeItem('spbc_auth_token');
      authToken.value = '';
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
        return tg.showAlert("Telegram ID is required (e.g. 7018241155)");
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
      const text = `✝️ Greetings! You are invited to join the Salem Primitive Baptist Church (SPBC) Bot as an authorized church leader.\n\nTap this link to activate your access:\n${activeInviteUrl.value}`;
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
        templates.value = Array.isArray(tRes) ? tRes : [];
        settings.value = sRes || { sendTime: '06:00', reminderTime: '20:00', customFields: [] };
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
        dataLoadError.value = "Unable to connect to server. Check your connection or tap Retry.";
        showToast("⚠️ Could not load data.");
      } finally {
        loading.value = false;
      }
    };

    onMounted(async () => {
      if (isInTelegram()) {
        // In Telegram: auth modal is strictly prohibited from opening
        authModalOpen.value = false;

        // Ensure token is retrieved from Telegram environment
        let token = getTgInitData();
        if (!token || token.length <= 5) {
          // Allow Telegram SDK handshake to settle if opening via native client
          await new Promise(r => setTimeout(r, 150));
          token = getTgInitData();
        }
        if (token) {
          authToken.value = token;
          localStorage.setItem('spbc_auth_token', token);
        } else {
          const uid = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
          if (uid) {
            authToken.value = String(uid);
            localStorage.setItem('spbc_auth_token', String(uid));
          }
        }
        authModalOpen.value = false;
        await loadData();
      } else if (authToken.value) {
        // Standalone browser with a saved token (ADMIN_ID or ADMIN_SECRET)
        authModalOpen.value = false;
        await loadData();
      } else {
        // Truly outside Telegram with no credentials - show passcode modal
        authModalOpen.value = true;
      }
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
      form.value = m ? { ...defaultForm(), ...m, customData: m.customData || {} } : defaultForm();
      currentTab.value = 'memberForm';
    };

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
      if (!form.value.name) return tg.showAlert("Full Name is required!");
      saving.value = true;
      try {
        if (!form.value._id) {
          // Pre-save duplicate collision inspection
          const dupRes = await apiCall('/members/check-duplicate', 'POST', form.value).catch(() => ({ duplicates: [] }));
          if (dupRes.duplicates && dupRes.duplicates.length > 0) {
            const firstDup = dupRes.duplicates[0];
            const proceed = confirm(`⚠️ Warning: Potential duplicate detected with "${firstDup.name}" (${firstDup.reason}).\n\nDo you want to proceed and save this new member profile?`);
            if (!proceed) {
              saving.value = false;
              return;
            }
          }
        }
        await apiCall(form.value._id ? `/members/${form.value._id}` : '/members', form.value._id ? 'PUT' : 'POST', form.value);
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

    const exportICS = () => {
      window.open(`/api/events/export/ics?auth=${encodeURIComponent(tg.initData)}`, '_blank');
      showToast("📅 Calendar (.ics) export initiated");
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
    const openWishModal = async (member, type = 'birthday') => {
      wishModal.value = {
        open: true,
        loading: true,
        sending: false,
        member,
        type,
        text: '',
        photo: member.photo || null
      };

      try {
        const res = await apiCall('/actions/preview-wish', 'POST', { memberId: member._id, type });
        wishModal.value.text = res.preview;
        wishModal.value.photo = res.photo;
      } catch (err) {
        wishModal.value.text = `இனிய ${type === 'birthday' ? 'பிறந்தநாள்' : 'திருமண நாள்'} வாழ்த்துகள், ${member.name}!`;
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
        const token = authToken.value || getStoredToken();
        const res = await fetch('/api/export', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "church_database.csv";
        a.click();
        window.URL.revokeObjectURL(url);
        showToast("📥 Database downloaded");
      } catch (e) {
        tg.showAlert(e.message);
      }
    };

    const openDirectory = () => {
      const token = authToken.value || getStoredToken();
      window.open(`/api/directory?auth=${encodeURIComponent(token)}`, '_blank');
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
      const token = authToken.value || getStoredToken();
      return `/api/members/${id}/photo?auth=${encodeURIComponent(token)}`;
    };

    const getCelebrationPill = (mmdd, isToday) => {
      if (isToday) return { label: 'Today 🎉', class: 'bg-emerald-500 text-white font-bold animate-pulse' };
      return { label: mmdd, class: 'bg-indigo-50 text-indigo-700 font-semibold' };
    };

    return {
      loadData,
      isDark, toggleTheme,
      authToken, authModalOpen, authPasscode, authError, authVerifying, verifyAndSavePasscode, logoutStandalone, goToAdminLogin, isInTelegram,
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
      openWishModal, copyWishToClipboard, openWhatsAppWish,
      openImportModal, parseCSVFile, executeBulkImport,
      handlePhotoFileInput, calendarMonth, calendarMonthDays, shiftCalendarMonth, mergeMemberAction,
      fastForm, retainHousehold, fastSessionMembers, fastSaving, existingFamilies, existingRoles,
      handleAgeEstimateChange, setFastPrefix, setFastRole, resetFastForm, openFastEntry, saveFastMember,
      saveSettings, triggerAction, exportCSV, openDirectory,
      errorLogs, errorStats, errorLoading, errorFilter, errorSearch, expandedErrorId,
      loadErrorLogs, resolveErrorLogAction, deleteErrorLogAction, clearResolvedErrorsAction, toggleErrorExpanded, copyErrorDetails,
      authorizedUsers, superAdminId, currentUser, activeInviteUrl, generatingInvite,
      userModalOpen, isEditingUser, userSaving, inviteModalOpen, inviteRole, inviteHours,
      userFilter, userSearch, userForm, filteredAuthorizedUsers,
      activeUsersCount, pendingUsersCount, suspendedUsersCount,
      openAddUserModal, openEditUserModal, onUserRoleChange, saveUserAction, deleteUserAction, toggleUserStatusAction, openInviteModal,
      loadUsers, generateInviteLink, copyInviteLink, shareInviteWhatsApp, approveUserAction, revokeUserAction,
      getAge, computeAge, getInitials, avatarStyle, photoUrl, getCelebrationPill
    };
  }
});

// Telemetry: report errors from client to server database for CMS inspection
const sendClientError = (err, info = '') => {
  try {
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: err?.message || String(err),
        stack: err?.stack || '',
        info,
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    }).catch(() => {});
  } catch (_) {}
};

// Resilient Vue global error handler to prevent blank screen failures
app.config.errorHandler = (err, instance, info) => {
  console.error("💥 [VUE ERROR]:", err, info);
  sendClientError(err, `Vue errorHandler (${info})`);
  try {
    if (instance?.showToast) {
      instance.showToast("⚠️ " + (err?.message || "UI Error occurred"));
    }
  } catch (_) {}
};

window.addEventListener("unhandledrejection", (event) => {
  console.error("💥 [UNHANDLED REJECTION in WebApp]:", event.reason);
  sendClientError(event.reason, "unhandledrejection");
});

window.addEventListener("error", (event) => {
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

