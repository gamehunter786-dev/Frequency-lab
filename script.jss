
/* ==========================================
   1. FREQUENCY LAB - MAIN SETTINGS
========================================== */

let audioContext = null;
let oscillator = null;
let gainNode = null;

let micContext = null;
let micStream = null;
let analyser = null;
let animationId = null;


/* ==========================================
   2. HTML ELEMENTS
========================================== */

const frequencyInput =
  document.getElementById("frequencyInput");

const frequencySlider =
  document.getElementById("frequencySlider");

const frequencyDisplay =
  document.getElementById("frequencyDisplay");

const volumeSlider =
  document.getElementById("volumeSlider");

const generatorStatus =
  document.getElementById("generatorStatus");

const detectedFrequency =
  document.getElementById("detectedFrequency");

const checkerStatus =
  document.getElementById("checkerStatus");

const canvas =
  document.getElementById("visualizer");

const ctx = canvas.getContext("2d");


/* ==========================================
   3. FREQUENCY INPUT
========================================== */

function updateFrequency(value) {

  let frequency = Number(value);

  if (!Number.isFinite(frequency)) return;

  frequency = Math.max(20, Math.min(20000, frequency));

  frequencyInput.value = frequency;
  frequencySlider.value = frequency;

  frequencyDisplay.textContent = frequency;

  if (oscillator && audioContext) {

    oscillator.frequency.setTargetAtTime(
      frequency,
      audioContext.currentTime,
      0.02
    );

  }
}


/* ==========================================
   4. FREQUENCY SLIDER
========================================== */

frequencyInput.addEventListener("input", () => {

  updateFrequency(frequencyInput.value);

});

frequencySlider.addEventListener("input", () => {

  updateFrequency(frequencySlider.value);

});


/* ==========================================
   5. VOLUME CONTROL
========================================== */

function updateVolume() {

  if (!gainNode || !audioContext) return;

  const volume =
    Number(volumeSlider.value) / 100 * 0.10;

  gainNode.gain.setTargetAtTime(
    volume,
    audioContext.currentTime,
    0.03
  );

}

volumeSlider.addEventListener("input", updateVolume);


/* ==========================================
   6. START FREQUENCY GENERATOR
========================================== */

document.getElementById("playBtn").onclick =
async function () {

  if (oscillator) return;

  try {

    audioContext = audioContext ||
      new (window.AudioContext ||
      window.webkitAudioContext)();

    await audioContext.resume();

    oscillator = audioContext.createOscillator();

    gainNode = audioContext.createGain();

    oscillator.type = "sine";

    oscillator.frequency.value =
      Number(frequencyInput.value);

    gainNode.gain.value =
      Number(volumeSlider.value) / 100 * 0.10;

    oscillator.connect(gainNode);

    gainNode.connect(audioContext.destination);

    oscillator.start();

    generatorStatus.textContent =
      "Generator Running";

  } catch (error) {

    generatorStatus.textContent =
      "Audio Error: " + error.message;

    oscillator = null;
    gainNode = null;

  }

};


/* ==========================================
   7. STOP FREQUENCY GENERATOR
========================================== */

document.getElementById("stopBtn").onclick =
function () {

  if (oscillator) {

    oscillator.stop();

    oscillator.disconnect();

    oscillator = null;

  }

  if (gainNode) {

    gainNode.disconnect();

    gainNode = null;

  }

  generatorStatus.textContent =
    "Generator Stopped";

};


/* ==========================================
   8. MICROPHONE CHECKER
========================================== */

document.getElementById("micStart").onclick =
async function () {

  if (micStream) return;

  if (!navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia) {

    checkerStatus.textContent =
      "Microphone unavailable. Open HTTPS in Chrome.";

    return;

  }

  try {

    micStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });

    micContext = new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

    await micContext.resume();

    analyser = micContext.createAnalyser();

    analyser.fftSize = 16384;

    analyser.smoothingTimeConstant = 0.7;

    const microphone =
      micContext.createMediaStreamSource(micStream);

    microphone.connect(analyser);

    checkerStatus.textContent =
      "Microphone Active - Listening";

    detectFrequency();

  } catch (error) {

    checkerStatus.textContent =
      "Microphone Error: " + error.message;

    stopMicrophone();

  }

};


/* ==========================================
   9. DETECT DOMINANT FREQUENCY
========================================== */

function detectFrequency() {

  if (!analyser || !micContext) return;

  const data = new Float32Array(
    analyser.frequencyBinCount
  );

  analyser.getFloatFrequencyData(data);

  let maxValue = -Infinity;
  let maxIndex = -1;

  for (let i = 1; i < data.length; i++) {

    const frequency =
      i * micContext.sampleRate / analyser.fftSize;

    if (frequency < 20 || frequency > 20000) {
      continue;
    }

    if (data[i] > maxValue) {

      maxValue = data[i];

      maxIndex = i;

    }

  }

  let frequency = 0;

  // Ignore very quiet background noise.
  if (maxIndex > 0 && maxValue > -65) {

    const left = data[maxIndex - 1];
    const center = data[maxIndex];
    const right = data[maxIndex + 1];

    const denominator =
      left - 2 * center + right;

    let correction = 0;

    if (Number.isFinite(denominator) &&
        Math.abs(denominator) > 0.0001) {

      correction =
        0.5 * (left - right) / denominator;

    }

    const refinedIndex =
      maxIndex + Math.max(-0.5, Math.min(0.5, correction));

    frequency =
      refinedIndex * micContext.sampleRate /
      analyser.fftSize;

  }

  detectedFrequency.textContent =
    frequency > 0 ? Math.round(frequency) : "0";

  drawVisualizer();

  animationId =
    requestAnimationFrame(detectFrequency);

}


/* ==========================================
   10. AUDIO VISUALIZER
========================================== */

function drawVisualizer() {

  if (!analyser) return;

  const width = canvas.clientWidth;

  const height = canvas.clientHeight;

  const dpr = window.devicePixelRatio || 1;

  if (canvas.width !== width * dpr ||
      canvas.height !== height * dpr) {

    canvas.width = width * dpr;

    canvas.height = height * dpr;

  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const data = new Uint8Array(analyser.fftSize);

  analyser.getByteTimeDomainData(data);

  ctx.clearRect(0, 0, width, height);

  ctx.beginPath();

  ctx.strokeStyle = "#00eaff";

  ctx.lineWidth = 2;

  const sliceWidth = width / data.length;

  let x = 0;

  for (let i = 0; i < data.length; i++) {

    const v = data[i] / 128;

    const y = v * height / 2;

    if (i === 0) {

      ctx.moveTo(x, y);

    } else {

      ctx.lineTo(x, y);

    }

    x += sliceWidth;

  }

  ctx.stroke();

}


/* ==========================================
   11. STOP MICROPHONE
========================================== */

document.getElementById("micStop").onclick =
function () {

  stopMicrophone();

};


function stopMicrophone() {

  cancelAnimationFrame(animationId);

  animationId = null;

  if (micStream) {

    micStream.getTracks().forEach(track => {
      track.stop();
    });

    micStream = null;

  }

  if (micContext) {

    micContext.close();

    micContext = null;

  }

  analyser = null;

  detectedFrequency.textContent = "0";

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  checkerStatus.textContent =
    "Microphone Inactive";

}


/* ==========================================
   12. INITIAL SETTINGS
========================================== */

updateFrequency(440);

generatorStatus.textContent =
  "Generator Ready";

checkerStatus.textContent =
  "Microphone Inactive";

console.log("FREQUENCY LAB INITIALIZED");
