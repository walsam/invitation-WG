/* Sound: a double knock on the tap, the door creaking open, then soft Andalusian music that loops.
   Browsers only allow sound after a gesture, so everything is unlocked by the guest's tap on the door.
   Credits — knock: "180604 Door knocks, brass knocker, foley" by TRP (freesound.org/s/570995, CC0);
   creak: "Large creaky door" by Throndronis (freesound.org/s/799523, CC0);
   music: "Orchestra-Tetouan-Asmir-07.wav" (oud solo, Orchestra Tetouan-Asmir, Tetouan 2013) by xserra,
   freesound.org/s/182730, CC BY 4.0 (creativecommons.org/licenses/by/4.0) — trimmed, filtered, looped, normalised. */
const InviteAudio = (() => {
  const FILES = {
    knock: "assets/audio/knock.m4a?v=b3f114b9",
    creak: "assets/audio/creak.m4a?v=17269bae",
    music: "assets/audio/music.m4a?v=dcc89213",
  };
  const MUSIC_VOLUME = 0.4;
  const STORAGE_KEY = "invitation-sound-muted";
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const OfflineContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  let context = null;
  let master = null;
  let musicSource = null;
  let musicGain = null;
  let muted = false;
  try { muted = localStorage.getItem(STORAGE_KEY) === "1"; } catch { /* private mode */ }

  const downloads = {};
  const buffers = {};
  const download = (name) => (downloads[name] ||= fetch(FILES[name]).then((response) => {
    if (!response.ok) throw new Error(`${FILES[name]}: ${response.status}`);
    return response.arrayBuffer();
  }));
  // Decoding needs no gesture: an offline context decodes before the tap, so the knock is instant.
  let decoder = null;
  const decoderContext = () => context || (decoder ||= OfflineContextClass ? new OfflineContextClass(2, 1, 44100) : null);

  // Callback form of decodeAudioData works on every Safari version.
  const decode = (name) => (buffers[name] ||= download(name).then((data) =>
    new Promise((resolve, reject) => {
      const decoding = decoderContext();
      if (!decoding) return reject(new Error("no audio"));
      decoding.decodeAudioData(data.slice(0), resolve, reject);
    })));

  // The effects are small: fetch and decode them now.
  if (AudioContextClass) ["knock", "creak"].forEach((name) => decode(name).catch(() => { delete buffers[name]; }));

  /* Must run inside the tap handler. */
  function unlock() {
    if (!AudioContextClass) return false;
    if (!context) {
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(context.destination);
    }
    if (context.state === "suspended") context.resume();
    return true;
  }

  async function play(name, volume = 1) {
    if (!unlock()) return;
    try {
      const buffer = await decode(name);
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain).connect(master);
      source.start();
    } catch { /* sound is a nicety: never break the invitation */ }
  }

  async function startMusic() {
    if (!unlock() || musicSource) return;
    try {
      const buffer = await decode("music");
      if (musicSource || !document.body.classList.contains("is-opening")) return;
      const now = context.currentTime;
      musicGain = context.createGain();
      musicGain.gain.setValueAtTime(0, now);
      musicGain.gain.linearRampToValueAtTime(MUSIC_VOLUME, now + 3);
      musicGain.connect(master);
      musicSource = context.createBufferSource();
      musicSource.buffer = buffer;
      musicSource.loop = true;
      musicSource.connect(musicGain);
      musicSource.start(now);
    } catch { /* keep silent */ }
  }

  function stopMusic() {
    if (!musicSource) return;
    const now = context.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(0, now + 1);
    musicSource.stop(now + 1.05);
    musicSource = null;
    musicGain = null;
  }

  function setMuted(value) {
    muted = value;
    try { localStorage.setItem(STORAGE_KEY, value ? "1" : "0"); } catch { /* private mode */ }
    if (!master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(value ? 0 : 1, now + 0.3);
  }

  // Pause everything while the guest is in another app or tab.
  document.addEventListener("visibilitychange", () => {
    if (!context) return;
    if (document.hidden) context.suspend();
    else context.resume();
  });

  return {
    unlock,
    play,
    startMusic,
    stopMusic,
    prefetchMusic: () => download("music").catch(() => {}),
    setMuted,
    get muted() { return muted; },
  };
})();
