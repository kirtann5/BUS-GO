/**
 * BusGo Multi-Bus 360 Seat Viewer - Core Engine
 * Reusable Three.js Equirectangular Spherical Panorama Engine
 * Supports: Desktop drag, Mobile touch & pinch, Presets, Inertia, Dynamic Seat Switching
 */

(function (window) {
  'use strict';

  let scene, camera, renderer, sphereMesh, textureLoader;
  let animFrameId = null;
  let isViewerOpen = false;

  // View state (spherical angles in degrees)
  let lon = 0, lat = 0;
  let targetLon = 0, targetLat = 0;
  let fov = 75;
  let targetFov = 75;

  // Dragging interaction state
  let isUserInteracting = false;
  let onMouseDownMouseX = 0, onMouseDownMouseY = 0;
  let onMouseDownLon = 0, onMouseDownLat = 0;
  let pinchStartDist = 0;
  let pinchStartFov = 75;

  // Current session tracking
  let currentBusConfig = null;
  let currentSeatConfig = null;
  let currentTextureUrl = null;
  let currentTimeMode = 'day';

  // 3D Seat Camera Position tracking (for true parallax & seat perspective)
  let camX = 0, camY = 0, camZ = 0;
  let targetCamX = 0, targetCamY = 0, targetCamZ = 0;

  // DOM elements cache
  let containerEl, canvasContainerEl, loadingEl, seatBadgeEl, busNameEl;
  let hintEl;

  function initViewerDOM() {
    containerEl = document.getElementById('bus360Modal');
    if (!containerEl) return false;

    canvasContainerEl = document.getElementById('bus360CanvasContainer');
    loadingEl = document.getElementById('bus360Loading');
    seatBadgeEl = document.getElementById('bus360SeatBadge');
    busNameEl = document.getElementById('bus360BusName');
    hintEl = document.getElementById('bus360DragHint');

    if (!canvasContainerEl) return false;

    // Attach interaction listeners to canvasContainerEl
    canvasContainerEl.addEventListener('mousedown', onPointerDown, { passive: false });
    window.addEventListener('mousemove', onPointerMove, { passive: false });
    window.addEventListener('mouseup', onPointerUp, { passive: false });

    canvasContainerEl.addEventListener('touchstart', onTouchStart, { passive: false });
    canvasContainerEl.addEventListener('touchmove', onTouchMove, { passive: false });
    canvasContainerEl.addEventListener('touchend', onTouchEnd, { passive: false });

    canvasContainerEl.addEventListener('wheel', onDocumentMouseWheel, { passive: false });
    window.addEventListener('resize', onWindowResize, false);

    return true;
  }

  function initThree() {
    if (!THREE) {
      console.error('Three.js library not loaded');
      return false;
    }

    if (!scene) {
      scene = new THREE.Scene();

      // Perspective Camera (FOV 75, aspect ratio, near 0.1, far 1100)
      const width = canvasContainerEl.clientWidth || 800;
      const height = canvasContainerEl.clientHeight || 500;
      camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 1200);
      camera.target = new THREE.Vector3(0, 0, 0);

      // Inverted Sphere Geometry for 360 equirectangular panorama
      // Radius 500, 64 horizontal segments, 48 vertical segments
      const geometry = new THREE.SphereGeometry(500, 64, 48);
      // Invert geometry along X axis so texture faces inward
      geometry.scale(-1, 1, 1);

      // Clean pure white base material so textures render with full bright natural colors
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: false
      });

      sphereMesh = new THREE.Mesh(geometry, material);
      scene.add(sphereMesh);

      // WebGL Renderer with high pixel ratio and bright daylight tone mapping
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.outputEncoding = THREE.sRGBEncoding || 3001;
      if (THREE.ACESFilmicToneMapping) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25; // Crisp, vivid, sunlit daylight
      }

      // Clear container and append canvas
      canvasContainerEl.innerHTML = '';
      canvasContainerEl.appendChild(renderer.domElement);

      textureLoader = new THREE.TextureLoader();
    }

    return true;
  }

  function resolvePanoramaSource(url, busKey) {
    // 1. If running under file:/// protocol, browsers block local XHR/CORS image loading into WebGL
    // Use embedded Data URI if available
    const filename = url ? url.split('/').pop() : '';
    if (window.BUS_PANORAMA_DATA) {
      const modeKey = busKey ? `${busKey}-${currentTimeMode}` : null;
      if (modeKey && window.BUS_PANORAMA_DATA[modeKey]) {
        return window.BUS_PANORAMA_DATA[modeKey];
      }
      if (filename && window.BUS_PANORAMA_DATA[filename]) {
        return window.BUS_PANORAMA_DATA[filename];
      }
      if (busKey && window.BUS_PANORAMA_DATA[busKey]) {
        return window.BUS_PANORAMA_DATA[busKey];
      }
    }
    return url;
  }

  function loadPanorama(url, onComplete, retryCount) {
    retryCount = retryCount || 0;
    const busKey = currentBusConfig ? (currentBusConfig.busKey || currentBusConfig.id) : null;
    const resolvedUrl = resolvePanoramaSource(url, busKey);

    if (currentTextureUrl === resolvedUrl && sphereMesh.material.map) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (onComplete) onComplete();
      return;
    }

    if (loadingEl) {
      loadingEl.style.display = 'flex';
      loadingEl.innerHTML = '<div class="bus-360-spinner"></div><div class="small fw-semibold" style="letter-spacing:0.3px;">Loading 360° Cabin Panorama...</div>';
    }

    // Set crossOrigin appropriately
    if (window.location.protocol === 'file:') {
      textureLoader.setCrossOrigin('');
    } else {
      textureLoader.setCrossOrigin('anonymous');
    }

    textureLoader.load(
      resolvedUrl,
      function (texture) {
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;

        sphereMesh.material.color.setHex(0xffffff);
        sphereMesh.material.map = texture;
        sphereMesh.material.needsUpdate = true;
        currentTextureUrl = resolvedUrl;

        if (loadingEl) loadingEl.style.display = 'none';
        if (onComplete) onComplete();
      },
      undefined,
      function (err) {
        console.warn('Failed to load panorama from:', resolvedUrl, 'attempt:', retryCount, err);

        // Fallback chain:
        // Attempt 1: Try embedded Data URI if not already used
        if (retryCount === 0 && window.BUS_PANORAMA_DATA) {
          const fallbackData = (busKey && window.BUS_PANORAMA_DATA[busKey]) || 
                               (url && window.BUS_PANORAMA_DATA[url.split('/').pop()]);
          if (fallbackData && fallbackData !== resolvedUrl) {
            loadPanorama(fallbackData, onComplete, 1);
            return;
          }
        }

        // Attempt 2: Try alternate relative path
        if (retryCount < 2) {
          const altUrl = url.startsWith('/') ? url.substring(1) : ('./' + url);
          if (altUrl !== url && altUrl !== resolvedUrl) {
            loadPanorama(altUrl, onComplete, 2);
            return;
          }
        }

        // Attempt 3: Try fallback images in images/ directory
        if (retryCount < 3) {
          loadPanorama('images/busgo_seat_360_panorama.jpg', onComplete, 3);
          return;
        }

        // If all attempts fail, provide clear user-friendly instructions with retry button
        if (loadingEl) {
          loadingEl.innerHTML = '<div class="p-3 text-center" style="max-width:400px; background:rgba(15,23,42,0.95); border:1px solid #ef4444; border-radius:12px;"><div class="text-danger fw-bold mb-2">Could not load 360 panorama</div><div class="small text-slate-300 mb-3" style="font-size:12px; line-height:1.5;">Browser file protocol security may restrict local images.<br>Try running <strong>run.bat</strong> and opening <strong>http://localhost:8080/</strong></div><button class="btn btn-sm btn-primary px-3 fw-bold" onclick="Bus360Engine.retryLoad()">Retry</button></div>';
        }
      }
    );
  }

  // Animation and render loop
  function animate() {
    if (!isViewerOpen) return;
    animFrameId = requestAnimationFrame(animate);
    render();
  }

  function render() {
    // Smooth damping / interpolation towards target angles and FOV
    lon += (targetLon - lon) * 0.12;
    lat += (targetLat - lat) * 0.12;
    fov += (targetFov - fov) * 0.15;

    // Smooth interpolation for 3D camera position between seats
    camX += (targetCamX - camX) * 0.12;
    camY += (targetCamY - camY) * 0.12;
    camZ += (targetCamZ - camZ) * 0.12;
    camera.position.set(camX, camY, camZ);

    // Clamp vertical tilt to avoid gimbal inversion
    lat = Math.max(-85, Math.min(85, lat));

    // Update camera FOV and projection
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // Convert spherical lon/lat degrees to Cartesian coordinates
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);

    const targetX = camX + 500 * Math.sin(phi) * Math.cos(theta);
    const targetY = camY + 500 * Math.cos(phi);
    const targetZ = camZ + 500 * Math.sin(phi) * Math.sin(theta);

    camera.lookAt(targetX, targetY, targetZ);
    renderer.render(scene, camera);
  }

  // Pointer / Mouse events
  function onPointerDown(e) {
    if (e.button !== 0) return; // Left mouse button only
    isUserInteracting = true;
    onMouseDownMouseX = e.clientX;
    onMouseDownMouseY = e.clientY;
    onMouseDownLon = targetLon;
    onMouseDownLat = targetLat;
    hideHint();
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isUserInteracting) return;
    const deltaX = e.clientX - onMouseDownMouseX;
    const deltaY = e.clientY - onMouseDownMouseY;
    // Speed factor scaled with current FOV
    const speed = 0.15 * (fov / 75);
    targetLon = onMouseDownLon - deltaX * speed;
    targetLat = onMouseDownLat + deltaY * speed;
    e.preventDefault();
  }

  function onPointerUp() {
    isUserInteracting = false;
  }

  // Touch events (Mobile support + Pinch-to-zoom)
  function onTouchStart(e) {
    if (e.touches.length === 1) {
      isUserInteracting = true;
      onMouseDownMouseX = e.touches[0].pageX;
      onMouseDownMouseY = e.touches[0].pageY;
      onMouseDownLon = targetLon;
      onMouseDownLat = targetLat;
      hideHint();
    } else if (e.touches.length === 2) {
      isUserInteracting = false;
      const dx = e.touches[0].pageX - e.touches[1].pageX;
      const dy = e.touches[0].pageY - e.touches[1].pageY;
      pinchStartDist = Math.sqrt(dx * dx + dy * dy);
      pinchStartFov = targetFov;
    }
  }

  function onTouchMove(e) {
    if (e.touches.length === 1 && isUserInteracting) {
      const deltaX = e.touches[0].pageX - onMouseDownMouseX;
      const deltaY = e.touches[0].pageY - onMouseDownMouseY;
      const speed = 0.18 * (fov / 75);
      targetLon = onMouseDownLon - deltaX * speed;
      targetLat = onMouseDownLat + deltaY * speed;
      e.preventDefault();
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].pageX - e.touches[1].pageX;
      const dy = e.touches[0].pageY - e.touches[1].pageY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = pinchStartDist / Math.max(dist, 1);
      targetFov = Math.max(35, Math.min(95, pinchStartFov * factor));
      e.preventDefault();
    }
  }

  function onTouchEnd() {
    isUserInteracting = false;
  }

  function onDocumentMouseWheel(e) {
    const delta = Math.sign(e.deltaY);
    targetFov = Math.max(35, Math.min(95, targetFov + delta * 3));
    hideHint();
    e.preventDefault();
  }

  function onWindowResize() {
    if (!isViewerOpen || !renderer || !camera || !canvasContainerEl) return;
    const width = canvasContainerEl.clientWidth;
    const height = canvasContainerEl.clientHeight;
    if (width > 0 && height > 0) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
  }

  function hideHint() {
    if (hintEl && !hintEl.classList.contains('fade-out')) {
      hintEl.classList.add('fade-out');
      setTimeout(() => {
        if (hintEl) hintEl.style.display = 'none';
      }, 500);
    }
  }

  function resetHint() {
    if (hintEl) {
      hintEl.style.display = 'flex';
      hintEl.classList.remove('fade-out');
    }
  }

  // View angle preset navigation
  function setViewAngle(presetName) {
    if (!currentSeatConfig) return;
    const baseYaw = (currentSeatConfig.baseYaw !== undefined)
      ? currentSeatConfig.baseYaw
      : (currentBusConfig && currentBusConfig.busYawOffset !== undefined ? currentBusConfig.busYawOffset : (currentSeatConfig.defaultYaw || 0));

    switch (presetName) {
      case 'front':
        targetLon = baseYaw;
        targetLat = 0;
        break;
      case 'left':
        targetLon = baseYaw - 90;
        targetLat = 0;
        break;
      case 'right':
        targetLon = baseYaw + 90;
        targetLat = 0;
        break;
      case 'back':
        targetLon = baseYaw + 180;
        targetLat = 0;
        break;
      case 'top':
        targetLon = baseYaw;
        targetLat = 62;
        break;
      case 'reset':
      default:
        targetLon = currentSeatConfig.defaultYaw || baseYaw;
        targetLat = currentSeatConfig.defaultPitch || -2;
        targetFov = currentSeatConfig.defaultFov || 75;
        targetCamX = currentSeatConfig.camX || 0;
        targetCamY = currentSeatConfig.camY || 0;
        targetCamZ = currentSeatConfig.camZ || 0;
        break;
    }

    // Highlight active preset button
    document.querySelectorAll('.view-angle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === presetName);
    });
  }

  function zoomIn() {
    targetFov = Math.max(35, targetFov - 8);
  }

  function zoomOut() {
    targetFov = Math.min(95, targetFov + 8);
  }

  function rotateStep(deltaDegrees) {
    targetLon += deltaDegrees;
  }

  // Public Viewer Controller API
  const Bus360Engine = {
    open: function (busIdOrObj, seatNum) {
      if (!initViewerDOM()) {
        console.error('Bus360Viewer DOM structure not found');
        return;
      }
      initThree();

      const busCfg = window.Bus360Config.getBusConfig(busIdOrObj);
      const seatCfg = window.Bus360Config.getSeatConfig(busCfg, seatNum || 1);

      currentBusConfig = busCfg;
      currentSeatConfig = seatCfg;
      // ALWAYS default to Day View on open as expected
      currentTimeMode = 'day';

      // Update Header HUD
      if (seatBadgeEl) seatBadgeEl.textContent = `Seat ${seatCfg.seatLabel}`;
      if (busNameEl) busNameEl.textContent = `${busCfg.operator} - ${busCfg.model}`;

      // Update Day / Night Toggle Buttons
      const dayBtn = document.getElementById('btn360DayView');
      const nightBtn = document.getElementById('btn360NightView');
      if (dayBtn) dayBtn.classList.add('active');
      if (nightBtn) nightBtn.classList.remove('active');

      // Show Modal immediately on top of seat modal
      containerEl.classList.add('active');
      containerEl.style.display = 'flex';
      isViewerOpen = true;

      resetHint();

      // Set initial camera to seat perspective and 3D position
      targetCamX = seatCfg.camX || 0;
      targetCamY = seatCfg.camY || 0;
      targetCamZ = seatCfg.camZ || 0;
      camX = targetCamX;
      camY = targetCamY;
      camZ = targetCamZ;
      if (camera) camera.position.set(camX, camY, camZ);

      targetLon = seatCfg.defaultYaw || seatCfg.baseYaw || 0;
      targetLat = seatCfg.defaultPitch || -2;
      targetFov = seatCfg.defaultFov || 75;
      lon = targetLon;
      lat = targetLat;
      fov = targetFov;

      // Load initial panorama (Day View by default)
      const initialUrl = (busCfg.panoramas && busCfg.panoramas['day']) 
        ? busCfg.panoramas['day'] 
        : busCfg.panoramaUrl;

      loadPanorama(initialUrl, function () {
        onWindowResize();
      });

      // Mark front view as active
      document.querySelectorAll('.view-angle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === 'front');
      });

      // Start render loop
      if (animFrameId) cancelAnimationFrame(animFrameId);
      animate();

      setTimeout(onWindowResize, 50);
    },

    changeSeat: function (seatNum) {
      if (!currentBusConfig) return;
      const seatCfg = window.Bus360Config.getSeatConfig(currentBusConfig, seatNum);
      currentSeatConfig = seatCfg;

      // Update Seat Badge smoothly
      if (seatBadgeEl) {
        seatBadgeEl.classList.add('badge-pulse');
        seatBadgeEl.textContent = `Seat ${seatCfg.seatLabel}`;
        setTimeout(() => seatBadgeEl.classList.remove('badge-pulse'), 400);
      }

      // Smoothly transition perspective and 3D seat camera position without disorienting cuts
      targetCamX = seatCfg.camX || 0;
      targetCamY = seatCfg.camY || 0;
      targetCamZ = seatCfg.camZ || 0;
      targetLon = seatCfg.defaultYaw || seatCfg.baseYaw || 0;
      targetLat = seatCfg.defaultPitch || -2;
      targetFov = seatCfg.defaultFov || 75;

      document.querySelectorAll('.view-angle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === 'front');
      });
    },

    nextSeat: function () {
      if (!currentBusConfig || !currentSeatConfig) return;
      const total = currentBusConfig.totalSeats || 40;
      let nextNum = (currentSeatConfig.seatNumber % total) + 1;
      this.changeSeat(nextNum);
    },

    prevSeat: function () {
      if (!currentBusConfig || !currentSeatConfig) return;
      const total = currentBusConfig.totalSeats || 40;
      let prevNum = currentSeatConfig.seatNumber - 1;
      if (prevNum < 1) prevNum = total;
      this.changeSeat(prevNum);
    },

    close: function () {
      isViewerOpen = false;
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      if (containerEl) {
        containerEl.classList.remove('active');
        containerEl.style.display = 'none';
      }
    },

    isOpen: function () {
      return isViewerOpen;
    },

    setViewAngle: setViewAngle,
    zoomIn: zoomIn,
    zoomOut: zoomOut,
    rotateStep: rotateStep,
    setTimeMode: function (mode) {
      if (!mode || (mode !== 'day' && mode !== 'night')) return;
      currentTimeMode = mode;

      const dayBtn = document.getElementById('btn360DayView');
      const nightBtn = document.getElementById('btn360NightView');
      if (dayBtn) dayBtn.classList.toggle('active', mode === 'day');
      if (nightBtn) nightBtn.classList.toggle('active', mode === 'night');

      if (currentBusConfig) {
        const targetUrl = (currentBusConfig.panoramas && currentBusConfig.panoramas[mode])
          ? currentBusConfig.panoramas[mode]
          : currentBusConfig.panoramaUrl;
        loadPanorama(targetUrl);
      }
    },
    getTimeMode: function () {
      return currentTimeMode;
    },
    retryLoad: function () {
      if (currentBusConfig) {
        currentTextureUrl = null;
        loadPanorama(currentBusConfig.panoramaUrl, null, 0);
      }
    }
  };

  window.Bus360Engine = Bus360Engine;
  // Backward compatibility alias
  window.Bus360Viewer = Bus360Engine;
})(window);
