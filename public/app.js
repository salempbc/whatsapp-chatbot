const { createApp, ref, computed, onMounted } = Vue;

const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

createApp({
  setup() {
    const currentTab = ref('members'); // 'members', 'templates', 'memberForm', 'templateForm'
    
    const members = ref([]);
    const templates = ref([]);
    
    const search = ref('');
    const memberFilter = ref('active'); // 'active', 'inactive', 'all'
    
    const loading = ref(true);
    const saving = ref(false);
    const error = ref('');

    // Forms
    const defaultForm = () => ({ name: '', gender: 'male', role: '', dob: '', weddingDate: '', familyName: '', isChild: false, isActive: true });
    const form = ref(defaultForm());
    
    const defaultTplForm = () => ({ type: 'birthday', category: 'formal', content: '' });
    const tplForm = ref(defaultTplForm());

    // API Helpers
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
        const [mRes, tRes] = await Promise.all([
          apiCall('/members'),
          apiCall('/templates')
        ]);
        members.value = mRes;
        templates.value = tRes;
      } catch (err) {
        error.value = "Failed to load database. Are you the admin?";
      } finally {
        loading.value = false;
      }
    };

    onMounted(loadData);

    // Member Logic
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

    // Template Logic
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

    // UI Helpers
    const getInitials = (name) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const avatarStyle = (name) => {
      const colors = ['#ef4444', '#f97316', '#8b5cf6', '#06b6d4', '#10b981', '#3b82f6'];
      const idx = name.charCodeAt(0) % colors.length;
      return { backgroundColor: colors[idx] };
    };

    return { 
      currentTab, members, templates, search, memberFilter, loading, saving, error, 
      form, tplForm, filteredMembers, 
      openMemberForm, saveMember, 
      openTemplateForm, saveTemplate, deleteTemplate,
      getInitials, avatarStyle
    };
  }
}).mount('#app');
