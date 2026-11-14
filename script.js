
const $ = (id) => document.getElementById(id);

const video = $("video");
const canvas = $("canvas");
const ctx = canvas.getContext("2d");

const startBtn = $("startBtn");
const stopBtn = $("stopBtn");
const placeholder = $("placeholder");
const cameraFrame = $("cameraFrame");

const objectsList = $("objectsList");
const objectCount = $("objectCount");

const topStatus = $("topStatus");
const liveBadge = $("liveBadge");

const engineStatus = $("engineStatus");
const engineDescription = $("engineDescription");
const engineProgress = $("engineProgress");
const enginePercent = $("enginePercent");

const cameraInfo = $("cameraInfo");
const fpsInfo = $("fpsInfo");
const scanLine = $("scanLine");
const voiceStatus = $("voiceStatus");

const testVoice = $("testVoice");
const toast = $("toast");

let model = null;
let stream = null;
let running = false;
let analyzing = false;

let detectionTimer = null;
let toastTimer = null;

let stableObjects = new Map();
let announcedObjects = new Map();

let lastDetectionTime = 0;
let fps = 0;
let frameCounter = 0;
let fpsStart = performance.now();

const LABELS = {
  person: "شخص",
  bicycle: "دراجة",
  car: "سيارة",
  motorcycle: "دراجة نارية",
  airplane: "طائرة",
  bus: "أتوبيس",
  train: "قطار",
  truck: "شاحنة",
  boat: "قارب",
  traffic_light: "إشارة مرور",
  fire_hydrant: "طفاية حريق",
  stop_sign: "علامة توقف",
  parking_meter: "عداد انتظار",
  bench: "مقعد",
  bird: "طائر",
  cat: "قطة",
  dog: "كلب",
  horse: "حصان",
  sheep: "خروف",
  cow: "بقرة",
  elephant: "فيل",
  bear: "دب",
  zebra: "حمار وحشي",
  giraffe: "زرافة",
  backpack: "حقيبة ظهر",
  umbrella: "مظلة",
  handbag: "حقيبة",
  tie: "ربطة عنق",
  suitcase: "حقيبة سفر",
  frisbee: "فريسبي",
  skis: "زلاجات",
  snowboard: "لوح تزلج",
  sports_ball: "كرة",
  kite: "طائرة ورقية",
  baseball_bat: "مضرب بيسبول",
  baseball_glove: "قفاز",
  skateboard: "لوح تزلج",
  surfboard: "لوح ركوب الأمواج",
  tennis_racket: "مضرب تنس",
  bottle: "زجاجة",
  wine_glass: "كأس",
  cup: "كوب",
  fork: "شوكة",
  knife: "سكين مطبخ",
  spoon: "ملعقة",
  bowl: "وعاء",
  banana: "موزة",
  apple: "تفاحة",
  sandwich: "ساندويتش",
  orange: "برتقالة",
  broccoli: "بروكلي",
  carrot: "جزرة",
  hot_dog: "هوت دوج",
  pizza: "بيتزا",
  donut: "دونات",
  cake: "كعكة",
  chair: "كرسي",
  couch: "أريكة",
  potted_plant: "نبات",
  bed: "سرير",
  dining_table: "طاولة",
  toilet: "مرحاض",
  tv: "تلفزيون",
  laptop: "لابتوب",
  mouse: "فأرة كمبيوتر",
  remote: "ريموت",
  keyboard: "لوحة مفاتيح",
  cell_phone: "هاتف",
  microwave: "ميكروويف",
  oven: "فرن",
  toaster: "محمصة",
  sink: "حوض",
  refrigerator: "ثلاجة",
  book: "كتاب",
  clock: "ساعة",
  vase: "مزهرية",
  scissors: "مقص",
  teddy_bear: "دبدوب",
  hair_drier: "مجفف شعر",
  toothbrush: "فرشاة أسنان"
};

const ICONS = {
  person: "◉",
  car: "▰",
  chair: "▤",
  bottle: "◒",
  dog: "♧",
  cat: "♧",
  cell_phone: "▯",
  laptop: "▱",
  book: "▤",
  bicycle: "⌁",
  tv: "▣",
  default: "◇"
};

function arabicLabel(label) {
  return LABELS[label] || "شيء غير معروف";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

function updateProgress(value, text) {
  engineProgress.style.width = value + "%";
  enginePercent.textContent = value + "%";

  if (text) {
    engineStatus.textContent = text;
  }
}

function getArabicVoice() {
  if (!("speechSynthesis" in window)) {
    return null;
  }

  const voices = speechSynthesis.getVoices();

  return (
    voices.find(v => v.lang.toLowerCase() === "ar-eg") ||
    voices.find(v => v.lang.toLowerCase().startsWith("ar")) ||
    null
  );
}

function speakArabic(text) {
  if (!("speechSynthesis" in window)) {
    voiceStatus.textContent = "غير مدعوم";
    return false;
  }

  const voice = getArabicVoice();

  if (!voice) {
    voiceStatus.textContent = "لا يوجد صوت عربي";
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.88;
  utterance.pitch = 1;
  utterance.volume = 1;

  speechSynthesis.speak(utterance);

  voiceStatus.textContent = "ينطق بالعربية";

  return true;
}

// تحميل أصوات الجهاز
if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = () => {
    voiceStatus.textContent = getArabicVoice()
      ? "صوت عربي جاهز"
      : "لا يوجد صوت عربي";
  };
}

function renderObjects(objects) {
  objectCount.textContent = objects.length;

  if (!objects.length) {
    objectsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-symbol">⌁</span>
        <p>لم يتم اكتشاف أشياء واضحة حاليًا</p>
      </div>
    `;
    return;
  }

  objectsList.innerHTML = objects.map(obj => {
    const label = arabicLabel(obj.class);
    const icon = ICONS[obj.class] || ICONS.default;

    return `
      <div class="object-item">
        <div class="object-icon">${icon}</div>

        <div class="object-info">
          <strong>${label}</strong>
          <small>تم اكتشافه بواسطة أفق</small>
        </div>

        <div class="object-confidence">
          ${Math.round(obj.score * 100)}%
        </div>
      </div>
    `;
  }).join("");
}

function drawObjects(objects) {
  if (!video.videoWidth || !video.videoHeight) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  objects.forEach(obj => {
    const [x, y, width, height] = obj.bbox;

    ctx.strokeStyle = "#35e6a5";
    ctx.lineWidth = Math.max(2, canvas.width / 450);
    ctx.strokeRect(x, y, width, height);

    const label = arabicLabel(obj.class);

    ctx.font = `bold ${Math.max(14, canvas.width / 45)}px Cairo, Arial`;
    const textWidth = ctx.measureText(label).width;

    const labelHeight = Math.max(24, canvas.width / 28);

    ctx.fillStyle = "#35e6a5";
    ctx.fillRect(
      x,
      Math.max(0, y - labelHeight),
      textWidth + 18,
      labelHeight
    );

    ctx.fillStyle = "#062219";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    ctx.fillText(
      label,
      x + textWidth + 10,
      Math.max(labelHeight / 2, y - labelHeight / 2)
    );
  });
}

// تثبيت النتائج المتكررة
function stabilize(predictions) {
  const now = Date.now();
  const current = new Map();

  predictions.forEach(obj => {
    const key = obj.class;

    if (!current.has(key)) {
      current.set(key, {
        class: obj.class,
        score: obj.score,
        bbox: obj.bbox,
        frames: 1,
        lastSeen: now
      });
    } else {
      const existing = current.get(key);

      existing.frames++;
      existing.score = Math.max(existing.score, obj.score);
      existing.bbox = obj.bbox;
    }
  });

  current.forEach((obj, key) => {
    const previous = stableObjects.get(key);

    if (previous) {
      obj.frames += previous.frames;
    }

    stableObjects.set(key, obj);
  });

  // حذف الأشياء التي اختفت
  for (const [key, obj] of stableObjects) {
    if (now - obj.lastSeen > 1800) {
      stableObjects.delete(key);
      announcedObjects.delete(key);
    }
  }

  return [...stableObjects.values()]
    .filter(obj => obj.frames >= 2)
    .sort((a, b) => b.score - a.score);
}

function announceObjects(objects) {
  const now = Date.now();

  const fresh = objects.filter(obj => {
    const last = announcedObjects.get(obj.class) || 0;

    if (now - last > 12000) {
      announcedObjects.set(obj.class, now);
      return true;
    }

    return false;
  });

  if (!fresh.length) return;

  const labels = fresh
    .slice(0, 3)
    .map(obj => arabicLabel(obj.class));

  let message;

  if (labels.length === 1) {
    message = "تم اكتشاف " + labels[0];
  } else {
    message = "تم اكتشاف " + labels.join(" و ");
  }

  speakArabic(message);
}

async function analyze() {
  if (!running || analyzing || !model) return;

  if (video.readyState < 2) {
    detectionTimer = setTimeout(analyze, 200);
    return;
  }

  analyzing = true;

  try {
    const predictions = await model.detect(video, 15, 0.55);

    if (!running) return;

    const filtered = predictions.filter(obj => obj.score >= 0.55);

    const objects = stabilize(filtered);

    drawObjects(objects);
    renderObjects(objects);
    announceObjects(objects);

    frameCounter++;

    const now = performance.now();

    if (now - fpsStart >= 1000) {
      fps = frameCounter;
      frameCounter = 0;
      fpsStart = now;

      fpsInfo.textContent = fps + " FPS";
    }

    cameraInfo.textContent = "LIVE ANALYSIS";
  } catch (error) {
    console.error("Detection error:", error);
  } finally {
    analyzing = false;

    if (running) {
      detectionTimer = setTimeout(analyze, 250);
    }
  }
}

async function startCamera() {
  if (running) return;

  startBtn.disabled = true;
  engineDescription.textContent = "جاري تحميل نموذج الذكاء...";
  updateProgress(20, "تحميل نموذج الرؤية");

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("camera-not-supported");
    }

    // تحميل النموذج الأقوى نسبيًا
    if (!model) {
      model = await cocoSsd.load({
        base: "mobilenet_v2"
      });
    }

    updateProgress(60, "النموذج جاهز");

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.srcObject = stream;

    await new Promise(resolve => {
      video.onloadedmetadata = resolve;
    });

    await video.play();

    running = true;

    startBtn.disabled = true;
    stopBtn.disabled = false;

    placeholder.style.display = "none";
    video.style.display = "block";

    liveBadge.classList.add("active");
    liveBadge.innerHTML = "<span></span> تحليل مباشر";

    topStatus.textContent = "الرؤية تعمل";
    topStatus.parentElement.classList.add("active");

    scanLine.classList.add("active");

    engineDescription.textContent =
      "الكاميرا تعمل والنموذج يحلل الأشياء.";

    updateProgress(100, "محرك الرؤية نشط");

    cameraInfo.textContent = "LIVE CAMERA";

    stableObjects.clear();
    announcedObjects.clear();

    fpsStart = performance.now();

    showToast("أفق بدأ تحليل الكاميرا");

    analyze();

  } catch (error) {
    console.error(error);

    startBtn.disabled = false;

    if (error.message === "camera-not-supported") {
      showToast("المتصفح لا يدعم الكاميرا");
    } else if (error.name === "NotAllowedError") {
      showToast("اسمح للموقع باستخدام الكاميرا");
    } else {
      showToast("حدث خطأ أثناء تشغيل أفق");
    }

    updateProgress(0, "تعذر تشغيل المحرك");

    engineDescription.textContent =
      "راجع اتصال الإنترنت وصلاحية الكاميرا.";

  }
}

function stopCamera() {
  running = false;

  clearTimeout(detectionTimer);

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  video.srcObject = null;
  video.style.display = "none";

  placeholder.style.display = "flex";

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  startBtn.disabled = false;
  stopBtn.disabled = true;

  liveBadge.classList.remove("active");
  liveBadge.innerHTML = "<span></span> غير نشط";

  topStatus.textContent = "جاهز للبدء";
  topStatus.parentElement.classList.remove("active");

  scanLine.classList.remove("active");

  cameraInfo.textContent = "CAMERA STANDBY";
  fpsInfo.textContent = "-- FPS";

  engineDescription.textContent =
    "ابدأ الرؤية لتفعيل تحليل الأشياء.";

  updateProgress(0, "المحرك في وضع الاستعداد");

  objectsList.innerHTML = `
    <div class="empty-state">
      <span class="empty-symbol">⌁</span>
      <p>الأشياء المكتشفة هتظهر هنا</p>
    </div>
  `;

  objectCount.textContent = "0";

  stableObjects.clear();
  announcedObjects.clear();

  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);

testVoice.addEventListener("click", () => {
  if (!getArabicVoice()) {
    showToast("لا يوجد صوت عربي مثبت على الجهاز");
    voiceStatus.textContent = "لا يوجد صوت عربي";
    return;
  }

  speechSynthesis.cancel();
  speakArabic("مرحبًا، أنا أفق. نظام مساعد للرؤية.");
});

window.addEventListener("beforeunload", stopCamera);
