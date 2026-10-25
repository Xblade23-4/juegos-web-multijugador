/**
 * Cliente Oficial "Gran Santiago Online" (2 a 8 Jugadores)
 * Economía en Pesos Chilenos ($ CLP)
 */

const socket = io();

// Formateador oficial de Pesos Chilenos ($ CLP)
const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0
});

function formatCLP(amount) {
  return clpFormatter.format(Number(amount) || 0);
}

function formatCompactCLP(amount) {
  const n = Number(amount) || 0;
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

// Estado global del cliente
let boardMeta = {
  COLOR_GROUPS: {},
  PLAYER_AVATARS: [],
  BOARD_TILES: [],
  CUAL_ES_SYMBOLS: []
};

let myPlayerId = localStorage.getItem('gso_playerId') || ('p_' + Math.random().toString(36).substring(2, 10));
localStorage.setItem('gso_playerId', myPlayerId);

let customAvatarImageUrl = localStorage.getItem('gso_custom_avatar_url') || null;
let customAuthProvider = localStorage.getItem('gso_custom_auth_provider') || null;
let customUserName = localStorage.getItem('gso_custom_user_name') || null;
let activeSocialModalTarget = 'google';

let selectedAvatarId = customAvatarImageUrl ? 'custom_avatar' : (boardMeta?.PLAYER_AVATARS?.[0]?.id || 'condor');
let selectedGameType = 'santiago';
let currentRoomState = null;
let myPenaltyUntil = 0;
let penaltyIntervalId = null;
let cualesCardTransitionUntil = 0;
let cualesTransitionTimer = null;
let lastRenderedCualEsDeckCount = null;
let lastKnownTurnPlayerId = null;
let turnOverlayTimer = null;
let displayedPositions = {}; // { [playerId]: tileIndex }
let walkingTimers = {};      // { [playerId]: intervalId }
let hoppingPlayers = new Set();
let isDiceRollingAnim = false;
let pendingRoomStateAfterDice = null;
let pendingCardAfterDice = null;
let pendingCardAfterWalk = null;
let pendingPaymentPopupAfterWalk = null;
let paymentPopupTimeoutId = null;
let cardCountdownIntervalId = null;
let activeCardId = null;
let diceIntervalId = null;
let inspectedTileId = null;
let soundEnabled = true;
let musicEnabled = true;
let bgmIntervalId = null;
let bgmStepIndex = 0;
let currentAiSongIndex = 0;
let noiseBuffer = null;

// Efectos de sonido y Motor Musical Multipista IA (Web Audio API en tiempo real)
const audioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  ? new (window.AudioContext || window.webkitAudioContext)()
  : null;

// Tabla de frecuencias musicales (Hz) para composición multipista
const N = {
  _: 0,
  A1: 55.00, C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50
};

// 20 Canciones completas compuestas por IA desde el Jukebox
const AI_SONGS = (typeof window !== 'undefined' && window.MusicJukebox && Array.isArray(window.MusicJukebox.SONGS) && window.MusicJukebox.SONGS.length > 0)
  ? window.MusicJukebox.SONGS
  : [
      {
        name: 'Fiesta en Santiago (Electro-Party)',
        bpm: 126,
        leadWave: 'sawtooth',
        bassWave: 'sawtooth',
        chords: [
          [N.A3, N.C4, N.E4],
          [N.F3, N.A3, N.C4],
          [N.C4, N.E4, N.G4],
          [N.G3, N.B3, N.D4]
        ],
        bass: [
          N.A2, N._, N.A3, N.A2, N._, N.A2, N.G2, N.A2, N.A2, N._, N.A3, N.E2, N._, N.G2, N.A2, N.E3,
          N.F2, N._, N.F3, N.F2, N._, N.F2, N.E2, N.F2, N.F2, N._, N.F3, N.C3, N._, N.C3, N.F2, N.G2,
          N.C2, N._, N.C3, N.C2, N._, N.C2, N.B2, N.C3, N.C2, N._, N.C3, N.G2, N._, N.A2, N.C3, N.E3,
          N.G2, N._, N.G3, N.G2, N._, N.G2, N.A2, N.B2, N.D3, N._, N.B2, N.G2, N.A2, N.B2, N.D3, N.E3
        ],
        lead: [
          N.E5, N._, N.C5, N.A4, N._, N.C5, N.E5, N._, N.G5, N.E5, N._, N.D5, N.C5, N.D5, N.E5, N._,
          N.F5, N._, N.C5, N.A4, N._, N.C5, N.F5, N._, N.E5, N.D5, N._, N.C5, N.A4, N.C5, N.D5, N._,
          N.G5, N._, N.E5, N.C5, N.E5, N.G5, N.A5, N._, N.G5, N.E5, N.C5, N.D5, N.E5, N._, N.C5, N._,
          N.D5, N.E5, N.D5, N.B4, N.G4, N.B4, N.D5, N.G5, N.A5, N._, N.G5, N.E5, N.D5, N.E5, N.G5, N.A5
        ],
        drums: ['K', 'H', 'O', 'H', 'KS', 'H', 'O', 'H', 'K', 'H', 'K', 'O', 'KS', 'H', 'O', 'H']
      }
    ];

function getNoiseBuffer() {
  if (!audioCtx) return null;
  if (noiseBuffer) return noiseBuffer;
  const bufferSize = audioCtx.sampleRate * 0.25;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return noiseBuffer;
}

// Bombo electrónico con golpe grave (Kick Drum)
function playDrumKick(now) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(145, now);
  osc.frequency.exponentialRampToValueAtTime(38, now + 0.11);
  gain.gain.setValueAtTime(0.11, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}

// Caja / Clap con filtro pasa-banda y cuerpo (Snare)
function playDrumSnare(now) {
  const buf = getNoiseBuffer();
  if (buf) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.045, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(audioCtx.destination);
    noise.start(now);
    noise.stop(now + 0.12);
  }
  const body = audioCtx.createOscillator();
  const bGain = audioCtx.createGain();
  body.type = 'triangle';
  body.frequency.setValueAtTime(195, now);
  body.frequency.exponentialRampToValueAtTime(110, now + 0.07);
  bGain.gain.setValueAtTime(0.04, now);
  bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  body.connect(bGain);
  bGain.connect(audioCtx.destination);
  body.start(now);
  body.stop(now + 0.09);
}

// Platillo Hi-Hat (cerrado o abierto)
function playDrumHat(now, isOpen = false) {
  const buf = getNoiseBuffer();
  if (!buf) return;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buf;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(6800, now);
  const gain = audioCtx.createGain();
  const dur = isOpen ? 0.09 : 0.032;
  gain.gain.setValueAtTime(isOpen ? 0.024 : 0.015, now);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start(now);
  noise.stop(now + dur + 0.01);
}

// Bajo Funky con filtro resonante (Acid / Funk Bass)
function playSynthBass(freq, now, stepSec, waveType = 'sawtooth') {
  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  osc.type = waveType;
  osc.frequency.setValueAtTime(freq, now);

  filter.type = 'lowpass';
  filter.Q.setValueAtTime(3.5, now);
  filter.frequency.setValueAtTime(1350, now);
  filter.frequency.exponentialRampToValueAtTime(210, now + stepSec * 0.9);

  gain.gain.setValueAtTime(0.042, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + stepSec * 0.95);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + stepSec);
}

// Acordes rítmicos (Synth Stabs)
function playChordStab(freqs, now, dur) {
  freqs.forEach((f) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now);
    gain.gain.setValueAtTime(0.014, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  });
}

// Sintetizador Principal Doble (Lead Melody con armónico brillante)
function playLeadSynth(freq, now, dur, waveType = 'sawtooth') {
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  osc1.type = waveType;
  osc2.type = 'sine';
  osc1.frequency.setValueAtTime(freq, now);
  osc2.frequency.setValueAtTime(freq * 2, now); // Brillo de octava alta

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2600, now);

  gain.gain.setValueAtTime(0.028, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + dur + 0.01);
  osc2.stop(now + dur + 0.01);
}

function updateMusicPlayerUI() {
  const song = AI_SONGS[currentAiSongIndex % AI_SONGS.length];
  const trackEl = document.getElementById('ai-music-track-name');
  const eqEl = document.getElementById('ai-music-eq');
  const globalBtn = document.getElementById('btn-global-music-toggle');
  const sidebarBtn = document.getElementById('btn-toggle-music');

  if (trackEl && song) {
    trackEl.textContent = song.name;
  }
  if (eqEl) {
    eqEl.classList.toggle('playing', musicEnabled);
  }
  if (globalBtn) {
    globalBtn.textContent = musicEnabled ? '🎵' : '🔕';
  }
  if (sidebarBtn) {
    sidebarBtn.textContent = musicEnabled ? '🎵' : '🔕';
  }
}

function startBackgroundMusic() {
  updateMusicPlayerUI();
  if (!musicEnabled || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (_) {}

  if (bgmIntervalId) {
    clearInterval(bgmIntervalId);
    bgmIntervalId = null;
  }

  const song = AI_SONGS[currentAiSongIndex % AI_SONGS.length];
  const stepMs = Math.round((60 / song.bpm / 4) * 1000); // Duración de 1 semicorchea
  const stepSec = stepMs / 1000;

  bgmIntervalId = setInterval(() => {
    if (!musicEnabled || !audioCtx || audioCtx.state !== 'running') return;
    const activeSong = AI_SONGS[currentAiSongIndex % AI_SONGS.length];
    const step = bgmStepIndex % 64;
    const barIdx = Math.floor(step / 16);
    const stepInBar = step % 16;
    bgmStepIndex += 1;

    try {
      const now = audioCtx.currentTime;

      // 1. Batería y Percusión
      const drumHit = activeSong.drums[stepInBar] || '_';
      if (drumHit.includes('K')) playDrumKick(now);
      if (drumHit.includes('S') || (step === 62 || step === 63)) playDrumSnare(now);
      if (drumHit.includes('H')) playDrumHat(now, false);
      if (drumHit.includes('O')) playDrumHat(now, true);

      // 2. Línea de Bajo Funky / Synth
      const bassNote = activeSong.bass[step];
      if (bassNote) {
        playSynthBass(bassNote, now, stepSec * 1.15, activeSong.bassWave);
      }

      // 3. Acordes Rítmicos (en golpes 0, 3, 6, 10, 12 de cada compás)
      if ([0, 3, 6, 10, 12].includes(stepInBar)) {
        const chord = activeSong.chords[barIdx % activeSong.chords.length];
        if (chord) {
          playChordStab(chord, now, stepSec * 1.6);
        }
      }

      // 4. Melodía Principal Sintetizada IA
      const leadNote = activeSong.lead[step];
      if (leadNote) {
        playLeadSynth(leadNote, now, stepSec * 1.85, activeSong.leadWave);
      }
    } catch (_) {}
  }, stepMs);
}

function stopBackgroundMusic() {
  if (bgmIntervalId) {
    clearInterval(bgmIntervalId);
    bgmIntervalId = null;
  }
  updateMusicPlayerUI();
}

function prevAiSong() {
  currentAiSongIndex = (currentAiSongIndex - 1 + AI_SONGS.length) % AI_SONGS.length;
  bgmStepIndex = 0;
  musicEnabled = true;
  startBackgroundMusic();
  const song = AI_SONGS[currentAiSongIndex];
  showToast(`🎶 Canción IA: ${song.name}`);
}

function nextAiSong() {
  currentAiSongIndex = (currentAiSongIndex + 1) % AI_SONGS.length;
  bgmStepIndex = 0;
  musicEnabled = true;
  startBackgroundMusic();
  const song = AI_SONGS[currentAiSongIndex];
  showToast(`🎶 Canción IA: ${song.name}`);
}

function playCashierSound() {
  if (!soundEnabled || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;

    // 1. Sonido mecánico de cajón abriéndose
    const mech = audioCtx.createOscillator();
    const mGain = audioCtx.createGain();
    mech.type = 'triangle';
    mech.frequency.setValueAtTime(320, now);
    mech.frequency.exponentialRampToValueAtTime(140, now + 0.08);
    mGain.gain.setValueAtTime(0.12, now);
    mGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    mech.connect(mGain);
    mGain.connect(audioCtx.destination);
    mech.start(now);
    mech.stop(now + 0.08);

    // 2. Primer repique de campana "Ka-" (E6 ~1318.5 Hz)
    const bell1 = audioCtx.createOscillator();
    const gBell1 = audioCtx.createGain();
    bell1.type = 'sine';
    bell1.frequency.setValueAtTime(1318.51, now + 0.04);
    gBell1.gain.setValueAtTime(0.2, now + 0.04);
    gBell1.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    bell1.connect(gBell1);
    gBell1.connect(audioCtx.destination);
    bell1.start(now + 0.04);
    bell1.stop(now + 0.38);

    // 3. Segundo repique brillante de campana "-CHING!" (B6 ~1975.5 Hz)
    const bell2 = audioCtx.createOscillator();
    const gBell2 = audioCtx.createGain();
    bell2.type = 'sine';
    bell2.frequency.setValueAtTime(1975.53, now + 0.12);
    gBell2.gain.setValueAtTime(0.26, now + 0.12);
    gBell2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    bell2.connect(gBell2);
    gBell2.connect(audioCtx.destination);
    bell2.start(now + 0.12);
    bell2.stop(now + 0.7);

    // Armónico metálico agudo
    const harm = audioCtx.createOscillator();
    const gHarm = audioCtx.createGain();
    harm.type = 'triangle';
    harm.frequency.setValueAtTime(3951, now + 0.12);
    gHarm.gain.setValueAtTime(0.07, now + 0.12);
    gHarm.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    harm.connect(gHarm);
    gHarm.connect(audioCtx.destination);
    harm.start(now + 0.12);
    harm.stop(now + 0.45);
  } catch (_) {}
}

function playTone(freq = 440, duration = 0.12, type = 'sine') {
  if (!soundEnabled || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (_) {}
}

function playSoundEffect(kind) {
  if (kind === 'dice') {
    playTone(320, 0.08, 'triangle');
    setTimeout(() => playTone(480, 0.1, 'triangle'), 90);
  } else if (kind === 'buy' || kind === 'cashier') {
    playCashierSound();
  } else if (kind === 'turn') {
    playTone(587.33, 0.12, 'sine');
    setTimeout(() => playTone(783.99, 0.16, 'sine'), 110);
  } else if (kind === 'card') {
    playTone(440, 0.08, 'triangle');
    setTimeout(() => playTone(554.37, 0.09, 'triangle'), 80);
    setTimeout(() => playTone(659.25, 0.15, 'sine'), 165);
  }
}

// Sonido de paso individual por cada casilla caminada (con tono ascendente)
function playStepSound(stepIndex = 0) {
  const baseFreq = 290 + Math.min(stepIndex * 24, 360);
  playTone(baseFreq, 0.075, 'triangle');
}

function renderTokensOnBoard(state) {
  if (!state || !boardMeta.BOARD_TILES.length) return;
  boardMeta.BOARD_TILES.forEach((tile) => {
    const tokenContainer = document.getElementById(`tokens-tile-${tile.id}`);
    if (tokenContainer) tokenContainer.innerHTML = '';
  });

  state.players.forEach((p) => {
    if (p.bankrupt) return;
    const pos = displayedPositions[p.id] !== undefined ? displayedPositions[p.id] : p.position;
    if (window.SantiagoMapAnimation && !walkingTimers[p.id]) {
      window.SantiagoMapAnimation.setPlayerTile(p.id, p.name, p.avatar?.icon, pos, false, p.avatar?.imageUrl);
    }
    const tokenContainer = document.getElementById(`tokens-tile-${pos}`);
    if (tokenContainer) {
      const tok = document.createElement('div');
      const isMe = p.id === myPlayerId;
      const isHopping = hoppingPlayers.has(p.id);
      const hasPhoto = Boolean(p.avatar?.imageUrl);
      tok.className = 'board-token' +
        (isMe ? ' is-me-token' : '') +
        (isHopping ? ' token-hopping' : '') +
        (hasPhoto ? ' has-photo' : '');
      tok.style.borderColor = p.avatar.color;
      tok.title = `${p.name} (${formatCLP(p.money)})`;
      if (hasPhoto) {
        tok.innerHTML = `<img src="${p.avatar.imageUrl}" alt="${p.name}" class="token-photo-img" />`;
      } else {
        tok.textContent = p.avatar.icon;
      }
      tokenContainer.appendChild(tok);
    }
  });
}

function animatePlayerMovement(player, fromPos, toPos) {
  if (walkingTimers[player.id]) {
    clearInterval(walkingTimers[player.id]);
    delete walkingTimers[player.id];
  }

  // Calcular la ruta casilla por casilla
  const steps = [];
  const forwardDist = (toPos - fromPos + 40) % 40;
  const backwardDist = (fromPos - toPos + 40) % 40;

  if (forwardDist === 0) {
    displayedPositions[player.id] = toPos;
    renderTokensOnBoard(currentRoomState);
    if (window.SantiagoMapAnimation) {
      window.SantiagoMapAnimation.setPlayerTile(player.id, player.name, player.avatar?.icon, toPos, false, player.avatar?.imageUrl);
    }
    return;
  }

  // Si retrocede 3 casillas (ej: Taco en la Alameda)
  if (backwardDist <= 4 && forwardDist > 30) {
    for (let i = 1; i <= backwardDist; i++) {
      steps.push((fromPos - i + 40) % 40);
    }
  } else {
    for (let i = 1; i <= forwardDist; i++) {
      steps.push((fromPos + i) % 40);
    }
  }

  let stepIdx = 0;
  walkingTimers[player.id] = setInterval(() => {
    if (stepIdx >= steps.length) {
      clearInterval(walkingTimers[player.id]);
      delete walkingTimers[player.id];
      hoppingPlayers.delete(player.id);
      renderTokensOnBoard(currentRoomState);

      if (pendingCardAfterWalk && (!pendingCardAfterWalk.playerId || pendingCardAfterWalk.playerId === player.id)) {
        const cd = pendingCardAfterWalk;
        pendingCardAfterWalk = null;
        showDrawnCardNotification(cd);
      }

      if (pendingPaymentPopupAfterWalk && (!pendingPaymentPopupAfterWalk.payerId || pendingPaymentPopupAfterWalk.payerId === player.id)) {
        const pay = pendingPaymentPopupAfterWalk;
        pendingPaymentPopupAfterWalk = null;
        showPaymentPopup(pay);
      }

      if (currentRoomState) {
        updateTurnActionControls(currentRoomState);
      }
      if (window.SantiagoMapAnimation) {
        window.SantiagoMapAnimation.setPlayerTile(player.id, player.name, player.avatar?.icon, toPos, false, player.avatar?.imageUrl);
      }
      return;
    }

    const nextTileId = steps[stepIdx];
    displayedPositions[player.id] = nextTileId;
    hoppingPlayers.add(player.id);
    if (window.SantiagoMapAnimation) {
      window.SantiagoMapAnimation.setPlayerTile(player.id, player.name, player.avatar?.icon, nextTileId, true, player.avatar?.imageUrl);
    }

    // Sonido por cada cuadro avanzado
    playStepSound(stepIdx);

    // Iluminar brevemente la casilla pisada
    const tileEl = document.getElementById(`board-tile-${nextTileId}`);
    if (tileEl) {
      tileEl.classList.add('tile-step-highlight');
      setTimeout(() => tileEl.classList.remove('tile-step-highlight'), 240);
    }

    renderTokensOnBoard(currentRoomState);
    stepIdx += 1;
  }, 190);
}

// Detección de transición discreta de display y cierre animado de <dialog> (Top Layer)
let supportsDisplayTransition;
function canTransitionDisplay() {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit() {
  return window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay();
}

async function closeTopLayer(element) {
  if (!element || !element.open) return;
  if (!supportsTopLayerExit()) {
    element.setAttribute('data-closing', '');
    const animations = element.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => setTimeout(r, 2000))
      ]);
    }
    if (!element.hasAttribute('data-closing')) return;
    element.removeAttribute('data-closing');
  }
  element.close();
}

function triggerTurnChangeAnimation(player, isMyTurn) {
  playSoundEffect('turn');
  const overlay = document.getElementById('turn-transition-overlay');
  const card = document.getElementById('turn-transition-card');
  const avatarEl = document.getElementById('tt-avatar');
  const nameEl = document.getElementById('tt-name');
  const subEl = document.getElementById('tt-sub');

  if (!overlay || !card || !player) return;

  card.style.borderTopColor = player.avatar?.color || '#2563eb';
  if (player.avatar?.imageUrl) {
    avatarEl.innerHTML = `<img src="${player.avatar.imageUrl}" alt="${player.name}" class="tt-avatar-img" />`;
  } else {
    avatarEl.textContent = player.avatar?.icon || '🎲';
  }
  nameEl.textContent = isMyTurn ? `¡Es tu turno, ${player.name}!` : `Turno de ${player.name}`;
  subEl.textContent = isMyTurn
    ? '¡Lanza los dados y conquista las comunas de Santiago!'
    : `Saldo disponible: ${formatCLP(player.money)}`;

  overlay.classList.remove('hidden');
  // Reiniciar la animación CSS
  card.style.animation = 'none';
  overlay.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';
  overlay.style.animation = '';

  if (turnOverlayTimer) clearTimeout(turnOverlayTimer);
  turnOverlayTimer = setTimeout(() => {
    overlay.classList.add('hidden');
  }, 1600);
}

function showToast(text) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3600);
}

// Posición en la grilla 11x11 para cada una de las 40 casillas
function getGridPosition(tileId) {
  if (tileId >= 0 && tileId <= 10) {
    return { row: 11, col: 11 - tileId };
  }
  if (tileId >= 11 && tileId <= 20) {
    return { row: 11 - (tileId - 10), col: 1 };
  }
  if (tileId >= 21 && tileId <= 30) {
    return { row: 1, col: 1 + (tileId - 20) };
  }
  return { row: 1 + (tileId - 30), col: 11 };
}

// Fallback para light-dismiss y cierre animado en navegadores
function setupDialogLightDismiss(dialog) {
  if (!dialog) return;
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeTopLayer(dialog);
  });
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (isDialogContent) return;
      closeTopLayer(dialog);
    });
  }
}

let activeGamePartyUrl = null;

const GAME_META_LABELS = {
  santiago: { title: '🚇 Gran Santiago Online', short: 'Gran Santiago', icon: '🚇' },
  cual_es: { title: '🔍 ¿Cuál es? (Coincidencias)', short: '¿Cuál es?', icon: '🔍' },
  crossword: { title: '🧩 Crucigrama Party', short: 'Crucigrama Party', icon: '🧩' },
  pictionary: { title: '🎨 Doodle Party', short: 'Doodle Party', icon: '🎨' },
  sudoku: { title: '🔢 Sudoku Colaborativo', short: 'Sudoku Colaborativo', icon: '🔢' }
};

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

function applySocialProfile({ name, imageUrl, provider }) {
  if (!imageUrl) return;
  customAvatarImageUrl = imageUrl;
  customAuthProvider = provider || 'social';
  if (name) customUserName = name;
  selectedAvatarId = 'custom_avatar';

  localStorage.setItem('gso_custom_avatar_url', customAvatarImageUrl);
  localStorage.setItem('gso_custom_auth_provider', customAuthProvider);
  if (name) localStorage.setItem('gso_custom_user_name', name);

  updateSocialCardUI();
  renderAvatarSelector();

  // Si el input de nombre está vacío o por defecto, rellenarlo con el nombre de la cuenta
  const nameInput = document.getElementById('input-player-name');
  if (nameInput && name && (!nameInput.value || nameInput.value === 'Santiaguino' || nameInput.value === 'Inversionista')) {
    nameInput.value = name;
    localStorage.setItem('gso_playerName', name);
  }

  // Si ya está en una sala, notificar al servidor para actualizar en vivo a todos
  if (currentRoomCode) {
    socket.emit('update_avatar', { avatarId: 'custom_avatar', avatarImageUrl: customAvatarImageUrl, name });
  }

  // Cerrar diálogo si estaba abierto
  const dialog = document.getElementById('social-auth-dialog');
  if (dialog && dialog.open) {
    dialog.close();
  }
  showToast(`✅ Foto de perfil de ${provider.toUpperCase()} activada con éxito`);
}

function updateSocialCardUI() {
  const card = document.getElementById('social-connected-card');
  const img = document.getElementById('scc-avatar-img');
  const badge = document.getElementById('scc-provider-badge');
  const nameEl = document.getElementById('scc-user-name');
  const descEl = document.getElementById('scc-provider-desc');

  if (!card) return;

  if (customAvatarImageUrl) {
    card.classList.remove('hidden');
    if (img) img.src = customAvatarImageUrl;
    const providerLabels = {
      google: { badge: 'G', label: 'Cuenta de Google', color: '#ea4335' },
      facebook: { badge: 'f', label: 'Cuenta de Facebook', color: '#1877F2' },
      instagram: { badge: '📷', label: 'Cuenta de Instagram', color: '#e1306c' },
      custom: { badge: '📁', label: 'Foto personalizada', color: '#0284c7' }
    };
    const pInfo = providerLabels[customAuthProvider] || providerLabels.custom;
    if (badge) {
      badge.textContent = pInfo.badge;
      badge.style.backgroundColor = pInfo.color;
    }
    if (nameEl) nameEl.textContent = customUserName || 'Usuario';
    if (descEl) descEl.textContent = pInfo.label;
  } else {
    card.classList.add('hidden');
  }
}

function openSocialModal() {
  const dialog = document.getElementById('social-auth-dialog');
  if (dialog && !dialog.open) {
    dialog.showModal();
  }
}

function initSocialAuth() {
  updateSocialCardUI();

  // Botón para subir o enlazar foto de perfil personalizada
  document.getElementById('btn-upload-photo')?.addEventListener('click', () => {
    const dialog = document.getElementById('social-auth-dialog');
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      document.getElementById('social-file-input')?.click();
    }
  });

  document.getElementById('btn-social-disconnect')?.addEventListener('click', () => {
    customAvatarImageUrl = null;
    customAuthProvider = null;
    customUserName = null;
    selectedAvatarId = boardMeta.PLAYER_AVATARS[0]?.id || 'condor';

    localStorage.removeItem('gso_custom_avatar_url');
    localStorage.removeItem('gso_custom_auth_provider');
    localStorage.removeItem('gso_custom_user_name');

    updateSocialCardUI();
    renderAvatarSelector();

    if (currentRoomCode) {
      socket.emit('update_avatar', { avatarId: selectedAvatarId, avatarImageUrl: null });
    }
    showToast('Foto de ficha quitada. Usando ficha chilena estándar.');
  });

  // Modal de opciones para foto personalizada
  document.getElementById('btn-close-social-dialog')?.addEventListener('click', () => {
    document.getElementById('social-auth-dialog')?.close();
  });

  document.getElementById('btn-social-opt-upload')?.addEventListener('click', () => {
    document.getElementById('social-file-input')?.click();
    document.getElementById('social-auth-dialog')?.close();
  });

  document.getElementById('btn-apply-avatar-url')?.addEventListener('click', () => {
    const input = document.getElementById('input-social-avatar-url');
    const url = input?.value.trim();
    if (!url || !url.startsWith('http')) {
      showToast('Ingresa una URL válida que empiece con http:// o https://');
      return;
    }
    applySocialProfile({
      name: null,
      imageUrl: url,
      provider: 'custom'
    });
    if (input) input.value = '';
    document.getElementById('social-auth-dialog')?.close();
  });

  document.getElementById('social-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('La imagen debe pesar menos de 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (dataUrl) {
        applySocialProfile({
          name: null,
          imageUrl: dataUrl,
          provider: 'custom'
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });
}

// Inicialización al cargar la página
async function initApp() {
  setupDialogLightDismiss(document.getElementById('property-dialog'));
  setupDialogLightDismiss(document.getElementById('trade-dialog'));
  setupDialogLightDismiss(document.getElementById('drawn-card-dialog'));
  setupDialogLightDismiss(document.getElementById('social-auth-dialog'));

  initSocialAuth();

  // Vincular eventos inmediatamente para que Crear Sala y Entrar funcionen sin demora
  bindUIEvents();

  // Autocompletar nombre guardado o código por URL (?sala=STGO-XXXX o ?room=STGO-XXXX)
  const savedName = localStorage.getItem('gso_playerName');
  if (savedName) {
    document.getElementById('input-player-name').value = savedName;
  }

  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('sala') || params.get('room');
  if (roomParam) {
    document.getElementById('input-room-code').value = roomParam.toUpperCase();
    showToast(`Código de invitación detectado: ${roomParam.toUpperCase()}`);
  }

  try {
    const res = await fetch('/api/board');
    boardMeta = await res.json();
    renderAvatarSelector();
    buildBoardDOM();
    if (currentRoomState && currentRoomState.status !== 'lobby') {
      renderGame(currentRoomState);
    }
  } catch (err) {
    console.error('Error cargando datos del tablero:', err);
  }
}

function renderAvatarSelector() {
  const container = document.getElementById('avatar-selector');
  container.innerHTML = '';

  // Si el usuario tiene una foto de perfil personalizada (Google, Facebook, Instagram o archivo)
  if (customAvatarImageUrl) {
    const isCustomSelected = selectedAvatarId === 'custom_avatar';
    const customDiv = document.createElement('div');
    customDiv.className = 'avatar-option avatar-photo-opt' + (isCustomSelected ? ' selected' : '');
    customDiv.innerHTML = `
      <div class="av-photo-wrap">
        <img src="${customAvatarImageUrl}" alt="Mi Foto" class="av-photo-img" />
        <span class="av-photo-badge">⭐</span>
      </div>
      <span class="av-name">Mi Foto</span>
    `;
    customDiv.addEventListener('click', () => {
      selectedAvatarId = 'custom_avatar';
      document.querySelectorAll('.avatar-option').forEach((el) => el.classList.remove('selected'));
      customDiv.classList.add('selected');
    });
    container.appendChild(customDiv);
  }

  boardMeta.PLAYER_AVATARS.forEach((av, idx) => {
    if (!customAvatarImageUrl && idx === 0 && !selectedAvatarId) selectedAvatarId = av.id;
    const div = document.createElement('div');
    div.className = 'avatar-option' + (av.id === selectedAvatarId ? ' selected' : '');
    div.innerHTML = `
      <span class="av-icon">${av.icon}</span>
      <span class="av-name">${av.name}</span>
    `;
    div.addEventListener('click', () => {
      selectedAvatarId = av.id;
      document.querySelectorAll('.avatar-option').forEach((el) => el.classList.remove('selected'));
      div.classList.add('selected');
    });
    container.appendChild(div);
  });
}

function buildBoardDOM() {
  const grid = document.getElementById('board-grid');
  // Eliminar casillas previas conservando .board-center
  grid.querySelectorAll('.board-tile').forEach((el) => el.remove());

  boardMeta.BOARD_TILES.forEach((tile) => {
    const pos = getGridPosition(tile.id);
    const tileEl = document.createElement('div');
    const isCorner = [0, 10, 20, 30].includes(tile.id);

    let edgeClass = 'tile-edge-bottom';
    if (tile.id >= 11 && tile.id <= 20) edgeClass = 'tile-edge-left';
    else if (tile.id >= 21 && tile.id <= 30) edgeClass = 'tile-edge-top';
    else if (tile.id >= 31 && tile.id <= 39) edgeClass = 'tile-edge-right';

    tileEl.className = 'board-tile ' + edgeClass + (isCorner ? ' corner-tile' : '');
    tileEl.id = `board-tile-${tile.id}`;
    tileEl.style.gridRow = pos.row;
    tileEl.style.gridColumn = pos.col;

    const groupInfo = tile.group ? boardMeta.COLOR_GROUPS[tile.group] : null;
    const specialColors = {
      chance: '#f97316',
      community: '#16a34a',
      tax: '#475569'
    };
    const barColor = groupInfo ? groupInfo.color : (specialColors[tile.type] || '#64748b');

    if (isCorner) {
      tileEl.innerHTML = `
        <div class="tile-icon">${tile.icon || '📍'}</div>
        <div class="tile-name">${tile.shortName || tile.name}</div>
        <div class="tile-tokens" id="tokens-tile-${tile.id}"></div>
      `;
    } else {
      const hasBadgeIcon = ['station', 'utility', 'chance', 'community', 'tax'].includes(tile.type);
      const barInitialIcon = tile.type === 'station' ? '🚇' : (tile.type === 'utility' ? (tile.icon || '⚡') : '');
      tileEl.innerHTML = `
        <div class="tile-color-bar" id="bar-tile-${tile.id}" style="background:${barColor}">${barInitialIcon}</div>
        <div class="tile-name">${tile.shortName || tile.name}</div>
        ${tile.icon ? `<div class="${hasBadgeIcon ? 'tile-center-badge' : 'tile-icon'}" style="border-color:${barColor}">${tile.icon}</div>` : ''}
        <div class="tile-meta-footer">
          <div class="tile-price" id="price-tile-${tile.id}">${tile.price ? formatCompactCLP(tile.price) : (tile.taxAmount ? '-' + formatCompactCLP(tile.taxAmount) : '')}</div>
          <div class="tile-rent-tag hidden" id="rent-tag-tile-${tile.id}"></div>
        </div>
        <div class="tile-tokens" id="tokens-tile-${tile.id}"></div>
        <div class="tile-owner-dot hidden" id="owner-dot-${tile.id}"></div>
        <div class="tile-mortgaged-tag hidden" id="mortgaged-tag-${tile.id}">HIPOTECADA</div>
      `;
    }

    tileEl.addEventListener('click', () => openPropertyModal(tile.id));
    grid.appendChild(tileEl);
  });
}

function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach((sc) => sc.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');

  if (screenId === 'screen-game') {
    if (window.SantiagoMapAnimation) {
      setTimeout(() => {
        window.SantiagoMapAnimation.resize();
        window.SantiagoMapAnimation.start();
      }, 80);
    }
  } else if (window.SantiagoMapAnimation) {
    window.SantiagoMapAnimation.stop();
  }
}

function bindUIEvents() {
  // Selector de Modo de Juego en pantalla de inicio (voto inicial al crear sala)
  const modeOptions = document.querySelectorAll('.game-mode-selector .mode-option[data-mode]');
  const moneyGroup = document.getElementById('group-starting-money');

  modeOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedGameType = btn.dataset.mode || 'santiago';
      modeOptions.forEach((el) => el.classList.remove('selected'));
      btn.classList.add('selected');
      if (moneyGroup) {
        moneyGroup.style.display = selectedGameType === 'santiago' ? 'block' : 'none';
      }
    });
  });

  // Votación de juego en el Lobby Unificado (4 tarjetas votables por todos)
  document.querySelectorAll('.lobby-vote-card[data-game]').forEach((card) => {
    card.addEventListener('click', () => {
      const gameType = card.dataset.game;
      playTone(520, 0.08, 'sine');
      socket.emit('vote_game', { gameType });
    });
  });

  // Botones de compatibilidad en el Lobby
  document.getElementById('btn-lobby-mode-santiago')?.addEventListener('click', () => {
    socket.emit('set_game_type', { gameType: 'santiago' });
  });
  document.getElementById('btn-lobby-mode-cuales')?.addEventListener('click', () => {
    socket.emit('set_game_type', { gameType: 'cual_es' });
  });

  // Ajustes de sala en el Lobby (Capital CLP, Categoría, Dificultad)
  document.getElementById('lobby-select-money')?.addEventListener('change', (e) => {
    socket.emit('update_lobby_settings', { startingMoney: Number(e.target.value) || 1500000 });
  });
  document.getElementById('lobby-select-category')?.addEventListener('change', (e) => {
    socket.emit('update_lobby_settings', { category: e.target.value });
  });
  document.getElementById('lobby-select-difficulty')?.addEventListener('change', (e) => {
    socket.emit('update_lobby_settings', { difficulty: e.target.value });
  });
  document.getElementById('lobby-select-sudoku-diff')?.addEventListener('change', (e) => {
    socket.emit('update_lobby_settings', { sudokuDifficulty: e.target.value });
  });

  // Chat en vivo dentro del Lobby Unificado
  document.getElementById('lobby-chat-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('lobby-chat-input');
    const msg = input?.value.trim();
    if (!msg) return;
    socket.emit('send_chat', { message: msg });
    input.value = '';
  });

  // Volver al Lobby Unificado desde cualquier juego
  const returnToLobbyHandler = () => {
    socket.emit('return_to_lobby', {}, (res) => {
      if (res && !res.ok && res.error) showToast(res.error);
    });
  };
  document.getElementById('btn-return-lobby')?.addEventListener('click', returnToLobbyHandler);
  document.getElementById('btn-return-lobby-santiago')?.addEventListener('click', returnToLobbyHandler);
  document.getElementById('btn-cuales-finish-return')?.addEventListener('click', returnToLobbyHandler);

  // Votar para Abandonar Juego y Volver a la Sala de Espera
  const voteAbandonHandler = () => {
    socket.emit('vote_abandon_game', {}, (res) => {
      if (res && res.ok) {
        if (res.abandoned) {
          showToast('🏳️ Partida finalizada por votación. ¡De vuelta en la Sala!');
        } else if (res.voted) {
          showToast(`🏳️ Votaste por abandonar el juego (${res.votes}/${res.required})`);
        } else {
          showToast(`↩️ Retiraste tu voto de abandonar (${res.votes}/${res.required})`);
        }
      }
    });
  };
  document.getElementById('btn-vote-abandon')?.addEventListener('click', voteAbandonHandler);
  document.getElementById('btn-cuales-vote-abandon')?.addEventListener('click', voteAbandonHandler);
  document.getElementById('btn-gp-vote-abandon')?.addEventListener('click', voteAbandonHandler);

  // Escuchar mensajes desde el iframe de Crucigrama Party / Doodle Party
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'UNIFIED_RETURN_TO_LOBBY') {
      socket.emit('return_to_lobby');
    } else if (e.data?.type === 'UNIFIED_LEAVE_ROOM') {
      window.location.href = '/';
    }
  });

  // Crear sala
  document.getElementById('btn-create-room').addEventListener('click', () => {
    const playerName = document.getElementById('input-player-name').value.trim() || 'Santiaguino';
    const startingMoney = Number(document.getElementById('select-starting-money').value) || 1500000;
    localStorage.setItem('gso_playerName', playerName);

    const activePhotoUrl = (selectedAvatarId === 'custom_avatar' || customAvatarImageUrl) ? customAvatarImageUrl : null;

    socket.emit(
      'create_room',
      { playerName, avatarId: selectedAvatarId, avatarImageUrl: activePhotoUrl, startingMoney, gameType: selectedGameType, playerId: myPlayerId },
      (res) => {
        if (res && res.ok) {
          if (res.state) {
            applyIncomingRoomState(res.state);
          }
          window.history.replaceState({}, '', `?sala=${res.roomCode}`);
        } else {
          showToast(res?.error || 'Error al crear sala');
        }
      }
    );
  });

  // Unirse por código
  document.getElementById('btn-join-code').addEventListener('click', () => {
    const code = document.getElementById('input-room-code').value.trim().toUpperCase();
    if (!code) {
      showToast('Ingresa un código de sala (ej: STGO-XXXX)');
      return;
    }
    joinRoomByCode(code);
  });

  document.getElementById('btn-refresh-rooms').addEventListener('click', () => {
    socket.emit('get_public_rooms');
    showToast('Lista de salas actualizada');
  });

  // Copiar link de invitación
  const copyInviteLink = () => {
    if (!currentRoomState) return;
    const url = `${window.location.origin}/?sala=${currentRoomState.code}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast(`¡Enlace copiado! Compártelo: ${url}`);
    });
  };
  document.getElementById('btn-copy-link').addEventListener('click', copyInviteLink);
  document.getElementById('btn-copy-game-link').addEventListener('click', copyInviteLink);
  document.getElementById('btn-mobile-copy-link')?.addEventListener('click', copyInviteLink);

  document.getElementById('btn-mobile-abandon')?.addEventListener('click', () => {
    socket.emit('vote_abandon', {}, (res) => {
      if (res && !res.ok) showToast(res.error);
    });
  });

  document.getElementById('btn-mobile-sound')?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('btn-mobile-sound');
    if (btn) btn.textContent = soundEnabled ? '🔊' : '🔇';
    const deskBtn = document.getElementById('btn-toggle-sound');
    if (deskBtn) deskBtn.textContent = soundEnabled ? '🔊' : '🔇';
    showToast(soundEnabled ? 'Efectos de sonido activados' : 'Sonido silenciado');
  });

  // Pestañas de navegación móvil (Tablero / Jugadores / Escrituras / Chat)
  const mobileTabBtns = document.querySelectorAll('.mobile-tab-btn');
  const mainLayout = document.getElementById('main-game-layout');
  const mobileChatBadge = document.getElementById('mobile-chat-badge');
  const myTurnBanner = document.getElementById('mobile-my-turn-banner');

  function setMobileActiveTab(tabKey) {
    if (!mainLayout) return;
    mainLayout.dataset.activeTab = tabKey;
    mobileTabBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabKey);
    });
    if (tabKey === 'chat' && mobileChatBadge) {
      mobileChatBadge.classList.add('hidden');
    }
    if (tabKey === 'board' && myTurnBanner) {
      myTurnBanner.classList.add('hidden');
    }
    if (tabKey === 'board' && window.SantiagoMapAnimation) {
      setTimeout(() => window.SantiagoMapAnimation.resize(), 60);
    }
  }
  window.setMobileActiveTab = setMobileActiveTab;

  mobileTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      setMobileActiveTab(btn.dataset.tab);
    });
  });

  document.getElementById('btn-mobile-goto-board')?.addEventListener('click', () => {
    setMobileActiveTab('board');
  });

  document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    window.location.href = '/';
  });

  // Agregar Bot en el Lobby
  document.getElementById('btn-add-bot').addEventListener('click', () => {
    socket.emit('add_bot', {}, (res) => {
      if (res && !res.ok) showToast(res.error);
    });
  });

  // Iniciar partida
  document.getElementById('btn-start-game').addEventListener('click', () => {
    const category = document.getElementById('lobby-select-category')?.value || 'todo_tipo';
    const difficulty = document.getElementById('lobby-select-difficulty')?.value || 'Fácil';
    const sudokuDifficulty = document.getElementById('lobby-select-sudoku-diff')?.value || 'facil';
    const startingMoney = Number(document.getElementById('lobby-select-money')?.value) || 1500000;
    socket.emit('start_game', { category, difficulty, sudokuDifficulty, startingMoney }, (res) => {
      if (res && !res.ok) showToast(res.error);
    });
  });

  // Controles de turno en el tablero
  document.getElementById('btn-roll-dice').addEventListener('click', () => {
    socket.emit('roll_dice');
  });

  document.getElementById('btn-pay-bail').addEventListener('click', () => {
    socket.emit('pay_bail', {}, (res) => {
      if (res && !res.ok) showToast(res.error);
    });
  });

  document.getElementById('btn-buy-prop').addEventListener('click', () => {
    playSoundEffect('buy');
    socket.emit('buy_property', {}, (res) => {
      if (res && !res.ok) showToast(res.error);
    });
  });

  document.getElementById('btn-skip-buy').addEventListener('click', () => {
    socket.emit('skip_buy');
  });

  document.getElementById('btn-end-turn').addEventListener('click', () => {
    socket.emit('end_turn');
  });

  // Iniciar música de fondo automáticamente al primer clic del usuario
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (musicEnabled) {
      startBackgroundMusic();
    }
    document.removeEventListener('click', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);

  // Música de Fondo IA (controles en reproductor flotante y en barra lateral)
  const toggleMusicHandler = () => {
    musicEnabled = !musicEnabled;
    if (musicEnabled) {
      startBackgroundMusic();
      showToast(`🎵 Música IA activada: ${AI_SONGS[currentAiSongIndex].name}`);
    } else {
      stopBackgroundMusic();
      showToast('🔕 Música IA en pausa');
    }
  };

  document.getElementById('btn-toggle-music')?.addEventListener('click', toggleMusicHandler);
  document.getElementById('btn-global-music-toggle')?.addEventListener('click', toggleMusicHandler);
  document.getElementById('btn-prev-ai-song')?.addEventListener('click', () => {
    prevAiSong();
  });
  document.getElementById('btn-next-ai-song')?.addEventListener('click', () => {
    nextAiSong();
  });

  // Sonido
  document.getElementById('btn-toggle-sound').addEventListener('click', (e) => {
    soundEnabled = !soundEnabled;
    e.currentTarget.textContent = soundEnabled ? '🔊' : '🔇';
    showToast(soundEnabled ? 'Efectos de sonido activados' : 'Sonido silenciado');
  });

  // Alternar Modo Claro / Modo Oscuro
  function applyTheme(theme) {
    const isLight = theme === 'light';
    document.documentElement.classList.toggle('theme-light', isLight);
    document.body.classList.toggle('theme-light', isLight);
    localStorage.setItem('gso_theme', theme);
    document.querySelectorAll('.btn-theme-toggle').forEach((btn) => {
      btn.textContent = isLight ? '☀️' : '🌙';
      btn.title = isLight ? 'Cambiar a Modo Oscuro' : 'Cambiar a Modo Claro';
    });
    if (window.SantiagoMapAnimation) {
      window.SantiagoMapAnimation.setTheme(theme);
    }
  }

  function toggleTheme() {
    const current = localStorage.getItem('gso_theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    showToast(next === 'light' ? '☀️ Modo Claro activado' : '🌙 Modo Oscuro activado');
    playTone(480, 0.08, 'triangle');
  }

  document.querySelectorAll('.btn-theme-toggle').forEach((btn) => {
    btn.addEventListener('click', toggleTheme);
  });

  // Inicializar tema guardado
  applyTheme(localStorage.getItem('gso_theme') || 'dark');

  // Chat
  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    socket.emit('send_chat', { message: msg });
    input.value = '';
  });

  // Modal de Propiedad
  document.getElementById('btn-close-prop-dialog').addEventListener('click', () => {
    closeTopLayer(document.getElementById('property-dialog'));
  });

  // Popup de Pago / Arriendo (cierre manual antes de los 5s)
  document.getElementById('btn-close-payment-popup')?.addEventListener('click', () => {
    closePaymentPopup();
  });

  // Modal de Tarjeta Sacada (cierre manual o confirmación antes de los 10s)
  const drawnCardDialog = document.getElementById('drawn-card-dialog');
  document.getElementById('btn-close-drawn-card').addEventListener('click', () => {
    confirmAndCloseDrawnCard(false);
  });
  if (drawnCardDialog) {
    drawnCardDialog.addEventListener('close', () => {
      if (cardCountdownIntervalId) {
        clearInterval(cardCountdownIntervalId);
        cardCountdownIntervalId = null;
      }
      if (activeCardId) {
        activeCardId = null;
        socket.emit('confirm_card');
      }
    });
  }

  document.getElementById('btn-build-house').addEventListener('click', () => {
    if (inspectedTileId === null) return;
    socket.emit('build_house', { tileId: inspectedTileId }, (res) => {
      if (res && !res.ok) showToast(res.error);
      else {
        playSoundEffect('buy');
        playTone(587.33, 0.15, 'triangle');
        openPropertyModal(inspectedTileId);
      }
    });
  });

  const buildHereBtn = document.getElementById('btn-build-here');
  if (buildHereBtn) {
    buildHereBtn.addEventListener('click', () => {
      if (!currentRoomState) return;
      const me = currentRoomState.players?.find((p) => p.id === myPlayerId);
      if (!me) return;
      socket.emit('build_house', { tileId: me.position }, (res) => {
        if (res && !res.ok) {
          showToast(res.error);
        } else {
          playSoundEffect('buy');
          playTone(587.33, 0.15, 'triangle');
          showToast('🏗️ ¡Mejora comprada con éxito!');
        }
      });
    });
  }

  document.getElementById('btn-sell-house').addEventListener('click', () => {
    if (inspectedTileId === null) return;
    socket.emit('sell_house', { tileId: inspectedTileId }, (res) => {
      if (res && !res.ok) showToast(res.error);
      else openPropertyModal(inspectedTileId);
    });
  });

  document.getElementById('btn-toggle-mortgage').addEventListener('click', () => {
    if (inspectedTileId === null) return;
    socket.emit('toggle_mortgage', { tileId: inspectedTileId }, (res) => {
      if (res && !res.ok) showToast(res.error);
      else openPropertyModal(inspectedTileId);
    });
  });

  // Modal de Negociación / Trueque
  document.getElementById('btn-open-trade').addEventListener('click', openTradeModal);
  document.getElementById('btn-close-trade-dialog').addEventListener('click', () => {
    closeTopLayer(document.getElementById('trade-dialog'));
  });

  document.getElementById('trade-target-player').addEventListener('change', populateTradeTargetProperties);

  document.getElementById('trade-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const targetPlayerId = document.getElementById('trade-target-player').value;
    const offerTileId = document.getElementById('trade-offer-tile').value || null;
    const requestTileId = document.getElementById('trade-request-tile').value || null;
    const offerMoney = Number(document.getElementById('trade-offer-money').value) || 0;
    const requestMoney = Number(document.getElementById('trade-request-money').value) || 0;

    socket.emit(
      'propose_trade',
      { targetPlayerId, offerTileId, requestTileId, offerMoney, requestMoney },
      (res) => {
        if (res && !res.ok) showToast(res.error);
        else {
          showToast('Oferta enviada a la Bolsa de Comercio');
          closeTopLayer(document.getElementById('trade-dialog'));
        }
      }
    );
  });
}

function joinRoomByCode(roomCode) {
  const playerName = document.getElementById('input-player-name').value.trim() || 'Inversionista';
  localStorage.setItem('gso_playerName', playerName);

  const activePhotoUrl = (selectedAvatarId === 'custom_avatar' || customAvatarImageUrl) ? customAvatarImageUrl : null;

  socket.emit(
    'join_room',
    { roomCode, playerName, avatarId: selectedAvatarId, avatarImageUrl: activePhotoUrl, playerId: myPlayerId },
    (res) => {
      if (res && res.ok) {
        if (res.state) {
          applyIncomingRoomState(res.state);
        }
        window.history.replaceState({}, '', `?sala=${res.roomCode}`);
      } else {
        showToast(res?.error || 'No se pudo entrar a la sala');
      }
    }
  );
}

// Eventos de Socket.IO
socket.on('public_rooms', (roomsList) => {
  const container = document.getElementById('public-rooms-list');
  if (!roomsList || !roomsList.length) {
    container.innerHTML = `<div class="empty-state">No hay salas abiertas en este instante. ¡Crea una a la izquierda e invita a tus amigos o agrega Bots!</div>`;
    return;
  }

  container.innerHTML = '';
  roomsList.forEach((r) => {
    const gMeta = GAME_META_LABELS[r.gameType] || GAME_META_LABELS.santiago;
    const subInfo =
      r.gameType === 'santiago'
        ? `👥 ${r.playerCount}/${r.maxPlayers} jugadores • Capital: ${formatCLP(r.startingMoney)} • Votación abierta`
        : `👥 ${r.playerCount}/${r.maxPlayers} jugadores • Votación abierta en el Lobby`;

    const item = document.createElement('div');
    item.className = 'room-item';
    item.innerHTML = `
      <div class="room-item-info">
        <strong>${r.code}</strong> • <span style="color:#facc15">${gMeta.icon} ${gMeta.short}</span> — Sala de ${r.hostName}
        <small>${subInfo}</small>
      </div>
      <button class="btn btn-accent btn-sm">Unirse</button>
    `;
    item.querySelector('button').addEventListener('click', () => joinRoomByCode(r.code));
    container.appendChild(item);
  });
});

function applyIncomingRoomState(state) {
  const prevTurnId = lastKnownTurnPlayerId;
  const activePlayer = state.players[state.turnIndex];
  currentRoomState = state;

  if (window.SantiagoMapAnimation) {
    window.SantiagoMapAnimation.updateGameState(state, myPlayerId);
  }

  if (state.status === 'lobby') {
    lastKnownTurnPlayerId = null;
    switchScreen('screen-lobby');
    renderLobby(state);
  } else {
    switchScreen('screen-game');
    renderGame(state);

    if (
      state.gameType === 'santiago' &&
      state.status === 'playing' &&
      activePlayer &&
      activePlayer.id !== prevTurnId
    ) {
      lastKnownTurnPlayerId = activePlayer.id;
      triggerTurnChangeAnimation(activePlayer, activePlayer.id === myPlayerId);
      const turnBanner = document.getElementById('turn-banner');
      if (turnBanner) {
        turnBanner.classList.remove('turn-pulse');
        void turnBanner.offsetWidth;
        turnBanner.classList.add('turn-pulse');
      }
    }
  }
}

socket.on('room_state', (state) => {
  if (isDiceRollingAnim && state.status === 'playing') {
    pendingRoomStateAfterDice = state;
    return;
  }
  applyIncomingRoomState(state);
});

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

socket.on('dice_rolled', ({ dice }) => {
  isDiceRollingAnim = true;
  const d1 = document.getElementById('die-1');
  const d2 = document.getElementById('die-2');
  const rollBtn = document.getElementById('btn-roll-dice');
  if (rollBtn) rollBtn.classList.add('hidden');

  d1.classList.add('rolling');
  d2.classList.add('rolling');

  if (diceIntervalId) clearInterval(diceIntervalId);

  // Cambiar caras de los dados y sonar agitando durante 2 segundos (2000 ms)
  let tick = 0;
  diceIntervalId = setInterval(() => {
    const r1 = Math.floor(Math.random() * 6);
    const r2 = Math.floor(Math.random() * 6);
    d1.textContent = DICE_FACES[r1];
    d2.textContent = DICE_FACES[r2];
    if (tick % 2 === 0) {
      playTone(260 + (tick * 18) % 240, 0.055, 'triangle');
    }
    tick += 1;
  }, 110);

  setTimeout(() => {
    if (diceIntervalId) {
      clearInterval(diceIntervalId);
      diceIntervalId = null;
    }
    d1.textContent = DICE_FACES[(dice[0] || 1) - 1];
    d2.textContent = DICE_FACES[(dice[1] || 1) - 1];
    d1.classList.remove('rolling');
    d2.classList.remove('rolling');
    playTone(587.33, 0.14, 'sine');

    isDiceRollingAnim = false;

    if (pendingRoomStateAfterDice) {
      const st = pendingRoomStateAfterDice;
      pendingRoomStateAfterDice = null;
      applyIncomingRoomState(st);
    }

    if (pendingCardAfterDice) {
      const cd = pendingCardAfterDice;
      pendingCardAfterDice = null;
      queueOrShowDrawnCard(cd);
    }
  }, 1000);
});

function queueOrShowDrawnCard(payload) {
  if (!payload) return;
  if (isDiceRollingAnim) {
    pendingCardAfterDice = payload;
    return;
  }
  // Si el personaje aún está caminando casilla por casilla hacia "?", esperar a que llegue
  if (payload.playerId && walkingTimers[payload.playerId]) {
    pendingCardAfterWalk = payload;
    return;
  }
  showDrawnCardNotification(payload);
}

function confirmAndCloseDrawnCard(fromServerEvent = false) {
  if (cardCountdownIntervalId) {
    clearInterval(cardCountdownIntervalId);
    cardCountdownIntervalId = null;
  }
  const shouldEmit = !fromServerEvent && Boolean(activeCardId);
  activeCardId = null;

  const cardDialog = document.getElementById('drawn-card-dialog');
  if (cardDialog && cardDialog.open) {
    closeTopLayer(cardDialog);
  }

  if (shouldEmit) {
    socket.emit('confirm_card');
  }
}

function showDrawnCardNotification({ id, playerName, deckType, deckTitle, card }) {
  playSoundEffect('card');
  activeCardId = id || ('card_' + Date.now());

  const isChance = deckType === 'chance';
  const headerColor = isChance ? '#f97316' : '#16a34a';

  // Actualizar banner en el centro del tablero con animación 3D Flip
  const banner = document.getElementById('last-card-banner');
  banner.classList.remove('hidden', 'card-flip-anim');
  banner.style.borderTopColor = headerColor;
  void banner.offsetWidth;
  banner.classList.add('card-flip-anim');

  const badgeEl = document.getElementById('card-banner-deck');
  badgeEl.style.color = headerColor;
  badgeEl.textContent = `${deckTitle} • ${playerName}`;
  document.getElementById('card-banner-title').textContent = card.title;
  document.getElementById('card-banner-text').textContent = card.text;

  // Abrir modal emergente de tarjeta con timeout de 10s o cierre manual
  const cardDialog = document.getElementById('drawn-card-dialog');
  if (cardDialog) {
    document.getElementById('drawn-card-header').style.background = headerColor;
    document.getElementById('drawn-card-deck').textContent = deckTitle;
    document.getElementById('drawn-card-title').textContent = card.title;
    document.getElementById('drawn-card-icon').textContent = isChance ? '❓' : '🍀';
    document.getElementById('drawn-card-player').textContent = `Tarjeta sacada por ${playerName}`;
    document.getElementById('drawn-card-text').textContent = card.text;

    let secondsLeft = 10;
    const countdownSpan = document.getElementById('drawn-card-countdown');
    const closeBtn = document.getElementById('btn-close-drawn-card');
    const updateCountdownUI = () => {
      if (countdownSpan) countdownSpan.textContent = String(secondsLeft);
      if (closeBtn) closeBtn.textContent = `¡Entendido! (${secondsLeft}s)`;
    };
    updateCountdownUI();

    if (cardCountdownIntervalId) clearInterval(cardCountdownIntervalId);
    cardCountdownIntervalId = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        confirmAndCloseDrawnCard(false);
        return;
      }
      updateCountdownUI();
    }, 1000);

    if (!cardDialog.open) cardDialog.showModal();
  }
}

socket.on('card_drawn', (payload) => {
  queueOrShowDrawnCard(payload);
});

socket.on('card_resolved', () => {
  confirmAndCloseDrawnCard(true);
});

// ================= POPUP FLOTANTE DE PAGO DE ARRIENDO O COBRO (5 SEGUNDOS) =================
function queueOrShowPaymentPopup(payload) {
  if (!payload) return;
  // Si el jugador que paga aún está caminando casilla por casilla, esperar a que aterrice en la propiedad
  if (payload.payerId && walkingTimers[payload.payerId]) {
    pendingPaymentPopupAfterWalk = payload;
    return;
  }
  showPaymentPopup(payload);
}

function showPaymentPopup(payload) {
  if (!payload) return;
  const overlay = document.getElementById('payment-popup-overlay');
  const badgeEl = document.getElementById('payment-popup-badge');
  const payerAvatarEl = document.getElementById('payment-payer-avatar');
  const receiverAvatarEl = document.getElementById('payment-receiver-avatar');
  const msgEl = document.getElementById('payment-popup-message');
  const amountEl = document.getElementById('payment-popup-amount');
  const timerFill = document.getElementById('payment-timer-fill');

  if (!overlay) return;

  // Sonido de cobro / pago en caja
  if (soundEnabled) {
    playTone(330, 0.08, 'triangle');
    setTimeout(() => playTone(247, 0.12, 'triangle'), 85);
  }

  // Título e iconos del popup
  if (payload.type === 'rent') {
    badgeEl.textContent = '💸 COBRO DE ARRIENDO';
  } else if (payload.type === 'tax') {
    badgeEl.textContent = '🏛️ PAGO DE IMPUESTOS / TAG';
  } else if (payload.type === 'bail') {
    badgeEl.textContent = '🚓 PAGO DE FIANZA';
  } else {
    badgeEl.textContent = '💳 PAGO / COBRO';
  }

  payerAvatarEl.textContent = payload.payerAvatar || '👤';
  receiverAvatarEl.textContent = payload.receiverAvatar || '👤';

  // Mensaje exacto: "x jugador ha caido en la propiedad de x jugador y ha pagado $ cantidad"
  if (payload.type === 'rent') {
    msgEl.innerHTML = `<strong>${payload.payerName}</strong> ha caído en la propiedad de <strong>${payload.receiverName}</strong> y ha pagado`;
  } else if (payload.type === 'tax') {
    msgEl.innerHTML = `<strong>${payload.payerName}</strong> ha caído en <strong>${payload.tileName || 'Impuestos'}</strong> y ha pagado`;
  } else {
    msgEl.innerHTML = payload.message || `<strong>${payload.payerName}</strong> ha pagado`;
  }

  amountEl.textContent = `-${formatCLP(payload.amount)}`;

  // Sonido de caja registradora (cashier Ka-Ching!) en cada pago de Gran Santiago
  playCashierSound();

  // Reiniciar barra de temporizador de 5 segundos
  if (timerFill) {
    timerFill.style.animation = 'none';
    void timerFill.offsetWidth;
    timerFill.style.animation = 'timerProgress 5s linear forwards';
  }

  overlay.classList.remove('hidden', 'closing');

  if (paymentPopupTimeoutId) {
    clearTimeout(paymentPopupTimeoutId);
    paymentPopupTimeoutId = null;
  }

  // Desaparece automáticamente en exactamente 5 segundos (5000 ms)
  paymentPopupTimeoutId = setTimeout(() => {
    closePaymentPopup();
  }, 5000);
}

function closePaymentPopup() {
  const overlay = document.getElementById('payment-popup-overlay');
  if (!overlay) return;
  overlay.classList.add('closing');
  setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('closing');
  }, 320);
  if (paymentPopupTimeoutId) {
    clearTimeout(paymentPopupTimeoutId);
    paymentPopupTimeoutId = null;
  }
}

socket.on('payment_popup', (payload) => {
  queueOrShowPaymentPopup(payload);
});

// ==========================================================================
// CUENTA REGRESIVA ANIMADA DE 3 SEGUNDOS ANTES DE CUALQUIER JUEGO
// ==========================================================================
socket.on('game_countdown_start', ({ seconds = 3, gameType }) => {
  const overlay = document.getElementById('game-countdown-overlay');
  const titleEl = document.getElementById('countdown-game-title');
  const numEl = document.getElementById('countdown-big-number');
  const subEl = document.getElementById('countdown-subtext');
  if (!overlay || !numEl) return;

  const names = {
    gran_santiago: 'GRAN SANTIAGO ONLINE',
    cual_es: '¿CUÁL ES? (SÍMBOLOS CHILENOS)',
    sudoku: 'SUDOKU COOPERATIVO',
    crossword: 'CRUCIGRAMA PARTY',
    pictionary: 'DOODLE PARTY'
  };
  if (titleEl) titleEl.textContent = names[gameType] || '¡A JUGAR!';

  overlay.classList.remove('hidden');
  let currentSec = seconds;

  function tickCount() {
    if (currentSec > 0) {
      numEl.textContent = currentSec;
      if (subEl) subEl.textContent = currentSec === 1 ? '¡Listos...!' : '¡Prepárate!';
      playTone(520 + (3 - currentSec) * 120, 0.09, 'triangle');
      numEl.style.animation = 'none';
      void numEl.offsetWidth;
      numEl.style.animation = 'countdownNumberZoom 0.9s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards';
      currentSec -= 1;
      setTimeout(tickCount, 950);
    } else {
      numEl.textContent = '¡A JUGAR!';
      if (subEl) subEl.textContent = '¡Comienza la partida!';
      playTone(784, 0.16, 'sine');
      setTimeout(() => playTone(1046.5, 0.25, 'sine'), 110);
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 700);
    }
  }

  tickCount();
});

// ==========================================================================
// 10 MINIJUEGOS MULTIJUGADOR MARIO PARTY EN TIEMPO REAL
// ==========================================================================
let activeMinigameData = null;
let minigameLocalTaps = 0;
let minigameWheelRaf = null;

socket.on('minigame_start', ({ minigame }) => {
  activeMinigameData = minigame;
  minigameLocalTaps = 0;

  const overlay = document.getElementById('minigame-arena-overlay');
  const titleEl = document.getElementById('minigame-title');
  const potEl = document.getElementById('minigame-pot-amount');
  const instrEl = document.getElementById('minigame-instructions');
  const cdBox = document.getElementById('minigame-countdown-box');
  const cdText = document.getElementById('minigame-countdown-text');
  const resBox = document.getElementById('minigame-results-box');

  if (!overlay) return;
  overlay.classList.remove('hidden');
  if (resBox) resBox.classList.add('hidden');

  if (titleEl) titleEl.textContent = `${minigame.icon} ${minigame.title}`;
  if (potEl) potEl.textContent = `${formatCLP(minigame.betAmount)} por jugador`;
  if (instrEl) instrEl.textContent = minigame.instruction;

  if (cdBox) cdBox.classList.remove('hidden');
  if (cdText) cdText.textContent = `¡Comienza en ${minigame.countdownNumber || 3}!`;

  renderMinigameStage(minigame);
  renderMinigamePlayers(minigame);
});

socket.on('minigame_update', ({ minigame }) => {
  activeMinigameData = minigame;

  const cdBox = document.getElementById('minigame-countdown-box');
  const cdText = document.getElementById('minigame-countdown-text');

  if (minigame.status === 'countdown') {
    if (cdBox) cdBox.classList.remove('hidden');
    if (cdText) cdText.textContent = `¡Comienza en ${minigame.countdownNumber || 3}!`;
    playTone(440, 0.08, 'triangle');
  } else if (minigame.status === 'active') {
    if (cdBox) cdBox.classList.add('hidden');
  }

  // Barra de tiempo restante
  const fill = document.getElementById('minigame-timer-fill');
  if (fill && minigame.startedTimestamp && minigame.durationSec) {
    const elapsed = Math.max(0, (Date.now() - minigame.startedTimestamp) / 1000);
    const pct = Math.max(0, Math.min(100, (1 - elapsed / minigame.durationSec) * 100));
    fill.style.width = `${pct}%`;
  }

  renderMinigameStage(minigame);
  renderMinigamePlayers(minigame);
});

socket.on('minigame_end', ({ results, minigame }) => {
  activeMinigameData = minigame;
  if (minigameWheelRaf) {
    cancelAnimationFrame(minigameWheelRaf);
    minigameWheelRaf = null;
  }

  const resBox = document.getElementById('minigame-results-box');
  const resContent = document.getElementById('minigame-results-content');
  if (!resBox || !resContent || !results) return;

  const iAmWinner = results.winners.some((w) => w.id === myPlayerId);
  const iAmLoser = results.losers.some((l) => l.id === myPlayerId);

  if (iAmWinner) {
    playCashierSound();
  } else if (iAmLoser) {
    playTone(220, 0.3, 'sawtooth');
  }

  let html = '';
  if (results.winners.length > 0) {
    const wNames = results.winners.map((w) => `${w.avatar?.icon || '🏆'} ${w.name}`).join(', ');
    html += `<div class="mg-winner-tag">🏆 Ganadores: ${wNames}</div>`;
    html += `<p style="color:#86efac;margin-bottom:0.6rem;">Premio ganado: +${formatCLP(results.winners[0]?.share || 0)} cada uno</p>`;
  }
  if (results.losers.length > 0) {
    const lNames = results.losers.map((l) => `${l.avatar?.icon || '💥'} ${l.name}`).join(', ');
    html += `<div class="mg-loser-tag">💥 Perdedores: ${lNames}</div>`;
    html += `<p style="color:#fca5a5;margin:0;">Pérdida al pozo: -${formatCLP(results.losers[0]?.lost || minigame.betAmount)}</p>`;
  }

  resContent.innerHTML = html;
  resBox.classList.remove('hidden');

  setTimeout(() => {
    const overlay = document.getElementById('minigame-arena-overlay');
    if (overlay) overlay.classList.add('hidden');
  }, 4200);
});

function sendMinigameAction(data) {
  socket.emit('minigame_action', data || {});
}

function renderMinigamePlayers(minigame) {
  const strip = document.getElementById('minigame-players-strip');
  if (!strip || !minigame.players) return;

  const playersArr = Object.values(minigame.players);
  let html = '';
  playersArr.forEach((p) => {
    const isMe = p.id === myPlayerId;
    let scoreDisplay = p.score || 0;
    if (minigame.id === 'reflejos_metro' && p.reactionTimeMs) {
      scoreDisplay = `${(p.reactionTimeMs / 1000).toFixed(2)}s`;
    }
    const statusIcon = p.eliminated ? '❌' : (p.finished ? '✅' : '⏳');
    html += `
      <div class="mg-player-badge ${isMe ? 'is-me' : ''}">
        <span>${p.avatar?.icon || '👤'}</span>
        <strong>${p.name}${isMe ? ' (Tú)' : ''}</strong>
        <span class="mg-score">${scoreDisplay}</span>
        <span>${statusIcon}</span>
      </div>
    `;
  });
  strip.innerHTML = html;
}

function renderMinigameStage(minigame) {
  const stage = document.getElementById('minigame-stage');
  if (!stage) return;

  const myState = minigame.players[myPlayerId];
  const isActive = minigame.status === 'active';

  switch (minigame.id) {
    case 'bomba_tiempo': {
      const holderId = minigame.gameData?.holderId;
      const isHolder = holderId === myPlayerId;
      let playersHtml = '';
      Object.values(minigame.players).forEach((p) => {
        const hasBomb = p.id === holderId;
        playersHtml += `
          <div class="mg-bomb-player ${hasBomb ? 'has-bomb' : ''}">
            <span style="font-size:1.8rem;">${hasBomb ? '💣' : (p.avatar?.icon || '👤')}</span>
            <small style="font-weight:700;">${p.name}</small>
          </div>
        `;
      });

      stage.innerHTML = `
        <div class="mg-bomb-circle">${playersHtml}</div>
        ${isActive ? (
          isHolder
            ? `<button id="btn-mg-bomb-pass" class="mg-big-button mg-btn-danger">💣 ¡PASAR LA BOMBA AHORA!</button>`
            : `<div style="color:#94a3b8;font-size:1.1rem;font-weight:700;">¡Espera, otro jugador tiene la bomba!</div>`
        ) : `<div style="font-size:1.1rem;color:#cbd5e1;">¡Preparando la dinamita!</div>`}
      `;

      document.getElementById('btn-mg-bomb-pass')?.addEventListener('click', () => {
        sendMinigameAction({});
        playTone(380, 0.08, 'triangle');
      });
      break;
    }

    case 'reflejos_metro': {
      const now = Date.now();
      const signalTime = minigame.gameData?.signalTimestamp || 0;
      const isGreen = isActive && now >= signalTime;

      stage.innerHTML = `
        <div class="mg-metro-signal ${isGreen ? 'mg-signal-green' : 'mg-signal-red'}">
          ${isGreen ? '🟢' : '🔴'}
        </div>
        <div style="font-size:1.15rem;font-weight:800;margin-bottom:1rem;color:${isGreen ? '#4ade80' : '#f87171'};">
          ${isGreen ? '¡VERDE! ¡PASA TU TARJETA BIP!' : '¡ROJO! ¡NO TOQUES TODAVÍA!'}
        </div>
        <button id="btn-mg-metro-bip" class="mg-big-button ${isGreen ? 'mg-btn-success' : 'mg-btn-action'}" ${myState?.finished ? 'disabled' : ''}>
          ${myState?.finished ? '✅ ¡Registrado!' : '💳 ¡PASAR BIP YA!'}
        </button>
      `;

      document.getElementById('btn-mg-metro-bip')?.addEventListener('click', () => {
        if (!myState?.finished) {
          sendMinigameAction({});
          playTone(isGreen ? 987 : 200, 0.12, 'sine');
        }
      });
      break;
    }

    case 'empanada_rapida': {
      const taps = myState?.taps || 0;
      const pct = Math.min(100, taps * 4);

      stage.innerHTML = `
        <div style="font-size:3rem;margin-bottom:0.5rem;">🥟</div>
        <div class="mg-empanada-meter">
          <div class="mg-empanada-fill" style="width:${pct}%"></div>
        </div>
        <div style="font-size:1.1rem;font-weight:800;color:#fbbf24;margin-bottom:1rem;">
          Empanadas devoradas: ${taps}
        </div>
        <button id="btn-mg-eat-empanada" class="mg-big-button mg-btn-action" ${!isActive ? 'disabled' : ''}>
          🥟 ¡DEVORAR EMPANADA!
        </button>
      `;

      document.getElementById('btn-mg-eat-empanada')?.addEventListener('click', () => {
        if (isActive) {
          minigameLocalTaps += 1;
          sendMinigameAction({});
          playTone(500 + (minigameLocalTaps % 8) * 45, 0.05, 'triangle');
        }
      });
      break;
    }

    case 'ruleta_santiago': {
      stage.innerHTML = `
        <div class="mg-wheel-track">
          <div id="mg-wheel-needle" class="mg-wheel-indicator" style="left:50%;"></div>
        </div>
        <div style="font-size:1.1rem;font-weight:700;margin-bottom:1rem;color:#cbd5e1;">
          ${myState?.finished ? `🎯 Tu puntaje fijado: ${myState.score} pts` : '¡Detén el puntero en el centro verde!'}
        </div>
        <button id="btn-mg-stop-wheel" class="mg-big-button mg-btn-action" ${myState?.finished || !isActive ? 'disabled' : ''}>
          🎡 ¡FRENAR RULETA!
        </button>
      `;

      if (!myState?.finished && isActive && !minigameWheelRaf) {
        let pos = 50;
        let dir = 1;
        function animNeedle() {
          pos += dir * 2.8;
          if (pos >= 96) { pos = 96; dir = -1; }
          if (pos <= 4) { pos = 4; dir = 1; }
          const needle = document.getElementById('mg-wheel-needle');
          if (needle) needle.style.left = `${pos}%`;
          if (activeMinigameData && activeMinigameData.status === 'active' && !myState?.finished) {
            minigameWheelRaf = requestAnimationFrame(animNeedle);
          }
        }
        minigameWheelRaf = requestAnimationFrame(animNeedle);
      }

      document.getElementById('btn-mg-stop-wheel')?.addEventListener('click', () => {
        if (!myState?.finished && isActive) {
          const needle = document.getElementById('mg-wheel-needle');
          const leftPct = needle ? parseFloat(needle.style.left) : 50;
          const distFromCenter = Math.abs(50 - leftPct);
          const score = Math.max(1, Math.round(10 - distFromCenter / 5));
          sendMinigameAction({ value: score });
          playTone(660, 0.15, 'sine');
        }
      });
      break;
    }

    case 'esquiva_tag': {
      stage.innerHTML = `
        <div style="font-size:3rem;margin-bottom:0.5rem;">🛣️</div>
        <div class="mg-wheel-track" style="background:linear-gradient(90deg, #334155 0%, #10b981 40%, #10b981 60%, #334155 100%);">
          <div id="mg-tag-bar" class="mg-wheel-indicator" style="left:50%;"></div>
        </div>
        <div style="font-size:1rem;color:#cbd5e1;margin-bottom:1rem;">
          ${myState?.finished ? (myState.score > 0 ? '✅ ¡Saltaste con éxito!' : '💥 ¡Te pilló el TAG!') : '¡Salta cuando la barra pase por la zona VERDE!'}
        </div>
        <button id="btn-mg-jump-tag" class="mg-big-button mg-btn-action" ${myState?.finished || !isActive ? 'disabled' : ''}>
          🦘 ¡SALTAR EL TAG!
        </button>
      `;

      if (!myState?.finished && isActive && !minigameWheelRaf) {
        let pos = 10;
        let dir = 1;
        function animTag() {
          pos += dir * 2.5;
          if (pos >= 90) { pos = 90; dir = -1; }
          if (pos <= 10) { pos = 10; dir = 1; }
          const bar = document.getElementById('mg-tag-bar');
          if (bar) bar.style.left = `${pos}%`;
          if (activeMinigameData && activeMinigameData.status === 'active' && !myState?.finished) {
            minigameWheelRaf = requestAnimationFrame(animTag);
          }
        }
        minigameWheelRaf = requestAnimationFrame(animTag);
      }

      document.getElementById('btn-mg-jump-tag')?.addEventListener('click', () => {
        if (!myState?.finished && isActive) {
          const bar = document.getElementById('mg-tag-bar');
          const leftPct = bar ? parseFloat(bar.style.left) : 50;
          const inGreen = leftPct >= 38 && leftPct <= 62;
          sendMinigameAction({ inZone: inGreen });
          playTone(inGreen ? 880 : 250, 0.15, inGreen ? 'sine' : 'sawtooth');
        }
      });
      break;
    }

    case 'micro_llena': {
      const seats = minigame.gameData?.availableSeats || 0;
      const claimed = minigame.gameData?.claimedSeats || [];
      const hasSeat = claimed.includes(myPlayerId);

      stage.innerHTML = `
        <div style="font-size:3.5rem;margin-bottom:0.5rem;">🚌🪑</div>
        <div style="font-size:1.25rem;font-weight:800;color:#38bdf8;margin-bottom:0.5rem;">
          Asientos libres restantes: ${seats}
        </div>
        <p style="color:#cbd5e1;font-size:0.95rem;margin-bottom:1rem;">
          ${hasSeat ? '✅ ¡Conseguiste asiento en la micro!' : (seats === 0 ? '❌ ¡Micro completa! Te quedaste de pie.' : '¡Presiona rápido para sentarte!')}
        </p>
        <button id="btn-mg-take-seat" class="mg-big-button mg-btn-success" ${hasSeat || seats === 0 || !isActive ? 'disabled' : ''}>
          🪑 ¡SENTARSE EN LA MICRO!
        </button>
      `;

      document.getElementById('btn-mg-take-seat')?.addEventListener('click', () => {
        if (!hasSeat && seats > 0 && isActive) {
          sendMinigameAction({});
          playTone(740, 0.12, 'sine');
        }
      });
      break;
    }

    case 'lluvia_monedas': {
      const myCoins = myState?.score || 0;
      stage.innerHTML = `
        <div style="font-size:1.15rem;font-weight:800;color:#facc15;margin-bottom:0.6rem;">
          🪙 Monedas atrapadas: ${myCoins}
        </div>
        <div id="mg-coin-field" class="mg-coin-field">
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#64748b;font-weight:700;pointer-events:none;">
            ¡Toca las monedas que caen!
          </div>
        </div>
      `;

      const field = document.getElementById('mg-coin-field');
      if (field && isActive && !field.dataset.spawnerStarted) {
        field.dataset.spawnerStarted = 'true';
        const spawnInterval = setInterval(() => {
          if (!activeMinigameData || activeMinigameData.status !== 'active') {
            clearInterval(spawnInterval);
            return;
          }
          const coin = document.createElement('div');
          coin.className = 'mg-falling-coin';
          coin.textContent = Math.random() < 0.25 ? '💰' : (Math.random() < 0.5 ? '💵' : '🪙');
          coin.style.left = `${Math.floor(Math.random() * 85)}%`;
          const duration = 1.4 + Math.random() * 1.6;
          coin.style.animationDuration = `${duration}s`;

          const grabHandler = (e) => {
            e.preventDefault();
            sendMinigameAction({ coins: 1 });
            playTone(800 + Math.random() * 400, 0.08, 'sine');
            coin.remove();
          };

          coin.addEventListener('mousedown', grabHandler);
          coin.addEventListener('touchstart', grabHandler, { passive: false });
          field.appendChild(coin);

          setTimeout(() => {
            if (coin.parentNode) coin.remove();
          }, duration * 1000);
        }, 450);
      }
      break;
    }

    case 'tira_cuerda': {
      const score = myState?.score || 0;
      stage.innerHTML = `
        <div style="font-size:3.5rem;margin-bottom:0.5rem;">🪢</div>
        <div style="font-size:1.1rem;font-weight:800;color:#38bdf8;margin-bottom:1rem;">
          Fuerza acumulada: ${score} kg
        </div>
        <button id="btn-mg-tug-pull" class="mg-big-button mg-btn-action" ${!isActive ? 'disabled' : ''}>
          💪 ¡TIRAR CON TODA TU FUERZA!
        </button>
      `;

      document.getElementById('btn-mg-tug-pull')?.addEventListener('click', () => {
        if (isActive) {
          sendMinigameAction({});
          playTone(420 + (score % 6) * 50, 0.06, 'triangle');
        }
      });
      break;
    }

    case 'memoria_santiago': {
      const seq = minigame.gameData?.sequence || [];
      const opts = minigame.gameData?.options || ['🦅', '🚇', '🗿', '🥟'];
      const myStep = myState?.score || 0;

      let seqDisplay = seq.map((s, i) => `<span style="font-size:2rem;margin:0 0.2rem;opacity:${i < myStep ? 0.35 : 1};">${s}</span>`).join('');
      let buttonsHtml = opts.slice(0, 4).map((sym) => `
        <button class="btn btn-secondary mg-sym-btn" data-sym="${sym}" style="font-size:1.8rem;padding:0.6rem 1rem;" ${!isActive || myState?.finished ? 'disabled' : ''}>
          ${sym}
        </button>
      `).join('');

      stage.innerHTML = `
        <div style="margin-bottom:1rem;">${seqDisplay}</div>
        <div style="font-size:0.95rem;color:#cbd5e1;margin-bottom:1rem;">
          ${myState?.finished ? (myState.eliminated ? '❌ ¡Te equivocaste de símbolo!' : '✅ ¡Secuencia completada!') : `Repite el símbolo paso ${myStep + 1} de ${seq.length}`}
        </div>
        <div style="display:flex;gap:0.6rem;flex-wrap:wrap;justify-content:center;">
          ${buttonsHtml}
        </div>
      `;

      stage.querySelectorAll('.mg-sym-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (isActive && !myState?.finished) {
            const sym = btn.getAttribute('data-sym');
            sendMinigameAction({ stepIndex: myStep, symbol: sym });
            playTone(600, 0.1, 'sine');
          }
        });
      });
      break;
    }

    case 'duelo_cronometro': {
      const now = Date.now();
      const start = minigame.startedTimestamp || now;
      const elapsed = Math.max(0, (now - start) / 1000);
      const isHidden = isActive && elapsed >= 2.5 && !myState?.finished;
      const displayTime = myState?.finished
        ? `${(myState.clickedTime || 5.0).toFixed(3)}s`
        : (isHidden ? '⏱️ ???' : `${elapsed.toFixed(2)}s`);

      stage.innerHTML = `
        <div style="font-size:3.2rem;font-weight:900;color:${isHidden ? '#fbbf24' : '#38bdf8'};margin-bottom:0.8rem;letter-spacing:2px;">
          ${displayTime}
        </div>
        <div style="font-size:0.95rem;color:#cbd5e1;margin-bottom:1.2rem;">
          ${myState?.finished ? `🎯 Puntaje obtenido: ${myState.score} pts` : '¡Detén el reloj exactamente en 5.000 segundos!'}
        </div>
        <button id="btn-mg-stop-clock" class="mg-big-button mg-btn-danger" ${myState?.finished || !isActive ? 'disabled' : ''}>
          ⏱️ ¡DETENER EN 5.00s!
        </button>
      `;

      document.getElementById('btn-mg-stop-clock')?.addEventListener('click', () => {
        if (!myState?.finished && isActive) {
          sendMinigameAction({});
          playTone(700, 0.15, 'sine');
        }
      });
      break;
    }
  }
}

socket.on('cual_es_point', ({ playerId, playerName, symbol }) => {
  if (playerId === myPlayerId) {
    playSoundEffect('buy');
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([25, 35, 25]); } catch (_) {}
    }
  } else {
    playTone(480, 0.1, 'sine');
  }
  animateCualEsCardFlyToWinner(playerId);
  const matchBanner = document.getElementById('cuales-last-match');
  if (matchBanner && symbol) {
    matchBanner.innerHTML = `⚡ <strong>${playerName}</strong> encontró <strong>${symbol.icon} ${symbol.name}</strong> y se llevó la carta!`;
  }
});

function animateCualEsCardFlyToWinner(winnerId) {
  const centerEl = document.getElementById('cuales-center-card');
  if (!centerEl) return;

  const seatEl = document.getElementById(`cuales-seat-${winnerId}`);
  if (seatEl) {
    seatEl.classList.add('seat-grabbing');
    setTimeout(() => seatEl.classList.remove('seat-grabbing'), 520);
  }

  const targetEl =
    winnerId === myPlayerId
      ? (document.getElementById('cuales-my-card') || seatEl)
      : (seatEl || document.getElementById('cuales-my-card'));
  if (!targetEl) return;

  const srcRect = centerEl.getBoundingClientRect();
  const dstRect = targetEl.getBoundingClientRect();
  if (!srcRect.width || !dstRect.width) return;

  const flyer = document.createElement('div');
  flyer.className = 'cuales-flying-card';
  flyer.style.width = `${srcRect.width}px`;
  flyer.style.height = `${srcRect.height}px`;
  flyer.style.left = `${srcRect.left}px`;
  flyer.style.top = `${srcRect.top}px`;
  flyer.innerHTML = centerEl.innerHTML;
  document.body.appendChild(flyer);

  const srcCenterX = srcRect.left + srcRect.width / 2;
  const srcCenterY = srcRect.top + srcRect.height / 2;
  const dstCenterX = dstRect.left + dstRect.width / 2;
  const dstCenterY = dstRect.top + dstRect.height / 2;

  const dx = dstCenterX - srcCenterX;
  const dy = dstCenterY - srcCenterY;
  const scale = winnerId === myPlayerId ? 0.92 : 0.28;

  requestAnimationFrame(() => {
    flyer.style.transform = `translate(${dx}px, ${dy}px) scale(${scale}) rotate(22deg)`;
    flyer.style.opacity = winnerId === myPlayerId ? '0.85' : '0.25';
  });

  setTimeout(() => {
    flyer.remove();
  }, 500);
}

socket.on('cual_es_penalty', ({ playerId, penaltyUntil, symbol }) => {
  if (playerId === myPlayerId) {
    playTone(170, 0.22, 'sawtooth');
    setTimeout(() => playTone(140, 0.28, 'sawtooth'), 140);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(140); } catch (_) {}
    }
    startMyPenaltyCountdown(penaltyUntil);
    showToast(`❄️ ¡"${symbol?.icon || ''} ${symbol?.name || ''}" no coincide! 3s de penalización.`);
  }
});

function startMyPenaltyCountdown(untilTimestamp) {
  myPenaltyUntil = untilTimestamp;
  const banner = document.getElementById('cuales-penalty-banner');
  const timerEl = document.getElementById('cuales-penalty-timer');
  const centerCardEl = document.getElementById('cuales-center-card');
  const myCardEl = document.getElementById('cuales-my-card');

  if (penaltyIntervalId) clearInterval(penaltyIntervalId);

  const updateTick = () => {
    const remMs = myPenaltyUntil - Date.now();
    if (remMs <= 0) {
      clearInterval(penaltyIntervalId);
      penaltyIntervalId = null;
      if (banner) banner.classList.add('hidden');
      if (centerCardEl) centerCardEl.classList.remove('penalized-card');
      if (myCardEl) myCardEl.classList.remove('penalized-card');
      return;
    }
    if (banner) banner.classList.remove('hidden');
    if (centerCardEl) centerCardEl.classList.add('penalized-card');
    if (myCardEl) myCardEl.classList.add('penalized-card');
    if (timerEl) timerEl.textContent = (remMs / 1000).toFixed(1);
  };

  updateTick();
  penaltyIntervalId = setInterval(updateTick, 80);
}

// Posiciones geométricas dentro de un círculo para los 8 dibujos de cada carta de "¿Cuál es?"
const CUAL_ES_SLOTS = [
  { x: 50, y: 50 }, // Centro
  { x: 50, y: 18 }, // Arriba
  { x: 77, y: 30 }, // Arriba-Derecha
  { x: 82, y: 59 }, // Abajo-Derecha
  { x: 65, y: 82 }, // Inferior-Derecha
  { x: 35, y: 82 }, // Inferior-Izquierda
  { x: 18, y: 59 }, // Abajo-Izquierda
  { x: 23, y: 30 }  // Arriba-Izquierda
];

// Escalas variadas (desde pequeño 0.58x hasta gigante 1.44x) como en el juego físico real
const CUAL_ES_SIZE_TIERS = [1.44, 0.64, 1.22, 0.74, 1.06, 0.58, 1.30, 0.86];

function renderCualEsCircleCard(containerId, symbolIds, cardSeed = 0) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (!symbolIds || !symbolIds.length) {
    container.innerHTML = `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#0f172a; font-weight:800;">🏁 Fin del Mazo</div>`;
    return;
  }

  const cardHash = symbolIds.reduce((acc, val, i) => acc + val * (i + 3), cardSeed * 13);

  symbolIds.forEach((symId, idx) => {
    const sym = boardMeta.CUAL_ES_SYMBOLS[symId] || { id: symId, icon: '❓', name: '?' };
    const slot = CUAL_ES_SLOTS[idx % CUAL_ES_SLOTS.length];
    // Cada icono en la carta recibe un tamaño distinto (gigante, grande, mediano, pequeño o mini) y rotación propia
    const sizeTierIdx = (idx * 3 + cardHash + symId) % CUAL_ES_SIZE_TIERS.length;
    const scale = CUAL_ES_SIZE_TIERS[sizeTierIdx];
    const rot = ((symId * 47 + idx * 73 + cardHash * 29) % 360) - 180;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cuales-symbol-btn';
    btn.style.left = `${slot.x}%`;
    btn.style.top = `${slot.y}%`;
    btn.style.setProperty('--sym-rot', `${rot}deg`);
    btn.style.setProperty('--sym-scale', String(scale));
    btn.innerHTML = `<span class="sym-emoji">${sym.icon}</span>`;

    btn.addEventListener('click', () => {
      if (Date.now() < myPenaltyUntil || Date.now() < cualesCardTransitionUntil) return;
      socket.emit('cual_es_click', { symbolId: symId }, (res) => {
        if (res && res.penalized && res.penaltyUntil) {
          startMyPenaltyCountdown(res.penaltyUntil);
        }
      });
    });

    container.appendChild(btn);
  });
}

function renderLobby(state) {
  document.getElementById('lobby-room-code').textContent = state.code;
  document.getElementById('lobby-player-count').textContent = state.players.length;

  // Limpiar el iframe de GameParty si se regresó al Lobby
  const gpFrame = document.getElementById('gameparty-frame');
  if (gpFrame && activeGamePartyUrl) {
    gpFrame.src = 'about:blank';
    activeGamePartyUrl = null;
  }

  const isHost = state.hostId === myPlayerId;
  const activeGame = state.gameType || 'santiago';
  const votes = state.votes || {};
  const myVote = votes[myPlayerId] || activeGame;
  const gMeta = GAME_META_LABELS[activeGame] || GAME_META_LABELS.santiago;

  const gameLabel = document.getElementById('lobby-current-game-label');
  if (gameLabel) {
    gameLabel.textContent = gMeta.title;
  }

  // Contabilizar votos y mostrar avatares de votantes en cada una de las tarjetas
  const allGameKeys = ['santiago', 'cual_es', 'crossword', 'pictionary', 'sudoku'];
  allGameKeys.forEach((gKey) => {
    const cardEl = document.getElementById(`vote-card-${gKey}`);
    const badgeEl = document.getElementById(`vote-badge-${gKey}`);
    const votersEl = document.getElementById(`voters-${gKey}`);

    const votersForGame = state.players.filter((p) => (votes[p.id] || state.gameType) === gKey);
    const count = votersForGame.length;
    const isLeading = activeGame === gKey;
    const isMyChoice = myVote === gKey;

    if (cardEl) {
      cardEl.classList.toggle('leading-vote', isLeading);
      cardEl.classList.toggle('my-vote', isMyChoice);
      cardEl.classList.toggle('selected', isLeading);
    }

    if (badgeEl) {
      const voteWord = count === 1 ? '1 voto' : `${count} votos`;
      badgeEl.textContent = isLeading ? `🏆 Ganando • ${voteWord}` : voteWord;
    }

    if (votersEl) {
      votersEl.innerHTML = '';
      votersForGame.forEach((vp) => {
        const chip = document.createElement('span');
        chip.className = 'voter-chip';
        const avChip = vp.avatar?.imageUrl
          ? `<img src="${vp.avatar.imageUrl}" class="chip-avatar-img" />`
          : (vp.avatar?.icon || '👤');
        chip.innerHTML = `${avChip} ${vp.name}`;
        votersEl.appendChild(chip);
      });
    }
  });

  // Mostrar ajustes contextuales según el juego más votado
  const moneyWrap = document.getElementById('lobby-money-setting-wrap');
  const partyWrap = document.getElementById('lobby-party-setting-wrap');
  const sudokuWrap = document.getElementById('lobby-sudoku-setting-wrap');
  const settingsBar = document.getElementById('lobby-game-settings-bar');

  if (activeGame === 'santiago') {
    moneyWrap?.classList.remove('hidden');
    partyWrap?.classList.add('hidden');
    sudokuWrap?.classList.add('hidden');
    settingsBar?.classList.remove('hidden');
    const moneySel = document.getElementById('lobby-select-money');
    if (moneySel) {
      moneySel.value = String(state.settings?.startingMoney || 1500000);
      moneySel.disabled = !isHost;
    }
  } else if (activeGame === 'crossword' || activeGame === 'pictionary') {
    moneyWrap?.classList.add('hidden');
    partyWrap?.classList.remove('hidden');
    sudokuWrap?.classList.add('hidden');
    settingsBar?.classList.remove('hidden');
    const catSel = document.getElementById('lobby-select-category');
    const diffSel = document.getElementById('lobby-select-difficulty');
    if (catSel) {
      catSel.value = state.settings?.category || 'todo_tipo';
      catSel.disabled = !isHost;
    }
    if (diffSel) {
      diffSel.value = state.settings?.difficulty || 'Fácil';
      diffSel.disabled = !isHost;
    }
  } else if (activeGame === 'sudoku') {
    moneyWrap?.classList.add('hidden');
    partyWrap?.classList.add('hidden');
    sudokuWrap?.classList.remove('hidden');
    settingsBar?.classList.remove('hidden');
    const diffSel = document.getElementById('lobby-select-sudoku-diff');
    if (diffSel) {
      diffSel.value = state.settings?.sudokuDifficulty || 'facil';
      diffSel.disabled = !isHost;
    }
  } else {
    moneyWrap?.classList.add('hidden');
    partyWrap?.classList.add('hidden');
    sudokuWrap?.classList.add('hidden');
    settingsBar?.classList.add('hidden');
  }

  document.getElementById('btn-add-bot').style.display =
    isHost && state.players.length < 8 && (activeGame === 'santiago' || activeGame === 'cual_es')
      ? 'inline-flex'
      : 'none';

  const minPlayers = (activeGame === 'crossword' || activeGame === 'sudoku') ? 1 : 2;
  const startBtn = document.getElementById('btn-start-game');
  startBtn.disabled = !isHost || state.players.length < minPlayers;
  startBtn.textContent = `🚀 ¡Iniciar ${gMeta.short}!`;

  document.getElementById('lobby-status-hint').textContent = isHost
    ? (state.players.length >= minPlayers
      ? `¡Listos para comenzar ${gMeta.short} con ${state.players.length} jugador(es)!`
      : `Se necesitan al menos ${minPlayers} jugadores para iniciar ${gMeta.short} (invita amigos o agrega un Bot).`)
    : `Vota arriba por tu juego favorito • Esperando que el anfitrión inicie ${gMeta.short}...`;

  const grid = document.getElementById('lobby-players-grid');
  grid.innerHTML = '';

  state.players.forEach((p) => {
    const pVote = votes[p.id] || activeGame;
    const pVoteMeta = GAME_META_LABELS[pVote] || GAME_META_LABELS.santiago;
    const card = document.createElement('div');
    card.className = 'lobby-player-card';
    card.style.borderColor = p.avatar.color;
    const avLobbyDisplay = p.avatar?.imageUrl
      ? `<img src="${p.avatar.imageUrl}" alt="${p.name}" class="lp-avatar-img" />`
      : p.avatar.icon;
    card.innerHTML = `
      <span class="lp-icon">${avLobbyDisplay}</span>
      <div>
        <div class="lp-name">${p.name} ${p.id === myPlayerId ? '(Tú)' : ''}</div>
        <div class="lp-role">${p.id === state.hostId ? '👑 Anfitrión' : (p.isBot ? '🤖 Bot Automático' : '🟢 Conectado')} • Vota: ${pVoteMeta.icon}</div>
      </div>
    `;

    if (isHost && p.id !== state.hostId) {
      const kickBtn = document.createElement('button');
      kickBtn.className = 'btn-kick';
      kickBtn.textContent = '✕';
      kickBtn.title = 'Quitar de la sala';
      kickBtn.addEventListener('click', () => {
        socket.emit('remove_player', { targetPlayerId: p.id });
      });
      card.appendChild(kickBtn);
    }

    grid.appendChild(card);
  });

  // Renderizar Chat en Vivo dentro del Lobby Unificado
  const lobbyChatEl = document.getElementById('lobby-chat-messages');
  if (lobbyChatEl) {
    if (!state.chat || !state.chat.length) {
      lobbyChatEl.innerHTML = `<div class="empty-small">¡Saluda a la sala y pónganse de acuerdo por cuál juego votar!</div>`;
    } else {
      lobbyChatEl.innerHTML = '';
      state.chat.forEach((c) => {
        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerHTML = `<strong>${c.avatar?.icon || ''} ${c.playerName}:</strong> ${c.text}`;
        lobbyChatEl.appendChild(div);
      });
      lobbyChatEl.scrollTop = lobbyChatEl.scrollHeight;
    }
  }
}

function renderGame(state) {
  document.getElementById('game-room-code').textContent = state.code;
  const mobCode = document.getElementById('mobile-game-room-code');
  if (mobCode) mobCode.textContent = state.code;

  const isCualEs = state.gameType === 'cual_es';
  const isGameParty = state.gameType === 'crossword' || state.gameType === 'pictionary';
  const isHost = state.hostId === myPlayerId;

  // Actualizar estado del botón de Votar Abandonar Juego en todas las vistas
  const abandonVotes = state.abandonVotes || [];
  const abandonRequired = state.abandonRequired || 1;
  const iVotedAbandon = abandonVotes.includes(myPlayerId);
  const abandonText = iVotedAbandon
    ? `✓ Votaste Abandonar (${abandonVotes.length}/${abandonRequired})`
    : `🏳️ Votar Abandonar Juego (${abandonVotes.length}/${abandonRequired})`;

  ['btn-vote-abandon', 'btn-cuales-vote-abandon', 'btn-gp-vote-abandon', 'btn-mobile-abandon'].forEach((btnId) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      if (btnId === 'btn-mobile-abandon') {
        btn.title = abandonText;
      } else {
        btn.textContent = abandonText;
      }
      btn.classList.toggle('voted-abandon', iVotedAbandon);
    }
  });

  const gamePartyArenaEl = document.getElementById('gameparty-arena');
  const mainGameLayoutEl = document.getElementById('main-game-layout');

  if (isGameParty) {
    if (gamePartyArenaEl) gamePartyArenaEl.classList.remove('hidden');
    if (mainGameLayoutEl) mainGameLayoutEl.classList.add('hidden');

    const me = state.players.find((p) => p.id === myPlayerId) || state.players[0];
    const targetUrl = `/gameparty/?autojoin=1&room=${encodeURIComponent(state.code)}&nick=${encodeURIComponent(me?.name || 'Jugador')}&avatar=${encodeURIComponent(me?.avatar?.icon || '😎')}&isHost=${isHost ? '1' : '0'}`;
    const gpFrame = document.getElementById('gameparty-frame');
    if (gpFrame && activeGamePartyUrl !== targetUrl) {
      activeGamePartyUrl = targetUrl;
      gpFrame.src = targetUrl;
    }
    return;
  }

  if (gamePartyArenaEl) gamePartyArenaEl.classList.add('hidden');
  if (mainGameLayoutEl) mainGameLayoutEl.classList.remove('hidden');

  const boardGridEl = document.getElementById('board-grid');
  const cualesArenaEl = document.getElementById('cuales-arena');
  const santiagoPortfolioEl = document.getElementById('santiago-portfolio-panel');
  const cualesRulesEl = document.getElementById('cuales-rules-panel');
  const sidebarTitleEl = document.getElementById('sidebar-players-title');
  const returnLobbyBtn = document.getElementById('btn-return-lobby');
  const returnLobbySantiagoBtn = document.getElementById('btn-return-lobby-santiago');
  const logPanelBox = document.getElementById('log-panel-box');

  const isSudoku = state.gameType === 'sudoku';
  const sudokuArenaEl = document.getElementById('sudoku-arena');

  boardGridEl.classList.toggle('hidden', isCualEs || isSudoku);
  cualesArenaEl.classList.toggle('hidden', !isCualEs);
  if (sudokuArenaEl) sudokuArenaEl.classList.toggle('hidden', !isSudoku);
  santiagoPortfolioEl.classList.toggle('hidden', isCualEs || isSudoku);
  cualesRulesEl.classList.toggle('hidden', !isCualEs);
  if (logPanelBox) logPanelBox.classList.toggle('hidden', isCualEs);

  // Ocultar pestaña de Escrituras en móvil para juegos de cartas y Sudoku
  const mobilePropsTabBtn = document.querySelector('.mobile-tab-btn[data-tab="props"]');
  if (mobilePropsTabBtn) {
    mobilePropsTabBtn.classList.toggle('hidden', isCualEs || isSudoku);
  }
  if ((isCualEs || isSudoku) && mainGameLayoutEl && mainGameLayoutEl.dataset.activeTab === 'props') {
    if (typeof window.setMobileActiveTab === 'function') {
      window.setMobileActiveTab('board');
    }
  }

  if (returnLobbyBtn) {
    returnLobbyBtn.classList.toggle('hidden', !isHost && state.status !== 'finished');
  }
  if (returnLobbySantiagoBtn) {
    returnLobbySantiagoBtn.classList.toggle('hidden', !isHost && state.status !== 'finished');
  }

  if (sidebarTitleEl) {
    sidebarTitleEl.textContent = isCualEs
      ? '🏆 Ranking de Cartas'
      : (isSudoku ? '👥 Equipo Colaborativo' : '👥 Magnates en Competencia');
  }

  if (isCualEs) {
    renderCualEsGame(state);
    renderLogsAndChat(state);
    return;
  }

  if (isSudoku) {
    renderSudokuGame(state);
    renderLogsAndChat(state);
    return;
  }

  document.getElementById('center-pot-amount').textContent = formatCLP(state.pot);

  // Actualizar dados
  const d1 = document.getElementById('die-1');
  const d2 = document.getElementById('die-2');
  d1.textContent = DICE_FACES[(state.lastDice[0] || 1) - 1];
  d2.textContent = DICE_FACES[(state.lastDice[1] || 1) - 1];

  // Detectar si algún jugador caminó de una casilla a otra para animarlo cuadro por cuadro ANTES de mostrar acciones de llegada
  state.players.forEach((p) => {
    if (p.bankrupt) return;
    const prevPos = displayedPositions[p.id];
    if (prevPos === undefined) {
      displayedPositions[p.id] = p.position;
    } else if (prevPos !== p.position && !walkingTimers[p.id]) {
      animatePlayerMovement(p, prevPos, p.position);
    }
  });

  renderTokensOnBoard(state);
  updateTurnActionControls(state);

  // Lista lateral de jugadores
  const playersList = document.getElementById('players-list');
  playersList.innerHTML = '';
  state.players.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'player-row' +
      (idx === state.turnIndex ? ' active-turn' : '') +
      (p.bankrupt ? ' bankrupt' : '');
    row.style.borderLeftColor = p.avatar.color;

    const tileName = boardMeta.BOARD_TILES[p.position]?.shortName || boardMeta.BOARD_TILES[p.position]?.name || '';
    const avRowDisplay = p.avatar?.imageUrl
      ? `<img src="${p.avatar.imageUrl}" alt="${p.name}" class="avatar-photo-img" />`
      : p.avatar.icon;
    row.innerHTML = `
      <div class="p-info">
        <span class="p-avatar">${avRowDisplay}</span>
        <div>
          <div class="p-name">${p.name} ${p.id === myPlayerId ? '(Tú)' : ''}</div>
          <span class="p-status-tag">${p.bankrupt ? '💥 En Bancarrota' : (p.inJail ? '🚓 En Comisaría' : `📍 ${tileName}`)}</span>
        </div>
      </div>
      <div class="p-money">${formatCLP(p.money)}</div>
    `;
    playersList.appendChild(row);
  });

  // Actualizar estado de propiedades en el tablero
  boardMeta.BOARD_TILES.forEach((tile) => {
    const prop = state.properties[tile.id];
    const ownerDot = document.getElementById(`owner-dot-${tile.id}`);
    const mortgagedTag = document.getElementById(`mortgaged-tag-${tile.id}`);
    const barEl = document.getElementById(`bar-tile-${tile.id}`);
    const rentTagEl = document.getElementById(`rent-tag-tile-${tile.id}`);

    if (prop) {
      if (prop.ownerId) {
        const owner = state.players.find((pl) => pl.id === prop.ownerId);
        if (owner && ownerDot) {
          ownerDot.style.backgroundColor = owner.avatar.color;
          ownerDot.classList.remove('hidden');
        }
        const activeRent = getActiveRentForTile(state, tile);
        if (rentTagEl && activeRent) {
          rentTagEl.textContent = `Cobro: ${formatCompactCLP(activeRent)}`;
          rentTagEl.classList.remove('hidden');
          rentTagEl.classList.toggle('upgraded-rent', (prop.houses || 0) > 0);
        } else if (rentTagEl) {
          rentTagEl.classList.add('hidden');
        }
      } else {
        if (ownerDot) ownerDot.classList.add('hidden');
        if (rentTagEl) rentTagEl.classList.add('hidden');
      }

      if (mortgagedTag) {
        mortgagedTag.classList.toggle('hidden', !prop.mortgaged);
      }

      if (barEl && tile.type === 'property') {
        if (prop.houses === 5) {
          barEl.innerHTML = `<span class="tile-house-pill hotel-pill">🏨 HOTEL</span>`;
        } else if (prop.houses > 0) {
          barEl.innerHTML = `<span class="tile-house-pill">${'🏠'.repeat(prop.houses)} ${prop.houses}</span>`;
        } else {
          barEl.innerHTML = '';
        }
      }
    }

    // Resaltar casillas en el tablero según propiedad y dueño
    const tileEl = document.getElementById(`board-tile-${tile.id}`);
    if (tileEl) {
      if (prop && prop.ownerId) {
        const isMine = prop.ownerId === myPlayerId;
        tileEl.classList.toggle('tile-owned-by-me', isMine);
        tileEl.classList.toggle('tile-owned-by-other', !isMine);
        if (!isMine) {
          const owner = state.players.find((pl) => pl.id === prop.ownerId);
          tileEl.style.setProperty('--owner-color', owner?.avatar?.color || '#ef4444');
        } else {
          tileEl.style.removeProperty('--owner-color');
        }
      } else {
        tileEl.classList.remove('tile-owned-by-me', 'tile-owned-by-other');
        tileEl.style.removeProperty('--owner-color');
      }
    }
  });

  // Notificar al mapa animado de Santiago sobre el estado de propiedades y jugador local
  if (window.SantiagoMapAnimation) {
    window.SantiagoMapAnimation.updateGameState(state, myPlayerId);
  }

  // Mis Propiedades
  renderMyProperties(state);

  // Ofertas de Trueque pendientes para mí
  renderPendingTrades(state);

  // Crónica Financiera y Chat
  renderLogsAndChat(state);
}

// Actualiza los botones del centro solo cuando el jugador terminó de caminar hasta la casilla
function updateTurnActionControls(state) {
  if (!state || state.gameType === 'cual_es') return;
  const currentPlayer = state.players[state.turnIndex];
  const isMyTurn = currentPlayer && currentPlayer.id === myPlayerId;
  const isCurrentWalking = Boolean(currentPlayer && walkingTimers[currentPlayer.id]);

  // Banner de turno o ganador
  const turnBanner = document.getElementById('turn-banner');
  if (state.status === 'finished' && state.winner) {
    turnBanner.innerHTML = `🏆 ¡${state.winner.avatar.icon} ${state.winner.name} GANA GRAN SANTIAGO!`;
  } else if (currentPlayer) {
    if (isCurrentWalking) {
      const targetTile = boardMeta.BOARD_TILES[currentPlayer.position];
      turnBanner.innerHTML = `🚶 ${currentPlayer.avatar.icon} ${currentPlayer.name} avanzando hacia <strong>${targetTile?.name || 'casilla'}</strong>...`;
    } else if (state.turnPhase === 'CARD_CONFIRM') {
      turnBanner.innerHTML = `🃏 Leyendo tarjeta de ${currentPlayer.avatar.icon} ${currentPlayer.name}...`;
    } else {
      turnBanner.innerHTML = isMyTurn
        ? `🟢 ¡ES TU TURNO, ${currentPlayer.avatar.icon} ${currentPlayer.name}!`
        : `⏳ Turno de ${currentPlayer.avatar.icon} ${currentPlayer.name}`;
    }
  }

  // Actualizar indicador móvil de turno
  const mobTurnIndicator = document.getElementById('mobile-turn-indicator');
  if (mobTurnIndicator && currentPlayer) {
    mobTurnIndicator.innerHTML = isMyTurn
      ? `<span class="mgh-my-turn">🎲 ¡Tu Turno! (${currentPlayer.avatar.icon})</span>`
      : `<span class="mgh-other-turn">⏳ ${currentPlayer.avatar.icon} ${currentPlayer.name.split(' ')[0]}</span>`;
  }

  // Alerta flotante en móvil si es mi turno y no estoy en la pestaña de Tablero
  const myTurnBanner = document.getElementById('mobile-my-turn-banner');
  const mainLayout = document.getElementById('main-game-layout');
  if (myTurnBanner && mainLayout) {
    const isNotOnBoard = mainLayout.dataset.activeTab && mainLayout.dataset.activeTab !== 'board';
    if (isMyTurn && isNotOnBoard && state.status === 'playing' && !isCurrentWalking && state.turnPhase !== 'CARD_CONFIRM') {
      myTurnBanner.classList.remove('hidden');
    } else {
      myTurnBanner.classList.add('hidden');
    }
  }

  // Actualizar contador de escrituras en la barra de pestañas móvil
  const mobPropsBadge = document.getElementById('mobile-props-badge');
  if (mobPropsBadge && state.properties) {
    const count = Object.values(state.properties).filter((p) => p.ownerId === myPlayerId).length;
    mobPropsBadge.textContent = count;
  }

  // Botones de acción en el centro
  const rollBtn = document.getElementById('btn-roll-dice');
  const bailBtn = document.getElementById('btn-pay-bail');
  const buyBox = document.getElementById('buy-decision-box');
  const buildHereBtn = document.getElementById('btn-build-here');
  const endBtn = document.getElementById('btn-end-turn');

  rollBtn.classList.add('hidden');
  bailBtn.classList.add('hidden');
  buyBox.classList.add('hidden');
  if (buildHereBtn) buildHereBtn.classList.add('hidden');
  endBtn.classList.add('hidden');

  // Esperar a que termine la animación de caminar o se confirme la tarjeta "?"
  if (isCurrentWalking || state.turnPhase === 'CARD_CONFIRM') {
    return;
  }

  if (state.status === 'playing' && isMyTurn) {
    if (state.turnPhase === 'ROLL') {
      rollBtn.classList.remove('hidden');
      if (currentPlayer.inJail && currentPlayer.money >= 50000) {
        bailBtn.classList.remove('hidden');
      }
    } else if (state.turnPhase === 'BUY_DECISION' && state.pendingBuyTileId !== null) {
      const tile = boardMeta.BOARD_TILES[state.pendingBuyTileId];
      if (tile) {
        buyBox.classList.remove('hidden');
        const buyGhibli = document.getElementById('buy-ghibli-preview');
        if (buyGhibli && window.GhibliArt) {
          buyGhibli.innerHTML = window.GhibliArt.getGhibliArtworkSVG(tile, 240, 126);
          buyGhibli.classList.remove('hidden');
        }
        const extraDetails = tile.type === 'property'
          ? `<div style="font-size:0.75rem; color:#cbd5e1; margin-top:4px;">💸 Arriendo base: <strong>${formatCLP(tile.rents[0])}</strong> · 🏗️ Mejora Casa/Hotel: <strong>${formatCLP(tile.houseCost)}</strong> <button type="button" onclick="openPropertyModal(${tile.id})" class="btn btn-xs btn-secondary" style="margin-left:4px; padding:1px 6px;">Ver Carta</button></div>`
          : (tile.type === 'station'
            ? `<div style="font-size:0.75rem; color:#cbd5e1; margin-top:4px;">💸 Cobro 1–4 estaciones: <strong>${formatCompactCLP(tile.rents[0])} a ${formatCompactCLP(tile.rents[3])}</strong></div>`
            : '');
        document.getElementById('buy-prompt-text').innerHTML =
          `¿Comprar <strong>${tile.name}</strong> por <span style="color:#4ade80">${formatCLP(tile.price)}</span>?${extraDetails}`;
      }
    } else if (state.turnPhase === 'END_TURN') {
      endBtn.classList.remove('hidden');
      endBtn.textContent = state.doublesCount > 0 && !currentPlayer.inJail
        ? '🎲 Tirar de Nuevo (Dobles)'
        : '⏭️ Terminar Turno';

      // Verificar si puede comprar 1 mejora en la casilla donde aterrizó (si tiene todas las tarjetas del barrio)
      const currentTile = boardMeta.BOARD_TILES[currentPlayer.position];
      const currentProp = state.properties?.[currentPlayer.position];
      const hasBuiltThisTurn = (state.builtHousesCountThisTurn || 0) >= 1;

      if (
        currentTile &&
        currentTile.type === 'property' &&
        currentProp &&
        currentProp.ownerId === currentPlayer.id &&
        !currentProp.mortgaged &&
        currentProp.houses < 5 &&
        !hasBuiltThisTurn
      ) {
        const groupTiles = boardMeta.BOARD_TILES.filter((t) => t.group === currentTile.group);
        const ownsAllCards =
          groupTiles.length > 0 &&
          groupTiles.every(
            (t) => state.properties?.[t.id]?.ownerId === currentPlayer.id && !state.properties?.[t.id]?.mortgaged
          );

        if (ownsAllCards && buildHereBtn) {
          const nextLabel = currentProp.houses === 4 ? '🏨 Comprar 1 Hotel' : '🏠 Comprar 1 Casa';
          const canAfford = currentPlayer.money >= currentTile.houseCost;
          buildHereBtn.textContent = `🏗️ ${nextLabel} en ${currentTile.name} (${formatCLP(currentTile.houseCost)})`;
          buildHereBtn.disabled = !canAfford;
          buildHereBtn.title = canAfford
            ? 'Comprar 1 mejora por caer en tu barrio completo'
            : 'Fondos insuficientes';
          buildHereBtn.classList.remove('hidden');
        }
      }
    }
  }
}

// Calcula en el cliente cuánto paga quien caiga en una casilla actualmente
function getActiveRentForTile(state, tile) {
  if (!state || !tile) return null;
  const prop = state.properties?.[tile.id];
  if (!prop || !prop.ownerId || prop.mortgaged) return null;

  const ownerId = prop.ownerId;
  if (tile.type === 'property') {
    const houses = prop.houses || 0;
    if (houses > 0) return tile.rents[houses];
    const groupTiles = boardMeta.BOARD_TILES.filter((t) => t.group === tile.group);
    const hasMonopoly =
      groupTiles.length > 0 &&
      groupTiles.every((t) => state.properties?.[t.id]?.ownerId === ownerId && !state.properties?.[t.id]?.mortgaged);
    return hasMonopoly ? tile.rents[0] * 2 : tile.rents[0];
  }

  if (tile.type === 'station') {
    const ownedStations = boardMeta.BOARD_TILES.filter(
      (t) => t.type === 'station' && state.properties?.[t.id]?.ownerId === ownerId && !state.properties?.[t.id]?.mortgaged
    ).length;
    return tile.rents[Math.max(0, Math.min(3, ownedStations - 1))] || 50000;
  }

  return null;
}

function renderCualEs3DStack(containerId, cardCount, maxCards = 55, maxLayers = 14) {
  const stackEl = document.getElementById(containerId);
  if (!stackEl) return;
  stackEl.innerHTML = '';

  const count = Math.max(0, Number(cardCount) || 0);
  if (count <= 1) return;

  const layers = Math.min(maxLayers, Math.max(1, Math.ceil(((count - 1) / maxCards) * maxLayers)));
  for (let i = layers; i >= 1; i--) {
    const layer = document.createElement('div');
    layer.className = 'deck-3d-layer';
    const offsetX = i * 1.1;
    const offsetY = i * 2.1;
    layer.style.transform = `translate3d(${offsetX}px, ${offsetY}px, -${i * 2}px)`;
    stackEl.appendChild(layer);
  }
}

function renderCualEsTableSeats(state) {
  const seatsContainer = document.getElementById('cuales-table-seats');
  if (!seatsContainer || !state.cualEs) return;
  seatsContainer.innerHTML = '';

  const ce = state.cualEs;
  const opponents = state.players.filter((p) => p.id !== myPlayerId);
  const me = state.players.find((p) => p.id === myPlayerId);

  // Bordes alrededor de la pantalla para hasta 7 oponentes
  const borderPositions = [
    'pos-top',
    'pos-left',
    'pos-right',
    'pos-top-left',
    'pos-top-right',
    'pos-bottom-left',
    'pos-bottom-right'
  ];

  opponents.forEach((p, idx) => {
    const posClass = borderPositions[idx % borderPositions.length];
    const isPenalized = (ce.penalties?.[p.id] || 0) > Date.now();
    const pScore = ce.scores?.[p.id] || 1;

    const seat = document.createElement('div');
    seat.id = `cuales-seat-${p.id}`;
    seat.className = `cuales-seat ${posClass}` + (isPenalized ? ' seat-penalized' : '');
    seat.style.borderColor = p.avatar?.color || '#38bdf8';
    const pAvDisplay = p.avatar?.imageUrl
      ? `<img src="${p.avatar.imageUrl}" alt="${p.name}" class="seat-avatar-img" />`
      : (p.avatar?.icon || '👤');
    seat.innerHTML = `
      <span class="cuales-seat-hand">${isPenalized ? '❄️' : '🫳'}</span>
      <span class="cuales-seat-avatar">${pAvDisplay}</span>
      <div class="cuales-seat-info">
        <span class="cuales-seat-name">${p.name}</span>
        <span class="cuales-seat-score">${pScore} 🃏</span>
      </div>
    `;
    seatsContainer.appendChild(seat);
  });

  if (me) {
    const isMePenalized = (ce.penalties?.[me.id] || 0) > Date.now();
    const myScore = ce.scores?.[me.id] || 1;
    const myAvDisplay = me.avatar?.imageUrl
      ? `<img src="${me.avatar.imageUrl}" alt="${me.name}" class="seat-avatar-img" />`
      : (me.avatar?.icon || '👤');
    const mySeat = document.createElement('div');
    mySeat.id = `cuales-seat-${me.id}`;
    mySeat.className = `cuales-seat pos-bottom` + (isMePenalized ? ' seat-penalized' : '');
    mySeat.style.borderColor = me.avatar?.color || '#38bdf8';
    mySeat.innerHTML = `
      <span class="cuales-seat-hand">${isMePenalized ? '❄️' : '🖐️'}</span>
      <span class="cuales-seat-avatar">${myAvDisplay}</span>
      <div class="cuales-seat-info">
        <span class="cuales-seat-name">${me.name} (Tú)</span>
        <span class="cuales-seat-score">${myScore} 🃏</span>
      </div>
    `;
    seatsContainer.appendChild(mySeat);
  }
}

function renderCualEsGame(state) {
  const ce = state.cualEs;
  if (!ce) return;

  const myScore = ce.scores?.[myPlayerId] || 1;
  const myScoreEl = document.getElementById('cuales-my-score');
  if (myScoreEl) myScoreEl.textContent = myScore;

  // Renderizar montones 3D (el grosor del montón muestra cuántas cartas quedan sin usar números)
  renderCualEs3DStack('cuales-deck-stack-layers', (ce.remainingDeckCount || 0) + (ce.centerCard?.length ? 1 : 0), 55, 14);
  renderCualEs3DStack('cuales-my-stack-layers', myScore, 30, 10);

  // Renderizar asientos y manos físicas en cada borde de la pantalla
  renderCualEsTableSeats(state);

  const matchBanner = document.getElementById('cuales-last-match');
  const gameOverOverlay = document.getElementById('cuales-gameover-overlay');

  if (state.status === 'finished' && state.winner) {
    matchBanner.innerHTML = `🏆 ¡PARTIDA TERMINADA! Ganador: <strong>${state.winner.avatar.icon} ${state.winner.name}</strong> con ${ce.scores?.[state.winner.id] || 0} cartas!`;

    if (gameOverOverlay) {
      gameOverOverlay.classList.remove('hidden');
      const winAvatarEl = document.getElementById('cuales-winner-avatar');
      const winTitleEl = document.getElementById('cuales-winner-title');
      const winSubEl = document.getElementById('cuales-winner-subtitle');
      const rankingEl = document.getElementById('cuales-gameover-ranking');

      if (winAvatarEl) winAvatarEl.textContent = state.winner.avatar?.icon || '🏆';
      if (winTitleEl) winTitleEl.textContent = `¡${state.winner.name} gana ¿Cuál es?!`;
      if (winSubEl) {
        winSubEl.textContent = `Campeón con ${ce.scores?.[state.winner.id] || 0} cartas ganadas`;
      }
      if (rankingEl) {
        rankingEl.innerHTML = '';
        const ranked = [...state.players].sort(
          (a, b) => (ce.scores?.[b.id] || 0) - (ce.scores?.[a.id] || 0)
        );
        ranked.forEach((p, idx) => {
          const row = document.createElement('div');
          row.className = 'cgo-rank-row' + (idx === 0 ? ' first-place' : '');
          const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx + 1}`));
          row.innerHTML = `
            <span>${medal} ${p.avatar?.icon || ''} ${p.name} ${p.id === myPlayerId ? '(Tú)' : ''}</span>
            <strong>${ce.scores?.[p.id] || 0} 🃏</strong>
          `;
          rankingEl.appendChild(row);
        });
      }
    }
  } else {
    if (gameOverOverlay) gameOverOverlay.classList.add('hidden');
    if (ce.lastMatch) {
      matchBanner.innerHTML = `⚡ Última carta ganada por <strong>${ce.lastMatch.playerAvatar?.icon || ''} ${ce.lastMatch.playerName}</strong> con <strong>${ce.lastMatch.symbol.icon}</strong>`;
    } else {
      matchBanner.textContent = '¡Encuentra y haz clic en el único icono idéntico entre ambas cartas!';
    }
  }

  // Verificar si tengo penalización activa
  const serverPenalty = ce.penalties?.[myPlayerId] || 0;
  if (serverPenalty > Date.now()) {
    startMyPenaltyCountdown(serverPenalty);
  }

  // Renderizar Carta Central y Mi Carta Activa (con animación de 0.5s al cambiar carta para evitar clics accidentales)
  const centerCard = ce.centerCard || [];
  const myCard = ce.playerCards?.[myPlayerId] || [];
  const centerEl = document.getElementById('cuales-center-card');
  const myCardEl = document.getElementById('cuales-my-card');

  const cardChanged =
    lastRenderedCualEsDeckCount !== null &&
    lastRenderedCualEsDeckCount !== ce.remainingDeckCount;
  lastRenderedCualEsDeckCount = ce.remainingDeckCount;

  if (cardChanged) {
    cualesCardTransitionUntil = Date.now() + 500;
    if (centerEl) {
      centerEl.classList.remove('cuales-card-changing');
      void centerEl.offsetWidth;
      centerEl.classList.add('cuales-card-changing');
    }
    if (myCardEl) {
      myCardEl.classList.remove('cuales-card-changing');
      void myCardEl.offsetWidth;
      myCardEl.classList.add('cuales-card-changing');
    }

    if (cualesTransitionTimer) clearTimeout(cualesTransitionTimer);
    // Actualizar los dibujos en la mitad del giro (200ms) y habilitar clics al terminar los 0.5s (500ms)
    setTimeout(() => {
      renderCualEsCircleCard('cuales-center-card', centerCard, ce.remainingDeckCount || 1);
      renderCualEsCircleCard('cuales-my-card', myCard, myScore);
    }, 200);

    cualesTransitionTimer = setTimeout(() => {
      if (centerEl) centerEl.classList.remove('cuales-card-changing');
      if (myCardEl) myCardEl.classList.remove('cuales-card-changing');
    }, 500);
  } else {
    renderCualEsCircleCard('cuales-center-card', centerCard, ce.remainingDeckCount || 1);
    renderCualEsCircleCard('cuales-my-card', myCard, myScore);
  }

  // Lista lateral de jugadores ordenada por puntaje en ¿Cuál es?
  const playersList = document.getElementById('players-list');
  playersList.innerHTML = '';

  const sortedPlayers = [...state.players].sort(
    (a, b) => (ce.scores?.[b.id] || 0) - (ce.scores?.[a.id] || 0)
  );

  sortedPlayers.forEach((p, idx) => {
    const row = document.createElement('div');
    const isPenalized = (ce.penalties?.[p.id] || 0) > Date.now();
    row.className = 'player-row' + (idx === 0 ? ' active-turn' : '');
    row.style.borderLeftColor = p.avatar.color;

    const pScore = ce.scores?.[p.id] || 0;
    row.innerHTML = `
      <div class="p-info">
        <span class="p-avatar">${p.avatar.icon}</span>
        <div>
          <div class="p-name">${p.name} ${p.id === myPlayerId ? '(Tú)' : ''}</div>
          <span class="p-status-tag">${isPenalized ? '❄️ Penalizado (3s)' : `🃏 Buscando coincidencia...`}</span>
        </div>
      </div>
      <div class="p-money">${pScore} 🃏</div>
    `;
    playersList.appendChild(row);
  });
}

// ============================================================================
// MOTOR DEL SUDOKU COLABORATIVO (CLIENTE)
// ============================================================================
let selectedSudokuCellIndex = null;
let highlightedSudokuNumber = null;
let sudokuListenersAttached = false;

function setupSudokuEventListeners() {
  if (sudokuListenersAttached) return;
  sudokuListenersAttached = true;

  // Teclas numéricas 1-9
  document.querySelectorAll('.skp-btn[data-num]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const num = parseInt(btn.dataset.num, 10);
      handleSudokuDigitInput(num);
    });
  });

  // Botón Borrar
  document.getElementById('btn-sudoku-key-clear')?.addEventListener('click', () => {
    handleSudokuClearInput();
  });

  // Botón Validar Tablero
  document.getElementById('btn-sudoku-validate')?.addEventListener('click', () => {
    playTone(580, 0.08, 'sine');
    socket.emit('sudoku_check', (res) => {
      if (!res) return;
      if (res.isComplete) {
        showToast('🎉 ¡Excelente! ¡El Sudoku está completo y perfecto!');
      } else if (res.isValid) {
        showToast(`✅ Tablero válido hasta ahora (${res.filledCount}/81 casillas llenas). ¡Sigan así!`);
      } else {
        showToast(`⚠️ Se detectaron ${res.errors.length} casillas con números repetidos.`);
      }
    });
  });

  // Botón Cargar Preset / Dificultad
  document.getElementById('btn-sudoku-load-preset')?.addEventListener('click', () => {
    const diff = document.getElementById('sudoku-preset-select')?.value || 'facil';
    playTone(440, 0.1, 'sine');
    socket.emit('sudoku_load_preset', { difficulty: diff }, (res) => {
      if (res && !res.ok) showToast(res.error);
    });
  });

  // Botón Limpiar Todo
  document.getElementById('btn-sudoku-clear-all')?.addEventListener('click', () => {
    if (confirm('¿Reiniciar todo el tablero de Sudoku?')) {
      const diff = document.getElementById('sudoku-preset-select')?.value || 'custom';
      socket.emit('sudoku_load_preset', { difficulty: diff });
    }
  });

  // Votar abandonar Sudoku
  document.getElementById('btn-sudoku-vote-abandon')?.addEventListener('click', () => {
    socket.emit('vote_abandon_game');
  });

  // Botón volver tras victoria
  document.getElementById('btn-sudoku-finish-return')?.addEventListener('click', () => {
    socket.emit('vote_abandon_game');
  });

  // Soporte de Teclado Físico
  window.addEventListener('keydown', (e) => {
    if (!currentRoomState || currentRoomState.gameType !== 'sudoku' || currentRoomState.status !== 'playing') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key >= '1' && e.key <= '9') {
      handleSudokuDigitInput(parseInt(e.key, 10));
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      handleSudokuClearInput();
    } else if (e.key.startsWith('Arrow')) {
      handleSudokuArrowNav(e.key);
    }
  });
}

function handleSudokuDigitInput(num) {
  highlightedSudokuNumber = num;
  if (!currentRoomState || !currentRoomState.sudoku) return;

  if (selectedSudokuCellIndex === null) {
    playTone(520, 0.05, 'sine');
    renderSudokuGame(currentRoomState);
    return;
  }

  const isHost = currentRoomState.hostId === myPlayerId;
  const cell = currentRoomState.sudoku.grid[selectedSudokuCellIndex];
  if (!cell) {
    renderSudokuGame(currentRoomState);
    return;
  }

  if (cell.given) {
    // Si la celda es una pista fija, pulsar un número en el keypad sirve para resaltar todos los de ese número
    playTone(520, 0.05, 'sine');
    renderSudokuGame(currentRoomState);
    return;
  }

  if (isHost) {
    playTone(660, 0.08, 'triangle');
    socket.emit('sudoku_set_cell', { index: selectedSudokuCellIndex, value: num }, (res) => {
      if (res && !res.ok) showToast(res.error);
    });
  } else {
    if (cell.value > 0) {
      showToast('Esta casilla ya tiene un número definitivo puesto por el líder.');
      renderSudokuGame(currentRoomState);
      return;
    }
    playTone(520, 0.06, 'sine');
    socket.emit('sudoku_toggle_suggestion', { index: selectedSudokuCellIndex, number: num });
  }
  renderSudokuGame(currentRoomState);
}

function handleSudokuClearInput() {
  if (selectedSudokuCellIndex === null || !currentRoomState) return;
  playTone(330, 0.08, 'sine');
  socket.emit('sudoku_clear_cell', { index: selectedSudokuCellIndex });
}

function handleSudokuArrowNav(arrowKey) {
  if (selectedSudokuCellIndex === null) {
    selectedSudokuCellIndex = 0;
  } else {
    let r = Math.floor(selectedSudokuCellIndex / 9);
    let c = selectedSudokuCellIndex % 9;
    if (arrowKey === 'ArrowUp') r = (r + 8) % 9;
    else if (arrowKey === 'ArrowDown') r = (r + 1) % 9;
    else if (arrowKey === 'ArrowLeft') c = (c + 8) % 9;
    else if (arrowKey === 'ArrowRight') c = (c + 1) % 9;
    selectedSudokuCellIndex = r * 9 + c;
    const curCell = currentRoomState?.sudoku?.grid?.[selectedSudokuCellIndex];
    if (curCell && curCell.value > 0) {
      highlightedSudokuNumber = curCell.value;
    }
  }
  if (currentRoomState) renderSudokuGame(currentRoomState);
}

function renderSudokuGame(state) {
  setupSudokuEventListeners();
  const su = state.sudoku;
  if (!su || !su.grid) return;

  const isHost = state.hostId === myPlayerId;

  // Header y Roles
  const roleHintEl = document.getElementById('sudoku-role-hint');
  if (roleHintEl) {
    roleHintEl.textContent = isHost
      ? '👑 Eres el Líder: Tienes el control de ingresar los números definitivos (1-9).'
      : '💡 Eres Colaborador: Haz clic en casillas vacías para colocar o quitar sugerencias de números.';
  }

  const leaderToolbar = document.getElementById('sudoku-leader-toolbar');
  if (leaderToolbar) {
    leaderToolbar.classList.toggle('hidden', !isHost);
  }

  const filledCountEl = document.getElementById('sudoku-stat-filled');
  if (filledCountEl) {
    filledCountEl.textContent = su.solvedCount || 0;
  }

  const abandonBtn = document.getElementById('btn-sudoku-vote-abandon');
  if (abandonBtn) {
    const abVotes = state.abandonVotes || [];
    abandonBtn.textContent = `🏳️ Votar Abandonar (${abVotes.length}/${state.abandonRequired || 1})`;
  }

  const presetSel = document.getElementById('sudoku-preset-select');
  if (presetSel && document.activeElement !== presetSel) {
    presetSel.value = su.difficulty || 'facil';
  }

  const puzzleBadge = document.getElementById('sudoku-current-puzzle-name');
  if (puzzleBadge) {
    puzzleBadge.textContent = su.puzzleName || 'Sudoku';
  }

  // Renderizar las 81 celdas del Sudoku
  const gridEl = document.getElementById('sudoku-grid');
  gridEl.innerHTML = '';

  const selCell = selectedSudokuCellIndex !== null ? su.grid[selectedSudokuCellIndex] : null;
  const selRow = selCell ? selCell.row : -1;
  const selCol = selCell ? selCell.col : -1;
  const selBox = selCell ? selCell.box : -1;

  // Si la celda seleccionada tiene un número, se marca automáticamente ese número
  if (selCell && selCell.value > 0) {
    highlightedSudokuNumber = selCell.value;
  }
  const activeNum = highlightedSudokuNumber;

  // Identificar todas las líneas horizontales y verticales cubiertas por el número marcado (cross-hatching)
  const coveredRows = new Set();
  const coveredCols = new Set();
  if (activeNum) {
    su.grid.forEach((c) => {
      if (c.value === activeNum) {
        coveredRows.add(c.row);
        coveredCols.add(c.col);
      }
    });
  }

  su.grid.forEach((cell, idx) => {
    const cellEl = document.createElement('div');
    cellEl.className = 'sudoku-cell';
    cellEl.dataset.index = idx;
    cellEl.dataset.row = cell.row;
    cellEl.dataset.col = cell.col;

    const isSelected = idx === selectedSudokuCellIndex;
    const isSameRow = selCell && cell.row === selRow;
    const isSameCol = selCell && cell.col === selCol;
    const isSameBox = selCell && cell.box === selBox;
    const isPeer = isSameRow || isSameCol || isSameBox;
    const isSameNumber = activeNum && cell.value === activeNum;
    const isCoveredRow = activeNum && coveredRows.has(cell.row);
    const isCoveredCol = activeNum && coveredCols.has(cell.col);
    const hasError = su.errors && su.errors.includes(idx);

    // Resaltado de líneas horizontal y vertical que cubren la celda activa
    if (isSameRow) cellEl.classList.add('cell-line-h');
    if (isSameCol) cellEl.classList.add('cell-line-v');
    if (isPeer) cellEl.classList.add('cell-peer');

    // Resaltado de líneas horizontales y verticales que cubren el número indicado
    if (isCoveredRow) cellEl.classList.add('cell-covered-row');
    if (isCoveredCol) cellEl.classList.add('cell-covered-col');
    if (isCoveredRow || isCoveredCol) cellEl.classList.add('cell-covered-line');

    // Resaltado de todos los números iguales al indicado
    if (isSameNumber) {
      cellEl.classList.add('cell-same-number');
    }

    if (isSelected) cellEl.classList.add('cell-selected');
    if (hasError) cellEl.classList.add('cell-error');

    if (cell.value > 0) {
      if (cell.given) {
        cellEl.classList.add('cell-given');
      } else {
        cellEl.classList.add('cell-leader-val');
      }
      cellEl.textContent = cell.value;
    } else {
      // Grilla 3x3 de sugerencias / notas
      const notesGrid = document.createElement('div');
      notesGrid.className = 'cell-notes-grid';

      for (let n = 1; n <= 9; n++) {
        const noteItem = document.createElement('div');
        noteItem.className = 'cell-note-item';
        const suggList = cell.suggestions?.[String(n)];
        if (suggList && suggList.length > 0) {
          noteItem.classList.add('has-suggestion');
          noteItem.textContent = n;
          const names = suggList.map((s) => s.name).join(', ');
          noteItem.title = `Sugerido por: ${names}`;
          // Si coincide con el número marcado, resaltar la nota
          if (activeNum && n === activeNum) {
            noteItem.classList.add('note-matches-active');
          }
          // Si yo lo sugerí, resaltar formato
          if (suggList.some((s) => s.id === myPlayerId)) {
            noteItem.style.fontWeight = '900';
            noteItem.style.textDecoration = 'underline';
          }
        }
        notesGrid.appendChild(noteItem);
      }
      cellEl.appendChild(notesGrid);
    }

    cellEl.addEventListener('click', () => {
      if (selectedSudokuCellIndex === idx && cell.value > 0 && highlightedSudokuNumber === cell.value) {
        // Al tocar de nuevo la misma celda con número, alternar/desmarcar
        highlightedSudokuNumber = null;
      } else {
        selectedSudokuCellIndex = idx;
        if (cell.value > 0) {
          highlightedSudokuNumber = cell.value;
        }
      }
      playTone(480, 0.04, 'sine');
      renderSudokuGame(state);
    });

    gridEl.appendChild(cellEl);
  });

  // Actualizar panel inferior de teclado y sugerencias
  updateSudokuKeypadUI(state);

  // Overlay de victoria
  const victoryOverlay = document.getElementById('sudoku-victory-overlay');
  if (victoryOverlay) {
    victoryOverlay.classList.toggle('hidden', !su.solved);
  }

  // Lista lateral de jugadores para Sudoku
  const playersList = document.getElementById('players-list');
  if (playersList) {
    playersList.innerHTML = '';
    state.players.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'player-row' + (p.id === state.hostId ? ' active-turn' : '');
      row.style.borderLeftColor = p.avatar?.color || '#3B82F6';
      const avDisplay = p.avatar?.imageUrl
        ? `<img src="${p.avatar.imageUrl}" alt="${p.name}" class="avatar-photo-img" />`
        : (p.avatar?.icon || '👤');
      const roleLabel = p.id === state.hostId ? '👑 Líder' : '💡 Colaborador';
      row.innerHTML = `
        <div class="p-info">
          <span class="p-avatar">${avDisplay}</span>
          <div>
            <div class="p-name">${p.name} ${p.id === myPlayerId ? '(Tú)' : ''}</div>
            <span class="p-status-tag">${roleLabel}</span>
          </div>
        </div>
      `;
      playersList.appendChild(row);
    });
  }
}

function updateSudokuKeypadUI(state) {
  const isHost = state.hostId === myPlayerId;
  const titleEl = document.getElementById('sudoku-keypad-title');
  const infoEl = document.getElementById('sudoku-selected-cell-info');
  const suggBarEl = document.getElementById('sudoku-cell-suggestions-bar');
  const suggListEl = document.getElementById('sudoku-cell-suggestions-list');

  // Resaltar en el teclado numérico el número actualmente activo
  const activeNum = highlightedSudokuNumber;
  document.querySelectorAll('.skp-btn[data-num]').forEach((btn) => {
    const bNum = parseInt(btn.dataset.num, 10);
    btn.classList.toggle('skp-btn-active', activeNum === bNum);
  });

  if (selectedSudokuCellIndex === null) {
    if (titleEl) titleEl.textContent = '👆 Haz clic en una casilla del tablero para comenzar';
    if (infoEl) infoEl.textContent = '';
    if (suggBarEl) suggBarEl.classList.add('hidden');
    return;
  }

  const cell = state.sudoku?.grid?.[selectedSudokuCellIndex];
  if (!cell) return;

  if (infoEl) {
    infoEl.textContent = `Fila ${cell.row + 1}, Columna ${cell.col + 1}` + (cell.given ? ' (Pista Fija)' : '');
  }

  if (titleEl) {
    if (cell.given) {
      titleEl.textContent = '🔒 Casilla con pista inicial protegida.';
    } else if (isHost) {
      titleEl.textContent = '👑 Elige el número definitivo para esta casilla:';
    } else {
      titleEl.textContent = cell.value > 0
        ? '✅ Casilla resuelta por el líder.'
        : '💡 Toca un número para sugerir o retirar tu nota:';
    }
  }

  // Si el líder seleccionó una casilla vacía con sugerencias del equipo, mostrarlas como accesos rápidos
  if (isHost && cell.value === 0 && cell.suggestions && Object.keys(cell.suggestions).length > 0) {
    if (suggBarEl) suggBarEl.classList.remove('hidden');
    if (suggListEl) {
      suggListEl.innerHTML = '';
      Object.entries(cell.suggestions).forEach(([numStr, pList]) => {
        if (!pList || pList.length === 0) return;
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'scsb-pill';
        const names = pList.map((p) => p.name).join(', ');
        pill.innerHTML = `<strong>${numStr}</strong> (${names})`;
        pill.title = `Aceptar sugerencia de ${names}`;
        pill.addEventListener('click', () => {
          playTone(660, 0.08, 'triangle');
          socket.emit('sudoku_set_cell', { index: selectedSudokuCellIndex, value: parseInt(numStr, 10) });
        });
        suggListEl.appendChild(pill);
      });
    }
  } else {
    if (suggBarEl) suggBarEl.classList.add('hidden');
  }
}

function renderMyProperties(state) {
  const myPropsContainer = document.getElementById('my-properties-list');
  const myOwnedTiles = boardMeta.BOARD_TILES.filter(
    (t) => state.properties[t.id]?.ownerId === myPlayerId
  );

  document.getElementById('my-props-count').textContent = myOwnedTiles.length;

  if (!myOwnedTiles.length) {
    myPropsContainer.innerHTML = `<p class="empty-small">Aún no tienes propiedades. ¡Lanza los dados y compra comunas!</p>`;
    return;
  }

  myPropsContainer.innerHTML = '';
  myOwnedTiles.forEach((tile) => {
    const prop = state.properties[tile.id];
    const groupColor = boardMeta.COLOR_GROUPS[tile.group]?.color || '#64748b';
    const item = document.createElement('div');
    item.className = 'my-prop-item';
    item.style.borderLeftColor = groupColor;

    let badge = '';
    if (prop.mortgaged) badge = '<span style="color:#ef4444; font-weight:900;">🏦 Hipotecada</span>';
    else if (prop.houses === 5) badge = '<span class="tile-house-pill hotel-pill" style="position:static;">🏨 HOTEL</span>';
    else if (prop.houses > 0) badge = `<span class="tile-house-pill" style="position:static;">${'🏠'.repeat(prop.houses)} (${prop.houses})</span>`;

    const activeRent = getActiveRentForTile(state, tile);
    const rentStr = prop.mortgaged
      ? 'Sin cobro'
      : (activeRent ? `Cobro: ${formatCompactCLP(activeRent)}` : (tile.type === 'utility' ? 'Cobro: ×Dados' : ''));
    const upgradeStr = tile.type === 'property' && tile.houseCost
      ? ` · Mejora: ${formatCompactCLP(tile.houseCost)}`
      : '';

    const typeIcon = tile.type === 'station' ? '🚇 ' : (tile.type === 'utility' ? `${tile.icon || '⚡'} ` : '🏘️ ');

    item.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:2px;">
        <span><strong>${typeIcon}${tile.name}</strong></span>
        <span style="font-size:0.7rem; color:#0369a1; font-weight:700;">💸 ${rentStr}${upgradeStr}</span>
      </div>
      <div style="display:flex; align-items:center; gap:4px;">
        ${badge || `<span style="color:#475569; font-weight:800; font-size:0.75rem">${formatCompactCLP(tile.price)}</span>`}
      </div>
    `;
    item.addEventListener('click', () => openPropertyModal(tile.id));
    myPropsContainer.appendChild(item);
  });
}

function renderPendingTrades(state) {
  const banner = document.getElementById('active-trades-banner');
  const myTrades = (state.trades || []).filter((t) => t.toId === myPlayerId);
  if (!myTrades.length) {
    banner.classList.add('hidden');
    return;
  }

  const tr = myTrades[0];
  const offerTileName = tr.offerTileId ? boardMeta.BOARD_TILES[tr.offerTileId]?.name : null;
  const reqTileName = tr.requestTileId ? boardMeta.BOARD_TILES[tr.requestTileId]?.name : null;

  banner.classList.remove('hidden');
  banner.innerHTML = `
    <div><strong>🤝 Oferta de ${tr.fromName}:</strong></div>
    <div style="margin: 4px 0;">
      Ofrece: <strong>${offerTileName || 'Ninguna prop.'} + ${formatCLP(tr.offerMoney)}</strong><br/>
      Pide: <strong>${reqTileName || 'Ninguna prop.'} + ${formatCLP(tr.requestMoney)}</strong>
    </div>
    <div style="display:flex; gap:6px; justify-content:center; margin-top:4px;">
      <button id="btn-accept-trade" class="btn btn-success btn-xs">Aceptar Trato</button>
      <button id="btn-reject-trade" class="btn btn-danger-outline btn-xs">Rechazar</button>
    </div>
  `;

  document.getElementById('btn-accept-trade').onclick = () => {
    socket.emit('respond_trade', { tradeId: tr.id, accept: true });
  };
  document.getElementById('btn-reject-trade').onclick = () => {
    socket.emit('respond_trade', { tradeId: tr.id, accept: false });
  };
}

let lastKnownChatCount = 0;
function renderLogsAndChat(state) {
  const logsEl = document.getElementById('game-logs');
  logsEl.innerHTML = '';
  state.logs.forEach((l) => {
    const div = document.createElement('div');
    div.className = `log-entry ${l.type || 'info'}`;
    div.innerHTML = `<span class="log-time">[${l.time}]</span> ${l.text}`;
    logsEl.appendChild(div);
  });

  const chatEl = document.getElementById('chat-messages');
  chatEl.innerHTML = '';
  state.chat.forEach((c) => {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<strong>${c.avatar?.icon || ''} ${c.playerName}:</strong> ${c.text}`;
    chatEl.appendChild(div);
  });
  chatEl.scrollTop = chatEl.scrollHeight;

  // Notificar mensajes no leídos en la pestaña móvil de Chat
  const mainLayout = document.getElementById('main-game-layout');
  if (state.chat && state.chat.length > lastKnownChatCount) {
    if (lastKnownChatCount > 0 && mainLayout && mainLayout.dataset.activeTab !== 'chat') {
      const dot = document.getElementById('mobile-chat-badge');
      if (dot) dot.classList.remove('hidden');
    }
    lastKnownChatCount = state.chat.length;
  }
}

function openPropertyModal(tileId) {
  const tile = boardMeta.BOARD_TILES[tileId];
  if (!tile) return;
  inspectedTileId = tileId;

  const dialog = document.getElementById('property-dialog');
  const header = document.getElementById('prop-dialog-header');
  const comunaEl = document.getElementById('prop-dialog-comuna');
  const titleEl = document.getElementById('prop-dialog-title');
  const priceEl = document.getElementById('prop-dialog-price');
  const ownerEl = document.getElementById('prop-dialog-owner');
  const upgradeBox = document.getElementById('prop-upgrade-box');
  const upgradeCostEl = document.getElementById('prop-dialog-upgrade-cost');
  const currentRentEl = document.getElementById('prop-dialog-current-rent');
  const rentTable = document.querySelector('#prop-rent-table tbody');
  const descEl = document.getElementById('prop-dialog-desc');
  const actionsBox = document.getElementById('prop-owner-actions');

  const groupInfo = tile.group ? boardMeta.COLOR_GROUPS[tile.group] : null;
  const headerColor = groupInfo ? groupInfo.color : '#334155';
  header.style.background = headerColor;
  comunaEl.textContent = tile.comuna || groupInfo?.name || 'CASILLA ESPECIAL';
  titleEl.textContent = `${tile.icon ? tile.icon + ' ' : ''}${tile.name}`;

  // Ilustración Studio Ghibli del lugar en la tarjeta
  const ghibliEl = document.getElementById('prop-dialog-ghibli-artwork');
  if (ghibliEl) {
    if (window.GhibliArt) {
      ghibliEl.innerHTML = window.GhibliArt.getGhibliArtworkSVG(tile, 340, 180);
      ghibliEl.classList.remove('hidden');
    } else {
      ghibliEl.classList.add('hidden');
    }
  }

  const emblemEl = document.getElementById('prop-dialog-emblem');
  if (emblemEl) {
    // Si hay arte Ghibli, ocultar el círculo con emoji para que destaque la postal ilustrada
    if (window.GhibliArt) {
      emblemEl.classList.add('hidden');
    } else {
      const bigIcon = tile.icon || (tile.type === 'property' ? '🏘️' : '📍');
      emblemEl.textContent = bigIcon;
      emblemEl.style.borderColor = headerColor;
      emblemEl.classList.remove('hidden');
    }
  }

  priceEl.textContent = tile.price ? formatCLP(tile.price) : '—';
  rentTable.innerHTML = '';
  descEl.textContent = tile.description || '';

  const propState = currentRoomState?.properties?.[tileId];
  if (propState) {
    const owner = currentRoomState.players.find((p) => p.id === propState.ownerId);
    let buildStatus = '';
    if (propState.houses === 5) buildStatus = ' · 🏨 CON HOTEL';
    else if (propState.houses > 0) buildStatus = ` · ${'🏠'.repeat(propState.houses)} (${propState.houses} casa${propState.houses > 1 ? 's' : ''})`;
    ownerEl.textContent = owner
      ? `Dueño: ${owner.avatar.icon} ${owner.name}${buildStatus} ${propState.mortgaged ? '(HIPOTECADA)' : ''}`
      : '🟢 Disponible en Conservador de Bienes Raíces';
  } else {
    ownerEl.textContent = 'Casilla Pública de Santiago';
  }

  // Mostrar resumen de Precio de Mejora y Cobro Actual
  if (upgradeBox) {
    if (tile.type === 'property' || tile.type === 'station' || tile.type === 'utility') {
      upgradeBox.classList.remove('hidden');
      if (upgradeCostEl) {
        upgradeCostEl.textContent = tile.type === 'property' && tile.houseCost
          ? `${formatCLP(tile.houseCost)} c/u`
          : 'No edificable';
      }
      if (currentRentEl) {
        const activeRent = getActiveRentForTile(currentRoomState, tile);
        if (propState?.mortgaged) {
          currentRentEl.textContent = '$0 (Hipotecada)';
        } else if (activeRent) {
          currentRentEl.textContent = formatCLP(activeRent);
        } else if (tile.type === 'property') {
          currentRentEl.textContent = `${formatCLP(tile.rents[0])} (Base)`;
        } else if (tile.type === 'station') {
          currentRentEl.textContent = `${formatCLP(tile.rents[0])} (1 Est.)`;
        } else if (tile.type === 'utility') {
          currentRentEl.textContent = '4.000 × Dados';
        }
      }
    } else {
      upgradeBox.classList.add('hidden');
    }
  }

  if (tile.type === 'property') {
    const headTr = document.createElement('tr');
    headTr.style.background = '#e2e8f0';
    headTr.innerHTML = `<td style="font-weight:900; color:#1e293b;">Nivel de Edificación</td><td style="font-weight:900; color:#1e293b;">Paga quien caiga</td>`;
    rentTable.appendChild(headTr);

    const ownerId = propState?.ownerId;
    const groupTiles = boardMeta.BOARD_TILES.filter((t) => t.group === tile.group);
    const hasMonopoly =
      ownerId &&
      groupTiles.length > 0 &&
      groupTiles.every((t) => currentRoomState?.properties?.[t.id]?.ownerId === ownerId && !currentRoomState?.properties?.[t.id]?.mortgaged);

    const rows = [
      { label: 'Sitio Sin Edificar (Base)', amount: tile.rents[0], isCurrent: Boolean(ownerId && !propState.mortgaged && propState.houses === 0 && !hasMonopoly) },
      { label: 'Con Barrio Completo (Renta Doble 2×)', amount: tile.rents[0] * 2, isCurrent: Boolean(ownerId && !propState.mortgaged && propState.houses === 0 && hasMonopoly) },
      { label: 'Con 1 Casa 🏠', amount: tile.rents[1], isCurrent: Boolean(ownerId && !propState.mortgaged && propState.houses === 1) },
      { label: 'Con 2 Casas 🏠🏠', amount: tile.rents[2], isCurrent: Boolean(ownerId && !propState.mortgaged && propState.houses === 2) },
      { label: 'Con 3 Casas 🏠🏠🏠', amount: tile.rents[3], isCurrent: Boolean(ownerId && !propState.mortgaged && propState.houses === 3) },
      { label: 'Con 4 Casas 🏠🏠🏠🏠', amount: tile.rents[4], isCurrent: Boolean(ownerId && !propState.mortgaged && propState.houses === 4) },
      { label: 'Con Hotel (Torre) 🏨', amount: tile.rents[5], isCurrent: Boolean(ownerId && !propState.mortgaged && propState.houses === 5) }
    ];

    rows.forEach((r) => {
      const tr = document.createElement('tr');
      if (r.isCurrent) tr.className = 'active-rent-row';
      const activeBadge = r.isCurrent ? ' <span style="font-size:0.68rem; background:#0284c7; color:#fff; padding:1px 5px; border-radius:999px;">ACTUAL</span>' : '';
      tr.innerHTML = `<td>${r.label}${activeBadge}</td><td>${formatCLP(r.amount)}</td>`;
      rentTable.appendChild(tr);
    });

    const buildTr = document.createElement('tr');
    buildTr.style.borderTop = '2px solid #cbd5e1';
    buildTr.innerHTML = `<td><strong>🏗️ Precio Mejora (Casa o Hotel)</strong></td><td><strong>${formatCLP(tile.houseCost)} c/u</strong></td>`;
    rentTable.appendChild(buildTr);
  } else if (tile.type === 'station') {
    const headTr = document.createElement('tr');
    headTr.style.background = '#e2e8f0';
    headTr.innerHTML = `<td style="font-weight:900; color:#1e293b;">Cantidad de Estaciones</td><td style="font-weight:900; color:#1e293b;">Paga quien caiga</td>`;
    rentTable.appendChild(headTr);

    const ownerId = propState?.ownerId;
    const ownedStations = ownerId
      ? boardMeta.BOARD_TILES.filter((t) => t.type === 'station' && currentRoomState?.properties?.[t.id]?.ownerId === ownerId && !currentRoomState?.properties?.[t.id]?.mortgaged).length
      : 0;

    tile.rents.forEach((r, i) => {
      const tr = document.createElement('tr');
      const isCurrent = Boolean(ownerId && !propState.mortgaged && ownedStations === i + 1);
      if (isCurrent) tr.className = 'active-rent-row';
      const activeBadge = isCurrent ? ' <span style="font-size:0.68rem; background:#0284c7; color:#fff; padding:1px 5px; border-radius:999px;">ACTUAL</span>' : '';
      tr.innerHTML = `<td>🚇 Con ${i + 1} Estación(es) de Metro${activeBadge}</td><td>${formatCLP(r)}</td>`;
      rentTable.appendChild(tr);
    });
  } else if (tile.type === 'utility') {
    const headTr = document.createElement('tr');
    headTr.style.background = '#e2e8f0';
    headTr.innerHTML = `<td style="font-weight:900; color:#1e293b;">Servicios Poseídos</td><td style="font-weight:900; color:#1e293b;">Paga quien caiga</td>`;
    rentTable.appendChild(headTr);

    const uIcon = tile.icon || '⚡';
    [
      { label: `${uIcon} Con 1 Servicio Básico`, val: '4.000 × Dados' },
      { label: `⚡💧 Con Ambos Servicios (Luz + Agua Potable)`, val: '10.000 × Dados' }
    ].forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${row.label}</td><td>${row.val}</td>`;
      rentTable.appendChild(tr);
    });
  }

  // Mostrar controles si el jugador es el propietario
  if (propState && propState.ownerId === myPlayerId && currentRoomState?.status === 'playing') {
    actionsBox.classList.remove('hidden');
    const buildBtn = document.getElementById('btn-build-house');
    const sellBtn = document.getElementById('btn-sell-house');
    const myPlayer = currentRoomState.players.find((p) => p.id === myPlayerId);
    const isCurrentTurn = currentRoomState.players[currentRoomState.turnIndex]?.id === myPlayerId;
    const isAtThisTile = myPlayer && myPlayer.position === tile.id;
    const hasBuiltThisTurn = (currentRoomState.builtHousesCountThisTurn || 0) >= 1;

    // Verificar si tiene todas las tarjetas del barrio
    const groupTiles = tile.group ? boardMeta.BOARD_TILES.filter((t) => t.group === tile.group) : [];
    const ownsAllCards =
      groupTiles.length > 0 &&
      groupTiles.every(
        (t) => currentRoomState.properties?.[t.id]?.ownerId === myPlayerId && !currentRoomState.properties?.[t.id]?.mortgaged
      );

    if (tile.type === 'property') {
      buildBtn.style.display = propState.houses < 5 ? 'inline-flex' : 'none';
      const nextUpgradeLabel = propState.houses === 4 ? '🏨 Construir Hotel' : '🏠 Construir Casa';
      buildBtn.textContent = `${nextUpgradeLabel} (${formatCLP(tile.houseCost)})`;

      if (!ownsAllCards) {
        buildBtn.disabled = true;
        buildBtn.title = 'Debes tener todas las tarjetas del barrio para edificar mejoras';
      } else if (!isAtThisTile) {
        buildBtn.disabled = true;
        buildBtn.title = 'Solo puedes comprar 1 mejora al caer físicamente en esta casilla';
      } else if (!isCurrentTurn) {
        buildBtn.disabled = true;
        buildBtn.title = 'Solo puedes comprar mejoras durante tu turno';
      } else if (hasBuiltThisTurn) {
        buildBtn.disabled = true;
        buildBtn.title = 'Ya compraste 1 mejora en esta pasada (máx. 1 por caída)';
      } else if (myPlayer && myPlayer.money < tile.houseCost) {
        buildBtn.disabled = true;
        buildBtn.title = `Fondos insuficientes (requiere ${formatCLP(tile.houseCost)})`;
      } else {
        buildBtn.disabled = false;
        buildBtn.title = 'Comprar 1 mejora por caer en tu barrio completo';
      }
    } else {
      buildBtn.style.display = 'none';
    }
    sellBtn.style.display =
      tile.type === 'property' && propState.houses > 0 ? 'inline-flex' : 'none';
    if (tile.type === 'property' && propState.houses > 0) {
      sellBtn.textContent = `🔨 Vender Mejora (+${formatCLP(Math.floor(tile.houseCost / 2))})`;
    }
    document.getElementById('btn-toggle-mortgage').textContent = propState.mortgaged
      ? `🏦 Levantar Hipoteca (${formatCLP(Math.floor(tile.price * 0.55))})`
      : `🏦 Hipotecar (+${formatCLP(Math.floor(tile.price / 2))})`;
  } else {
    actionsBox.classList.add('hidden');
  }

  if (!dialog.open) dialog.showModal();
}
window.openPropertyModal = openPropertyModal;

function openTradeModal() {
  if (!currentRoomState || currentRoomState.status !== 'playing') return;
  const dialog = document.getElementById('trade-dialog');
  const targetSelect = document.getElementById('trade-target-player');
  const offerSelect = document.getElementById('trade-offer-tile');

  const otherPlayers = currentRoomState.players.filter((p) => p.id !== myPlayerId && !p.bankrupt);
  if (!otherPlayers.length) {
    showToast('No hay otros jugadores disponibles para negociar.');
    return;
  }

  targetSelect.innerHTML = '';
  otherPlayers.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.avatar.icon} ${p.name} (${formatCLP(p.money)})`;
    targetSelect.appendChild(opt);
  });

  // Mis propiedades para ofrecer
  offerSelect.innerHTML = '<option value="">— Ninguna propiedad —</option>';
  boardMeta.BOARD_TILES.forEach((t) => {
    if (currentRoomState.properties[t.id]?.ownerId === myPlayerId && !currentRoomState.properties[t.id]?. houses) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (${formatCLP(t.price)})`;
      offerSelect.appendChild(opt);
    }
  });

  populateTradeTargetProperties();
  if (!dialog.open) dialog.showModal();
}
window.openPropertyModal = openPropertyModal;

function populateTradeTargetProperties() {
  const targetId = document.getElementById('trade-target-player').value;
  const reqSelect = document.getElementById('trade-request-tile');
  reqSelect.innerHTML = '<option value="">— Ninguna propiedad —</option>';
  if (!targetId || !currentRoomState) return;

  boardMeta.BOARD_TILES.forEach((t) => {
    if (currentRoomState.properties[t.id]?.ownerId === targetId && !currentRoomState.properties[t.id]?.houses) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (${formatCLP(t.price)})`;
      reqSelect.appendChild(opt);
    }
  });
}

window.addEventListener('DOMContentLoaded', initApp);
