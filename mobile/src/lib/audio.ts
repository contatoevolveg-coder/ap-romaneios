class AudioService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playSuccess() {
    try {
      // Audio
      this.init();
      if (this.ctx) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, this.ctx.currentTime); // High pitch beep

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.08);
      }

      // Vibration (30ms single pulse for success)
      if ('vibrate' in navigator) {
        navigator.vibrate(30);
      }
    } catch (e) {
      console.warn('Success feedback failed', e);
    }
  }

  playError() {
    try {
      // Audio
      this.init();
      if (this.ctx) {
        const playBuzz = (delay: number) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.type = 'sawtooth'; // Buzzer sound
          osc.frequency.setValueAtTime(160, this.ctx.currentTime + delay);

          gain.gain.setValueAtTime(0.12, this.ctx.currentTime + delay);
          gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + delay + 0.12);

          osc.start(this.ctx.currentTime + delay);
          osc.stop(this.ctx.currentTime + delay + 0.12);
        };

        playBuzz(0);
        playBuzz(0.18); // Double buzz
      }

      // Vibration (Double vibration: vibrate 100ms, pause 100ms, vibrate 100ms)
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 100, 100]);
      }
    } catch (e) {
      console.warn('Error feedback failed', e);
    }
  }
}

export const audioService = new AudioService();
export default audioService;
