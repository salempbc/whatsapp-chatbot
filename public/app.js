const { createApp, ref, computed, onMounted, watch } = Vue;

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

createApp({
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
    
    // Telegram BackButton integration
    watch(currentTab, (newTab) => {
      if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
      if (['memberForm', 'templateForm'].includes(newTab)) {
        tg.BackButton.show();
      } else {
        tg.BackButton.hide();
      }
    });

    tg.onEvent('backButtonClicked', () => {
      if (currentTab.value === 'memberForm') currentTab.value = 'members';
      else if (currentTab.value === 'templateForm') currentTab.value = 'templates';
    });

    // Core Data Collections
    const members = ref([]);
    const templates = ref([]);
    const upcomingEvents = ref({ birthdays: [], weddings: [] });
    const churchEvents = ref([]);
    const tasks = ref([]);
    const churchStats = ref(null);
    const dataQuality = ref(null);
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
    let toastTimeout = null;

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

    // Live AI Wish Preview & Sender Modal
    const wishModal = ref({
      open: false,
      loading: false,
      sending: false,
      member: null,
      type: 'birthday',
      text: '',
      photo: null
    });

    // Bulk CSV Import Modal
    const importModal = ref({
      open: false,
      parsing: false,
      importing: false,
      parsedMembers: [],
      error: ''
    });

    // API Helper
    const apiCall = async (url, method = 'GET', body = null) => {
      const opts = {
        method,
        headers: { 'Authorization': `Bearer ${tg.initData}` }
      };
      if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(`/api${url}`, opts);
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || `Request failed (${res.status})`);
      }
      return await res.json();
    };

    // Load All Data
    const loadData = async () => {
      loading.value = true;
      try {
        const [mRes, tRes, sRes, uRes, eRes, taskRes, statsRes, dqRes] = await Promise.all([
          apiCall('/members').catch(() => []),
          apiCall('/templates').catch(() => []),
          apiCall('/settings').catch(() => ({ sendTime: '06:00', reminderTime: '20:00', customFields: [] })),
          apiCall('/upcoming?days=30').catch(() => ({ birthdays: [], weddings: [] })),
          apiCall('/events').catch(() => []),
          apiCall('/tasks').catch(() => []),
          apiCall('/reports/stats').catch(() => null),
          apiCall('/reports/data-quality').catch(() => null)
        ]);
        members.value = mRes;
        templates.value = tRes;
        settings.value = sRes;
        upcomingEvents.value = uRes;
        churchEvents.value = eRes;
        tasks.value = taskRes;
        churchStats.value = statsRes;
        dataQuality.value = dqRes;
      } catch (err) {
        showToast("⚠️ Could not load data.");
      } finally {
        loading.value = false;
      }
    };

    onMounted(loadData);

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

    // Grouped Family Units
    const groupedFamilies = computed(() => {
      const groups = {};
      for (const m of filteredMembers.value) {
        const famName = m.familyName?.trim() || 'General Roster';
        if (!groups[famName]) groups[famName] = [];
        groups[famName].push(m);
      }
      return groups;
    });

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
    const eventModalOpen = ref(false);
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
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      if (eventFilter.value === 'upcoming') {
        list = list.filter(e => new Date(e.startDate) >= now);
      } else if (eventFilter.value === 'past') {
        list = list.filter(e => new Date(e.startDate) < now);
      }
      return list.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    });

    // Task Management
    const defaultTaskForm = () => ({
      title: '',
      category: 'general',
      priority: 'medium',
      status: 'todo',
      dueDate: '',
      assignee: 'Admin'
    });
    const taskForm = ref(defaultTaskForm());
    const taskModalOpen = ref(false);
    const taskFilter = ref('all'); // 'all', 'pending', 'completed', 'overdue'

    const openTaskForm = (item = null) => {
      if (item) {
        taskForm.value = {
          _id: item._id,
          title: item.title || '',
          category: item.category || 'general',
          priority: item.priority || 'medium',
          status: item.status || 'todo',
          dueDate: item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : '',
          assignee: item.assignee || 'Admin'
        };
      } else {
        taskForm.value = defaultTaskForm();
      }
      taskModalOpen.value = true;
    };

    const saveTask = async () => {
      if (!taskForm.value.title) return tg.showAlert("Task title is required!");
      saving.value = true;
      try {
        await apiCall(taskForm.value._id ? `/tasks/${taskForm.value._id}` : '/tasks', taskForm.value._id ? 'PUT' : 'POST', taskForm.value);
        await loadData();
        taskModalOpen.value = false;
        taskForm.value = defaultTaskForm();
        showToast("Task saved");
      } catch (e) {
        tg.showAlert(e.message);
      } finally {
        saving.value = false;
      }
    };

    const toggleTaskComplete = async (t) => {
      const newStatus = t.status === 'completed' ? 'todo' : 'completed';
      try {
        await apiCall(`/tasks/${t._id}`, 'PUT', { status: newStatus });
        await loadData();
        showToast(newStatus === 'completed' ? "Task marked completed!" : "Task reopened");
      } catch (e) {
        tg.showAlert(e.message);
      }
    };

    const deleteTask = async (id) => {
      tg.showConfirm("Are you sure you want to delete this task?", async (ok) => {
        if (!ok) return;
        try {
          await apiCall(`/tasks/${id}`, 'DELETE');
          await loadData();
          showToast("Task deleted");
        } catch (e) {
          tg.showAlert(e.message);
        }
      });
    };

    const overdueTasksCount = computed(() => {
      const now = new Date();
      return tasks.value.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && t.dueDate && new Date(t.dueDate) < now).length;
    });

    const filteredTasks = computed(() => {
      let list = [...tasks.value];
      const now = new Date();

      if (taskFilter.value === 'pending') {
        list = list.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
      } else if (taskFilter.value === 'completed') {
        list = list.filter(t => t.status === 'completed');
      } else if (taskFilter.value === 'overdue') {
        list = list.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && t.dueDate && new Date(t.dueDate) < now);
      }
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
        const res = await fetch('/api/export', { headers: { 'Authorization': `Bearer ${tg.initData}` } });
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
      window.open(`/api/directory?auth=${encodeURIComponent(tg.initData)}`, '_blank');
    };

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

    const photoUrl = (id) => `/api/members/${id}/photo?auth=${encodeURIComponent(tg.initData)}`;

    const getCelebrationPill = (mmdd, isToday) => {
      if (isToday) return { label: 'Today 🎉', class: 'bg-emerald-500 text-white font-bold animate-pulse' };
      return { label: mmdd, class: 'bg-indigo-50 text-indigo-700 font-semibold' };
    };

    return {
      isDark, toggleTheme,
      currentTab, memberView, members, templates, upcomingEvents, churchEvents, tasks, churchStats, dataQuality, settings,
      search, memberFilter, sortBy, selectedIds,
      loading, saving, triggering, toastMessage, showToast,
      form, tplForm, wishModal, importModal, eventForm, taskForm,
      eventModalOpen, taskModalOpen, eventFilter, taskFilter,
      totalCount, activeCount, marriedCount, celebrationsCount, overdueTasksCount,
      filteredMembers, groupedFamilies, filteredChurchEvents, filteredTasks,
      selectAll, bulkAction, openMemberForm, saveMember, archiveMember, restoreMember,
      openTemplateForm, saveTemplate, deleteTemplate, insertVariable,
      openEventForm, saveEvent, deleteEvent, exportICS,
      openTaskForm, saveTask, deleteTask, toggleTaskComplete,
      openWishModal, copyWishToClipboard,
      openImportModal, parseCSVFile, executeBulkImport,
      saveSettings, triggerAction, exportCSV, openDirectory,
      getAge, getInitials, avatarStyle, photoUrl, getCelebrationPill
    };
  }
}).mount('#app');
