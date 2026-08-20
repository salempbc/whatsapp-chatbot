const { createApp, ref, computed, onMounted } = Vue;

const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

createApp({
  setup() {
    const currentTab = ref('members');
    
    const members = ref([]);
    const templates = ref([]);
    const settings = ref({ sendTime: '06:00', reminderTime: '20:00' });
    
    const search = ref('');
    const memberFilter = ref('active');
    const selectedIds = ref([]);
    
    const loading = ref(true);
    const saving = ref(false);
    const triggering = ref(false);
    const error = ref('');

    const defaultForm = () => ({ name: '', gender: 'male', role: '', dob: '', weddingDate: '', familyName: '', isChild: false, isActive: true });
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
      if (!res.ok) throw new Error("API Request Failed");
      return await res.json();
    };

    const loadData = async () => {
      loading.value = true;
      try {
        const [mRes, tRes, sRes] = await Promise.all([
          apiCall('/members'),
          apiCall('/templates'),
          apiCall('/settings')
        ]);
        members.value = mRes;
        templates.value = tRes;
        settings.value = sRes;
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
      form.value = m ? { ...m } : defaultForm();
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

    const getInitials = (name) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const avatarStyle = (name) => {
      const colors = ['#ef4444', '#f97316', '#8b5cf6', '#06b6d4', '#10b981', '#3b82f6'];
      const idx = name.charCodeAt(0) % colors.length;
      return { backgroundColor: colors[idx] };
    };

    return { 
      currentTab, members, templates, search, memberFilter, loading, saving, error, triggering,
      form, tplForm, filteredMembers, settings, selectedIds,
      selectAll, bulkAction, saveSettings, triggerAction,
      openMemberForm, saveMember, 
      openTemplateForm, saveTemplate, deleteTemplate,
      getInitials, avatarStyle
    };
  }
}).mount('#app');
