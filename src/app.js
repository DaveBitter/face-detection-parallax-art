const detections = ['face', 'eye-left', 'eye-right', 'nose', 'mouth'];

const elements = {
  webcamSelect: document.querySelector('[data-webcam-select]'),
  inputContainer: document.querySelector('[data-input-container]'),
  video: document.querySelector('[data-video]'),
  videoPlaceholder: document.querySelector('[data-video-placeholder]'),
  faceDebugBoxes: {
    face: document.querySelector('[data-face-debug-box-face]'),
    ['eye-left']: document.querySelector('[data-face-debug-box-eye-left]'),
    ['eye-right']: document.querySelector('[data-face-debug-box-eye-right]'),
    nose: document.querySelector('[data-face-debug-box-nose]'),
    mouth: document.querySelector('[data-face-debug-box-mouth]')
  },
  artForeground: document.querySelector('[data-art-foreground]'),
  outputs: detections.reduce(
    (acc, cur) => ({
      ...acc,
      [cur]: document.querySelector(`[data-detection-output-${cur}]`)
    }),
    {}
  )
};

const state = {
  hasFilledWebcamOptions: false
};

const mapFaceDetectionBoundingBoxFromIntrinsicSize = faceDetectionBoundingBox => {
  const videoWidthByAspectRatio =
    elements.video.scrollHeight *
    (elements.videoPlaceholder.scrollWidth /
      elements.videoPlaceholder.scrollHeight);

  const videoHeightByAspectRatio =
    elements.video.scrollWidth *
    (elements.videoPlaceholder.scrollHeight /
      elements.videoPlaceholder.scrollWidth);

  let factorX;
  let factorY;

  const inputContainerIsPortrait =
    elements.inputContainer.getBoundingClientRect().height >
    elements.inputContainer.getBoundingClientRect().width;

  elements.videoPlaceholder.style.minWidth =
    elements.videoPlaceholder.scrollWidth + 'px';
  elements.videoPlaceholder.style.minHeight =
    elements.videoPlaceholder.scrollHeight + 'px';

  if (inputContainerIsPortrait) {
    factorY =
      elements.video.scrollHeight / elements.videoPlaceholder.scrollHeight;
    factorX = videoWidthByAspectRatio / elements.videoPlaceholder.scrollWidth;
    elements.video.style.setProperty('--video-width', 'unset');
    elements.video.style.setProperty('--video-height', '100%');
  } else {
    factorY = videoHeightByAspectRatio / elements.videoPlaceholder.scrollHeight;
    factorX =
      elements.video.scrollWidth / elements.videoPlaceholder.scrollWidth;
    elements.video.style.setProperty('--video-width', '100%');
    elements.video.style.setProperty('--video-height', 'unset');
  }

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

const onUserMedia = stream => {
  return new Promise(async resolve => {
    await loadVideoStream(stream);

    elements.video.play();
    elements.videoPlaceholder.play();

    resolve();
  });
};

let prevLeft;
let prevTop;
let prevWidth;
let offsetLeft;
let offsetTop;
let offsetWidth;
const getFaceDetection = async faceDetector => {
  const [face] = await faceDetector
    .detect(elements.videoPlaceholder)
    .catch(resetDebugBoxes);

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

const outputDetectionValues = faceDetections => {
  faceDetections.forEach(({ type, boundingBox }) => {
    const { top, left, width, height } = boundingBox;
    elements.outputs[type].innerHTML = `${parseInt(top)}, ${parseInt(
      left
    )}, ${parseInt(width)}, ${parseInt(height)}`;
  });
};

const resetDebugBoxes = () => {
  Object.keys(elements.faceDebugBoxes).forEach(key => {
    elements.faceDebugBoxes[key].style.setProperty(
      '--debug-box-translate-x',
      'unset'
    );
    elements.faceDebugBoxes[key].style.setProperty(
      '--debug-box-translate-y',
      'unset'
    );
    elements.faceDebugBoxes[key].style.setProperty(
      '--debug-box-width',
      'unset'
    );
    elements.faceDebugBoxes[key].style.setProperty(
      '--debug-box-height',
      'unset'
    );
  });
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

const updateArt = () => {
  elements.artForeground.style.setProperty(
    '--art-foreground-rotate-x',
    `-${parseInt(offsetTop / 40)}deg`
  );
  elements.artForeground.style.setProperty(
    '--art-foreground-rotate-y',
    `${parseInt(offsetLeft / 20 - 30)}deg`
  );
  elements.artForeground.style.setProperty(
    '--art-foreground-scale',
    `${parseFloat(1 + offsetWidth / 1000).toFixed(2)}`
  );
};

const startDetection = () => {
  const faceDetector = new window.FaceDetector();

  setInterval(async () => {
    const faceDetections = await getFaceDetection(faceDetector).catch(
      resetDebugBoxes
    );

    if (!faceDetections) {
      return;
    }

    drawDebugBoxes(faceDetections);
    updateArt(faceDetections);
    outputDetectionValues(faceDetections);
  }, 100);
};

const hideUnsupportedNotice = () => {
  document.body.dataset.supported = 'false';
};

const initWebcamStreams = async deviceIdToUse => {
  const mediaDevices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = mediaDevices.filter(
    mediaDevice => mediaDevice.kind === 'videoinput'
  );

  !state.hasFilledWebcamOptions &&
    videoDevices.forEach((videoDevice, index) => {
      const option = document.createElement('option');
      const label = videoDevice.label.split(' (')[0] || `Camera ${index++}`;
      const textNode = document.createTextNode(label);

      option.value = videoDevice.deviceId;
      option.appendChild(textNode);
      elements.webcamSelect.appendChild(option);

      state.hasFilledWebcamOptions = true;
    });

  const cachedVideoDeviceId = localStorage.getItem('selectedVideoDeviceId');

  const selectedDeviceId =
    deviceIdToUse || cachedVideoDeviceId || videoDevices[0].deviceId;
  elements.webcamSelect.value = selectedDeviceId;

  localStorage.setItem('selectedVideoDeviceId', selectedDeviceId);

  await navigator.mediaDevices
    .getUserMedia({
      video: {
        deviceId: selectedDeviceId
      },
      audio: false
    })
    .then(onUserMedia)
    .catch(alert);
};

const start = () => {
  initWebcamStreams();

  elements.webcamSelect.addEventListener('change', ({ target }) => {
    return initWebcamStreams(target.value);
  });

  'FaceDetector' in window ? startDetection() : hideUnsupportedNotice();
};

start();
