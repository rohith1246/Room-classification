// Load the model
let model;
async function loadModel() {
  try {
    model = await tf.loadLayersModel('tfjs_model/model.json');
    console.log('Model loaded successfully');
    document.getElementById('result').innerText = 'Model loaded! Ready to classify.';
  } catch (error) {
    console.error('Error loading model:', error);
    document.getElementById('result').innerText = 'Error loading model.';
  }
}

// Preprocess the uploaded image
function preprocessImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.getElementById('canvas');
        canvas.width = 224;
        canvas.height = 224;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 224, 224);
        const imageData = ctx.getImageData(0, 0, 224, 224);
        const tensor = tf.browser.fromPixels(imageData, 3); // RGB
        const normalizedTensor = tensor.div(255.0).expandDims(0); // Normalize and add batch dimension
        tensor.dispose(); // Clean up
        resolve(normalizedTensor);
      };
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Classify the image
async function classifyImage() {
  const fileInput = document.getElementById('imageUpload');
  const file = fileInput.files[0];
  if (!file) {
    document.getElementById('result').innerText = 'Please upload an image.';
    return;
  }

  if (!model) {
    document.getElementById('result').innerText = 'Model not loaded yet. Please wait.';
    return;
  }

  try {
    const tensor = await preprocessImage(file);
    const prediction = model.predict(tensor);
    const result = prediction.dataSync();
    prediction.dispose(); // Clean up

    const classNames = ['Bathroom', 'Bedroom', 'Dining', 'Kitchen', 'Livingroom'];
    const maxIndex = result.indexOf(Math.max(...result));
    const confidence = result[maxIndex] * 100;

    if (confidence < 60) {
      document.getElementById('result').innerText = "⚠ Please upload a room image only.";
    } else {
      document.getElementById('result').innerText = 
        `Predicted class: ${classNames[maxIndex]} (Confidence: ${confidence.toFixed(2)}%)`;
    }

    tensor.dispose(); // Clean up
  } catch (error) {
    console.error('Error classifying image:', error);
    document.getElementById('result').innerText = 'Error classifying image.';
  }
}

// Load the model when the page loads
window.onload = loadModel;
