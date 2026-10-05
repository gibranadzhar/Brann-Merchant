/* ==========================================================================
   ALIGHT MOTION PRO GENERATOR — COMIC DEDICATED JAVASCRIPT
   ========================================================================== */

(function () {
  'use strict';

  let currentUser = JSON.parse(localStorage.getItem('am_user') || 'null');
  let ownerSecret = localStorage.getItem('am_owner_secret') || '';

  let soundEnabled = true;
  let audioCtx = null;

  // Web Audio Synthesizer
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

  // Modal Control Utilities
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

  // Update UI sesua status Auth User / Owner
  function updateAuthUI() {
    const authBtns = document.getElementById('auth-buttons-group');
    const userGroup = document.getElementById('user-logged-group');
    const userBadge = document.getElementById('user-badge-name');
    const btnOwnerPanel = document.getElementById('btn-owner-panel-trigger');

    if (currentUser) {
      if (authBtns) authBtns.style.display = 'none';
      if (userGroup) userGroup.style.display = 'flex';
      if (userBadge) {
        const isOwner = currentUser.role === 'owner';
        userBadge.innerHTML = isOwner ? `👑 OWNER: <b>${currentUser.username}</b>` : `⚡ HERO: <b>${currentUser.username}</b>`;
        userBadge.className = isOwner ? 'user-badge-name badge-owner' : 'user-badge-name badge-hero';
      }

      if (btnOwnerPanel) {
        btnOwnerPanel.style.display = (currentUser.role === 'owner') ? 'inline-flex' : 'none';
      }
    } else {
      if (authBtns) authBtns.style.display = 'flex';
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

  // Health check API
  async function checkApiHealth() {
    const dot = document.getElementById('health-dot');
    const statusText = document.getElementById('health-status-text');
    if (!statusText) return;

    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data && data.online) {
        if (dot) dot.style.background = '#00FF66';
        statusText.innerHTML = '⚡ RAILWAY API ONLINE & READY FOR ALIGHT MOTION POWERS!';
      } else {
        if (dot) dot.style.background = '#FF6B00';
        statusText.innerHTML = '⚠️ RAILWAY API CONNECTED';
      }
    } catch (err) {
      if (dot) dot.style.background = '#00FF66';
      statusText.innerHTML = '⚡ RAILWAY API DIRECT CONNECTED';
    }
  }

  // Handle Send Link Form Submit
  async function handleSendLink(e) {
    e.preventDefault();
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
      outputContent.innerHTML = `<span style="color:#00FF66">✔ SUCCESS: ${resultData.message}</span>\n<span style="color:#FFE600">Order ID: ${resultData.orderId || '-'}</span>\n\n📌 <b>LANGKAH SELANJUTNYA:</b>\n1. Cek Email <b>${email}</b> (Inbox/Spam).\n2. Buka pesan dari Alight Creative & copy Magic Link.\n3. Paste Magic Link di form <b>STEP 2 (AKTIVASI PREMIUM)</b>!`;
      
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

  /* ==========================================================================
     AUTH HANDLERS (USER LOGIN, REGISTER, OWNER LOGIN)
     ========================================================================== */

  // Form User Login
  async function handleUserLogin(e) {
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
        closeModal('modal-login');
        playVictorySound();
        spawnPowText('WELCOME!', window.innerWidth / 2, 200);
        alert(data.message);
      } else {
        alert('❌ Login Gagal: ' + data.message);
      }
    } catch (err) {
      alert('Error login: ' + err.message);
    }
  }

  // Form User Register
  async function handleUserRegister(e) {
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
        closeModal('modal-register');
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

  // Form Owner Login
  async function handleOwnerLogin(e) {
    e.preventDefault();
    const username = document.getElementById('owner-login-user').value.trim();
    const password = document.getElementById('owner-login-pass').value.trim();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.success && data.user.role === 'owner') {
        currentUser = data.user;
        ownerSecret = password;
        localStorage.setItem('am_user', JSON.stringify(currentUser));
        localStorage.setItem('am_owner_secret', ownerSecret);
        updateAuthUI();
        closeModal('modal-owner-login');
        openModal('modal-owner-panel');
        playVictorySound();
        spawnPowText('OWNER MODE!', window.innerWidth / 2, 200);
      } else {
        alert('❌ Login Owner Gagal: Password atau Username Owner Salah!');
      }
    } catch (err) {
      alert('Error login owner: ' + err.message);
    }
  }

  /* ==========================================================================
     OWNER PANEL HANDLERS (GANTI API KEY & GITHUB SYNC)
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
        alert('Akses Owner Ditolak! Harap login ulang sebagai Owner.');
        closeModal('modal-owner-panel');
      }
    } catch (err) {
      console.error('Error loading owner data:', err);
    }
  }

  // Submit Update API Key & Base URL
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

  // Force Manual Github Sync
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

  // Utilities
  window.generateRandomEmail = function () {
    playZapSound();
    const rand = Math.floor(Math.random() * 899999) + 100000;
    const email = `hero${rand}@gmail.com`;
    const input1 = document.getElementById('send-email-input');
    const input2 = document.getElementById('activate-email-input');
    if (input1) input1.value = email;
    if (input2) input2.value = email;
    spawnPowText('GENERATED!', window.innerWidth / 2, 300);
  };

  window.copySnippetCode = function () {
    playZapSound();
    const codeText = document.getElementById('snippet-code-text').innerText;
    navigator.clipboard.writeText(codeText).then(() => {
      spawnPowText('COPIED!', window.innerWidth / 2, 400);
      alert('⚡ Kode Node.js / Axios berhasil disalin ke clipboard!');
    });
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

    // Auth Forms
    const formLogin = document.getElementById('form-login-user');
    if (formLogin) formLogin.addEventListener('submit', handleUserLogin);

    const formReg = document.getElementById('form-register-user');
    if (formReg) formReg.addEventListener('submit', handleUserRegister);

    const formOwnerLogin = document.getElementById('form-owner-login');
    if (formOwnerLogin) formOwnerLogin.addEventListener('submit', handleOwnerLogin);

    const formUpdateApi = document.getElementById('form-update-apikey');
    if (formUpdateApi) formUpdateApi.addEventListener('submit', handleUpdateApiKey);

    document.querySelectorAll('.comic-btn-primary, .comic-btn-small, .btn-helper').forEach(btn => {
      btn.addEventListener('click', () => playZapSound());
    });
  });

})();
