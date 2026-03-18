const { createApp, ref, computed, watch } = Vue;

createApp({
  setup() {
    const todayKey = () => new Date().toISOString().slice(0,10);
    const state = ref(loadState());
    const currentDate = ref(todayKey());
    const showSettings = ref(false);

    const toRestAnim = ref(false);
    const fromRestAnim = ref(false);
    const celebrate = ref(false);

    const fileInput = ref(null);
    const uploadedFileName = ref('');

    function loadState() {
      const raw = document.cookie.split('; ').find(r => r.startsWith('pushups='));
      return raw ? JSON.parse(decodeURIComponent(raw.split('=')[1])) : {
        days:{},
        settings:{ goal:50, step:5, restTarget:4 },
        restCredits:0,
        progressToRest:0
      };
    }

    function saveState() {
      document.cookie = 'pushups=' + encodeURIComponent(JSON.stringify(state.value)) + '; path=/; max-age=31536000';
    }

    const dayData = computed(() => {
      if (!state.value.days[currentDate.value]) {
        state.value.days[currentDate.value] = {
          count:0,
          restUsed:false,
          goalSnapshot: state.value.settings.goal,
          contributed:false
        };
      }
      return state.value.days[currentDate.value];
    });

    function vibrate() { if (navigator.vibrate) navigator.vibrate(10); }

    function add(n) { vibrate(); dayData.value.count += n; checkGoalContribution(); saveState(); }
    function sub(n) { vibrate(); dayData.value.count = Math.max(0, dayData.value.count - n); saveState(); }

    function checkGoalContribution() {
      if (!dayData.value.contributed && dayData.value.count >= dayData.value.goalSnapshot) {
        dayData.value.contributed = true;
        state.value.progressToRest++;
        if (state.value.progressToRest >= state.value.settings.restTarget) {
          state.value.restCredits++;
          state.value.progressToRest = 0;
        }
        celebrate.value = true;
        setTimeout(() => celebrate.value = false, 900);
      }
    }

    function prevDay() { const d = new Date(currentDate.value); d.setDate(d.getDate() - 1); currentDate.value = d.toISOString().slice(0,10); }
    function nextDay() { const d = new Date(currentDate.value); d.setDate(d.getDate() + 1); currentDate.value = d.toISOString().slice(0,10); }

    function toggleRestDay() {
      const wasRest = dayData.value.restUsed;
      if (!wasRest && state.value.restCredits > 0) {
        toRestAnim.value = true;
        dayData.value.restUsed = true; state.value.restCredits--;
        setTimeout(() => { toRestAnim.value = false; }, 620);
      } else if (wasRest) {
        fromRestAnim.value = true;
        dayData.value.restUsed = false; state.value.restCredits++;
        setTimeout(() => { fromRestAnim.value = false; }, 620);
      }
      saveState();
    }

    const progress = computed(() => {
      const goal = dayData.value.goalSnapshot;
      const base = goal ? Math.min(1, dayData.value.count / goal) : 0;
      if (dayData.value.restUsed && !toRestAnim.value) return 0;
      return base;
    });

    // Instant-apply settings: watch settings values and persist immediately
    watch(() => state.value.settings.goal, (v) => {
      const val = Number(v) || 0;
      state.value.settings.goal = val;
      dayData.value.goalSnapshot = val;
      saveState();
    });
    watch(() => state.value.settings.step, (v) => {
      state.value.settings.step = Number(v) || 0;
      saveState();
    });
    watch(() => state.value.settings.restTarget, (v) => {
      state.value.settings.restTarget = Math.max(1, Number(v) || 1);
      saveState();
    });

    function adjustRestCredits(n) {
      state.value.restCredits = Math.max(0, state.value.restCredits + n);
      saveState();
    }

    function downloadData() {
      const blob = new Blob([JSON.stringify(state.value)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pushups_backup.json';
      a.click();
      URL.revokeObjectURL(url);
    }

    function uploadData(event) {
      const file = event.target.files[0];
      if (!file) return;
      uploadedFileName.value = file.name;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          state.value = JSON.parse(e.target.result);
          saveState();
        } catch(err) {
          alert('Invalid file');
        }
      };
      reader.readAsText(file);
    }

    function triggerUpload() {
      if (fileInput.value) fileInput.value.click();
    }

    const weekday = computed(() => new Date(currentDate.value).toLocaleDateString(undefined, { weekday: 'long' }));
    const dateLabel = computed(() => new Date(currentDate.value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));

    return {
      state, currentDate, dayData, showSettings,
      add, sub, prevDay, nextDay, toggleRestDay,
      progress, adjustRestCredits,
      downloadData, uploadData, triggerUpload,
      toRestAnim, fromRestAnim, celebrate,
      fileInput, uploadedFileName,
      weekday, dateLabel
    };
  },

  template: /* html */ `
  <div class="container">
    <div class="topbar">
      <button class="secondary" @click="showSettings=true">⚙️</button>
    </div>

    <div class="goal">Goal: {{ dayData.goalSnapshot }}</div>

    <div class="ring" :class="{ 'goal-met': celebrate }">
      <svg width="180" height="180">
        <circle cx="90" cy="90" r="80" stroke="#334155" stroke-width="12" fill="none" />
        <circle cx="90" cy="90" r="80"
          :stroke="dayData.restUsed ? '#3b82f6' : '#22c55e'"
          stroke-width="12" fill="none"
          :stroke-dasharray="2 * Math.PI * 80"
          :stroke-dashoffset="2 * Math.PI * 80 * (1 - (dayData.restUsed ? 1 : progress))" />
      </svg>
      <div class="center-text" :class="{ 'to-rest': toRestAnim, 'from-rest': fromRestAnim }">
        <span class="pct" v-show="!dayData.restUsed || toRestAnim || fromRestAnim">{{ Math.round(progress*100) }}%</span>
        <span class="rest" v-show="dayData.restUsed || toRestAnim || fromRestAnim">REST</span>
      </div>
    </div>

    <div class="count">{{ dayData.restUsed ? '−' : dayData.count }}</div>

    <div class="rest-box">
      💤 {{ state.restCredits }} rest days
    </div>

    <div class="buttons">
      <!-- Switch - buttons to left, + buttons to right -->
      <button class="danger" @click="sub(state.settings.step)" :disabled="dayData.restUsed" :style="{ opacity: dayData.restUsed ? 0.4 : 1 }">-{{ state.settings.step }}</button>
      <button class="primary" @click="add(state.settings.step)" :disabled="dayData.restUsed" :style="{ opacity: dayData.restUsed ? 0.4 : 1 }">+{{ state.settings.step }}</button>
      <button class="danger" @click="sub(1)" :disabled="dayData.restUsed" :style="{ opacity: dayData.restUsed ? 0.4 : 1 }">-1</button>
      <button class="primary" @click="add(1)" :disabled="dayData.restUsed" :style="{ opacity: dayData.restUsed ? 0.4 : 1 }">+1</button>
    </div>

    <div class="nav">
      <button class="secondary nav-left" @click="prevDay">⬅</button>
      <div class="date-stack">
        <div class="weekday">{{ weekday }}</div>
        <div class="date-sub">{{ dateLabel }}</div>
      </div>
      <button class="secondary nav-right" @click="nextDay">➡</button>
    </div>

    <button class="secondary" style="margin-top:10px" @click="toggleRestDay">
      {{ dayData.restUsed ? 'Cancel Rest Day' : 'Use Rest Day' }}
    </button>

    <div v-if="showSettings" class="settings">
      <div class="settings-panel">
        <h3>Settings</h3>

        <label>Daily Goal</label>
        <div class="hint">Applies to current + future days</div>
        <input type="number" v-model.number="state.settings.goal" />

        <label>Step (X)</label>
        <input type="number" v-model.number="state.settings.step" />

        <label>Days per rest reward</label>
        <input type="number" v-model.number="state.settings.restTarget" />

        <label>Rest Credits: {{ state.restCredits }}</label>
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <button class="secondary" @click="adjustRestCredits(1)">+1</button>
          <button class="secondary" @click="adjustRestCredits(-1)">-1</button>
        </div>

        <hr style="border-color:#334155; margin:12px 0;">

        <div class="hint">Backup & Restore</div>
        <div class="io-row" style="margin-bottom:6px;">
          <button class="secondary" @click="downloadData">Backup to File</button>
          <button class="primary" @click="triggerUpload">Restore from File</button>
          <input ref="fileInput" class="hidden-file" type="file" accept="application/json" @change="uploadData" />
        </div>
        <div class="hint" v-if="uploadedFileName">Selected: {{ uploadedFileName }}</div>

        <div class="settings-actions">
          <button class="secondary" @click="showSettings=false">Close</button>
        </div>
      </div>
    </div>

  </div>
  `
}).mount('#app');

// Service worker registration (relative path for GitHub Pages)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
