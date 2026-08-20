const { createApp, ref, computed, onMounted, watch } = Vue;

const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

createApp({
  setup() {
    const currentTab = ref('members');
    
    // Telegram BackButton Logic
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
    
    const members = ref([]);
    const templates = ref([]);
    const settings = ref({ sendTime: '06:00', reminderTime: '20:00', enableBirthdays: true, enableWeddings: true, customFields: [] });
    
    const search = ref('');
    const memberFilter = ref('active');
    const selectedIds = ref([]);
    
    const loading = ref(true);
    const saving = ref(false);
    const triggering = ref(false);
    const error = ref('');

    const defaultForm = () => ({ name: '', gender: 'male', role: '', dob: '', weddingDate: '', familyName: '', isChild: false, isActive: true, customData: {} });
    const form = ref(defaultForm());
    
    const defaultTplForm = () => ({ type: 'birthday', category: 'formal', content: '' });
    const tplForm = ref(defaultTplForm());

    const apiCall = async (url, method = 'GET', body = null) => {
      const opts = { method, headers: { 'Authorization': `Bearer ${tg.initData}` } };
      if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(`/api${url}`, opts);
      if (!res.ok) {
        /* Surface the server's message — validation errors say what was wrong. */
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || `Request failed (${res.status})`);
      }
      return await res.json();
    };

        const loadData = async () => {
      // Optimistic cache load
      const cacheM = localStorage.getItem('cache_members');
      const cacheT = localStorage.getItem('cache_templates');
      const cacheS = localStorage.getItem('cache_settings');
      if (cacheM) members.value = JSON.parse(cacheM);
      if (cacheT) templates.value = JSON.parse(cacheT);
      if (cacheS) settings.value = JSON.parse(cacheS);
      
      if (!cacheM) loading.value = true;
      try {
        const [mRes, tRes, sRes] = await Promise.all([
          apiCall('/members'),
          apiCall('/templates'),
          apiCall('/settings')
        ]);
        members.value = mRes;
        templates.value = tRes;
        settings.value = sRes;
        
        localStorage.setItem('cache_members', JSON.stringify(mRes));
        localStorage.setItem('cache_templates', JSON.stringify(tRes));
        localStorage.setItem('cache_settings', JSON.stringify(sRes));
      } catch (err) {
        error.value = "Failed to load database. Are you the admin?";
      } finally {
        loading.value = false;
      }
    };

    onMounted(loadData);

    const filteredMembers = computed(() => {
      let filtered = members.value;
      if (memberFilter.value === 'active') filtered = filtered.filter(m => m.isActive !== false);
      if (memberFilter.value === 'inactive') filtered = filtered.filter(m => m.isActive === false);
      if (search.value) {
        const s = search.value.toLowerCase();
        filtered = filtered.filter(m => m.name.toLowerCase().includes(s) || (m.role || '').toLowerCase().includes(s) || (m.familyName || '').toLowerCase().includes(s));
      }
      return filtered;
    });

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
          tg.HapticFeedback.notificationOccurred('success');
        } catch (e) {
          tg.showAlert(e.message);
        }
      });
    };

    const openMemberForm = (m = null) => {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      form.value = m ? { ...m, customData: m.customData || {} } : defaultForm();
      currentTab.value = 'memberForm';
    };

    const saveMember = async () => {
      if (!form.value.name) return tg.showAlert("Name is required!");
      saving.value = true;
      try {
        await apiCall(form.value._id ? `/members/${form.value._id}` : '/members', form.value._id ? 'PUT' : 'POST', form.value);
        await loadData();
        currentTab.value = 'members';
        tg.HapticFeedback.notificationOccurred('success');
      } catch (e) {
        tg.showAlert(e.message);
      } finally {
        saving.value = false;
      }
    };

    const openTemplateForm = (t = null) => {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      tplForm.value = t ? { ...t } : defaultTplForm();
      currentTab.value = 'templateForm';
    };

    const saveTemplate = async () => {
      if (!tplForm.value.content) return tg.showAlert("Content is required!");
      saving.value = true;
      try {
        await apiCall(tplForm.value._id ? `/templates/${tplForm.value._id}` : '/templates', tplForm.value._id ? 'PUT' : 'POST', tplForm.value);
        await loadData();
        currentTab.value = 'templates';
        tg.HapticFeedback.notificationOccurred('success');
      } catch (e) {
        tg.showAlert(e.message);
      } finally {
        saving.value = false;
      }
    };

    const deleteTemplate = async () => {
      tg.showConfirm("Delete this template?", async (ok) => {
        if (!ok) return;
        saving.value = true;
        try {
          await apiCall(`/templates/${tplForm.value._id}`, 'DELETE');
          await loadData();
          currentTab.value = 'templates';
          tg.HapticFeedback.notificationOccurred('success');
        } catch (e) {
          tg.showAlert(e.message);
        } finally {
          saving.value = false;
        }
      });
    };

    const saveSettings = async () => {
      saving.value = true;
      try {
        await apiCall('/settings', 'POST', settings.value);
        tg.HapticFeedback.notificationOccurred('success');
        tg.showAlert("Settings saved! Schedule updated.");
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
        tg.HapticFeedback.notificationOccurred('success');
        if (act === 'trigger-today') {
          tg.showAlert(`Success! ${res.count} messages were sent to the group.`);
        } else {
          tg.showAlert("Success! Ping sent.");
        }
      } catch (e) {
        tg.showAlert(e.message);
      } finally {
        triggering.value = false;
      }
    };

        const exportCSV = async () => {
      triggering.value = true;
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
      } catch (e) {
        tg.showAlert(e.message);
      } finally {
        triggering.value = false;
      }
    };
    const getInitials = (name) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const avatarStyle = (name) => {
      const colors = ['#ef4444', '#f97316', '#8b5cf6', '#06b6d4', '#10b981', '#3b82f6'];
      const idx = name.charCodeAt(0) % colors.length;
      return { backgroundColor: colors[idx] };
    };

    /* The photo endpoint is admin-only; an <img> tag cannot send an
       Authorization header, so the signed initData rides along as a param. */
    const photoUrl = (id) => `/api/members/${id}/photo?auth=${encodeURIComponent(tg.initData)}`;

    return {
      currentTab, members, templates, search, memberFilter, loading, saving, error, triggering,
      form, tplForm, filteredMembers, settings, selectedIds,
      selectAll, bulkAction, saveSettings, triggerAction, exportCSV,
      openMemberForm, saveMember,
      openTemplateForm, saveTemplate, deleteTemplate,
      getInitials, avatarStyle, photoUrl
    };
  }
}).mount('#app');
