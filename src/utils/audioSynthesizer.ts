/**
 * Web Audio API synthesizer for ambient background music, speech preview and transition sounds
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicOscillators: OscillatorNode[] = [];
  private musicGain: GainNode | null = null;
  private isPlayingMusic = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playClick() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // Audio context might fail before user gesture
    }
  }

  public playSuccess() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, this.ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
    } catch {
      // Audio context error ignore
    }
  }

  public playWhoosh() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const bufferSize = this.ctx.sampleRate * 0.25;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.12);
      filter.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.25);
      filter.Q.value = 3;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      whiteNoise.start();
    } catch {
      // Ignore
    }
  }

  public startBackgroundAmbience(volume = 0.15) {
    if (this.isPlayingMusic) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      this.isPlayingMusic = true;

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(volume * 0.2, this.ctx.currentTime);
      this.musicGain.connect(this.ctx.destination);

      // Low soothing ambient pad chord (D minor 9: D, F, A, C, E)
      const freqs = [73.42, 110.0, 146.83, 174.61, 220.0];
      this.musicOscillators = freqs.map((f, i) => {
        const osc = this.ctx!.createOscillator();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, this.ctx!.currentTime);

        // subtle vibrato
        const lfo = this.ctx!.createOscillator();
        lfo.frequency.value = 0.2 + i * 0.05;
        const lfoGain = this.ctx!.createGain();
        lfoGain.gain.value = 1.2;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        const oscGain = this.ctx!.createGain();
        oscGain.gain.value = 0.1 / (i + 1);
        osc.connect(oscGain);
        oscGain.connect(this.musicGain!);

        osc.start();
        return osc;
      });
    } catch {
      // Ignore
    }
  }

  public setMusicVolume(volume: number) {
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(volume * 0.25, this.ctx.currentTime, 0.1);
    }
  }

  public stopBackgroundAmbience() {
    if (!this.isPlayingMusic) return;
    this.musicOscillators.forEach(osc => {
      try {
        osc.stop();
      } catch {
        // Ignore
      }
    });
    this.musicOscillators = [];
    this.isPlayingMusic = false;
  }

  public speakText(text: string, rate = 1.0, onEnd?: () => void) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.lang = 'ru-RU';
      
      const voices = window.speechSynthesis.getVoices();
      const ruVoice = voices.find(v => v.lang.startsWith('ru')) || voices[0];
      if (ruVoice) utterance.voice = ruVoice;
      
      if (onEnd) {
        utterance.onend = onEnd;
      }
      window.speechSynthesis.speak(utterance);
    }
  }

  public stopSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const soundEngine = new SoundEngine();
