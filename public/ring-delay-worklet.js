/* Arseradio sync ring buffer (FR-6): holds up to 90s of the incoming room
 * mix; playback reads at a configurable offset behind the live edge.
 * Mono float buffer: 48000 * 90 * 4 bytes ≈ 17MB (ARCHITECTURE estimate).
 *
 * Messages in:  { type: "setDelay", seconds }
 * Messages out: { type: "state", availableSeconds, effectiveDelaySeconds }
 *
 * If the requested delay exceeds what's buffered, the effective delay
 * clamps to the available depth and grows toward the request as the
 * buffer fills (FR-6.4).
 */
class RingDelayProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = sampleRate * 90;
    this.buffer = new Float32Array(this.capacity);
    this.writeIndex = 0;
    this.totalWritten = 0;
    this.delaySamples = 0;
    this.blocksSinceReport = 0;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === "setDelay") {
        const s = Math.max(0, Math.min(90, Number(e.data.seconds) || 0));
        this.delaySamples = Math.round(s * sampleRate);
      }
      if (e.data && e.data.type === "reset") {
        // forget the buffered timeline (sent on stop-listening so a later
        // resume can never replay stale audio); depth regrows from zero
        this.totalWritten = 0;
        this.writeIndex = 0;
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const n = output[0].length;
    const input = inputs[0] && inputs[0][0] ? inputs[0][0] : null;

    // always advance the timeline; gaps in the source become silence so
    // the offset math stays truthful
    for (let i = 0; i < n; i++) {
      this.buffer[(this.writeIndex + i) % this.capacity] = input ? input[i] : 0;
    }
    this.writeIndex = (this.writeIndex + n) % this.capacity;
    this.totalWritten += n;

    const available = Math.min(this.totalWritten, this.capacity);
    const effective = Math.min(this.delaySamples, Math.max(0, available - n));

    let read = this.writeIndex - n - effective;
    read = ((read % this.capacity) + this.capacity) % this.capacity;
    for (let i = 0; i < n; i++) {
      const sample = this.buffer[(read + i) % this.capacity];
      for (let ch = 0; ch < output.length; ch++) output[ch][i] = sample;
    }

    // ~4 reports per second at 128-sample blocks
    if (++this.blocksSinceReport >= 94) {
      this.blocksSinceReport = 0;
      this.port.postMessage({
        type: "state",
        availableSeconds: available / sampleRate,
        effectiveDelaySeconds: effective / sampleRate,
      });
    }
    return true;
  }
}

registerProcessor("ring-delay", RingDelayProcessor);
