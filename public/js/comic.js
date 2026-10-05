/* ==========================================================================
   ALIGHT MOTION PRO GENERATOR — COMIC INTERACTIVE JAVASCRIPT
   ========================================================================== */

(function () {
  'use strict';

  // State & Config
  const API_KEY = 'Codex-D1FAF918-419CB645-93B44EEA-58A4EFB5';
  const PROXY_BASE = '/api/comic'; // Local backend proxy
  const DIRECT_BASE = 'https://brann-alight-motion-2-production.up.railway.app/api/v1/bot-premium';

  let soundEnabled = true;
  let audioCtx = null;

  // Initialize Web Audio API Synthesizer for Comic SFX
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Comic Sound FX: Click Zap
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

  // Comic Sound FX: Explosion Boom
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

  // Comic Sound FX: Victory Fanfare Arpeggio
  function playVictorySound() {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
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

  // Spawn visual comic action burst ("BOOM!", "POW!", "ZAP!")
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

  // Live Health Check Ping
  async function checkApiHealth() {
    const dot = document.getElementById('health-dot');
    const statusText = document.getElementById('health-status-text');
    if (!statusText) return;

    try {
      const res = await fetch('/api/comic/health');
      const data = await res.json();
      if (data && data.online) {
        if (dot) dot.style.background = '#00FF66';
        statusText.innerHTML = '⚡ RAILWAY API ONLINE & READY FOR SUPER POWERS!';
      } else {
        if (dot) dot.style.background = '#FF6B00';
        statusText.innerHTML = '⚠️ RAILWAY API STANDBY / CHECKING RESPONSE...';
      }
    } catch (err) {
      if (dot) dot.style.background = '#FF0055';
      statusText.innerHTML = '❌ LOCAL BACKEND CONNECTED (RAILWAY API DIRECT FALLBACK READY)';
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

    // UI Loading state
    const originalBtnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SENDING MAGIC LINK...';
    outputBox.classList.remove('active');

    spawnPowText('BAM!', e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2);

    let resultData = null;
    let isSuccess = false;

    try {
      // 1. Try local proxy
      const proxyRes = await fetch(`${PROXY_BASE}/send-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      resultData = await proxyRes.json();
      isSuccess = proxyRes.ok && resultData.success;
    } catch (err) {
      console.warn('Proxy failed, attempting direct fetch:', err);
      // 2. Direct Fallback
      try {
        const directRes = await fetch(`${DIRECT_BASE}/send-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ email })
        });
        resultData = await directRes.json();
        isSuccess = directRes.ok && resultData.success;
      } catch (err2) {
        resultData = { success: false, message: 'Koneksi gagal: ' + err2.message };
      }
    }

    // Restore UI
    btn.disabled = false;
    btn.innerHTML = originalBtnText;

    // Show output
    outputBox.classList.add('active');
    if (isSuccess) {
      playVictorySound();
      spawnPowText('SUCCESS!', window.innerWidth / 2 - 80, 200);
      outputContent.innerHTML = `<span style="color:#00FF66">✔ SUCCESS: ${resultData.message}</span>\n<span style="color:#FFE600">Order ID: ${resultData.orderId || '-'}</span>\n\n📌 <b>LANGKAH SELANJUTNYA:</b>\n1. Cek Email <b>${email}</b> (Inbox/Spam).\n2. Buka pesan dari Alight Creative & copy Magic Link.\n3. Paste Magic Link di form <b>STEP 2 (AKTIVASI PREMIUM)</b>!`;
      
      // Auto fill step 2 email
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

    // UI Loading state
    const originalBtnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> UNLOCKING PREMIUM...';
    outputBox.classList.remove('active');

    spawnPowText('KABOOM!', e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2);

    let resultData = null;
    let isSuccess = false;

    try {
      // 1. Try local proxy
      const proxyRes = await fetch(`${PROXY_BASE}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, magicLink })
      });
      resultData = await proxyRes.json();
      isSuccess = proxyRes.ok && resultData.success;
    } catch (err) {
      console.warn('Proxy failed, attempting direct fetch:', err);
      // 2. Direct Fallback
      try {
        const directRes = await fetch(`${DIRECT_BASE}/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ email, magicLink })
        });
        resultData = await directRes.json();
        isSuccess = directRes.ok && resultData.success;
      } catch (err2) {
        resultData = { success: false, message: 'Koneksi gagal: ' + err2.message };
      }
    }

    // Restore UI
    btn.disabled = false;
    btn.innerHTML = originalBtnText;

    // Show output
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

  // Helper Utilities
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

  // Event Listeners Initialization
  document.addEventListener('DOMContentLoaded', () => {
    checkApiHealth();

    const formSend = document.getElementById('form-send-link');
    if (formSend) formSend.addEventListener('submit', handleSendLink);

    const formAct = document.getElementById('form-activate');
    if (formAct) formAct.addEventListener('submit', handleActivate);

    // Click sound effect for all comic buttons
    document.querySelectorAll('.comic-btn-primary, .comic-btn-small, .btn-helper').forEach(btn => {
      btn.addEventListener('click', () => playZapSound());
    });
  });

})();
