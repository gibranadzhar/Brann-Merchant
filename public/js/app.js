/* ==========================================================================
   ALIGHT MOTION PRO GENERATOR — INBOXKITTEN AUTO ACTIVATION & JAVASCRIPT
   ========================================================================== */

(function () {
  'use strict';

  let currentUser = JSON.parse(localStorage.getItem('am_user') || 'null');
  let ownerSecret = localStorage.getItem('am_owner_secret') || '';

  let soundEnabled = true;
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playZapSound() {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}
  }

  function playBoomSound() {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
  }

  function playVictorySound() {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.09);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + idx * 0.09 + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + idx * 0.09);
        osc.stop(audioCtx.currentTime + idx * 0.09 + 0.25);
      });
    } catch (e) {}
  }

  function spawnPowText(text, x, y) {
    const el = document.createElement('div');
    el.className = 'pow-burst';
    el.textContent = text || 'POW!';
    el.style.left = (x || (window.innerWidth / 2 - 50)) + 'px';
    el.style.top = (y || (window.innerHeight / 2 - 50)) + 'px';
    document.body.appendChild(el);
    setTimeout(() => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 800);
  }

  window.showAuthTab = function (tabName) {
    playZapSound();
    const tabLogin = document.getElementById('tab-btn-login');
    const tabReg = document.getElementById('tab-btn-register');
    const panelLogin = document.getElementById('auth-panel-login');
    const panelReg = document.getElementById('auth-panel-register');

    if (tabName === 'login') {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabReg) tabReg.classList.remove('active');
      if (panelLogin) panelLogin.classList.add('active');
      if (panelReg) panelReg.classList.remove('active');
    } else {
      if (tabReg) tabReg.classList.add('active');
      if (tabLogin) tabLogin.classList.remove('active');
      if (panelReg) panelReg.classList.add('active');
      if (panelLogin) panelLogin.classList.remove('active');
    }
  };

  window.openModal = function (modalId) {
    playZapSound();
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');

    if (modalId === 'modal-owner-panel') {
      loadOwnerDashboardData();
    }
  };

  window.closeModal = function (modalId) {
    playZapSound();
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  };

  function updateAuthUI() {
    const guestLanding = document.getElementById('view-guest-landing');
    const userDashboard = document.getElementById('view-user-dashboard');
    const authGuestControls = document.getElementById('auth-guest-controls');
    const userGroup = document.getElementById('user-logged-group');
    const userBadge = document.getElementById('user-badge-name');
    const btnOwnerPanel = document.getElementById('btn-owner-panel-trigger');
    const mascotGreeting = document.getElementById('mascot-user-greeting');

    if (currentUser) {
      if (guestLanding) guestLanding.style.display = 'none';
      if (userDashboard) userDashboard.style.display = 'block';

      if (authGuestControls) authGuestControls.style.display = 'none';
      if (userGroup) userGroup.style.display = 'flex';

      const isOwner = currentUser.role === 'owner';
      if (userBadge) {
        userBadge.innerHTML = isOwner ? `👑 OWNER: <b>${currentUser.username}</b>` : `⚡ HERO: <b>${currentUser.username}</b>`;
        userBadge.className = isOwner ? 'user-badge-name badge-owner' : 'user-badge-name badge-hero';
      }

      if (btnOwnerPanel) {
        btnOwnerPanel.style.display = isOwner ? 'inline-flex' : 'none';
      }

      if (mascotGreeting) {
        mascotGreeting.innerHTML = isOwner ? `WELCOME BACK SUPREME OWNER 👑 (${currentUser.username.toUpperCase()}):` : `WELCOME BACK HERO ⚡ (${currentUser.username.toUpperCase()}):`;
      }
    } else {
      if (guestLanding) guestLanding.style.display = 'block';
      if (userDashboard) userDashboard.style.display = 'none';

      if (authGuestControls) authGuestControls.style.display = 'flex';
      if (userGroup) userGroup.style.display = 'none';
    }
  }

  window.handleLogout = function () {
    playZapSound();
    currentUser = null;
    ownerSecret = '';
    localStorage.removeItem('am_user');
    localStorage.removeItem('am_owner_secret');
    updateAuthUI();
    spawnPowText('LOGOUT!', window.innerWidth / 2, 200);
    alert('⚡ Anda telah logout!');
  };

  async function checkApiHealth() {
    const dot = document.getElementById('health-dot');
    const statusText = document.getElementById('health-status-text');
    if (!statusText) return;

    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data && data.online) {
        if (dot) dot.style.background = '#00FF66';
        statusText.innerHTML = '⚡ RAILWAY API ONLINE & INBOXKITTEN AUTO ACTIVATION READY!';
      } else {
        if (dot) dot.style.background = '#FF6B00';
        statusText.innerHTML = '⚠️ RAILWAY API CONNECTED';
      }
    } catch (err) {
      if (dot) dot.style.background = '#00FF66';
      statusText.innerHTML = '⚡ RAILWAY API DIRECT CONNECTED';
    }
  }

  /* ==========================================================================
     1-CLICK INBOXKITTEN AUTO ACTIVATION HANDLER
     ========================================================================== */
  window.handleAutoInboxKitten = async function () {
    if (!currentUser) {
      alert('⚡ Harap Login terlebih dahulu!');
      return;
    }

    initAudio();
    playBoomSound();

    const btn = document.getElementById('btn-auto-inboxkitten');
    const progressBox = document.getElementById('inboxkitten-progress-box');
    const progressText = document.getElementById('inboxkitten-progress-text');
    const stepStatus = document.getElementById('auto-step-status');

    btn.disabled = true;
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MEMPROSES AUTO AKTIVASI INBOXKITTEN...';
    progressBox.classList.add('active');

    if (stepStatus) stepStatus.innerHTML = '<span style="color:#FFE600">PROCESSING...</span>';
    progressText.innerHTML = `🐱 <b>STEP 1:</b> Membuat email temp InboxKitten...\n⚡ <b>STEP 2:</b> Mengirim Magic Link ke Railway API...\n⏳ <b>STEP 3:</b> Polling email & mengekstrak verifikasi link dari InboxKitten (Mohon tunggu max 30 detik)...`;

    spawnPowText('AUTO AKTIVASI!', window.innerWidth / 2 - 100, 250);

    try {
      const res = await fetch('/api/inboxkitten/auto-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser ? currentUser.username : 'guest' })
      });
      const data = await res.json();

      btn.disabled = false;
      btn.innerHTML = originalBtnText;

      if (res.ok && data.success) {
        playVictorySound();
        spawnPowText('AUTO UNLOCKED!', window.innerWidth / 2 - 100, 200);
        if (stepStatus) stepStatus.innerHTML = '<span style="color:#00FF66">SUCCESS!</span>';

        progressText.innerHTML = `<span style="color:#00FF66; font-weight:bold; font-size:1.1rem;">🎉 AUTO AKTIVASI BERHASIL 100%!</span>\n\n📌 <b>DETAIL AKUN PREMIUM:</b>\n- Email Temp: <b style="color:#FFE600">${data.email}</b>\n- Inbox Viewer: <a href="https://inboxkitten.com/inbox/${data.email.split('@')[0]}" target="_blank" style="color:#00F0FF; text-decoration:underline;">Cek InboxKitten Website</a>\n- Status: <b>PREMIUM ACTIVATED! 🎉</b>\n- Order ID: ${data.activation?.codeorder || data.activation?.orderId || 'SUCCESS'}\n\n✨ Akun Alight Motion Pro Premium tanpa watermark siap digunakan!`;
      } else {
        spawnPowText('FAILED!', window.innerWidth / 2 - 60, 200);
        if (stepStatus) stepStatus.innerHTML = '<span style="color:#FF0055">FAILED</span>';
        progressText.innerHTML = `<span style="color:#FF0055; font-weight:bold;">❌ GAGAL AUTO AKTIVASI: ${data.message}</span>\n\nEmail: ${data.email || '-'}\nAnda dapat mencoba menekan tombol sekali lagi atau menggunakan opsi manual.`;
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
      if (stepStatus) stepStatus.innerHTML = '<span style="color:#FF0055">ERROR</span>';
      progressText.innerHTML = `<span style="color:#FF0055">❌ ERROR KONEKSI: ${err.message}</span>`;
    }
  };

  // Helper untuk generate manual email temp inboxkitten
  window.generateInboxKittenEmail = function () {
    playZapSound();
    const rand = Math.floor(Math.random() * 899999) + 100000;
    const email = `hero${rand}@inboxkitten.com`;
    const input1 = document.getElementById('send-email-input');
    const input2 = document.getElementById('activate-email-input');
    if (input1) input1.value = email;
    if (input2) input2.value = email;
    spawnPowText('TEMP EMAIL!', window.innerWidth / 2, 300);
  };

  // Handle Send Link Form Submit
  async function handleSendLink(e) {
    e.preventDefault();
    if (!currentUser) {
      alert('⚡ Harap Login terlebih dahulu!');
      return;
    }

    initAudio();
    playBoomSound();

    const btn = document.getElementById('btn-send-link');
    const inputEmail = document.getElementById('send-email-input');
    const outputBox = document.getElementById('send-link-output');
    const outputContent = document.getElementById('send-link-json');

    const email = inputEmail.value.trim();
    if (!email) {
      spawnPowText('OPS!', e.clientX, e.clientY);
      alert('⚡ Harap masukkan email target terlebih dahulu!');
      return;
    }

    const originalBtnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SENDING MAGIC LINK...';
    outputBox.classList.remove('active');

    spawnPowText('BAM!', e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2);

    let resultData = null;
    let isSuccess = false;

    try {
      const proxyRes = await fetch('/api/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username: currentUser ? currentUser.username : 'guest' })
      });
      resultData = await proxyRes.json();
      isSuccess = proxyRes.ok && resultData.success;
    } catch (err) {
      resultData = { success: false, message: 'Koneksi backend gagal: ' + err.message };
    }

    btn.disabled = false;
    btn.innerHTML = originalBtnText;

    outputBox.classList.add('active');
    if (isSuccess) {
      playVictorySound();
      spawnPowText('SUCCESS!', window.innerWidth / 2 - 80, 200);
      outputContent.innerHTML = `<span style="color:#00FF66">✔ SUCCESS: ${resultData.message}</span>\n<span style="color:#FFE600">Order ID: ${resultData.orderId || '-'}</span>\n\n📌 <b>LANGKAH SELANJUTNYA:</b>\n1. Jika pakai @inboxkitten.com, buka <a href="https://inboxkitten.com/inbox/${email.split('@')[0]}" target="_blank" style="color:#00F0FF; text-decoration:underline;">InboxKitten Mailbox</a>.\n2. Copy Magic Link dari pesan Alight Creative.\n3. Paste Magic Link di form <b>STEP 2 (AKTIVASI PREMIUM)</b>!`;
      
      const actEmailInput = document.getElementById('activate-email-input');
      if (actEmailInput) actEmailInput.value = email;
    } else {
      spawnPowText('ERROR!', window.innerWidth / 2 - 80, 200);
      outputContent.innerHTML = `<span style="color:#FF0055">❌ ERROR: ${resultData.message || 'Gagal mengirim link'}</span>\n\nDetail:\n${JSON.stringify(resultData, null, 2)}`;
    }
  }

  // Handle Activate Premium Form Submit
  async function handleActivate(e) {
    e.preventDefault();
    if (!currentUser) {
      alert('⚡ Harap Login terlebih dahulu!');
      return;
    }

    initAudio();
    playBoomSound();

    const btn = document.getElementById('btn-activate');
    const inputEmail = document.getElementById('activate-email-input');
    const inputLink = document.getElementById('activate-link-input');
    const outputBox = document.getElementById('activate-output');
    const outputContent = document.getElementById('activate-json');

    const email = inputEmail.value.trim();
    const magicLink = inputLink.value.trim();

    if (!email || !magicLink) {
      spawnPowText('DATA KURANG!', e.clientX, e.clientY);
      alert('⚡ Harap isi Email Target dan Magic Link terlebih dahulu!');
      return;
    }

    const originalBtnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> UNLOCKING PREMIUM...';
    outputBox.classList.remove('active');

    spawnPowText('KABOOM!', e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2);

    let resultData = null;
    let isSuccess = false;

    try {
      const proxyRes = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, magicLink, username: currentUser ? currentUser.username : 'guest' })
      });
      resultData = await proxyRes.json();
      isSuccess = proxyRes.ok && resultData.success;
    } catch (err) {
      resultData = { success: false, message: 'Koneksi backend gagal: ' + err.message };
    }

    btn.disabled = false;
    btn.innerHTML = originalBtnText;

    outputBox.classList.add('active');
    if (isSuccess) {
      playVictorySound();
      spawnPowText('VICTORY!', window.innerWidth / 2 - 90, 200);
      outputContent.innerHTML = `<span style="color:#00FF66; font-size: 1.1rem; font-weight: bold;">🏆 UNLOCKED! PREMIUM SUCCESS!</span>\n\n<span style="color:#FFE600">${resultData.message || 'Lisensi Premium Alight Motion Berhasil Diaktifkan!'}</span>\n\n📌 <b>STATUS AKUN:</b>\n- Email: ${email}\n- Status: PREMIUM ACTIVE 🎉\n- Selamat membuat konten Alight Motion tanpa watermark!`;
    } else {
      spawnPowText('FAILED!', window.innerWidth / 2 - 80, 200);
      outputContent.innerHTML = `<span style="color:#FF0055">❌ ACTIVATION FAILED: ${resultData.message || 'Gagal aktivasi'}</span>\n\nDetail Response:\n${JSON.stringify(resultData, null, 2)}`;
    }
  }

  // Unified Form Login
  async function handleUnifiedLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        currentUser = data.user;
        localStorage.setItem('am_user', JSON.stringify(currentUser));
        
        if (currentUser.role === 'owner') {
          ownerSecret = password;
          localStorage.setItem('am_owner_secret', ownerSecret);
        }

        updateAuthUI();
        playVictorySound();
        spawnPowText(currentUser.role === 'owner' ? 'OWNER MODE!' : 'WELCOME!', window.innerWidth / 2, 200);
        alert(data.message);
      } else {
        alert('❌ Login Gagal: ' + data.message);
      }
    } catch (err) {
      alert('Error login: ' + err.message);
    }
  }

  // Unified Form Register
  async function handleUnifiedRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        currentUser = data.user;
        localStorage.setItem('am_user', JSON.stringify(currentUser));
        updateAuthUI();
        playVictorySound();
        spawnPowText('REGISTERED!', window.innerWidth / 2, 200);
        alert(data.message);
      } else {
        alert('❌ Pendaftaran Gagal: ' + data.message);
      }
    } catch (err) {
      alert('Error register: ' + err.message);
    }
  }

  /* ==========================================================================
     OWNER PANEL HANDLERS
     ========================================================================== */

  async function loadOwnerDashboardData() {
    const logsBox = document.getElementById('owner-logs-box');
    const inputApiKey = document.getElementById('owner-input-apikey');
    const inputBaseUrl = document.getElementById('owner-input-baseurl');

    try {
      const res = await fetch('/api/owner/dashboard', {
        headers: { 'x-owner-secret': ownerSecret }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (inputApiKey) inputApiKey.placeholder = `Current: ${data.stats.currentApiKey}`;
        if (inputBaseUrl) inputBaseUrl.value = data.stats.baseUrl;

        if (logsBox) {
          logsBox.textContent = data.logs.map(l => `[${l.timestamp}] [${l.username.toUpperCase()}] ${l.action} -> ${l.status} (${l.detail})`).join('\n');
        }
      } else {
        alert('Akses Owner Ditolak!');
        closeModal('modal-owner-panel');
      }
    } catch (err) {
      console.error('Error loading owner data:', err);
    }
  }

  async function handleUpdateApiKey(e) {
    e.preventDefault();
    const newApiKey = document.getElementById('owner-input-apikey').value.trim();
    const newBaseUrl = document.getElementById('owner-input-baseurl').value.trim();
    const newOwnerPassword = document.getElementById('owner-input-newpass').value.trim();

    try {
      const res = await fetch('/api/owner/update-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-secret': ownerSecret
        },
        body: JSON.stringify({ newApiKey, newBaseUrl, newOwnerPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (newOwnerPassword) {
          ownerSecret = newOwnerPassword;
          localStorage.setItem('am_owner_secret', ownerSecret);
        }
        playVictorySound();
        spawnPowText('API UPDATED!', window.innerWidth / 2, 200);
        alert('🎉 SUCCESS: ' + data.message);
        loadOwnerDashboardData();
      } else {
        alert('❌ Gagal update: ' + data.message);
      }
    } catch (err) {
      alert('Error updating API Key: ' + err.message);
    }
  }

  window.triggerManualGithubSync = async function () {
    playZapSound();
    try {
      const res = await fetch('/api/owner/sync-github', {
        method: 'POST',
        headers: { 'x-owner-secret': ownerSecret }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        playVictorySound();
        spawnPowText('PUSHED!', window.innerWidth / 2, 200);
        alert('🚀 GITHUB SYNC SUCCESS: ' + data.message);
      } else {
        alert('❌ Gagal sync GitHub: ' + data.message);
      }
    } catch (err) {
      alert('Error trigger GitHub sync: ' + err.message);
    }
  };

  window.toggleSound = function () {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('toggle-sound-btn');
    if (btn) {
      btn.innerHTML = soundEnabled ? '<i class="fas fa-volume-up"></i> SFX: ON' : '<i class="fas fa-volume-mute"></i> SFX: OFF';
    }
    if (soundEnabled) playZapSound();
  };

  document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    checkApiHealth();

    const formSend = document.getElementById('form-send-link');
    if (formSend) formSend.addEventListener('submit', handleSendLink);

    const formAct = document.getElementById('form-activate');
    if (formAct) formAct.addEventListener('submit', handleActivate);

    const formLogin = document.getElementById('form-login-unified');
    if (formLogin) formLogin.addEventListener('submit', handleUnifiedLogin);

    const formReg = document.getElementById('form-register-unified');
    if (formReg) formReg.addEventListener('submit', handleUnifiedRegister);

    const formUpdateApi = document.getElementById('form-update-apikey');
    if (formUpdateApi) formUpdateApi.addEventListener('submit', handleUpdateApiKey);

    document.querySelectorAll('.comic-btn-primary, .comic-btn-small, .btn-helper').forEach(btn => {
      btn.addEventListener('click', () => playZapSound());
    });
  });

})();
