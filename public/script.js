// ===== Global =====
let model;
const THRESHOLD = 70; // percent

const globalStatus = () => document.getElementById('globalStatus');
const galleryEl = () => document.getElementById('gallery');
const dropZone = () => document.getElementById('dropZone');
const fileInput = () => document.getElementById('imageUpload');

// ===== Load TFJS model =====
async function loadModel() {
  try {
    model = await tf.loadLayersModel('tfjs_model/model.json');
    const box = globalStatus();
    box.textContent = 'Model loaded! Ready to classify.';
    box.className = 'result-box success';
  } catch (e) {
    console.error(e);
    const box = globalStatus();
    box.textContent = 'Error loading model.';
    box.className = 'result-box error';
  }
}

// ===== UI helpers =====
function createCard(imageSrc){
  const card = document.createElement('div');
  card.className = 'card';

  const tag = document.createElement('div');
  tag.className = 'tag';
  tag.textContent = 'Detecting…';
  card.appendChild(tag);

  const img = document.createElement('img');
  img.className = 'card-img';
  img.alt = 'uploaded image preview';
  img.src = imageSrc;
  card.appendChild(img);

  const body = document.createElement('div'); body.className = 'card-body';

  const progress = document.createElement('div'); progress.className = 'progress';
  const fill = document.createElement('div'); fill.className = 'progress-fill';
  progress.appendChild(fill);

  const actions = document.createElement('div'); actions.className = 'actions';
  const btnShare = document.createElement('button'); btnShare.className='action-btn'; btnShare.textContent='Share';
  const btnDownload = document.createElement('button'); btnDownload.className='action-btn'; btnDownload.textContent='Download';
  const btnReclass = document.createElement('button'); btnReclass.className='action-btn'; btnReclass.textContent='Re-classify';
  actions.append(btnShare, btnDownload, btnReclass);

  body.append(progress, actions);
  card.appendChild(body);

  // Handlers for share/download later
  btnShare.addEventListener('click', () => shareCard(imageSrc, tag.textContent, fill.dataset.conf || '0'));
  btnDownload.addEventListener('click', () => downloadCard(imageSrc, tag.textContent, fill.dataset.conf || '0'));
  btnReclass.addEventListener('click', () => classifyOne(imageSrc, tag, fill, card));

  return { card, tag, fill };
}

function setPredictionUI(tagEl, fillEl, label, confidence){
  const pct = Math.max(0, Math.min(100, confidence));
  fillEl.style.width = pct + '%';
  fillEl.dataset.conf = String(pct);

  if (pct < THRESHOLD){
    tagEl.textContent = 'Not a room image';
    tagEl.style.background = 'rgba(198,40,40,.85)';
  } else {
    tagEl.textContent = `🪪 ${label}`;
    tagEl.style.background = 'rgba(0,0,0,.65)';
  }
}

// ===== Classification =====
function preprocessFromImgElement(imgEl){
  const canvas = document.createElement('canvas');
  const SIZE = 224;
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, SIZE, SIZE);
  const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
  const tensor = tf.browser.fromPixels(imageData, 3);
  const normalized = tensor.div(255).expandDims(0);
  tensor.dispose();
  return normalized;
}

async function classifyOne(imageSrc, tagEl, fillEl, cardEl){
  if(!model){
    const box = globalStatus();
    box.textContent = 'Model not loaded yet. Please wait.';
    box.className = 'result-box warning';
    return;
  }

  // Load into an Image to feed canvas
  const imgEl = new Image();
  imgEl.crossOrigin = 'anonymous';
  imgEl.onload = () => {
    const input = preprocessFromImgElement(imgEl);
    const pred = model.predict(input);
    const arr = pred.dataSync();
    pred.dispose();

    const classNames = ['Bathroom', 'Bedroom', 'Dining', 'Kitchen', 'Livingroom'];
    const maxIndex = arr.indexOf(Math.max(...arr));
    const confidence = arr[maxIndex] * 100;
    const label = classNames[maxIndex];

    setPredictionUI(tagEl, fillEl, label, confidence);
    cardEl.classList.add('predicted');

    // Also put a sentence into the global status for accessibility
    const box = globalStatus();
    if (confidence < THRESHOLD){
      box.textContent = '⚠ Please upload a room image only.';
      box.className = 'result-box warning';
    } else {
      box.textContent = `The image you uploaded is a ${label}.`;
      box.className = 'result-box success';
    }

    input.dispose();
  };
  imgEl.src = imageSrc;
}

// Multi file handler
function handleFiles(fileList){
  const files = Array.from(fileList || []);
  if(files.length === 0) return;

  files.forEach(file=>{
    if(!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = e => {
      const src = e.target.result;
      const { card, tag, fill } = createCard(src);
      galleryEl().prepend(card); // newest first
      // Auto classify
      classifyOne(src, tag, fill, card);
    };
    reader.readAsDataURL(file);
  });
}

// Drag & drop wiring
function initDragAndDrop(){
  const dz = dropZone();
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  
  fileInput().addEventListener('change', e => handleFiles(e.target.files));
}

// ===== Share & Download =====
async function shareCard(imageSrc, labelText, confidence){
  const text = (parseFloat(confidence) >= THRESHOLD)
    ? `The image you uploaded is a ${labelText.replace('🪪 ','')}. (Confidence: ${Math.round(confidence)}%)`
    : 'Please upload a room image only.';

  if(navigator.share){
    try{
      await navigator.share({ title:'Room Classifier', text, url:location.href });
    }catch(_){} // user cancelled
  }else{
    alert('Sharing not supported on this browser. You can use Download to save a result card.');
  }
}

function downloadCard(imageSrc, labelText, confidence){
  // Build a simple result card on a canvas and download it as PNG
  const canvas = document.createElement('canvas');
  const W=900, H=700; canvas.width=W; canvas.height=H;
  const ctx = canvas.getContext('2d');

  // background
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);

  // image
  const img = new Image();
  img.crossOrigin='anonymous';
  img.onload = ()=>{
    const ar = img.width/img.height;
    let iw = W-120, ih = (W-120)/ar;
    if(ih > H-220){ ih = H-220; iw = ih*ar; }
    const ix = (W - iw)/2, iy = 80 + (H-220 - ih)/2;
    ctx.drawImage(img, ix, iy, iw, ih);

    // Title
    ctx.fillStyle = '#111';
    ctx.font = 'bold 34px Segoe UI, Tahoma';
    ctx.fillText('Room Classifier — Rohith Vuppula', 40, 50);

    // Label box
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.roundRect = function(x,y,w,h,r){ this.beginPath(); this.moveTo(x+r,y); this.arcTo(x+w,y,x+w,y+h,r); this.arcTo(x+w,y+h,x,y+h,r); this.arcTo(x,y+h,x,y,r); this.arcTo(x,y,x+w,y,r); this.closePath(); }
    ctx.roundRect(40, H-120, W-80, 70, 16);
    ctx.fill();

    // Text on label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Segoe UI, Tahoma';
    const conf = Math.round(parseFloat(confidence) || 0);
    const ok = conf >= THRESHOLD;
    const line = ok ? `The image you uploaded is a ${labelText.replace('🪪 ','')}.` : 'Please upload a room image only.';
    ctx.fillText(line, 60, H-78);
    if(ok){
      ctx.font = 'normal 22px Segoe UI, Tahoma';
      ctx.fillText(`Confidence: ${conf}%`, 60, H-48);
    }

    // Download
    const link = document.createElement('a');
    link.download = 'room-classifier-result.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  img.src = imageSrc;
}

// ===== Init =====
window.addEventListener('DOMContentLoaded', ()=>{
  initDragAndDrop();
  loadModel();
});
