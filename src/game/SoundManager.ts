export class SoundManager {
  ctx: AudioContext | null = null;
  masterVolume: GainNode | null = null;
  musicVolume: GainNode | null = null;
  sfxVolume: GainNode | null = null;

  isMusicPlaying = false;
  isSfxEnabled = true;

  // Lofi chords sequencer state
  sequencerTimer: any = null;
  currentChordIndex = 0;

  // Chord Progression (Fmaj7 - Em7 - Dm7 - Cmaj7) in MIDI notes
  chords = [
    [53, 57, 60, 64], // Fmaj7 (F3, A3, C4, E4)
    [52, 55, 59, 62], // Em7 (E3, G3, B3, D4)
    [50, 53, 57, 60], // Dm7 (D3, F3, A3, C4)
    [48, 52, 55, 59], // Cmaj7 (C3, E3, G3, B3)
  ];

  constructor() {}

  init() {
    if (this.ctx) return;
    
    // Create AudioContext on user interaction
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Setup node routing
    this.masterVolume = this.ctx.createGain();
    this.masterVolume.gain.setValueAtTime(0.8, this.ctx.currentTime);
    this.masterVolume.connect(this.ctx.destination);

    this.musicVolume = this.ctx.createGain();
    this.musicVolume.gain.setValueAtTime(0.15, this.ctx.currentTime); // Soft background music
    this.musicVolume.connect(this.masterVolume);

    this.sfxVolume = this.ctx.createGain();
    this.sfxVolume.gain.setValueAtTime(0.5, this.ctx.currentTime);
    this.sfxVolume.connect(this.masterVolume);

    // Create a continuous vinyl-crackle/rain noise buffer for lofi ambiance
    this.startAmbiance();
  }

  // Generate continuous background vinyl hum/rain
  startAmbiance() {
    if (!this.ctx || !this.musicVolume) return;

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Populate buffer with pink noise
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.04; // Adjust volume
      b6 = white * 0.115926;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Filter to make crackle soft
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.5, this.ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(this.musicVolume);
    noiseSource.start();
  }

  toggleMusic() {
    this.init();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }

    this.isMusicPlaying = !this.isMusicPlaying;
    if (this.isMusicPlaying) {
      this.playSequencer();
    } else {
      this.stopSequencer();
    }
    return this.isMusicPlaying;
  }

  toggleSfx() {
    this.isSfxEnabled = !this.isSfxEnabled;
    return this.isSfxEnabled;
  }

  // Play MIDI note helper
  playSynthNote(midiNote: number, startTime: number, duration: number, volume: number) {
    if (!this.ctx || !this.musicVolume) return;

    const freq = Math.pow(2, (midiNote - 69) / 12) * 440;

    // Create main oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle'; // Soft low-poly lofi vibe
    osc.frequency.setValueAtTime(freq, startTime);

    // Create sub oscillator for warm depth
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq / 2, startTime);

    // Envelope
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, startTime);
    // Slow Attack
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.4);
    // Smooth Decay/Sustain
    gainNode.gain.setValueAtTime(volume, startTime + duration - 0.5);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    // Soft low pass filter to cut off sharp frequencies
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, startTime); // Muffled, cozy sound

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.musicVolume);

    osc.start(startTime);
    subOsc.start(startTime);
    osc.stop(startTime + duration);
    subOsc.stop(startTime + duration);
  }

  // Procedural lofi chime melody note
  playChimeMelody(chordNotes: number[], startTime: number) {
    if (!this.ctx || !this.musicVolume) return;

    // Choose a note from pentatonic chord extension
    const baseNote = chordNotes[Math.floor(Math.random() * chordNotes.length)];
    const chimeMidi = baseNote + 12; // Octave up

    const freq = Math.pow(2, (chimeMidi - 69) / 12) * 440;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.08, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.8);

    const delay = this.ctx.createDelay();
    delay.delayTime.setValueAtTime(0.3, startTime);
    const feedback = this.ctx.createGain();
    feedback.gain.setValueAtTime(0.4, startTime);

    // Echo effect routing
    osc.connect(gain);
    gain.connect(this.musicVolume);

    // Feedback Loop
    gain.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(this.musicVolume);

    osc.start(startTime);
    osc.stop(startTime + 2.0);
  }

  // Play sequencer chord loop
  playSequencer() {
    if (!this.ctx) return;

    const playChordStep = () => {
      const now = this.ctx!.currentTime;
      const duration = 4.0; // Chord holds for 4s
      const chord = this.chords[this.currentChordIndex];

      // Play chord voices
      chord.forEach((note) => {
        this.playSynthNote(note, now, duration, 0.25);
      });

      // Scatter a couple of soft chime melody notes in the chord duration
      this.playChimeMelody(chord, now + 0.5);
      if (Math.random() > 0.4) {
        this.playChimeMelody(chord, now + 2.0);
      }

      this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;

      // Repeat after 4 seconds
      this.sequencerTimer = setTimeout(playChordStep, 4000);
    };

    playChordStep();
  }

  stopSequencer() {
    if (this.sequencerTimer) {
      clearTimeout(this.sequencerTimer);
      this.sequencerTimer = null;
    }
  }

  // 1. Build Placed SFX (Pleasant woody pop)
  playBuildSFX() {
    this.init();
    if (!this.isSfxEnabled || !this.ctx || !this.sfxVolume) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    // Ascending arpeggio
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxVolume);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  // 2. Demolish/Bulldozer SFX (Soft rumble rubble)
  playDemolishSFX() {
    this.init();
    if (!this.isSfxEnabled || !this.ctx || !this.sfxVolume) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    // Descending wobble
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.3);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolume);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  // 3. UI Button Click SFX
  playClickSFX() {
    this.init();
    if (!this.isSfxEnabled || !this.ctx || !this.sfxVolume) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxVolume);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // 4. Alert Warning Hum
  playWarningSFX() {
    this.init();
    if (!this.isSfxEnabled || !this.ctx || !this.sfxVolume) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(220, now);
    osc2.frequency.setValueAtTime(223, now); // Detuned for chorus effect

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxVolume);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  }
}
