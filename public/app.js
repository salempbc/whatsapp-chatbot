const { createApp, ref, computed, onMounted } = Vue;

const tg = window.Telegram.WebApp;
tg.expand(); // make it full screen

createApp({
  setup() {
    const view = ref('list');
    const members = ref([]);
    const search = ref('');
    const loading = ref(true);
    const saving = ref(false);
    const error = ref('');

    const defaultForm = () => ({
      name: '', gender: 'male', role: '', dob: '', weddingDate: '', familyName: '',
      isChild: false, isPastor: false, isActive: true
    });
    const form = ref(defaultForm());

    const fetchMembers = async () => {
      try {
        const res = await fetch('/api/members', {
          headers: { 'Authorization': `Bearer ${tg.initData}` }
        });
        if (!res.ok) throw new Error("Failed to load");
        members.value = await res.json();
      } catch (err) {
        error.value = err.message;
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      fetchMembers();
      tg.ready();
    });

    const filteredMembers = computed(() => {
      return members.value.filter(m => m.name.toLowerCase().includes(search.value.toLowerCase()));
    });

    const editMember = (m) => {
      form.value = { ...m };
      view.value = 'edit';
    };

    const saveMember = async () => {
      if (!form.value.name) return tg.showAlert("Name is required!");
      saving.value = true;
      error.value = '';
      try {
        const method = form.value._id ? 'PUT' : 'POST';
        const url = form.value._id ? `/api/members/${form.value._id}` : '/api/members';
        
        const res = await fetch(url, {
          method,
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tg.initData}`
          },
          body: JSON.stringify(form.value)
        });
        
        if (!res.ok) throw new Error("Save failed");
        
        await fetchMembers();
        view.value = 'list';
        tg.HapticFeedback.notificationOccurred('success');
      } catch (err) {
        error.value = err.message;
        tg.HapticFeedback.notificationOccurred('error');
      } finally {
        saving.value = false;
      }
    };

    return { view, members, search, loading, saving, error, form, filteredMembers, editMember, saveMember };
  }
}).mount('#app');
