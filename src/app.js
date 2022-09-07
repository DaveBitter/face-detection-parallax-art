const elements = {
  video: document.querySelector('[data-video]'),
  videoPlaceholder: document.querySelector('[data-video-placeholder]'),
  faceDebugBoxes: {
    face: document.querySelector('[data-face-debug-box-face]'),
    ['eye-left']: document.querySelector('[data-face-debug-box-eye-left]'),
    ['eye-right']: document.querySelector('[data-face-debug-box-eye-right]'),
    nose: document.querySelector('[data-face-debug-box-nose]'),
    mouth: document.querySelector('[data-face-debug-box-mouth]')
  },
  artForeground: document.querySelector('[data-art-foreground]')
};

const state = {};

const mapFaceDetectionBoundingBoxFromIntrinsicSize = faceDetectionBoundingBox => {
  const factorX =
    elements.video.scrollWidth / elements.videoPlaceholder.scrollWidth;
  const factorY =
    elements.video.scrollHeight / elements.videoPlaceholder.scrollHeight;

  return {
    top: factorY * faceDetectionBoundingBox.top,
    bottom: factorY * faceDetectionBoundingBox.bottom,
    left: factorX * faceDetectionBoundingBox.left,
    right: factorX * faceDetectionBoundingBox.right,
    width: factorX * faceDetectionBoundingBox.width,
    height: factorY * faceDetectionBoundingBox.height
  };
};

const loadVideoStream = stream =>
  new Promise(resolve => {
    elements.video.srcObject = stream;
    elements.videoPlaceholder.srcObject = stream;
    elements.videoPlaceholder.addEventListener('loadedmetadata', resolve);
  });

const onUserMedia = stream =>
  new Promise(async resolve => {
    await loadVideoStream(stream);

    elements.video.play();
    elements.videoPlaceholder.play();

    resolve();
  });

let prevLeft;
let prevTop;
let prevWidth;
let offsetLeft;
let offsetTop;
let offsetWidth;
const getFaceDetection = async faceDetector => {
  const [face] = await faceDetector.detect(elements.videoPlaceholder);

  if (!face) {
    return;
  }

  const mappedBoundingBox = mapFaceDetectionBoundingBoxFromIntrinsicSize(
    face.boundingBox
  );

  if (!offsetLeft || !offsetTop || !offsetWidth) {
    offsetLeft = mappedBoundingBox.left;
    offsetTop = mappedBoundingBox.top;
    offsetWidth = mappedBoundingBox.width;
  } else {
    offsetLeft = offsetLeft + (mappedBoundingBox.left - prevLeft);
    offsetTop = offsetTop + (mappedBoundingBox.top - prevTop);
    offsetWidth = offsetWidth + (mappedBoundingBox.width - prevWidth);
  }
  prevLeft = mappedBoundingBox.left;
  prevTop = mappedBoundingBox.top;
  prevWidth = mappedBoundingBox.width;

  const landmarks = face.landmarks.reduce((acc, { type, locations }) => {
    let key = type;
    let location = {};

    if (type === 'eye') {
      key = acc.find(entry => entry.type === 'eye-left')
        ? 'eye-right'
        : 'eye-left';
    }

    const lowestLeft = locations
      .map(({ x }) => x)
      .sort()
      .at(0);
    const highestLeft = locations
      .map(({ x }) => x)
      .sort()
      .at(-1);
    const lowestTop = locations
      .map(({ y }) => y)
      .sort()
      .at(0);
    const highestTop = locations
      .map(({ y }) => y)
      .sort()
      .at(-1);

    location.left = lowestLeft;
    location.top = lowestTop;
    location.width = highestLeft - lowestLeft;
    location.height = highestTop - lowestTop;

    return [...acc, { type: key, boundingBox: location }];
  }, []);

  const mappedLandmarkBoundingBoxes = [
    { type: 'face', ...face },
    ...landmarks
  ].map(({ type, boundingBox }) => ({
    type,
    boundingBox: mapFaceDetectionBoundingBoxFromIntrinsicSize(boundingBox)
  }));

  return mappedLandmarkBoundingBoxes;
};

const drawDebugBoxes = faceDetections => {
  faceDetections.forEach(({ type, boundingBox }) => {
    elements.faceDebugBoxes[type].style.setProperty(
      '--debug-box-translate-x',
      `${boundingBox.left}px`
    );
    elements.faceDebugBoxes[type].style.setProperty(
      '--debug-box-translate-y',
      `${boundingBox.top}px`
    );
    elements.faceDebugBoxes[type].style.setProperty(
      '--debug-box-width',
      `${boundingBox.width}px`
    );
    elements.faceDebugBoxes[type].style.setProperty(
      '--debug-box-height',
      `${boundingBox.height}px`
    );
  });
};

const start = async () => {
  await navigator.mediaDevices
    .getUserMedia({
      video: true,
      audio: false
    })
    .then(onUserMedia)
    .catch(alert);

  const faceDetector = new window.FaceDetector();

  setInterval(async () => {
    const faceDetections = await getFaceDetection(faceDetector);

    elements.artForeground.style.setProperty(
      '--art-foreground-rotate-x',
      `${parseInt(offsetTop / 10)}deg`
    );
    elements.artForeground.style.setProperty(
      '--art-foreground-rotate-y',
      `${parseInt(offsetLeft / 50)}deg`
    );
    elements.artForeground.style.setProperty(
      '--art-foreground-scale',
      `${parseFloat(offsetWidth / 200).toFixed(1)}`
    );

    drawDebugBoxes(faceDetections);
  }, 100);
};

start();