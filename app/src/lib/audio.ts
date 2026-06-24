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
      this.init();
      if (!this.ctx) return;

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
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  playError() {
    try {
      this.init();
      if (!this.ctx) return;

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
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }
}

export const audioService = new AudioService();
