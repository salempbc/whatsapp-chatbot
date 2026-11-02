<template>
  <div v-cloak class="max-w-xl mx-auto px-4 pt-4">

    <!-- Toast Pill Notification -->
    <transition name="fade">
      <div v-if="toastMessage" class="toast-pill">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>{{ toastMessage }}</span>
      </div>
    </transition>

    <!-- Top Church Brand Header -->
    <header class="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-200 dark:border-slate-800">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-600/30 flex-shrink-0">
          ⛪
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none">Salem PBC</h1>
          <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Church Operating System</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button @click="openCommandPalette" class="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm flex items-center gap-1.5" title="Search Everything (Ctrl+K)">
          <span>🔍</span>
          <span class="hidden sm:inline">Search</span>
          <kbd class="hidden sm:inline-block px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[9px] text-slate-400 font-mono border border-slate-200 dark:border-slate-700">⌘K</kbd>
        </button>
        <button @click="toggleTheme" class="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm flex items-center justify-center transition-colors shadow-sm" title="Toggle Light/Dark Theme">
          <span>{{ isDark ? '☀️' : '🌙' }}</span>
        </button>
        <button v-if="!authModalOpen && !isInTelegram()" @click="logoutStandalone" class="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-rose-500 transition-colors shadow-sm flex items-center gap-1" title="Lock Admin Session">
          <span>🔒</span>
          <span>Lock</span>
        </button>
        <div v-if="isOfflineMode" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold" :title="'Running offline using cached directory' + (offlineCacheTime ? ' (' + offlineCacheTime + ')' : '')">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
          <span>Offline</span>
        </div>
        <div v-else class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Online</span>
        </div>
      </div>
    </header>

    <!-- Global Non-Intrusive Connection / Error Alert Banner -->
    <transition name="fade">
      <div v-if="dataLoadError" class="mb-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-base flex-shrink-0">⚠️</span>
          <span class="truncate">{{ dataLoadError }}</span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <button @click="loadData" class="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors shadow-sm">🔄 Retry</button>
          <button @click="dataLoadError = ''" class="px-2 py-1 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs">✕</button>
        </div>
      </div>
    </transition>

    <!-- Floating Bulk Selection Bar -->
    <transition name="fade">
      <div v-if="selectedIds.length > 0" class="fixed top-3 left-4 right-4 max-w-xl mx-auto bg-slate-900 dark:bg-slate-800 text-white p-3 z-50 flex items-center justify-between shadow-2xl rounded-2xl border border-slate-700">
        <div class="flex items-center gap-2 font-bold text-sm pl-2">
          <span class="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 text-xs">{{ selectedIds.length }}</span>
          <span>Selected</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button @click="bulkAction('active', true)" class="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors">✅ Active</button>
          <button @click="bulkAction('active', false)" class="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors">🚪 Inactive</button>
          <button @click="bulkAction('delete', true)" class="px-2.5 py-1.5 rounded-xl bg-rose-500/80 hover:bg-rose-600 text-xs font-semibold transition-colors">🗑 Delete</button>
          <button @click="selectedIds = []" class="px-2 py-1.5 text-xs text-slate-400 hover:text-white ml-1">✕</button>
        </div>
      </div>
    </transition>

    <!-- ========================================== -->
    <!-- TAB 1: MEMBERS ROSTER & FAMILY EXPLORER   -->
    <!-- ========================================== -->
    <main v-if="currentTab === 'members'" class="space-y-4">
      
      <!-- Offline Notice Banner in Members View -->
      <div v-if="isOfflineMode" class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-2">
          <span class="text-base flex-shrink-0">📶</span>
          <span><b>Offline Directory:</b> Displaying {{ members.length }} cached church contacts for pastoral visits{{ offlineCacheTime ? ' (cached at ' + offlineCacheTime + ')' : '' }}.</span>
        </div>
        <button @click="loadData" class="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] transition-colors flex-shrink-0 ml-2">
          🔄 Sync
        </button>
      </div>

      <!-- Metrics Overview Cards (High Contrast) -->
      <div class="grid grid-cols-4 gap-2">
        <div class="p-2.5 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 text-center shadow-sm">
          <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</div>
          <div class="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{{ totalCount }}</div>
        </div>
        <div class="p-2.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/30 border border-emerald-500/20 dark:border-emerald-800/40 text-center shadow-sm">
          <div class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active</div>
          <div class="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{{ activeCount }}</div>
        </div>
        <div class="p-2.5 rounded-2xl bg-rose-500/5 dark:bg-rose-950/30 border border-rose-500/20 dark:border-rose-800/40 text-center shadow-sm">
          <div class="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Married</div>
          <div class="text-xl font-extrabold text-rose-500 dark:text-rose-400 mt-0.5">{{ marriedCount }}</div>
        </div>
        <div class="p-2.5 rounded-2xl bg-indigo-500/5 dark:bg-indigo-950/30 border border-indigo-500/20 dark:border-indigo-800/40 text-center shadow-sm cursor-pointer hover:border-indigo-500 transition-colors" @click="currentTab = 'upcoming'">
          <div class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Events</div>
          <div class="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">{{ celebrationsCount }}</div>
        </div>
      </div>

      <!-- Search, View Switcher & Add Actions -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 dark:text-slate-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </span>
          <input type="text" v-model="search" placeholder="Search name, family, role..." class="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151c28] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors shadow-sm" />
          <button v-if="search" @click="search = ''" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
        </div>

        <!-- View Switcher (Cards vs Family Tree) -->
        <div class="flex items-center p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700/60">
          <button @click="memberView = 'cards'" :class="['p-1.5 rounded-lg text-xs transition-all', memberView === 'cards' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400']" title="Cards View">
            📇
          </button>
          <button @click="memberView = 'families'" :class="['p-1.5 rounded-lg text-xs transition-all', memberView === 'families' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400']" title="Families View">
            🏡
          </button>
        </div>

        <button @click="openFastEntry()" class="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all" title="Speed continuous registration">
          <span>⚡</span>
          <span>Fast Entry</span>
        </button>

        <button @click="openMemberForm()" class="btn-brand px-3 py-2.5 text-xs flex items-center gap-1 shadow-sm">
          <span>➕</span>
          <span>Add</span>
        </button>
      </div>

      <!-- Segmented Filters & Sort Row -->
      <div class="flex items-center justify-between gap-1 overflow-x-auto pb-1 scrollbar-hide text-xs font-semibold">
        <div class="flex items-center gap-1.5">
          <button @click="memberFilter = 'active'" :class="['px-3 py-1.5 rounded-xl transition-all whitespace-nowrap', memberFilter === 'active' ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-300/50 dark:border-slate-700/50']">
            Active
          </button>
          <button @click="memberFilter = 'all'" :class="['px-3 py-1.5 rounded-xl transition-all whitespace-nowrap', memberFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-300/50 dark:border-slate-700/50']">
            All
          </button>
          <button @click="memberFilter = 'married'" :class="['px-3 py-1.5 rounded-xl transition-all whitespace-nowrap', memberFilter === 'married' ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-300/50 dark:border-slate-700/50']">
            💍 Married
          </button>
          <button @click="memberFilter = 'youth'" :class="['px-3 py-1.5 rounded-xl transition-all whitespace-nowrap', memberFilter === 'youth' ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-300/50 dark:border-slate-700/50']">
            Youth
          </button>
          <button @click="memberFilter = 'pastor'" :class="['px-3 py-1.5 rounded-xl transition-all whitespace-nowrap', memberFilter === 'pastor' ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-300/50 dark:border-slate-700/50']">
            Pastors
          </button>
        </div>

        <select v-model="sortBy" class="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold focus:outline-none ml-2 shadow-sm">
          <option value="name">Sort: A-Z</option>
          <option value="birthday">Sort: Birthday</option>
          <option value="wedding">Sort: Wedding</option>
        </select>
      </div>

      <!-- Shimmering Skeleton Loader for Member Cards -->
      <div v-if="loading && !filteredMembers.length" class="space-y-2.5">
        <div v-for="sk in 4" :key="'skel-' + sk" class="p-3.5 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 flex items-center gap-3 animate-pulse">
          <div class="w-11 h-11 rounded-2xl bg-slate-200 dark:bg-slate-800 flex-shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-slate-200 dark:bg-slate-700/60 rounded-md w-2/5"></div>
            <div class="flex gap-2">
              <div class="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-14"></div>
              <div class="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-16"></div>
              <div class="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-24"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- VIEW A: MEMBER CARDS GRID (Pure High Contrast) -->
      <div v-if="memberView === 'cards'" class="space-y-2.5">
        <div v-for="m in filteredMembers" :key="m._id" class="p-3.5 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 flex items-center gap-3 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-sm">
          <input type="checkbox" :value="m._id" v-model="selectedIds" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0" />
          
          <div class="w-11 h-11 rounded-2xl relative overflow-hidden flex items-center justify-center font-bold text-white text-sm shadow-md cursor-pointer flex-shrink-0" :style="avatarStyle(m.name)" @click="openMemberForm(m)">
            <img v-if="m.photo" :src="photoUrl(m._id)" class="w-full h-full object-cover absolute inset-0" />
            <span v-if="!m.photo">{{ getInitials(m.name) }}</span>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <h3 class="font-bold text-slate-900 dark:text-white text-base leading-tight truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400" @click="openMemberForm(m)">
                {{ m.name }}
              </h3>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button @click="openWishModal(m, 'birthday')" class="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 border border-indigo-200/50 dark:border-indigo-800/60 font-bold text-xs flex items-center gap-1 transition-colors" title="Live AI Wish Preview">
                  <span>✨</span>
                  <span>Wish</span>
                </button>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs">
              <span v-if="getRoleBadge(m)" :class="['px-1.5 py-0.5 rounded-md font-extrabold text-[10px] uppercase border', getRoleBadge(m).class]">
                {{ getRoleBadge(m).label }}
              </span>
              <span :class="['px-1.5 py-0.5 rounded-md font-semibold text-[11px] border', (m.status === 'active' || (m.isActive !== false && m.status !== 'inactive')) ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700']">
                {{ (m.status === 'active' || (m.isActive !== false && m.status !== 'inactive')) ? 'Active' : 'Inactive' }}
              </span>
              <span v-if="m.dob || m.birthday" class="text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60 text-[11px]">🎂 {{ m.dob ? m.dob.substring(5) : m.birthday }}</span>
              <span v-if="m.isMarried && (m.weddingDate || m.wedding)" class="text-rose-700 dark:text-rose-300 font-semibold bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/60 text-[11px]">💍 {{ m.weddingDate ? m.weddingDate.substring(5) : m.wedding }}</span>
              <span v-if="m.familyName" class="text-slate-400 dark:text-slate-500 text-[11px]">🏡 {{ m.familyName }}</span>
            </div>
          </div>
        </div>

        <div v-if="!filteredMembers.length" class="text-center py-12 px-6 rounded-3xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div class="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center text-3xl shadow-inner">
            <span>{{ memberSearch ? '🔍' : '👥' }}</span>
          </div>
          <div>
            <h4 class="text-base font-bold text-slate-800 dark:text-slate-100">
              {{ memberSearch ? 'No matching members found' : 'No Church Members Yet' }}
            </h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              {{ memberSearch ? `We couldn't find any member matching "${memberSearch}". Try adjusting your keywords or clearing the filter.` : 'Start building your church directory by adding your first church member or importing a CSV roster.' }}
            </p>
          </div>
          <div class="flex items-center justify-center gap-2 pt-1">
            <button v-if="memberSearch" @click="memberSearch = ''" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all">
              ✕ Clear Search
            </button>
            <button v-else @click="openMemberForm()" class="btn-brand px-4 py-2 text-xs font-bold shadow-md">
              ➕ Add First Member
            </button>
            <button v-if="!members.length" @click="openImportModal" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              📥 Import CSV
            </button>
          </div>
        </div>
      </div>

      <!-- VIEW B: GROUPED FAMILY TREE & HOUSEHOLD VIEW -->
      <div v-if="memberView === 'families'" class="space-y-4">
        <!-- Household Analytics Header -->
        <div class="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-center">
          <div class="p-2 rounded-xl bg-white dark:bg-[#151c28] border border-slate-100 dark:border-slate-700/50 shadow-xs">
            <div class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Households</div>
            <div class="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">🏡 {{ householdStats.totalHouseholds }}</div>
          </div>
          <div class="p-2 rounded-xl bg-white dark:bg-[#151c28] border border-slate-100 dark:border-slate-700/50 shadow-xs">
            <div class="text-xs text-slate-500 dark:text-slate-400 font-semibold">In Families</div>
            <div class="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">👨‍👩‍👧‍👦 {{ householdStats.totalInHouseholds }}</div>
          </div>
          <div class="p-2 rounded-xl bg-white dark:bg-[#151c28] border border-slate-100 dark:border-slate-700/50 shadow-xs">
            <div class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Avg. Size</div>
            <div class="text-lg font-black text-sky-600 dark:text-sky-400 mt-0.5">📊 {{ householdStats.avgSize }}</div>
          </div>
        </div>

        <!-- Household Units List -->
        <div v-for="fam in structuredFamilies" :key="fam.name" class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-3.5 shadow-sm">
          
          <!-- Family Header -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xl">{{ fam.isUnassigned ? '📋' : '🏡' }}</span>
                <h3 class="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">{{ fam.name }}</h3>
                <span :class="['px-2.5 py-0.5 rounded-full text-xs font-bold border', fam.isUnassigned ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800']">
                  {{ fam.totalCount }} {{ fam.totalCount === 1 ? 'member' : 'members' }}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span v-if="fam.primaryAddress" class="flex items-center gap-1">📍 {{ fam.primaryAddress }}</span>
                <span v-if="fam.weddingDate || fam.weddingKey" class="flex items-center gap-1 text-pink-600 dark:text-pink-400 font-medium">💍 Anniversary: {{ fam.weddingDate || fam.weddingKey }}</span>
              </div>
            </div>

            <!-- Header Quick Actions -->
            <div class="flex items-center gap-1.5">
              <button v-if="!fam.isUnassigned" @click="openFastEntry(fam.name)" class="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs" title="Rapidly enter members into this family">
                <span>⚡ Fast Add</span>
              </button>
              <button v-if="!fam.isUnassigned" @click="addFamilyMember(fam.name)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1" title="Add family member">
                <span>➕ Add</span>
              </button>
              <button v-if="fam.primaryPhone" @click="openFamilyWhatsApp(fam.primaryPhone)" class="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-colors flex items-center gap-1" title="WhatsApp Family">
                <span>💬 WhatsApp</span>
              </button>
              <a v-if="fam.primaryPhone" :href="'tel:' + fam.primaryPhone" class="px-2.5 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-700 dark:text-sky-300 text-xs font-bold transition-colors flex items-center gap-1" title="Call Household">
                <span>📞 Call</span>
              </a>
            </div>
          </div>

          <!-- Unassigned Roster Notice -->
          <div v-if="fam.isUnassigned" class="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-700 dark:text-amber-300">
            💡 These members do not currently belong to a linked household. Click any profile below to assign them to their family group.
          </div>

          <!-- Structured Family Tree Grid -->
          <div v-if="!fam.isUnassigned" class="space-y-3">
            
            <!-- Tier 1: Parents / Head of Household & Spouse -->
            <div>
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1">
                <span>👑</span>
                <span>Parents & Household Leads</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                
                <!-- Head -->
                <div v-if="fam.head" class="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                  <div class="flex items-center gap-2.5 min-w-0 cursor-pointer" @click="openMemberForm(fam.head)">
                    <div class="w-9 h-9 rounded-xl font-bold text-white text-xs flex items-center justify-center flex-shrink-0" :style="avatarStyle(fam.head.name)">
                      {{ getInitials(fam.head.name) }}
                    </div>
                    <div class="truncate">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-slate-900 dark:text-white text-sm truncate">{{ fam.head.name }}</span>
                        <span class="px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">Head</span>
                      </div>
                      <div class="text-[11px] text-slate-500 dark:text-slate-400">{{ fam.head.role || 'Member' }} <span v-if="fam.head.phone">• {{ fam.head.phone }}</span></div>
                    </div>
                  </div>
                  <button @click="openWishModal(fam.head, 'birthday')" class="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 text-xs font-bold shadow-xs">✨</button>
                </div>

                <!-- Spouse -->
                <div v-if="fam.spouse" class="p-3 rounded-xl bg-pink-50/40 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900/40 flex items-center justify-between">
                  <div class="flex items-center gap-2.5 min-w-0 cursor-pointer" @click="openMemberForm(fam.spouse)">
                    <div class="w-9 h-9 rounded-xl font-bold text-white text-xs flex items-center justify-center flex-shrink-0" :style="avatarStyle(fam.spouse.name)">
                      {{ getInitials(fam.spouse.name) }}
                    </div>
                    <div class="truncate">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-slate-900 dark:text-white text-sm truncate">{{ fam.spouse.name }}</span>
                        <span class="px-1.5 py-0.2 rounded bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300 text-[10px] font-bold">Spouse</span>
                      </div>
                      <div class="text-[11px] text-slate-500 dark:text-slate-400">{{ fam.spouse.role || 'Member' }} <span v-if="fam.spouse.phone">• {{ fam.spouse.phone }}</span></div>
                    </div>
                  </div>
                  <button @click="openWishModal(fam.spouse, 'wedding')" class="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 hover:bg-pink-50 text-xs font-bold shadow-xs">✨</button>
                </div>

              </div>
            </div>

            <!-- Tier 2: Children & Dependents -->
            <div v-if="fam.children && fam.children.length > 0">
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1">
                <span>👶</span>
                <span>Children & Youth ({{ fam.children.length }})</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 border-l-2 border-indigo-200 dark:border-indigo-800/60 ml-2">
                <div v-for="c in fam.children" :key="c._id" class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                  <div class="flex items-center gap-2 min-w-0 cursor-pointer" @click="openMemberForm(c)">
                    <div class="w-8 h-8 rounded-lg font-bold text-white text-xs flex items-center justify-center flex-shrink-0" :style="avatarStyle(c.name)">
                      {{ getInitials(c.name) }}
                    </div>
                    <div class="truncate">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-slate-900 dark:text-white text-sm truncate">{{ c.name }}</span>
                        <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                          {{ c.gender === 'male' ? '👦 Son' : '👧 Daughter' }}
                        </span>
                      </div>
                      <div class="text-[11px] text-slate-500 dark:text-slate-400">
                        <span v-if="computeAge(c.dob) !== null">{{ computeAge(c.dob) }} yrs</span>
                        <span v-else>{{ c.isChild ? 'Child' : 'Youth' }}</span>
                        <span v-if="c.birthday"> • 🎂 {{ c.birthday }}</span>
                      </div>
                    </div>
                  </div>
                  <button @click="openWishModal(c, 'birthday')" class="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-bold">✨</button>
                </div>
              </div>
            </div>

            <!-- Tier 3: Other Household Members / Relatives -->
            <div v-if="fam.others && fam.others.length > 0">
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1">
                <span>👥</span>
                <span>Extended Family & Relatives ({{ fam.others.length }})</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 border-l-2 border-slate-200 dark:border-slate-800 ml-2">
                <div v-for="o in fam.others" :key="o._id" class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                  <div class="flex items-center gap-2 min-w-0 cursor-pointer" @click="openMemberForm(o)">
                    <div class="w-8 h-8 rounded-lg font-bold text-white text-xs flex items-center justify-center flex-shrink-0" :style="avatarStyle(o.name)">
                      {{ getInitials(o.name) }}
                    </div>
                    <div class="truncate">
                      <div class="font-bold text-slate-900 dark:text-white text-sm truncate">{{ o.name }}</div>
                      <div class="text-[11px] text-slate-500 dark:text-slate-400">{{ o.role || 'Member' }} <span v-if="o.phone">• {{ o.phone }}</span></div>
                    </div>
                  </div>
                  <button @click="openWishModal(o, 'birthday')" class="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-bold">✨</button>
                </div>
              </div>
            </div>

          </div>

          <!-- Unassigned Members Flat Grid -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div v-for="fm in fam.allMembers" :key="fm._id" class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
              <div class="flex items-center gap-2.5 min-w-0 cursor-pointer" @click="openMemberForm(fm)">
                <div class="w-8 h-8 rounded-xl font-bold text-white text-xs flex items-center justify-center flex-shrink-0" :style="avatarStyle(fm.name)">
                  {{ getInitials(fm.name) }}
                </div>
                <div class="truncate">
                  <div class="font-bold text-slate-900 dark:text-white text-sm truncate">{{ fm.name }}</div>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400">{{ fm.role || 'Member' }} <span v-if="fm.phone">• {{ fm.phone }}</span></div>
                </div>
              </div>
              <button @click="openMemberForm(fm)" class="px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-semibold hover:bg-amber-200">Set Family</button>
            </div>
          </div>

        </div>
      </div>

    </main>

    <!-- ========================================== -->
    <!-- TAB 2: UPCOMING CELEBRATIONS & CALENDAR    -->
    <!-- ========================================== -->
    <main v-if="currentTab === 'upcoming'" class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Upcoming Celebrations</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Next 30 days birthdays & anniversaries</p>
        </div>
        <button @click="loadData()" class="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-100 shadow-sm">
          🔄 Refresh
        </button>
      </div>

      <!-- Subtab Switcher: Celebrations vs Message Templates -->
      <div class="flex p-1 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button type="button" class="flex-1 py-2 rounded-xl text-xs font-bold transition-all bg-white dark:bg-[#151c28] text-indigo-600 dark:text-indigo-400 shadow-sm">
          🎂 Upcoming Celebrations ({{ (upcomingEvents.birthdays?.length || 0) + (upcomingEvents.weddings?.length || 0) }})
        </button>
        <button type="button" class="flex-1 py-2 rounded-xl text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200" @click="currentTab = 'templates'">
          📝 Message Templates ({{ templates.length }})
        </button>
      </div>

      <!-- Birthdays Section -->
      <section class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div class="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
            <span>🎂</span>
            <span>Birthdays ({{ upcomingEvents.birthdays?.length || 0 }})</span>
          </div>
          <span class="text-[11px] text-slate-400 font-semibold">Next 30 Days</span>
        </div>

          <div v-for="(b, bIdx) in (upcomingEvents?.birthdays || [])" :key="b?.member?._id || bIdx" class="p-3 rounded-xl border flex items-center justify-between transition-all" :class="b.isToday ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'">
            <div class="flex items-center gap-3 min-w-0">
              <span :class="['px-2.5 py-1 rounded-lg text-xs font-bold border', b.isToday ? 'bg-amber-500 text-white border-amber-600 animate-pulse' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800']">
                {{ b.isToday ? 'Today 🎉' : b.mmdd }}
              </span>
              <div class="min-w-0">
                <div class="font-bold text-slate-900 dark:text-white text-sm truncate">{{ b?.member?.name || 'Member' }}</div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{{ b?.member?.role || 'Member' }}</div>
              </div>
            </div>

            <button v-if="b?.member" @click="openWishModal(b.member, 'birthday')" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm">
              <span>✨</span>
              <span>Wish</span>
            </button>
          </div>

          <div v-if="!upcomingEvents?.birthdays?.length" class="text-center py-4 text-xs text-slate-400">
            No birthdays in the next 30 days.
          </div>
      </section>

      <!-- Wedding Anniversaries Section -->
      <section class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div class="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
            <span>💍</span>
            <span>Wedding Anniversaries ({{ upcomingEvents?.weddings?.length || 0 }})</span>
          </div>
          <span class="text-[11px] text-slate-400 font-semibold">Next 30 Days</span>
        </div>

        <div class="space-y-2">
          <div v-for="(w, wIdx) in (upcomingEvents?.weddings || [])" :key="w?.member?._id || wIdx" class="p-3 rounded-xl border flex items-center justify-between transition-all" :class="w.isToday ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'">
            <div class="flex items-center gap-3 min-w-0">
              <span :class="['px-2.5 py-1 rounded-lg text-xs font-bold border', w.isToday ? 'bg-rose-500 text-white border-rose-600 animate-pulse' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800']">
                {{ w.isToday ? 'Today 🎉' : w.mmdd }}
              </span>
              <div class="min-w-0">
                <div class="font-bold text-slate-900 dark:text-white text-sm truncate">{{ w?.member?.name || 'Member' }} & {{ w?.member?.spouseName || 'Spouse' }}</div>
                <div class="text-[11px] text-rose-600 dark:text-rose-400 font-medium">💍 Anniversary</div>
              </div>
            </div>

            <button v-if="w?.member" @click="openWishModal(w.member, 'wedding')" class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm">
              <span>✨</span>
              <span>Wish</span>
            </button>
          </div>

          <div v-if="!upcomingEvents.weddings?.length" class="text-center py-4 text-xs text-slate-400">
            No wedding anniversaries in the next 30 days.
          </div>
        </div>
      </section>
    </main>

    <!-- ========================================== -->
    <!-- TAB 3: TEMPLATES STUDIO                    -->
    <!-- ========================================== -->
    <main v-if="currentTab === 'templates'" class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button @click="currentTab = 'upcoming'" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 flex items-center justify-center font-bold text-sm" title="Back to Celebrations">←</button>
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Message Templates Studio</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ templates.length }} active church templates stored</p>
          </div>
        </div>
        <button @click="openTemplateForm()" class="btn-brand px-3.5 py-2.5 text-sm flex items-center gap-1.5 shadow-sm">
          <span>➕</span>
          <span>New</span>
        </button>
      </div>

      <!-- Subtab Switcher: Celebrations vs Message Templates -->
      <div class="flex p-1 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button type="button" class="flex-1 py-2 rounded-xl text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200" @click="currentTab = 'upcoming'">
          🎂 Upcoming Celebrations ({{ (upcomingEvents.birthdays?.length || 0) + (upcomingEvents.weddings?.length || 0) }})
        </button>
        <button type="button" class="flex-1 py-2 rounded-xl text-xs font-bold transition-all bg-white dark:bg-[#151c28] text-indigo-600 dark:text-indigo-400 shadow-sm">
          📝 Message Templates ({{ templates.length }})
        </button>
      </div>

      <div class="space-y-3">
        <div v-for="t in templates" :key="t._id" class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm" @click="openTemplateForm(t)">
          <div class="flex items-center justify-between mb-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border" :class="t.type === 'birthday' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'">
              <span>{{ t.type === 'birthday' ? '🎂' : '💍' }}</span>
              <span>{{ t.type.toUpperCase() }}</span>
            </span>
            <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{{ t.category }}</span>
          </div>
          <p class="text-sm text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed font-normal bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 font-sans">{{ t.content }}</p>
        </div>
      </div>
    </main>

    <!-- ========================================== -->
    <!-- TAB: CHURCH EVENTS & CALENDAR              -->
    <!-- ========================================== -->
    <main v-if="currentTab === 'events'" class="space-y-4">
      <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Church Calendar</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">Services, prayer meetings & scheduled events</p>
        </div>
        <div class="flex items-center gap-2">
          <button @click="exportICS" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold hover:bg-slate-50 text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-1.5" title="Export to Apple/Google/Outlook Calendar">
            <span>📅</span>
            <span>Export .ics</span>
          </button>
          <button @click="openEventForm()" class="btn-brand px-3.5 py-2 text-xs font-bold shadow-sm flex items-center gap-1">
            <span>➕</span>
            <span>New Event</span>
          </button>
        </div>
      </div>

      <!-- Event Filters & Calendar Grid Switcher -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-xs font-semibold">
          <button @click="eventFilter = 'all'" :class="['px-3 py-1.5 rounded-xl transition-all', eventFilter === 'all' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300']">All ({{ churchEvents.length }})</button>
          <button @click="eventFilter = 'upcoming'" :class="['px-3 py-1.5 rounded-xl transition-all', eventFilter === 'upcoming' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300']">Upcoming</button>
          <button @click="eventFilter = 'past'" :class="['px-3 py-1.5 rounded-xl transition-all', eventFilter === 'past' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300']">Past</button>
        </div>
      </div>

      <!-- INTERACTIVE MONTH CALENDAR GRID -->
      <div class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <h3 class="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <span>🗓️</span>
            <span>{{ calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' }) }}</span>
          </h3>
          <div class="flex items-center gap-1">
            <button @click="shiftCalendarMonth(-1)" class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold flex items-center justify-center">◀</button>
            <button @click="calendarMonth = new Date()" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[10px] font-bold">Today</button>
            <button @click="shiftCalendarMonth(1)" class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold flex items-center justify-center">▶</button>
          </div>
        </div>

        <!-- Weekday Headers -->
        <div class="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 uppercase">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>

        <!-- Month Day Cells -->
        <div class="grid grid-cols-7 gap-1 text-xs">
          <div v-for="(c, idx) in calendarMonthDays" :key="idx" class="min-h-[52px] p-1 rounded-xl border flex flex-col justify-between transition-colors" :class="c.day ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/80 hover:border-indigo-400' : 'border-transparent'">
            <div v-if="c.day" class="font-bold text-[11px] text-slate-700 dark:text-slate-300">{{ c.day }}</div>
            <div v-if="c.events && c.events.length" class="space-y-0.5">
              <div v-for="(ev, eIdx) in c.events.slice(0, 2)" :key="eIdx" class="text-[9px] px-1 py-0.5 rounded truncate font-medium" :class="ev.type === 'church' ? 'bg-indigo-600 text-white font-bold' : ev.type === 'wedding' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'">
                {{ ev.label }}
              </div>
              <div v-if="c.events.length > 2" class="text-[8px] text-slate-400 text-center font-bold">+{{ c.events.length - 2 }} more</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Events List -->
      <div v-if="filteredChurchEvents.length === 0" class="text-center py-12 px-6 rounded-3xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div class="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center text-3xl shadow-inner">
          📅
        </div>
        <div>
          <h4 class="text-base font-bold text-slate-800 dark:text-slate-100">No Church Events Scheduled</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
            Schedule worship services, prayer meetings, youth fellowships, or special church programs.
          </p>
        </div>
        <div class="pt-1">
          <button @click="openEventForm()" class="btn-brand px-5 py-2.5 text-xs font-bold shadow-md inline-flex items-center gap-1.5">
            <span>➕</span>
            <span>Schedule First Event</span>
          </button>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div v-for="ev in filteredChurchEvents" :key="ev._id" class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                  {{ (ev.category || 'Event').replace(/_/g, ' ') }}
                </span>
                <span v-if="ev.status === 'completed'" class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Completed</span>
                <span v-else-if="ev.status === 'cancelled'" class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600">Cancelled</span>
              </div>
              <h3 class="font-bold text-base text-slate-900 dark:text-white mt-1">{{ ev.title }}</h3>
            </div>
            <div class="flex items-center gap-1">
              <button @click="openEventForm(ev)" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs" title="Edit Event">✏️</button>
              <button @click="deleteEvent(ev._id)" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs" title="Delete Event">🗑</button>
            </div>
          </div>

          <p v-if="ev.description" class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{{ ev.description }}</p>

          <div class="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60">
            <span class="flex items-center gap-1">
              <span>📅</span>
              <span class="font-semibold text-slate-800 dark:text-slate-200">{{ new Date(ev.startDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
            </span>
            <span v-if="ev.startTime" class="flex items-center gap-1">
              <span>⏰</span>
              <span>{{ ev.startTime }}</span>
            </span>
            <span v-if="ev.venue" class="flex items-center gap-1">
              <span>📍</span>
              <span>{{ ev.venue }}</span>
            </span>
          </div>
        </div>
      </div>
    </main>

    <!-- ========================================== -->
    <!-- TAB: ADMINISTRATIVE TASKS & FOLLOW-UPS     -->
    <!-- ========================================== -->
    <main v-if="currentTab === 'tasks'" class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>📋</span>
            <span>Church Tasks & Pastoral Follow-ups</span>
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">TaskFlow: Subtasks, notes, attachments, priorities & reminders</p>
        </div>
        <button @click="openTaskForm()" class="btn-brand px-3.5 py-2 text-xs font-bold shadow-sm flex items-center gap-1.5">
          <span>➕</span>
          <span>New Task</span>
        </button>
      </div>

      <!-- STATS CARDS -->
      <div class="space-y-2">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <!-- Total Tasks -->
          <div class="p-3.5 rounded-2xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10 flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Total Tasks</span>
              <span class="text-blue-500 font-bold">📋</span>
            </div>
            <div class="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">{{ taskStats.total || 0 }}</div>
          </div>
          <!-- Active Tasks -->
          <div class="p-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Active</span>
              <span class="text-amber-500 font-bold">⏳</span>
            </div>
            <div class="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{{ taskStats.active || 0 }}</div>
          </div>
          <!-- Completed Tasks -->
          <div class="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Completed</span>
              <span class="text-emerald-500 font-bold">✅</span>
            </div>
            <div class="mt-2 flex items-baseline gap-1.5">
              <span class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ taskStats.completed || 0 }}</span>
              <span class="text-xs text-slate-400 font-medium">/ {{ taskStats.total || 0 }}</span>
            </div>
          </div>
          <!-- Overdue Tasks -->
          <div class="p-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10 flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Overdue</span>
              <span class="text-rose-500 font-bold">⚠️</span>
            </div>
            <div class="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">{{ taskStats.overdue || 0 }}</div>
          </div>
        </div>

        <!-- Estimated Time summary -->
        <div v-if="taskStats.totalEstimatedMins > 0" class="px-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
          <span>⏱️ Estimated Time:</span>
          <span class="font-bold text-slate-800 dark:text-slate-200">{{ formatEstimate(taskStats.totalEstimatedMins) }}</span>
          <span>·</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-bold">{{ formatEstimate(taskStats.completedEstimatedMins) }} completed</span>
        </div>
      </div>

      <!-- PROGRESS BAR -->
      <div v-if="taskStats.total > 0" class="p-3 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-sm">
        <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div class="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2.5 rounded-full transition-all duration-300" :style="{ width: progressPercentage + '%' }"></div>
        </div>
        <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span v-if="taskStats.total > 0 && taskStats.completed === taskStats.total" class="text-emerald-500 font-bold">
            ✓ All tasks complete! Outstanding work.
          </span>
          <span v-else>
            <span class="font-bold text-slate-800 dark:text-slate-200">{{ progressPercentage }}% complete</span>
            <span> · </span>
            <span>{{ taskStats.completed }}/{{ taskStats.total }} tasks done</span>
          </span>
          <span v-if="taskStats.overdue > 0" class="text-rose-500 font-bold flex items-center gap-1">
            <span>⚠️</span>
            <span>{{ taskStats.overdue }} overdue</span>
          </span>
        </div>
      </div>

      <!-- SMART QUICK ADD (NLP) -->
      <div class="p-3.5 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
        <div class="flex items-center gap-2">
          <span class="text-base text-indigo-500">⚡</span>
          <input
            type="text"
            v-model="quickAddText"
            @keyup.enter="executeQuickAdd"
            placeholder="Quick add: &quot;visit Brother Thomas tomorrow at 4pm #visitation - bring communion&quot;"
            class="flex-1 text-xs sm:text-sm bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          <button
            @click="executeQuickAdd"
            :disabled="quickAddSubmitting || !quickAddText.trim()"
            class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all flex-shrink-0"
          >
            <span>➕</span>
            <span>Add</span>
          </button>
        </div>

        <!-- Priority Pills & Syntax Hint -->
        <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-400 font-medium">Priority:</span>
            <button
              v-for="p in ['low', 'medium', 'high', 'urgent']"
              :key="p"
              @click="quickAddPriority = p"
              :class="['px-2 py-0.5 rounded-md font-bold uppercase text-[10px] transition-all', quickAddPriority === p ? (p === 'urgent' ? 'bg-rose-500 text-white' : p === 'high' ? 'bg-amber-500 text-white' : p === 'medium' ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white') : 'bg-slate-100 dark:bg-slate-800 text-slate-500']"
            >
              {{ p }}
            </button>
          </div>
          <span class="text-slate-400 text-[10px]">
            Syntax: <code class="text-indigo-600 dark:text-indigo-400">#tag</code>, <code class="text-indigo-600 dark:text-indigo-400">today</code>, <code class="text-indigo-600 dark:text-indigo-400">at 3pm</code>, <code class="text-indigo-600 dark:text-indigo-400">- notes</code>
          </span>
        </div>
      </div>

      <!-- FILTER & SEARCH BAR -->
      <div class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <!-- Status Pills -->
          <div class="flex items-center gap-1 text-xs font-semibold">
            <button @click="taskFilter = 'all'" :class="['px-2.5 py-1.5 rounded-xl transition-all', taskFilter === 'all' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300']">
              All ({{ tasks.length }})
            </button>
            <button @click="taskFilter = 'active'" :class="['px-2.5 py-1.5 rounded-xl transition-all', taskFilter === 'active' || taskFilter === 'pending' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300']">
              Active ({{ taskStats.active || 0 }})
            </button>
            <button @click="taskFilter = 'completed'" :class="['px-2.5 py-1.5 rounded-xl transition-all', taskFilter === 'completed' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300']">
              Completed ({{ taskStats.completed || 0 }})
            </button>
            <button @click="taskFilter = 'overdue'" :class="['px-2.5 py-1.5 rounded-xl transition-all', taskFilter === 'overdue' ? 'bg-rose-600 text-white font-bold shadow-sm' : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300']">
              Overdue ({{ taskStats.overdue || 0 }})
            </button>
          </div>

          <!-- Sort and Priority Selects -->
          <div class="flex items-center gap-1.5 text-xs">
            <select v-model="taskPriorityFilter" class="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none">
              <option value="all">All Priorities</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>

            <select v-model="taskSortField" class="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none">
              <option value="manual">Sort: Manual</option>
              <option value="dueDate">Sort: Due Date</option>
              <option value="priority">Sort: Priority</option>
              <option value="createdAt">Sort: Newest</option>
              <option value="title">Sort: Title A-Z</option>
            </select>
          </div>
        </div>

        <!-- Search & Tag Filter Row -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative flex-1 min-w-[180px]">
            <input
              type="text"
              v-model="taskSearch"
              placeholder="🔍 Search tasks, descriptions, assignees..."
              class="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
            <button v-if="taskSearch" @click="taskSearch = ''" class="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
          </div>

          <!-- Tag Pills -->
          <div v-if="allTags.length > 0" class="flex flex-wrap items-center gap-1 text-xs">
            <button
              @click="taskTagFilter = 'all'"
              :class="['px-2 py-1 rounded-lg text-[11px] font-semibold transition-all', taskTagFilter === 'all' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-500']"
            >
              All Tags
            </button>
            <button
              v-for="tag in allTags"
              :key="tag"
              @click="taskTagFilter = tag"
              :class="['px-2 py-1 rounded-lg text-[11px] font-semibold transition-all', taskTagFilter === tag ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600']"
            >
              #{{ tag }}
            </button>
          </div>
        </div>
      </div>

      <!-- BULK ACTIONS TOOLBAR -->
      <div v-if="selectedTaskIds.length > 0" class="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2">
          <span class="font-bold text-indigo-700 dark:text-indigo-300">
            ✓ {{ selectedTaskIds.length }} task(s) selected
          </span>
          <button @click="selectAllFilteredTasks" class="text-indigo-600 dark:text-indigo-400 underline font-semibold">
            {{ selectedTaskIds.length === filteredTasks.length ? 'Deselect All' : 'Select All (' + filteredTasks.length + ')' }}
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <button @click="executeTaskBulkAction('complete')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm">
            <span>✅</span>
            <span>Mark Complete</span>
          </button>
          <button @click="executeTaskBulkAction('priority', 'urgent')" class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm">
            <span>🔴</span>
            <span>Set Urgent</span>
          </button>
          <button @click="executeTaskBulkAction('delete')" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 font-bold text-xs">
            <span>🗑</span>
            <span>Delete</span>
          </button>
          <button @click="clearSelectedTasks" class="px-2 py-1 text-slate-400 hover:text-slate-600 font-semibold">
            ✕ Cancel
          </button>
        </div>
      </div>

      <!-- TASK LIST -->
      <div v-if="filteredTasks.length === 0" class="text-center py-12 px-6 rounded-3xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div class="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center text-3xl shadow-inner">
          {{ taskSearch ? '🔍' : '🎉' }}
        </div>
        <div>
          <h4 class="text-base font-bold text-slate-800 dark:text-slate-100">
            {{ taskSearch ? 'No tasks match your filter' : 'All Ministry Tasks Up To Date!' }}
          </h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
            {{ taskSearch ? `No tasks found matching "${taskSearch}". Try searching for another keyword or tag.` : 'There are no pending pastoral follow-ups or administrative items right now. Excellent work!' }}
          </p>
        </div>
        <div class="flex items-center justify-center gap-2 pt-1">
          <button v-if="taskSearch" @click="taskSearch = ''" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all">
            ✕ Clear Search
          </button>
          <button @click="openTaskForm()" class="btn-brand px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 shadow-md">
            <span>➕</span>
            <span>Create Task</span>
          </button>
        </div>
      </div>

      <!-- TASK CARDS -->
      <div v-else class="space-y-3">
        <div
          v-for="t in filteredTasks"
          :key="t._id"
          class="p-4 rounded-3xl bg-white dark:bg-[#151c28] border transition-all shadow-sm space-y-3"
          :class="[
            t.pinned ? 'border-amber-400/60 dark:border-amber-500/40 bg-amber-500/[0.02]' : 'border-slate-200 dark:border-slate-800',
            isTaskSelected(t._id) ? 'ring-2 ring-indigo-500' : ''
          ]"
        >
          <!-- Task Top Row -->
          <div class="flex items-start gap-3">
            <!-- Multi-Select Checkbox -->
            <input
              type="checkbox"
              :checked="isTaskSelected(t._id)"
              @change="toggleSelectTask(t._id)"
              class="mt-1 w-4 h-4 rounded text-indigo-600 border-slate-300 dark:border-slate-700 focus:ring-indigo-500 cursor-pointer"
              title="Select for bulk action"
            />

            <!-- Complete Toggle Checkbox -->
            <input
              type="checkbox"
              :checked="t.status === 'completed' || t.completed === true"
              @change="toggleTaskComplete(t)"
              class="mt-0.5 w-5 h-5 rounded-lg text-emerald-600 border-slate-300 dark:border-slate-700 focus:ring-emerald-500 cursor-pointer"
              title="Mark complete"
            />

            <!-- Title & Metadata -->
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-1.5">
                <!-- Pinned Icon Badge -->
                <button
                  @click="toggleTaskPinAction(t)"
                  :class="['px-1.5 py-0.5 rounded text-[11px] font-bold transition-all', t.pinned ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'text-slate-400 hover:text-amber-500']"
                  :title="t.pinned ? 'Pinned to top (Click to unpin)' : 'Click to pin to top'"
                >
                  📌
                </button>

                <!-- Title -->
                <span :class="['font-bold text-sm sm:text-base leading-snug', (t.status === 'completed' || t.completed) ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white']">
                  {{ t.title }}
                </span>

                <!-- Priority Badge -->
                <span :class="['px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider', t.priority === 'urgent' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' : t.priority === 'high' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : t.priority === 'low' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400']">
                  {{ t.priority }}
                </span>

                <!-- Recurring Badge -->
                <span v-if="t.recurring && t.recurring !== 'none'" class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50">
                  🔁 {{ t.recurring }}
                </span>

                <!-- Estimated Time Badge -->
                <span v-if="t.estimatedTime > 0" class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  ⏱️ {{ formatEstimate(t.estimatedTime) }}
                </span>
              </div>

              <!-- Description -->
              <p v-if="t.description" class="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed whitespace-pre-line">{{ t.description }}</p>

              <!-- Attributes Pill Row -->
              <div class="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                <!-- Category -->
                <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                  {{ (t.category || 'General').replace(/_/g, ' ') }}
                </span>

                <!-- Assignee -->
                <span v-if="t.assignee" class="flex items-center gap-1 font-medium">
                  <span>👤</span>
                  <span>{{ t.assignee }}</span>
                </span>

                <!-- Relative Due Date -->
                <span v-if="t.dueDate" :class="['flex items-center gap-1 font-semibold', (new Date(t.dueDate) < new Date() && t.status !== 'completed' && !t.completed) ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300']">
                  <span>⏰</span>
                  <span>{{ formatRelativeDue(t.dueDate, t.dueTime) }}</span>
                </span>

                <!-- Tags -->
                <span v-for="tg in (t.tags || [])" :key="tg" class="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-medium text-[10px]">
                  #{{ tg }}
                </span>
              </div>
            </div>

            <!-- Card Action Buttons -->
            <div class="flex items-center gap-1 flex-shrink-0">
              <button @click="openTaskForm(t)" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs" title="Edit Task">✏️</button>
              <button @click="deleteTask(t._id)" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs" title="Delete Task">🗑</button>
            </div>
          </div>

          <!-- EXPANDABLE ACCORDIONS: SUBTASKS, NOTES, ATTACHMENTS -->
          <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold">
            <!-- Subtasks Toggle -->
            <button
              @click="toggleSubtasksExpanded(t._id)"
              class="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <span>☑️</span>
              <span>Subtasks ({{ (t.subtasks || []).filter(s => s.done).length }}/{{ (t.subtasks || []).length }})</span>
              <span>{{ expandedSubtasks[t._id] ? '▲' : '▼' }}</span>
            </button>

            <!-- Notes Toggle -->
            <button
              @click="toggleNotesExpanded(t._id)"
              class="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <span>💬</span>
              <span>Notes ({{ (t.notes || []).length }})</span>
              <span>{{ expandedNotes[t._id] ? '▲' : '▼' }}</span>
            </button>

            <!-- Attachments Toggle -->
            <button
              @click="toggleAttachmentsExpanded(t._id)"
              class="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <span>📎</span>
              <span>Files ({{ (t.attachments || []).length }})</span>
              <span>{{ expandedAttachments[t._id] ? '▲' : '▼' }}</span>
            </button>

            <!-- Quick Status Switcher -->
            <div class="ml-auto flex items-center gap-1">
              <span class="text-[10px] font-bold text-slate-400">Status:</span>
              <button @click="updateTaskStatus(t, 'todo')" :class="['px-2 py-0.5 rounded text-[10px] font-semibold', t.status === 'todo' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400']">To-Do</button>
              <button @click="updateTaskStatus(t, 'in_progress')" :class="['px-2 py-0.5 rounded text-[10px] font-semibold', t.status === 'in_progress' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400']">In-Prog</button>
              <button @click="updateTaskStatus(t, 'waiting')" :class="['px-2 py-0.5 rounded text-[10px] font-semibold', t.status === 'waiting' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400']">Wait</button>
              <button @click="updateTaskStatus(t, 'completed')" :class="['px-2 py-0.5 rounded text-[10px] font-semibold', t.status === 'completed' || t.completed ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400']">Done</button>
            </div>
          </div>

          <!-- EXPANDED SUBTASKS ACCORDION BODY -->
          <div v-if="expandedSubtasks[t._id]" class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Subtasks Checklist</span>
              <span class="text-[11px] text-slate-500">{{ (t.subtasks || []).filter(s => s.done).length }} of {{ (t.subtasks || []).length }} done</span>
            </div>

            <!-- Mini Progress for Subtasks -->
            <div v-if="t.subtasks && t.subtasks.length > 0" class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
              <div class="bg-indigo-600 h-1.5 rounded-full" :style="{ width: Math.round((t.subtasks.filter(s => s.done).length / t.subtasks.length) * 100) + '%' }"></div>
            </div>

            <!-- Subtask list -->
            <div class="space-y-1.5">
              <div v-for="sub in (t.subtasks || [])" :key="sub._id" class="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
                <label class="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                  <input type="checkbox" :checked="sub.done" @change="toggleSubtaskAction(t, sub)" class="rounded text-indigo-600 border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer" />
                  <span :class="['truncate', sub.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200']">{{ sub.text }}</span>
                </label>
                <button @click="deleteSubtaskAction(t, sub)" class="text-slate-400 hover:text-rose-500 text-xs px-1">✕</button>
              </div>
            </div>

            <!-- Add Subtask Input -->
            <div class="flex items-center gap-2 pt-1">
              <input
                type="text"
                v-model="taskSubtaskInputs[t._id]"
                @keyup.enter="addSubtaskAction(t)"
                placeholder="Add subtask step (Press Enter)..."
                class="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              <button @click="addSubtaskAction(t)" class="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm">
                Add
              </button>
            </div>
          </div>

          <!-- EXPANDED NOTES ACCORDION BODY -->
          <div v-if="expandedNotes[t._id]" class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div class="text-xs font-bold text-slate-700 dark:text-slate-300">Notes & Pastoral Updates Thread</div>

            <div v-if="!t.notes || t.notes.length === 0" class="text-xs text-slate-400 italic py-1">
              No notes yet. Add progress updates, prayer points, or remarks.
            </div>

            <!-- Notes List -->
            <div class="space-y-2">
              <div v-for="n in (t.notes || [])" :key="n._id" class="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
                <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                  <span>👤 {{ n.author || 'Admin' }} · {{ new Date(n.createdAt || Date.now()).toLocaleDateString() }}</span>
                  <button @click="deleteNoteAction(t, n)" class="text-slate-400 hover:text-rose-500 text-xs">✕</button>
                </div>
                <p class="text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">{{ n.text }}</p>
              </div>
            </div>

            <!-- Add Note Input -->
            <div class="flex items-center gap-2 pt-1">
              <input
                type="text"
                v-model="taskNoteInputs[t._id]"
                @keyup.enter="addNoteAction(t)"
                placeholder="Write a pastoral note or update..."
                class="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              <button @click="addNoteAction(t)" class="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm">
                Post Note
              </button>
            </div>
          </div>

          <!-- EXPANDED ATTACHMENTS ACCORDION BODY -->
          <div v-if="expandedAttachments[t._id]" class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div class="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Attached Documents & Photos</span>
              <label class="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] cursor-pointer shadow-sm">
                <span>📎 Upload File</span>
                <input type="file" @change="handleTaskAttachmentUpload(t, $event)" class="hidden" />
              </label>
            </div>

            <div v-if="!t.attachments || t.attachments.length === 0" class="text-xs text-slate-400 italic py-1">
              No files attached. You can attach PDFs, images, or documents up to 5MB.
            </div>

            <!-- Attachments list -->
            <div class="space-y-1.5">
              <div v-for="att in (t.attachments || [])" :key="att._id" class="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
                <a :href="att.data" :download="att.filename" class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline truncate">
                  <span>📄</span>
                  <span class="truncate font-medium">{{ att.filename }}</span>
                  <span class="text-[10px] text-slate-400 font-normal">({{ Math.round(att.size / 1024) }} KB)</span>
                </a>
                <button @click="deleteTaskAttachmentAction(t, att)" class="text-slate-400 hover:text-rose-500 text-xs px-1">✕</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- ========================================== -->
    <!-- TAB: CHURCH REPORTS & DATA QUALITY AUDIT   -->
    <!-- ========================================== -->
    <main v-if="currentTab === 'analytics'" class="space-y-4">
      <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Church Analytics & Health</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">Demographic insights & database integrity score</p>
        </div>
        <button @click="loadData" class="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold" title="Refresh Reports">
          🔄 Refresh
        </button>
      </div>

      <!-- Health Score Card -->
      <div class="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 shadow-sm flex items-center justify-between">
        <div>
          <div class="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Database Quality Score</div>
          <div class="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            {{ dataQuality?.healthScore !== undefined ? dataQuality.healthScore + '%' : '100%' }}
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {{ dataQuality?.inconsistencies?.length ? `${dataQuality.inconsistencies.length} record issue(s) detected` : 'All church records clean and validated' }}
          </div>
        </div>
        <div class="w-14 h-14 rounded-2xl bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-2xl">
          {{ (dataQuality?.healthScore || 100) >= 90 ? '🛡️' : '⚠️' }}
        </div>
      </div>

      <!-- Demographics Breakdown -->
      <div class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">📊 Member Demographics</h3>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span class="text-slate-600 dark:text-slate-400">Active Members</span>
            <span class="font-extrabold text-slate-900 dark:text-white">{{ churchStats?.members?.activeCount || activeCount }}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span class="text-slate-600 dark:text-slate-400">Inactive / Archived</span>
            <span class="font-extrabold text-slate-900 dark:text-white">{{ (churchStats?.members?.inactiveCount || 0) + (churchStats?.members?.archivedCount || 0) }}</span>
          </div>
        </div>

        <!-- Visual Age Distribution Bars -->
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div class="text-[11px] font-bold text-slate-500">Demographic Distribution</div>
          
          <div class="space-y-1.5 text-[11px]">
            <div>
              <div class="flex justify-between mb-0.5 text-slate-600 dark:text-slate-400">
                <span>Children & Teens (&lt;18)</span>
                <span class="font-bold">{{ members.filter(m => m.isChild || (getAge(m.dob) !== null && getAge(m.dob) < 18)).length }}</span>
              </div>
              <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div class="h-full bg-emerald-500 rounded-full" :style="{ width: `${totalCount ? (members.filter(m => m.isChild || (getAge(m.dob) !== null && getAge(m.dob) < 18)).length / totalCount * 100) : 0}%` }"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between mb-0.5 text-slate-600 dark:text-slate-400">
                <span>Youth & Young Adults (18-35)</span>
                <span class="font-bold">{{ members.filter(m => !m.isChild && getAge(m.dob) !== null && getAge(m.dob) >= 18 && getAge(m.dob) <= 35).length }}</span>
              </div>
              <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div class="h-full bg-indigo-500 rounded-full" :style="{ width: `${totalCount ? (members.filter(m => !m.isChild && getAge(m.dob) !== null && getAge(m.dob) >= 18 && getAge(m.dob) <= 35).length / totalCount * 100) : 0}%` }"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between mb-0.5 text-slate-600 dark:text-slate-400">
                <span>Adults (36-59)</span>
                <span class="font-bold">{{ members.filter(m => getAge(m.dob) !== null && getAge(m.dob) >= 36 && getAge(m.dob) < 60).length }}</span>
              </div>
              <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div class="h-full bg-blue-500 rounded-full" :style="{ width: `${totalCount ? (members.filter(m => getAge(m.dob) !== null && getAge(m.dob) >= 36 && getAge(m.dob) < 60).length / totalCount * 100) : 0}%` }"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between mb-0.5 text-slate-600 dark:text-slate-400">
                <span>Senior Citizens (60+)</span>
                <span class="font-bold">{{ members.filter(m => getAge(m.dob) !== null && getAge(m.dob) >= 60).length }}</span>
              </div>
              <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div class="h-full bg-purple-500 rounded-full" :style="{ width: `${totalCount ? (members.filter(m => getAge(m.dob) !== null && getAge(m.dob) >= 60).length / totalCount * 100) : 0}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Task Completion Stats -->
      <div class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">✅ Administrative Task Execution</h3>
        <div class="grid grid-cols-3 gap-2 text-center text-xs">
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div class="text-[10px] text-slate-400 uppercase font-bold">Total</div>
            <div class="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">{{ tasks.length }}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <div class="text-[10px] uppercase font-bold">Done</div>
            <div class="text-base font-extrabold mt-0.5">{{ tasks.filter(t => t.status === 'completed').length }}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <div class="text-[10px] uppercase font-bold">Overdue</div>
            <div class="text-base font-extrabold mt-0.5">{{ overdueTasksCount }}</div>
          </div>
        </div>
      </div>

      <!-- Data Quality Audit Inconsistencies -->
      <div class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">🛡️ Data Quality Audit</h3>
          <span class="text-xs text-indigo-600 dark:text-indigo-400 font-bold">{{ dataQuality?.inconsistencies?.length || 0 }} Issues</span>
        </div>

        <div v-if="!dataQuality?.inconsistencies?.length" class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <span>✅</span>
          <span>Zero data quality issues found. All records meet church consistency criteria!</span>
        </div>

        <div v-else class="space-y-2 max-h-64 overflow-y-auto">
          <div v-for="(issue, idx) in (dataQuality?.inconsistencies || [])" :key="idx" class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs flex items-start gap-2">
            <span class="text-amber-500 mt-0.5">⚠️</span>
            <div class="flex-1">
              <div class="font-bold text-slate-900 dark:text-white">{{ issue.name || 'Member Record' }}</div>
              <div class="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">{{ issue.issue }}</div>
            </div>
            <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400">{{ issue.type || 'Warning' }}</span>
          </div>
        </div>
      </div>

      <!-- Quick Duplicate Member Merger Tool -->
      <div class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">🔀 Member Profile Merger</h3>
          <span class="text-[10px] text-slate-400">Reconcile Duplicates</span>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">Merge a duplicate record into a primary member profile to consolidate contact and family details.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div>
            <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">Keep Primary Record</label>
            <select id="merge-target" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
              <option value="" disabled selected>Select primary member...</option>
              <option v-for="m in members" :key="m._id" :value="m._id">{{ m.name }} ({{ m.role || 'Member' }})</option>
            </select>
          </div>
          <div>
            <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">Merge & Archive Duplicate</label>
            <select id="merge-source" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
              <option value="" disabled selected>Select duplicate to merge...</option>
              <option v-for="m in members" :key="m._id" :value="m._id">{{ m.name }} ({{ m.role || 'Member' }})</option>
            </select>
          </div>
        </div>
        <button @click="() => {
          const t = document.getElementById('merge-target')?.value;
          const s = document.getElementById('merge-source')?.value;
          if (!t || !s) return tg.showAlert('Please select both a primary member and a duplicate member.');
          if (t === s) return tg.showAlert('Cannot merge a member into themselves.');
          mergeMemberAction(t, s);
        }" class="w-full py-2.5 rounded-xl btn-brand text-xs font-bold shadow-md">
          Consolidate & Merge Profiles
        </button>
      </div>

      <!-- System Error Logs & Audit Management Section -->
      <div class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">🚨 System Error Log & Diagnostics</h3>
            <span v-if="errorStats.unresolved > 0" class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              {{ errorStats.unresolved }} Unresolved
            </span>
            <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              0 Errors
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <button @click="loadErrorLogs" class="p-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
              🔄 Refresh
            </button>
            <button v-if="errorLogs.length > 0" @click="clearResolvedErrorsAction" class="p-1.5 px-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[11px] font-bold text-rose-600 dark:text-rose-400">
              🧹 Purge Resolved
            </button>
          </div>
        </div>

        <p class="text-xs text-slate-500 dark:text-slate-400">
          Automated audit trail capturing Telegram bot interactions, API exceptions, and system runtime errors. Inspect stack traces and click "Copy for Developer" to report issues.
        </p>

        <!-- Search and Filters Bar -->
        <div class="flex flex-wrap items-center gap-2 pt-1">
          <div class="relative flex-1 min-w-[160px]">
            <input
              type="text"
              v-model="errorSearch"
              @keyup.enter="loadErrorLogs"
              placeholder="Filter errors by message, endpoint, or user..."
              class="w-full py-1.5 pl-8 pr-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span class="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
          </div>

          <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              v-for="flt in [
                { id: 'all', label: 'All' },
                { id: 'unresolved', label: 'Active' },
                { id: 'resolved', label: 'Resolved' },
                { id: 'telegram', label: 'Telegram' },
                { id: 'express', label: 'API' }
              ]"
              :key="flt.id"
              @click="errorFilter = flt.id"
              class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
              :class="errorFilter === flt.id ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
            >
              {{ flt.label }}
            </button>
          </div>
        </div>

        <!-- Error List / Empty States -->
        <div v-if="errorLoading" class="py-8 text-center text-xs text-slate-400 animate-pulse">
          ⏳ Loading system audit logs...
        </div>

        <div v-else-if="!errorLogs.length" class="py-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
          <span class="text-xl block mb-1">✅</span>
          No errors recorded matching this criteria. System operating smoothly!
        </div>

        <div v-else class="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
          <div
            v-for="err in errorLogs"
            :key="err._id"
            class="p-3 rounded-xl border transition-all text-xs space-y-2 min-w-0 overflow-hidden"
            :class="err.resolved
              ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
              : 'bg-white dark:bg-[#1a2232] border-rose-200/80 dark:border-rose-900/40 shadow-xs'"
          >
            <!-- Header Row -->
            <div class="flex items-start justify-between gap-2 min-w-0">
              <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0 flex-1">
                <span
                  class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex-shrink-0"
                  :class="{
                    'bg-sky-500/15 text-sky-600 dark:text-sky-400': err.source === 'telegram',
                    'bg-amber-500/15 text-amber-600 dark:text-amber-400': err.source === 'express',
                    'bg-purple-500/15 text-purple-600 dark:text-purple-400': err.source === 'scheduler',
                    'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400': err.source === 'client',
                    'bg-rose-500/15 text-rose-600 dark:text-rose-400': err.source === 'system'
                  }"
                >
                  {{ err.source }}
                </span>
                <span v-if="err.endpoint" class="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded max-w-[180px] sm:max-w-xs md:max-w-sm truncate inline-block align-middle" :title="err.endpoint">
                  {{ formatEndpoint(err.endpoint) }}
                </span>
                <span v-if="err.statusCode" class="text-[10px] font-bold text-slate-500 flex-shrink-0">
                  HTTP {{ err.statusCode }}
                </span>
                <span class="text-[10px] text-slate-400 font-medium flex-shrink-0">
                  {{ new Date(err.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }} IST
                </span>
              </div>

              <!-- Quick Action Pills -->
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button
                  @click="copyErrorDetails(err)"
                  class="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center gap-1 transition-all"
                  title="Copy full markdown report to send to developer"
                >
                  📋 Copy for Dev
                </button>
                <button
                  v-if="!err.resolved"
                  @click="resolveErrorLogAction(err._id)"
                  class="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1 transition-all"
                  title="Mark as investigated and resolved"
                >
                  ✅ Resolve
                </button>
                <button
                  @click="deleteErrorLogAction(err._id)"
                  class="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-all text-[11px]"
                  title="Delete log"
                >
                  🗑
                </button>
              </div>
            </div>

            <!-- Error Message -->
            <div class="font-bold text-slate-900 dark:text-white leading-snug break-words">
              {{ err.message }}
            </div>

            <!-- Metadata info -->
            <div class="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 min-w-0 flex-wrap">
              <span v-if="err.userName || (err.userId && err.userId !== 'anonymous')" class="truncate max-w-[200px]">
                👤 User: <b class="text-slate-700 dark:text-slate-300">{{ err.userName || err.userId }}</b>
              </span>
              <span v-if="err.resolved" class="text-emerald-600 dark:text-emerald-400 font-bold flex-shrink-0">
                ✓ Resolved by {{ err.resolvedBy || 'Admin' }}
              </span>
              <button
                @click="toggleErrorExpanded(err._id)"
                class="ml-auto text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-[10px] flex-shrink-0"
              >
                {{ expandedErrorId === err._id ? '▲ Hide Stack & Context' : '▼ View Stack & Details' }}
              </button>
            </div>

            <!-- Expandable Stack Trace & Context -->
            <div v-if="expandedErrorId === err._id" class="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 min-w-0 overflow-hidden">
              <div v-if="err.stack" class="min-w-0">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Stack Trace</div>
                <pre class="p-2.5 rounded-lg bg-slate-950 text-rose-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-44">{{ err.stack }}</pre>
              </div>
              <div v-if="err.context && Object.keys(err.context).length > 0" class="min-w-0">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Execution Context</div>
                <pre class="p-2 rounded-lg bg-slate-900 text-slate-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-32">{{ JSON.stringify(err.context, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- ========================================== -->
    <!-- TAB 4: SYSTEM SETTINGS & DEV TOOLS         -->
    <!-- ========================================== -->
    <main v-if="currentTab === 'settings'" class="space-y-5">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">System Settings</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">AI Pastoral Prayers, automation controls, & backups</p>
      </div>

      <!-- AI Generative Wishing Config (Featured at top) -->
      <section class="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-purple-50/50 dark:from-indigo-950/40 dark:to-purple-950/20 border-2 border-indigo-200 dark:border-indigo-800 space-y-3.5 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">✨</div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">AI Pastoral Prayers & Wishing</h3>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">Google Gemini API key for dynamic Tamil pastoral blessings</p>
            </div>
          </div>
          <span class="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider" :class="settings.geminiApiKey ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'">
            {{ settings.geminiApiKey ? '● Gemini Connected' : '○ Curated Offline Mode' }}
          </span>
        </div>

        <div>
          <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">Google Gemini API Key (100% Free)</label>
          <div class="flex gap-2">
            <input type="password" v-model="settings.geminiApiKey" placeholder="Paste your Gemini AI Studio API key here (AIzaSy...)" class="flex-1 py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" />
            <button type="button" @click="testGeminiKey" :disabled="testingGemini" class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all flex-shrink-0 disabled:opacity-50">
              <span v-if="testingGemini">⏳ Testing...</span>
              <span v-else>⚡ Test Key</span>
            </button>
          </div>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-between">
            <span>Leave blank anytime to use built-in curated pastoral church blessings without an API key.</span>
            <button type="button" @click="saveSettings" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline ml-2">Quick Save Key</button>
          </p>
        </div>
      </section>

      <!-- Feature Automation Toggles -->
      <section class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
        <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Automations</h3>
        <label class="flex items-center justify-between py-1 cursor-pointer">
          <div>
            <div class="font-bold text-slate-900 dark:text-white text-sm">🎂 Birthday Automation</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">Post automated birthday wishes daily</div>
          </div>
          <input type="checkbox" v-model="settings.enableBirthdays" class="ios-switch" @change="showToast('Birthday setting saved')" />
        </label>
        <div class="border-t border-slate-200 dark:border-slate-800"></div>
        <label class="flex items-center justify-between py-1 cursor-pointer">
          <div>
            <div class="font-bold text-slate-900 dark:text-white text-sm">💍 Wedding Automation</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">Post wedding anniversary greetings daily</div>
          </div>
          <input type="checkbox" v-model="settings.enableWeddings" class="ios-switch" @change="showToast('Wedding setting saved')" />
        </label>
      </section>

      <!-- Message Templates Studio Direct Card -->
      <section class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm cursor-pointer hover:border-indigo-500/50 transition-all" @click="currentTab = 'templates'">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">📝</div>
            <div>
              <div class="font-bold text-slate-900 dark:text-white text-sm">Message Templates Studio</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">{{ templates.length }} active templates for birthdays & weddings</div>
            </div>
          </div>
          <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400">Manage →</span>
        </div>
      </section>

      <!-- Broadcast Schedule -->
      <section class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
        <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Daily Schedule (IST)</h3>
        <div class="flex items-center justify-between py-1">
          <span class="text-sm font-semibold text-slate-800 dark:text-slate-200">Daily Morning Post</span>
          <input type="time" v-model="settings.sendTime" class="w-32 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold text-center focus:outline-none" @change="showToast('Broadcast time updated')" />
        </div>
        <div class="border-t border-slate-200 dark:border-slate-800"></div>
        <div class="flex items-center justify-between py-1">
          <span class="text-sm font-semibold text-slate-800 dark:text-slate-200">Admin Night Reminder</span>
          <input type="time" v-model="settings.reminderTime" class="w-32 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold text-center focus:outline-none" @change="showToast('Reminder time updated')" />
        </div>
      </section>

      <!-- Dynamic Custom Fields Builder -->
      <section class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Custom Member Attributes</h3>
          <button @click="settings.customFields.push({ id: 'custom_' + Date.now(), label: '', type: 'text' })" class="text-indigo-600 dark:text-indigo-400 font-bold text-xs">+ Add Attribute</button>
        </div>
        <div v-for="(field, idx) in settings.customFields" :key="idx" class="flex items-center gap-2">
          <input type="text" v-model="field.label" placeholder="e.g. Blood Group, Area..." class="flex-1 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <select v-model="field.type" class="w-24 py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:outline-none">
            <option value="text">Text</option>
            <option value="date">Date</option>
            <option value="number">Number</option>
          </select>
          <button @click="settings.customFields.splice(idx, 1); showToast('Attribute removed')" class="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-100 flex items-center justify-center">✕</button>
        </div>
        <div v-if="!settings.customFields?.length" class="text-center py-2 text-xs text-slate-400">No custom attributes defined.</div>
      </section>

      <button @click="saveSettings" class="btn-brand w-full py-3.5 text-sm shadow-md" :disabled="saving">
        <span v-if="saving">⏳ Saving Preferences...</span>
        <span v-else>💾 Save All Preferences</span>
      </button>

      <!-- Tools & Database Operations -->
      <section class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
        <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Operations & Backups</h3>
        <div class="grid grid-cols-2 gap-2">
          <button @click="openImportModal" class="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-50 border border-blue-200 dark:border-blue-900 text-left transition-colors">
            <div class="text-base">📤</div>
            <div class="font-bold text-blue-900 dark:text-blue-300 text-xs mt-1">Bulk CSV Import</div>
            <div class="text-[10px] text-blue-600 dark:text-blue-400">Upload 500+ members</div>
          </button>
          <button @click="exportCSV" class="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-50 border border-emerald-200 dark:border-emerald-900 text-left transition-colors">
            <div class="text-base">📥</div>
            <div class="font-bold text-emerald-900 dark:text-emerald-300 text-xs mt-1">Download CSV</div>
            <div class="text-[10px] text-emerald-600 dark:text-emerald-400">Export database backup</div>
          </button>
          <button @click="openDirectory" class="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 hover:bg-purple-50 border border-purple-200 dark:border-purple-900 text-left transition-colors">
            <div class="text-base">🖨️</div>
            <div class="font-bold text-purple-900 dark:text-purple-300 text-xs mt-1">Print Directory</div>
            <div class="text-[10px] text-purple-600 dark:text-purple-400">Printable Church PDF</div>
          </button>
          <button @click="triggerAction('trigger-today')" class="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-50 border border-indigo-200 dark:border-indigo-900 text-left transition-colors">
            <div class="text-base">📋</div>
            <div class="font-bold text-indigo-900 dark:text-indigo-300 text-xs mt-1">Scan Today's Review</div>
            <div class="text-[10px] text-indigo-600 dark:text-indigo-400">Prepare greetings for review</div>
          </button>
        </div>
      </section>

      <!-- Disaster Recovery & Automated Backup Health Card -->
      <section class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-3.5 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              🛡️
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">Disaster Recovery & Backup Health</h3>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">Automated integrity checks on database dump archives</p>
            </div>
          </div>
          <span v-if="backupHealth" class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
            ● 100% Restorable
          </span>
        </div>

        <div v-if="backupHealth" class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Total Records</div>
            <div class="text-sm font-black text-slate-900 dark:text-white mt-0.5">{{ backupHealth.totalRecords }} docs</div>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Collections</div>
            <div class="text-sm font-black text-slate-900 dark:text-white mt-0.5">{{ backupHealth.collectionsCount }} tracked</div>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Archive Size</div>
            <div class="text-sm font-black text-slate-900 dark:text-white mt-0.5">{{ backupHealth.archiveSizeKb }} KB</div>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Integrity</div>
            <div class="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">Verified OK</div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
          <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            <span v-if="backupHealth">Archive: <code class="font-mono text-[10px]">{{ backupHealth.archiveName }}</code></span>
            <span v-else>No backup verification run yet in this session.</span>
          </div>
          <button
            type="button"
            @click="runBackupVerificationAction"
            :disabled="backupVerifying"
            class="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all"
          >
            <span v-if="backupVerifying">⏳ Inspecting Archive...</span>
            <span v-else>⚡ Verify Backup Integrity Now</span>
          </button>
        </div>
      </section>

      <!-- Authorized Leaders & User Management Section -->
      <!-- Authorized Leaders & User Access Control (RBAC & CRUD) Section -->
      <section class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Authorized Leaders & Access Control</span>
            </h3>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">Full RBAC, granular CRUD permissions & Telegram account management</p>
          </div>
          <div class="flex items-center gap-2">
            <button @click="openAddUserModal()" class="btn-brand px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1">
              <span>➕</span>
              <span>Add Leader</span>
            </button>
            <button @click="openInviteModal()" :disabled="generatingInvite" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 border border-slate-200 dark:border-slate-700">
              <span>🔗</span>
              <span>Invite Link</span>
            </button>
          </div>
        </div>

        <!-- Filter Tabs & Quick Search -->
        <div class="flex flex-col sm:flex-row gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          <div class="flex items-center gap-1 text-[11px] font-bold overflow-x-auto pb-1 sm:pb-0">
            <button @click="userFilter = 'all'" :class="['px-2.5 py-1 rounded-lg transition-all', userFilter === 'all' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400']">
              All ({{ authorizedUsers.length }})
            </button>
            <button @click="userFilter = 'active'" :class="['px-2.5 py-1 rounded-lg transition-all', userFilter === 'active' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400']">
              Active ({{ activeUsersCount }})
            </button>
            <button @click="userFilter = 'pending'" :class="['px-2.5 py-1 rounded-lg transition-all', userFilter === 'pending' ? 'bg-sky-600 text-white font-bold shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400']">
              Pending ({{ pendingUsersCount }})
            </button>
            <button @click="userFilter = 'suspended'" :class="['px-2.5 py-1 rounded-lg transition-all', userFilter === 'suspended' ? 'bg-amber-600 text-white font-bold shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400']">
              Suspended ({{ suspendedUsersCount }})
            </button>
          </div>
          <div class="flex-1">
            <input v-model="userSearch" type="text" placeholder="Search by name, @username, or ID..." class="w-full text-xs px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>

        <!-- Super Admin Pinned Owner Card -->
        <div v-if="superAdminId" class="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-between text-xs shadow-sm">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">👑</span>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-extrabold text-slate-900 dark:text-white">Primary Super Admin</span>
                <span class="px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-extrabold uppercase">Owner</span>
              </div>
              <div class="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                ID: {{ superAdminId }} • Root access across all systems
              </div>
            </div>
          </div>
          <span class="text-[10px] font-bold text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-amber-200 dark:border-amber-900">
            Unrestricted
          </span>
        </div>

        <!-- Active Invite Link Banner (if generated) -->
        <div v-if="activeInviteUrl" class="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
          <div class="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <span>🔗</span>
              <span>Active One-Click Invite Link:</span>
            </span>
            <button @click="activeInviteUrl = ''" class="text-slate-400 hover:text-slate-600 text-xs font-bold">✕</button>
          </div>
          <div class="p-2 rounded-lg bg-white dark:bg-slate-900 font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all select-all border border-indigo-100 dark:border-indigo-900">
            {{ activeInviteUrl }}
          </div>
          <div class="flex gap-2">
            <button @click="copyInviteLink" class="flex-1 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-sm hover:bg-indigo-700 transition-colors">
              📋 Copy Link
            </button>
            <button @click="shareInviteWhatsApp" class="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 transition-colors">
              📲 Share on WhatsApp
            </button>
          </div>
          <p class="text-[10px] text-indigo-700 dark:text-indigo-300">💡 When recipient taps this link and presses Start, their access is activated instantly with assigned permissions!</p>
        </div>

        <!-- Authorized Users Roster (CRUD List) -->
        <div v-if="filteredAuthorizedUsers && filteredAuthorizedUsers.length > 0" class="space-y-2 pt-1">
          <div v-for="u in filteredAuthorizedUsers" :key="u._id" class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/40 space-y-2">
            <!-- User Header Row -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-start gap-2.5">
                <div class="w-8 h-8 rounded-xl font-bold text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5" :style="avatarStyle(u.name)">
                  {{ getInitials(u.name) }}
                </div>
                <div>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="font-bold text-slate-900 dark:text-white text-xs">{{ u.name }}</span>
                    <a v-if="u.username" :href="'https://t.me/' + u.username" target="_blank" class="text-indigo-600 dark:text-indigo-400 font-medium text-[11px] hover:underline">@{{ u.username }}</a>
                    
                    <!-- Role Pill -->
                    <span :class="['px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase', 
                      u.role === 'admin' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' :
                      u.role === 'pastor' ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' :
                      u.role === 'staff' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
                      'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300']">
                      {{ u.role === 'admin' ? '👑 Admin' : u.role === 'pastor' ? '✝️ Pastor' : u.role === 'staff' ? '👤 Staff' : '🤝 Volunteer' }}
                    </span>

                    <!-- Status Pill -->
                    <span :class="['px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                      u.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' :
                      u.status === 'suspended' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' :
                      u.status === 'pending' ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300' :
                      'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300']">
                      {{ u.status }}
                    </span>
                  </div>

                  <div class="text-[10px] text-slate-400 font-mono mt-0.5">
                    ID: <code>{{ u.telegramId }}</code> <span v-if="u.addedBy">• Added by {{ u.addedBy }}</span>
                  </div>
                </div>
              </div>

              <!-- Quick CRUD Actions for User -->
              <div class="flex items-center gap-1">
                <!-- Pending Approval Buttons -->
                <button v-if="u.status === 'pending' && !u.telegramId.startsWith('pending_invite_')" @click="approveUserAction(u.telegramId, 'admin', u.name)" class="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow-sm" title="Approve as Co-Admin">
                  ✅ Approve
                </button>
                <button v-if="u.status === 'pending' && !u.telegramId.startsWith('pending_invite_')" @click="approveUserAction(u.telegramId, 'staff', u.name)" class="px-2 py-1 rounded-lg bg-blue-600 text-white font-bold text-[10px] hover:bg-blue-700 shadow-sm" title="Approve as Staff">
                  👤 Staff
                </button>

                <!-- Edit Button -->
                <button @click="openEditUserModal(u)" class="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs" title="Edit permissions & role">
                  ✏️
                </button>

                <!-- Toggle Active / Suspended Button -->
                <button v-if="u.status === 'active' || u.status === 'suspended'" @click="toggleUserStatusAction(u)" :class="['px-2 py-1 rounded-lg font-bold text-[10px] transition-colors', u.status === 'active' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800']" :title="u.status === 'active' ? 'Suspend User Access' : 'Reactivate User'">
                  {{ u.status === 'active' ? '⏸️ Suspend' : '▶️ Activate' }}
                </button>

                <!-- Delete / Remove Button -->
                <button @click="deleteUserAction(u)" class="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs" title="Permanently delete user">
                  🗑️
                </button>
              </div>
            </div>

            <!-- Permissions Tags Preview -->
            <div class="flex flex-wrap gap-1 pt-1 border-t border-slate-200/50 dark:border-slate-700/30 text-[10px]">
              <span v-if="u.permissions?.canManageMembers" class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">👥 Members</span>
              <span v-if="u.permissions?.canDeleteMembers" class="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-medium">🗑️ Del</span>
              <span v-if="u.permissions?.canSendGreetings" class="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-medium">💌 Wishes</span>
              <span v-if="u.permissions?.canManageTemplates" class="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium">📝 Templates</span>
              <span v-if="u.permissions?.canManageEvents" class="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-medium">🗓️ Events</span>
              <span v-if="u.permissions?.canManageTasks" class="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-medium">✅ Tasks</span>
              <span v-if="u.permissions?.canExportData" class="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-medium">📊 Export</span>
              <span v-if="u.permissions?.canManageUsers" class="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 font-semibold">⚙️ Users</span>
              <span v-if="u.notes" class="text-slate-400 italic ml-1">"{{ u.notes }}"</span>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-6 text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <p class="font-semibold">No leaders found matching filter.</p>
          <p class="text-[11px] mt-1">Tap <b>Add Leader</b> to register directly or <b>Invite Link</b> to generate an onboarding URL.</p>
        </div>
      </section>
    </main>

    <!-- ========================================== -->
    <!-- MODAL 1: LIVE WISH PREVIEW & SENDER       -->
    <!-- ========================================== -->
    <transition name="fade">
      <div v-if="wishModal.open" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div class="w-full max-w-md max-h-[92vh] overflow-y-auto p-5 rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#151c28] border-t md:border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl transition-all duration-300" @click.stop>
          <div class="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-1 md:hidden"></div>
          <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="text-xl">✨</span>
              <h3 class="font-bold text-slate-900 dark:text-white text-base">Live Wish Dispatcher</h3>
            </div>
            <div class="flex items-center gap-2">
              <button @click="wishModal.open = false" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 flex items-center justify-center">✕</button>
            </div>
          </div>

          <div v-if="wishModal.loading" class="text-center py-10 space-y-2">
            <div class="animate-spin text-2xl">⏳</div>
            <p class="text-sm text-slate-500 dark:text-slate-400 font-semibold">Preparing Greeting Card...</p>
          </div>

          <div v-else class="space-y-3">

            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
              <div class="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div class="w-8 h-8 rounded-xl font-bold text-white text-xs flex items-center justify-center flex-shrink-0" :style="avatarStyle(wishModal.member?.name)">
                  {{ getInitials(wishModal.member?.name) }}
                </div>
                <div>
                  <div class="font-bold text-slate-900 dark:text-white text-xs">{{ wishModal.member?.name }}</div>
                  <div class="text-[10px] text-slate-400">WhatsApp / Telegram Ready Preview</div>
                </div>
              </div>
              <textarea v-model="wishModal.text" rows="6" class="w-full text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans bg-transparent resize-none focus:outline-none"></textarea>
            </div>

            <!-- WhatsApp Status Poster Preview -->
            <div v-if="wishModal.cardDataUrl" class="rounded-2xl overflow-hidden border border-amber-500/40 shadow-xl relative bg-slate-950 p-1">
              <img :src="wishModal.cardDataUrl" class="w-full max-h-56 object-contain rounded-xl" alt="Celebration Card Poster" />
              <button @click="downloadStatusCardAction" class="w-full mt-1.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow flex items-center justify-center gap-1.5 transition-transform active:scale-98">
                <span>📥 Download High-Res Poster (PNG)</span>
              </button>
            </div>

            <div class="flex flex-col gap-2 pt-1">
              <div class="grid grid-cols-2 gap-2">
                <button @click="openWhatsAppWish" class="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all">
                  <span>📲 Share WhatsApp</span>
                </button>
                <button @click="generateStatusCardAction" :disabled="wishModal.cardGenerating" class="py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50">
                  <span v-if="wishModal.cardGenerating" class="animate-spin text-xs">⏳</span>
                  <span v-else>🎨</span>
                  <span>{{ wishModal.cardDataUrl ? 'Regenerate Poster' : 'Create Status Poster' }}</span>
                </button>
              </div>

              <div class="flex gap-2">
                <button type="button" @click="regenerateWish()" class="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                  <span>🔄</span>
                  <span>Regenerate Text</span>
                </button>
                <button @click="copyWishToClipboard" class="btn-brand flex-1 py-2.5 text-xs font-bold shadow-md flex items-center justify-center gap-1.5">
                  <span>📋 Copy Text</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ========================================== -->
    <!-- MODAL 2: BULK CSV SPREADSHEET IMPORT       -->
    <!-- ========================================== -->
    <transition name="fade">
      <div v-if="importModal.open" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div class="w-full max-w-md p-5 rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#151c28] border-t md:border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl transition-all duration-300" @click.stop>
          <div class="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-1 md:hidden"></div>
          <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="text-xl">📤</span>
              <h3 class="font-bold text-slate-900 dark:text-white text-base">Bulk CSV Import</h3>
            </div>
            <button @click="importModal.open = false" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 flex items-center justify-center">✕</button>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Upload your Church Excel or CSV file. Supported headers: <code>name, gender, role, dob, weddingDate, familyName, spouseName</code>.
          </p>

          <input type="file" accept=".csv" @change="parseCSVFile" class="block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 dark:file:bg-indigo-950 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 cursor-pointer" />

          <div v-if="importModal.parsedMembers.length > 0" class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <div class="text-xs font-bold text-emerald-700 dark:text-emerald-300">✅ {{ importModal.parsedMembers.length }} Members Ready to Import</div>
            <div class="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">Sample: {{ importModal.parsedMembers[0]?.name }} ({{ importModal.parsedMembers[0]?.gender }})</div>
          </div>

          <div v-if="importModal.error" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 font-semibold">
            {{ importModal.error }}
          </div>

          <button @click="executeBulkImport" :disabled="!importModal.parsedMembers.length || importModal.importing" class="btn-brand w-full py-3.5 text-xs font-bold shadow-md">
            <span v-if="importModal.importing">⏳ Importing Members...</span>
            <span v-else>🎉 Start Import ({{ importModal.parsedMembers.length }} Members)</span>
          </button>
        </div>
      </div>
    </transition>

    <!-- ========================================== -->
    <!-- MODAL 3: CHURCH EVENT FORM MODAL           -->
    <!-- ========================================== -->
    <transition name="fade">
      <div v-if="eventModalOpen" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div class="w-full max-w-md p-5 rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#151c28] border-t md:border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto transition-all duration-300" @click.stop>
          <div class="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-1 md:hidden"></div>
          <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="text-xl">📅</span>
              <h3 class="font-bold text-slate-900 dark:text-white text-base">{{ eventForm._id ? 'Edit Church Event' : 'Add Church Event' }}</h3>
            </div>
            <button @click="eventModalOpen = false" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 flex items-center justify-center">✕</button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Event Title *</label>
              <input type="text" v-model="eventForm.title" placeholder="e.g. Sunday Worship & Lord's Supper" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Category</label>
                <select v-model="eventForm.category" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none">
                  <option value="worship_service">Worship Service</option>
                  <option value="prayer_meeting">Prayer Meeting</option>
                  <option value="fellowship">Fellowship</option>
                  <option value="special_service">Special Service</option>
                  <option value="meeting">Admin Meeting</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Status</label>
                <select v-model="eventForm.status" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none">
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Date *</label>
                <input type="date" v-model="eventForm.startDate" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
              </div>
              <div>
                <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Time</label>
                <input type="time" v-model="eventForm.startTime" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
              </div>
            </div>

            <div>
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Venue / Location</label>
              <input type="text" v-model="eventForm.venue" placeholder="SPBC Church Hall" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
            </div>

            <div>
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Description / Details</label>
              <textarea v-model="eventForm.description" rows="2" placeholder="Sermon text, speaker, choir info..." class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none"></textarea>
            </div>

            <div class="flex gap-2 pt-2">
              <button @click="saveEvent" :disabled="saving" class="btn-brand flex-1 py-3 text-xs font-bold shadow-md">
                <span v-if="saving">Saving...</span>
                <span v-else>💾 Save Event</span>
              </button>
              <button v-if="eventForm._id" @click="deleteEvent(eventForm._id); eventModalOpen = false" class="px-3 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-100 text-xs border border-rose-200 dark:border-rose-800">
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ========================================== -->
    <!-- MODAL 4: TASK FORM MODAL                   -->
    <!-- ========================================== -->
    <transition name="fade">
      <div v-if="taskModalOpen" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div class="w-full max-w-lg p-5 rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#151c28] border-t md:border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto transition-all duration-300" @click.stop>
          <div class="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-1 md:hidden"></div>
          <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="text-xl">📋</span>
              <h3 class="font-bold text-slate-900 dark:text-white text-base">{{ taskForm._id ? 'Edit Church Task' : 'Add Church Task' }}</h3>
            </div>
            <button @click="taskModalOpen = false" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 flex items-center justify-center">✕</button>
          </div>

          <div class="space-y-3.5 text-xs">
            <!-- Title -->
            <div>
              <label class="font-bold text-slate-700 dark:text-slate-300">Task Title *</label>
              <input type="text" v-model="taskForm.title" placeholder="e.g. Hospital visitation for Elder Thomas" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <!-- Description -->
            <div>
              <label class="font-bold text-slate-700 dark:text-slate-300">Description / Details</label>
              <textarea v-model="taskForm.description" rows="2" placeholder="Full details, pastoral prayer items, agenda..." class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
            </div>

            <!-- Category & Priority -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="font-bold text-slate-700 dark:text-slate-300">Category</label>
                <select v-model="taskForm.category" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none">
                  <option value="pastoral_care">Pastoral Care</option>
                  <option value="event_prep">Event Prep</option>
                  <option value="admin">Administration</option>
                  <option value="facility">Facility / Sound</option>
                  <option value="follow_up">Member Follow-up</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label class="font-bold text-slate-700 dark:text-slate-300">Priority</label>
                <select v-model="taskForm.priority" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none">
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="high">🟠 High</option>
                  <option value="urgent">🔴 Urgent</option>
                </select>
              </div>
            </div>

            <!-- Due Date & Due Time -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="font-bold text-slate-700 dark:text-slate-300">Due Date</label>
                <input type="date" v-model="taskForm.dueDate" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none" />
              </div>
              <div>
                <label class="font-bold text-slate-700 dark:text-slate-300">Due Time</label>
                <input type="time" v-model="taskForm.dueTime" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none" />
              </div>
            </div>

            <!-- Assignee & Estimated Time -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="font-bold text-slate-700 dark:text-slate-300">Assignee</label>
                <input type="text" v-model="taskForm.assignee" placeholder="e.g. Pastor / Deacon" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none" />
              </div>
              <div>
                <label class="font-bold text-slate-700 dark:text-slate-300">Estimated Time (mins)</label>
                <input type="number" v-model="taskForm.estimatedTime" placeholder="e.g. 60 (1 hour)" min="0" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none" />
              </div>
            </div>

            <!-- Status & Recurring -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="font-bold text-slate-700 dark:text-slate-300">Status</label>
                <select v-model="taskForm.status" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none">
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting">Waiting</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label class="font-bold text-slate-700 dark:text-slate-300">Recurring</label>
                <select v-model="taskForm.recurring" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none">
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <!-- Pin To Top Checkbox -->
            <label class="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 cursor-pointer">
              <input type="checkbox" v-model="taskForm.pinned" class="w-4 h-4 rounded text-amber-600 border-slate-300 dark:border-slate-600 focus:ring-amber-500 cursor-pointer" />
              <span class="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>📌</span>
                <span>Pin this task to top of dashboard</span>
              </span>
            </label>

            <!-- Tags Manager -->
            <div>
              <label class="font-bold text-slate-700 dark:text-slate-300">Tags</label>
              <div class="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  v-model="taskForm.tagInput"
                  @keyup.enter.prevent="addTagToForm"
                  placeholder="Type tag and press Enter (e.g. youth, visitation)..."
                  class="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                />
                <button type="button" @click="addTagToForm" class="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300">
                  + Add
                </button>
              </div>
              <div v-if="taskForm.tags && taskForm.tags.length > 0" class="flex flex-wrap items-center gap-1.5 mt-2">
                <span v-for="tag in taskForm.tags" :key="tag" class="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 text-[11px] font-semibold flex items-center gap-1">
                  <span>#{{ tag }}</span>
                  <button type="button" @click="removeTagFromForm(tag)" class="text-indigo-400 hover:text-indigo-600 font-bold ml-0.5">✕</button>
                </span>
              </div>
            </div>

            <!-- Subtasks Manager -->
            <div>
              <label class="font-bold text-slate-700 dark:text-slate-300">Checklist Subtasks</label>
              <div class="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  v-model="taskForm.subtaskInput"
                  @keyup.enter.prevent="addSubtaskToForm"
                  placeholder="Add step and press Enter..."
                  class="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                />
                <button type="button" @click="addSubtaskToForm" class="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300">
                  + Add
                </button>
              </div>
              <div v-if="taskForm.subtasks && taskForm.subtasks.length > 0" class="space-y-1 mt-2">
                <div v-for="(sub, idx) in taskForm.subtasks" :key="idx" class="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <span class="truncate text-slate-800 dark:text-slate-200">▫️ {{ sub.text }}</span>
                  <button type="button" @click="removeSubtaskFromForm(idx)" class="text-slate-400 hover:text-rose-500 font-bold px-1">✕</button>
                </div>
              </div>
            </div>

            <div class="flex gap-2 pt-2">
              <button @click="saveTask" :disabled="saving" class="btn-brand flex-1 py-3 text-xs font-bold shadow-md">
                <span v-if="saving">Saving...</span>
                <span v-else>💾 Save Task</span>
              </button>
              <button v-if="taskForm._id" @click="deleteTask(taskForm._id); taskModalOpen = false" class="px-3 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-100 text-xs border border-rose-200 dark:border-rose-800">
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ========================================== -->
    <!-- MODAL 5: ADD / EDIT LEADER & ACCESS CONTROL -->
    <!-- ========================================== -->
    <transition name="fade">
      <div v-if="userModalOpen" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4 overflow-y-auto">
        <div class="w-full max-w-lg p-5 rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#151c28] border-t md:border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto transition-all duration-300 my-0 md:my-8" @click.stop>
          <div class="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-1 md:hidden"></div>
          <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="text-xl">{{ isEditingUser ? '✏️' : '➕' }}</span>
              <h3 class="font-bold text-slate-900 dark:text-white text-base">
                {{ isEditingUser ? 'Edit Leader & Access Control' : 'Add Authorized Leader' }}
              </h3>
            </div>
            <button @click="userModalOpen = false" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 flex items-center justify-center">✕</button>
          </div>

          <div class="space-y-3.5 text-xs">
            <!-- Telegram ID -->
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Telegram User ID <span class="text-rose-500">*</span></label>
              <input v-model="userForm.telegramId" :disabled="isEditingUser" type="text" placeholder="Numeric ID, e.g. 123456789" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-60" />
              <p class="text-[10px] text-slate-400 mt-1">💡 Ask user to forward any message to @userinfobot or @raw_data_bot on Telegram to get their numeric ID.</p>
            </div>

            <!-- Full Name & Username -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name <span class="text-rose-500">*</span></label>
                <input v-model="userForm.name" type="text" placeholder="e.g. Pastor Paul" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Telegram @Username (Optional)</label>
                <input v-model="userForm.username" type="text" placeholder="e.g. paul_pastor" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" />
              </div>
            </div>

            <!-- Role & Status -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Church Role</label>
                <select v-model="userForm.role" @change="onUserRoleChange" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold">
                  <option value="admin">👑 Co-Admin (Full Administrative)</option>
                  <option value="pastor">✝️ Pastor (Pastoral Care & Roster)</option>
                  <option value="staff">👤 Staff (Daily Operations)</option>
                  <option value="volunteer">🤝 Volunteer (Greetings & View)</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                <select v-model="userForm.status" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold">
                  <option value="active">Active (Full Bot Access)</option>
                  <option value="suspended">Suspended (Access Temporarily Paused)</option>
                  <option value="pending">Pending Approval</option>
                </select>
              </div>
            </div>

            <!-- Granular Permissions Grid -->
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Granular Access Permissions (RBAC)</span>
                <span class="text-[10px] text-slate-400 font-normal">Auto-preset by role; customized below</span>
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <input type="checkbox" v-model="userForm.permissions.canManageMembers" class="rounded text-indigo-600 w-4 h-4" />
                  <div>
                    <div class="font-bold text-slate-800 dark:text-slate-200">👥 Manage Members</div>
                    <div class="text-[10px] text-slate-400">View, add, edit roster</div>
                  </div>
                </label>
                <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <input type="checkbox" v-model="userForm.permissions.canDeleteMembers" class="rounded text-indigo-600 w-4 h-4" />
                  <div>
                    <div class="font-bold text-rose-600 dark:text-rose-400">🗑️ Delete Members</div>
                    <div class="text-[10px] text-slate-400">Archive, delete & merge</div>
                  </div>
                </label>
                <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <input type="checkbox" v-model="userForm.permissions.canSendGreetings" class="rounded text-indigo-600 w-4 h-4" />
                  <div>
                    <div class="font-bold text-slate-800 dark:text-slate-200">💌 Send Greetings</div>
                    <div class="text-[10px] text-slate-400">Wishes & broadcasts</div>
                  </div>
                </label>
                <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <input type="checkbox" v-model="userForm.permissions.canManageTemplates" class="rounded text-indigo-600 w-4 h-4" />
                  <div>
                    <div class="font-bold text-slate-800 dark:text-slate-200">📝 Templates</div>
                    <div class="text-[10px] text-slate-400">Edit greeting texts</div>
                  </div>
                </label>
                <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <input type="checkbox" v-model="userForm.permissions.canManageEvents" class="rounded text-indigo-600 w-4 h-4" />
                  <div>
                    <div class="font-bold text-slate-800 dark:text-slate-200">🗓️ Church Events</div>
                    <div class="text-[10px] text-slate-400">Calendar scheduling</div>
                  </div>
                </label>
                <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <input type="checkbox" v-model="userForm.permissions.canManageTasks" class="rounded text-indigo-600 w-4 h-4" />
                  <div>
                    <div class="font-bold text-slate-800 dark:text-slate-200">✅ Pastoral Tasks</div>
                    <div class="text-[10px] text-slate-400">Create & complete tasks</div>
                  </div>
                </label>
                <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <input type="checkbox" v-model="userForm.permissions.canExportData" class="rounded text-indigo-600 w-4 h-4" />
                  <div>
                    <div class="font-bold text-slate-800 dark:text-slate-200">📊 Export Data</div>
                    <div class="text-[10px] text-slate-400">Download CSV & ICS</div>
                  </div>
                </label>
                <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <input type="checkbox" v-model="userForm.permissions.canManageUsers" class="rounded text-indigo-600 w-4 h-4" />
                  <div>
                    <div class="font-bold text-red-600 dark:text-red-400">⚙️ User Management</div>
                    <div class="text-[10px] text-slate-400">Add/edit other leaders</div>
                  </div>
                </label>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Administrative Notes (Optional)</label>
              <input v-model="userForm.notes" type="text" placeholder="e.g. Media Team Lead, Youth Coordinator" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" />
            </div>

            <!-- Submit Buttons -->
            <div class="flex items-center gap-2 pt-2">
              <button @click="userModalOpen = false" type="button" class="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200">
                Cancel
              </button>
              <button @click="saveUserAction" :disabled="userSaving" type="button" class="btn-brand flex-1 py-2.5 rounded-xl font-bold shadow-md">
                <span v-if="userSaving">Saving...</span>
                <span v-else-if="isEditingUser">Save Changes</span>
                <span v-else>Create Leader</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ========================================== -->
    <!-- MODAL 6: CONFIGURE & GENERATE INVITE LINK -->
    <!-- ========================================== -->
    <transition name="fade">
      <div v-if="inviteModalOpen" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4 overflow-y-auto">
        <div class="w-full max-w-md p-5 rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#151c28] border-t md:border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto transition-all duration-300 my-0 md:my-8" @click.stop>
          <div class="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-1 md:hidden"></div>
          <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="text-xl">🔗</span>
              <h3 class="font-bold text-slate-900 dark:text-white text-base">Generate 1-Click Invite Link</h3>
            </div>
            <button @click="inviteModalOpen = false" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 flex items-center justify-center">✕</button>
          </div>

          <div class="space-y-3.5 text-xs">
            <p class="text-slate-500 dark:text-slate-400">
              The recipient can tap this link in WhatsApp or Telegram and will be automatically registered with the selected role upon tapping Start.
            </p>

            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Role</label>
              <select v-model="inviteRole" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold">
                <option value="admin">👑 Co-Admin (Full Administrative)</option>
                <option value="pastor">✝️ Pastor (Pastoral Care & Roster)</option>
                <option value="staff">👤 Church Staff (Daily Operations)</option>
                <option value="volunteer">🤝 Volunteer (Greetings & View)</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Link Expiration</label>
              <select v-model="inviteHours" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold">
                <option :value="24">24 Hours (1 Day)</option>
                <option :value="48">48 Hours (2 Days)</option>
                <option :value="72">72 Hours (3 Days - Recommended)</option>
                <option :value="168">7 Days (1 Week)</option>
              </select>
            </div>

            <div class="flex items-center gap-2 pt-2">
              <button @click="inviteModalOpen = false" type="button" class="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200">
                Cancel
              </button>
              <button @click="generateInviteLink(inviteRole, inviteHours)" :disabled="generatingInvite" type="button" class="btn-brand flex-1 py-2.5 rounded-xl font-bold shadow-md">
                <span v-if="generatingInvite">Generating...</span>
                <span v-else>Create Invite Link</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ========================================== -->
    <!-- FORMS: SPEED MEMBER REGISTRATION FORM      -->
    <!-- ========================================== -->
    <main v-if="currentTab === 'fastEntry'" class="space-y-4">
      <!-- Fast Header -->
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xl">⚡</span>
            <h2 class="text-xl font-black text-slate-900 dark:text-white tracking-tight">Speed Registration</h2>
            <span class="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[11px] font-extrabold">Fast Mode</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Rapid continuous entry for families and attendees</p>
        </div>
        <button @click="currentTab = 'members'" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 flex items-center justify-center">✕</button>
      </div>

      <!-- Mode & Session Sticky Bar -->
      <div class="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-sky-500/10 dark:from-amber-950/30 dark:via-indigo-950/30 dark:to-sky-950/30 border border-amber-300/40 dark:border-amber-700/40 flex items-center justify-between gap-2 shadow-xs">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" v-model="retainHousehold" class="w-4 h-4 rounded text-amber-600 focus:ring-amber-500" />
          <span class="text-xs font-bold text-slate-800 dark:text-slate-200">
            🔗 Retain Family & Address for next member
          </span>
        </label>
        <span class="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200/80 dark:border-slate-700 shadow-2xs whitespace-nowrap">
          🔥 {{ fastSessionMembers.length }} added
        </span>
      </div>

      <!-- Main Input Card -->
      <div class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
        
        <!-- Field 1: Full Name with Prefix Shortcuts -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Full Name *</label>
            <div class="flex items-center gap-1">
              <button type="button" @click="setFastPrefix('Bro.')" class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 text-[11px] font-bold">Bro.</button>
              <button type="button" @click="setFastPrefix('Sis.')" class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 text-[11px] font-bold">Sis.</button>
              <button type="button" @click="setFastPrefix('Pastor')" class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 text-[11px] font-bold">Pastor</button>
              <button type="button" @click="setFastPrefix('Master')" class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 text-[11px] font-bold">Master</button>
            </div>
          </div>
          <input id="fast-name-input" type="text" v-model="fastForm.name" @keydown.enter.prevent="saveFastMember(true)" placeholder="e.g. Bro. David Solomon" class="w-full px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white font-medium text-base focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner" />
        </div>

        <!-- Field 2: 1-Tap Gender Selector & Quick Role -->
        <div class="space-y-2">
          <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Gender *</label>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" @click="fastForm.gender = 'male'" :class="['py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border', fastForm.gender === 'male' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700']">
              <span>👨</span>
              <span>Male / புருஷன் / சகோதரர்</span>
            </button>
            <button type="button" @click="fastForm.gender = 'female'" :class="['py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border', fastForm.gender === 'female' ? 'bg-pink-600 text-white border-pink-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700']">
              <span>👩</span>
              <span>Female / மனைவி / சகோதரி</span>
            </button>
          </div>
        </div>

        <!-- Quick Role Chips -->
        <div>
          <label class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">Ministry Role</label>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="r in existingRoles" :key="r" type="button" @click="setFastRole(r)" :class="['px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border', fastForm.role === r ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200']">
              {{ r }}
            </button>
          </div>
        </div>

        <!-- Field 3: Family Group Name with Suggestions -->
        <div>
          <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Family Group Name (Household)</label>
          <input type="text" v-model="fastForm.familyName" list="fast-existing-families" placeholder="e.g. Paulraj Family" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          <datalist id="fast-existing-families">
            <option v-for="fn in existingFamilies" :key="fn" :value="fn">{{ fn }}</option>
          </datalist>
        </div>

        <!-- Field 4: Age or Date of Birth -->
        <div class="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">⚡ Quick Age</label>
            <input type="number" v-model="fastForm.ageEstimate" @input="handleAgeEstimateChange" placeholder="e.g. 25" min="0" max="120" class="w-full mt-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <span class="text-[10px] text-slate-400 mt-0.5 block">Auto-calculates birth year</span>
          </div>
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Date of Birth</label>
            <input type="date" v-model="fastForm.dob" class="w-full mt-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <span class="text-[10px] text-slate-400 mt-0.5 block">{{ fastForm.isChild ? '👶 Child/Youth flag ON' : 'Adult' }}</span>
          </div>
        </div>

        <!-- Field 5: Contact Phone & Residential Address -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Contact Phone</label>
            <input type="tel" v-model="fastForm.phone" placeholder="+91 98765 43210" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Residential Address</label>
            <input type="text" v-model="fastForm.address" placeholder="e.g. 14 Church St, Salem" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
          </div>
        </div>

        <!-- Field 6: Marriage Toggle & Spouse -->
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
          <label class="flex items-center justify-between cursor-pointer select-none">
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>💍</span>
              <span>Married Member</span>
            </span>
            <input type="checkbox" v-model="fastForm.isMarried" class="ios-switch" />
          </label>

          <div v-if="fastForm.isMarried" class="grid grid-cols-2 gap-3 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div>
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Spouse Name</label>
              <input type="text" v-model="fastForm.spouseName" placeholder="Spouse's Name" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
            </div>
            <div>
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Wedding Date</label>
              <input type="date" v-model="fastForm.weddingDate" class="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
            </div>
          </div>
        </div>

      </div>

      <!-- Action Buttons Bar -->
      <div class="flex gap-2">
        <button @click="saveFastMember(true)" class="flex-1 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2" :disabled="fastSaving">
          <span>⚡</span>
          <span>{{ fastSaving ? 'Saving...' : 'Save & Add Next (Ctrl+Enter)' }}</span>
        </button>
        <button @click="saveFastMember(false)" class="px-5 py-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm shadow-md transition-all" :disabled="fastSaving">
          <span>💾 Save & Done</span>
        </button>
      </div>

      <!-- Live Session Tray: Members Added in This Session -->
      <div v-if="fastSessionMembers.length > 0" class="p-3.5 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <span>✅</span>
            <span>Added in this session ({{ fastSessionMembers.length }})</span>
          </div>
          <span class="text-[11px] text-slate-400">Click to view/edit</span>
        </div>
        <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <div v-for="sm in fastSessionMembers" :key="sm._id" @click="openMemberForm(sm)" class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-2 flex-shrink-0 cursor-pointer hover:border-indigo-400 transition-colors">
            <div class="w-6 h-6 rounded-lg font-bold text-white text-[10px] flex items-center justify-center" :style="avatarStyle(sm.name)">
              {{ getInitials(sm.name) }}
            </div>
            <div>
              <div class="font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">{{ sm.name }}</div>
              <div class="text-[10px] text-slate-400">{{ sm.role || 'Member' }} <span v-if="sm.familyName">• {{ sm.familyName }}</span></div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- ========================================== -->
    <!-- FORMS: MEMBER PROFILE FORM                 -->
    <!-- ========================================== -->
    <main v-if="currentTab === 'memberForm'" class="space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">{{ form._id ? '✏️ Edit Member' : '➕ Add Member' }}</h2>
            <button v-if="!form._id" @click="openFastEntry(form.familyName)" class="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-200 transition-colors flex items-center gap-1">
              <span>⚡ Switch to Fast Entry</span>
            </button>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Fill in church member profile</p>
        </div>
        <button @click="currentTab = 'members'" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 flex items-center justify-center">✕</button>
      </div>

      <div class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-3.5 shadow-sm">
        <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">👤 Personal Information</h3>
        <div>
          <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Full Name *</label>
          <input type="text" v-model="form.name" placeholder="e.g. Bro. David Solomon" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Gender *</label>
            <select v-model="form.gender" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Role / Designation</label>
            <input type="text" v-model="form.role" list="role-options" placeholder="e.g. Deacon" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Date of Birth</label>
              <span v-if="!form.dob && form.birthday" class="text-[10px] font-bold text-amber-600 dark:text-amber-400">Recorded: {{ form.birthday }}</span>
            </div>
            <input type="date" v-model="form.dob" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
            <div class="mt-1 flex items-center justify-between text-[11px]">
              <span v-if="form.dob && getAge(form.dob) !== null" class="text-slate-400 font-medium">Age: {{ getAge(form.dob) }} yrs</span>
              <label class="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-600 dark:text-slate-400 ml-auto">
                <input type="checkbox" v-model="form.isChild" class="w-3.5 h-3.5 rounded text-indigo-600" /> Child / Youth (&lt;18)
              </label>
            </div>
          </div>
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Family Group Name</label>
            <input type="text" v-model="form.familyName" placeholder="e.g. Kumar Family" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Contact Phone</label>
            <input type="tel" v-model="form.phone" placeholder="+91 98765 43210" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
          </div>
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Ministry / Dept</label>
            <input type="text" v-model="form.ministry" placeholder="e.g. Worship, Youth" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
          </div>
        </div>

        <div>
          <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Profile Photo / Document Attachment</label>
          <div class="mt-1 flex items-center gap-3">
            <div v-if="form.photo" class="w-12 h-12 rounded-xl overflow-hidden border border-indigo-300 flex-shrink-0 bg-slate-100 flex items-center justify-center">
              <img :src="form.photo" class="w-full h-full object-cover" />
            </div>
            <input type="file" @change="handlePhotoFileInput" accept="image/*,.pdf,.doc,.docx" class="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950/60 dark:file:text-indigo-300" />
          </div>
        </div>

        <div>
          <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Residential Address</label>
          <input type="text" v-model="form.address" placeholder="Street, Area, Salem" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
        </div>
      </div>

      <!-- Marriage Section -->
      <div class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
        <label class="flex items-center justify-between cursor-pointer">
          <div>
            <div class="text-sm font-bold text-slate-900 dark:text-white">💍 Married?</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">Enable wedding anniversary celebrations</div>
          </div>
          <input type="checkbox" v-model="form.isMarried" class="ios-switch" />
        </label>
        <div v-if="form.isMarried" class="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Wedding Date</label>
              <span v-if="!form.weddingDate && form.wedding" class="text-[10px] font-bold text-rose-600 dark:text-rose-400">Recorded: {{ form.wedding }}</span>
            </div>
            <input type="date" v-model="form.weddingDate" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Spouse Name</label>
              <input type="text" v-model="form.spouseName" placeholder="Spouse's Name" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
            </div>
            <div>
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Spouse Gender</label>
              <select v-model="form.spouseGender" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Lifecycle Status & Archive Section -->
      <div class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
        <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">🏷️ Lifecycle Status</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Status</label>
            <select v-model="form.status" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="transferred">Transferred</option>
              <option value="deceased">Deceased</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Membership Date</label>
            <input type="date" v-model="form.membershipDate" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none" />
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <button @click="saveMember" class="btn-brand flex-1 py-3.5 text-sm shadow-md" :disabled="saving">
          <span v-if="saving">⏳ Saving...</span>
          <span v-else>💾 Save Member Profile</span>
        </button>
        <button v-if="form._id" @click="archiveMember(form._id)" class="px-4 py-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-100 text-sm border border-rose-200 dark:border-rose-800">
          📦 Archive
        </button>
      </div>
    </main>

    <!-- ========================================== -->
    <!-- FORMS: TEMPLATE FORM                       -->
    <!-- ========================================== -->
    <main v-if="currentTab === 'templateForm'" class="space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">{{ tplForm._id ? '✏️ Edit Template' : '➕ New Template' }}</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">Configure message template wording</p>
        </div>
        <button @click="currentTab = 'templates'" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 flex items-center justify-center">✕</button>
      </div>

      <div class="p-4 rounded-2xl bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 space-y-3.5 shadow-sm">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Event Type</label>
            <select v-model="tplForm.type" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none">
              <option value="birthday">Birthday</option>
              <option value="wedding">Wedding</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Category</label>
            <select v-model="tplForm.category" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none">
              <option value="formal">Formal</option>
              <option value="short">Short</option>
            </select>
          </div>
        </div>

        <div>
          <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Message Content</label>
          <textarea v-model="tplForm.content" rows="6" class="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Type template text..."></textarea>
          
          <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 mt-2 space-y-1.5">
            <span class="font-bold text-slate-800 dark:text-slate-200">Quick Insert Tags (Tap to add):</span>
            <div class="flex flex-wrap gap-1 font-mono text-[10px]">
              <button @click="insertVariable('{name}')" class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold border border-indigo-200 dark:border-indigo-800">{name}</button>
              <button @click="insertVariable('{age}')" class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold border border-indigo-200 dark:border-indigo-800">{age}</button>
              <button @click="insertVariable('{designation}')" class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold border border-indigo-200 dark:border-indigo-800">{designation}</button>
              <button @click="insertVariable('{suffix}')" class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold border border-indigo-200 dark:border-indigo-800">{suffix}</button>
              <button @click="insertVariable('{husband}')" class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold border border-indigo-200 dark:border-indigo-800">{husband}</button>
              <button @click="insertVariable('{wife}')" class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold border border-indigo-200 dark:border-indigo-800">{wife}</button>
              <button @click="insertVariable('{years}')" class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold border border-indigo-200 dark:border-indigo-800">{years}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-2.5">
        <button @click="saveTemplate" class="btn-brand flex-1 py-3.5 text-sm shadow-md" :disabled="saving">
          <span v-if="saving">⏳ Saving...</span>
          <span v-else>💾 Save Template</span>
        </button>
        <button v-if="tplForm._id" @click="deleteTemplate" class="px-4 py-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-100 text-sm border border-rose-200 dark:border-rose-800">
          🗑 Delete
        </button>
      </div>
    </main>

    <!-- Role Options Datalist -->
    <datalist id="role-options">
      <option value="Pastor"></option>
      <option value="Associate Pastor"></option>
      <option value="Elder"></option>
      <option value="Deacon"></option>
      <option value="Treasurer"></option>
      <option value="Secretary"></option>
      <option value="Worship Leader"></option>
      <option value="Sunday School Teacher"></option>
      <option value="Member"></option>
    </datalist>

    <!-- ========================================== -->
    <!-- GLOBAL COMMAND PALETTE (Ctrl+K / ⌘K)        -->
    <!-- ========================================== -->
    <transition name="fade">
      <div v-if="commandPaletteOpen" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[120] flex items-start justify-center pt-12 md:pt-20 p-4" @click="closeCommandPalette">
        <div class="w-full max-w-lg bg-white dark:bg-[#151c28] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-all" @click.stop>
          <!-- Input Bar -->
          <div class="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <span class="text-lg text-slate-400">🔍</span>
            <input
              id="command-palette-input"
              v-model="commandPaletteQuery"
              @keydown.down.prevent="navigateCommandPalette(1)"
              @keydown.up.prevent="navigateCommandPalette(-1)"
              @keydown.enter.prevent="commandPaletteResults[commandPaletteSelectedIndex] && executeCommandPaletteItem(commandPaletteResults[commandPaletteSelectedIndex])"
              type="text"
              placeholder="Search members, events, tasks, or type an action..."
              class="w-full bg-transparent text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
            <kbd class="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-500 font-mono">ESC</kbd>
          </div>

          <!-- Results List -->
          <div class="overflow-y-auto p-2 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/40">
            <div v-if="commandPaletteResults.length === 0" class="py-8 text-center text-xs text-slate-400">
              No matching members, tasks, or actions found.
            </div>

            <div
              v-for="(item, idx) in commandPaletteResults"
              :key="item.id || idx"
              @click="executeCommandPaletteItem(item)"
              @mouseenter="commandPaletteSelectedIndex = idx"
              class="flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-colors text-xs"
              :class="commandPaletteSelectedIndex === idx ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-base flex-shrink-0">{{ item.icon }}</span>
                <div class="truncate">
                  <div class="font-bold text-slate-900 dark:text-white">{{ item.title }}</div>
                  <div class="text-[10px] text-slate-400 truncate">{{ item.subtitle }}</div>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 flex-shrink-0">
                {{ item.category }}
              </span>
            </div>
          </div>

          <!-- Footer Hints -->
          <div class="px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>ESC Close</span>
            </div>
            <span>SPBC Quick Command</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- Standalone Admin Authentication Modal -->
    <transition name="fade">
      <div v-if="authModalOpen" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
        <div class="bg-white dark:bg-[#151c28] border-t md:border border-slate-200 dark:border-slate-800 rounded-t-3xl md:rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
          <div class="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-1 md:hidden"></div>
          <div class="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center text-3xl shadow-sm">
            🔒
          </div>
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Admin Session Required</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Please enter your Administrator Passcode or Secret Key to unlock SPBC Church CMS.
            </p>
          </div>
          <div class="space-y-2 text-left">
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Admin Secret / Passcode</label>
            <input
              v-model="authInputKey"
              type="password"
              @keyup.enter="verifyAndSavePasscode"
              placeholder="Enter ADMIN_SECRET"
              autocomplete="current-password"
              class="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <p v-if="authError" class="text-xs text-rose-500 font-semibold mt-1">{{ authError }}</p>
          </div>
          <button
            @click="verifyAndSavePasscode"
            :disabled="authVerifying || !authInputKey.trim()"
            class="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span v-if="authVerifying">Verifying...</span>
            <span v-else>Unlock CMS</span>
          </button>
        </div>
      </div>
    </transition>

    <!-- Floating Island Bottom Navigation (High Contrast Dark/Light Island) -->
    <nav v-if="!loading && !['memberForm', 'templateForm', 'fastEntry'].includes(currentTab)" style="bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);" class="fixed left-3 right-3 max-w-xl mx-auto bg-white/95 dark:bg-[#151c28]/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl flex justify-between p-1.5 z-50 transition-colors">
      <button class="flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all" :class="currentTab === 'members' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'" @click="currentTab = 'members'">
        <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
        <span>Members</span>
      </button>

      <button class="flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all" :class="currentTab === 'events' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'" @click="currentTab = 'events'">
        <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
        <span>Events</span>
      </button>

      <button class="flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all relative" :class="currentTab === 'tasks' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'" @click="currentTab = 'tasks'">
        <span v-if="overdueTasksCount > 0" class="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500"></span>
        <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
        <span>Tasks</span>
      </button>

      <button class="flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all" :class="currentTab === 'analytics' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'" @click="currentTab = 'analytics'">
        <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
        <span>Reports</span>
      </button>

      <button class="flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all" :class="['upcoming', 'templates'].includes(currentTab) ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'" @click="currentTab = 'upcoming'">
        <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h16z"></path></svg>
        <span>Wishes</span>
      </button>

      <button class="flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all" :class="currentTab === 'settings' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'" @click="currentTab = 'settings'">
        <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        <span>Settings</span>
      </button>
    </nav>

  </div>
</template>

<script>
import { ref, computed, onMounted, watch, onErrorCaptured, nextTick } from 'vue';
import { sendClientError } from './telemetry.js';

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

export default {
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

      import('./js/haptics.js').then(({ initPullToRefresh }) => {
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
        const { generateCelebrationCard } = await import('./js/canvasCardGenerator.js');
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
};
</script>
