/**
 * BusGo - Real-Time Seat Locking & Reservation Engine
 * 
 * Provides concurrency control across tabs and user sessions:
 * - 8-minute countdown hold on selected seats
 * - Visually marks seats as "In Progress / Locked" for other users
 * - Auto-releases locks on timeout or modal dismissal
 * - Synchronizes state in real time across browser tabs via storage events
 */

const SeatLockManager = {
  STORAGE_KEY: 'busgo_active_seat_locks',
  LOCK_DURATION_MS: 8 * 60 * 1000, // 8 minutes hold time
  timerInterval: null,
  activeBusId: null,
  activeDate: null,

  // Get or generate a persistent Session ID per browser tab
  getSessionId() {
    let sessId = sessionStorage.getItem('busgo_session_id');
    if (!sessId) {
      sessId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
      sessionStorage.setItem('busgo_session_id', sessId);
    }
    return sessId;
  },

  // Retrieve and auto-purge expired locks from storage
  getAllLocks() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const locks = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      const valid = locks.filter(l => l && l.expiresAt && l.expiresAt > now);
      if (valid.length !== locks.length) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(valid));
      }
      return valid;
    } catch (e) {
      return [];
    }
  },

  // Save locks list to storage
  saveLocks(locks) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(locks));
    } catch (e) {
      console.warn('Failed to save seat locks:', e);
    }
  },

  // Check if seat is locked by ANOTHER user/session
  isLockedByOther(busId, travelDate, seatNum) {
    const myId = this.getSessionId();
    const locks = this.getAllLocks();
    return locks.some(l => 
      String(l.busId) === String(busId) && 
      String(l.date) === String(travelDate) && 
      Number(l.seatNum) === Number(seatNum) && 
      l.sessionId !== myId
    );
  },

  // Check if seat is locked by ME (current session)
  isLockedByMe(busId, travelDate, seatNum) {
    const myId = this.getSessionId();
    const locks = this.getAllLocks();
    return locks.some(l => 
      String(l.busId) === String(busId) && 
      String(l.date) === String(travelDate) && 
      Number(l.seatNum) === Number(seatNum) && 
      l.sessionId === myId
    );
  },

  // Acquire lock for a seat
  acquireLock(busId, travelDate, seatNum) {
    if (this.isLockedByOther(busId, travelDate, seatNum)) {
      return { success: false, reason: 'LOCKED_BY_OTHER' };
    }

    const myId = this.getSessionId();
    const now = Date.now();
    const expiresAt = now + this.LOCK_DURATION_MS;

    const locks = this.getAllLocks().filter(l => 
      !(String(l.busId) === String(busId) && String(l.date) === String(travelDate) && Number(l.seatNum) === Number(seatNum))
    );

    locks.push({
      busId: String(busId),
      date: String(travelDate),
      seatNum: Number(seatNum),
      sessionId: myId,
      lockedAt: now,
      expiresAt: expiresAt
    });

    this.saveLocks(locks);
    this.startCountdown(busId, travelDate);
    return { success: true, expiresAt };
  },

  // Release lock for a specific seat
  releaseLock(busId, travelDate, seatNum) {
    const myId = this.getSessionId();
    const locks = this.getAllLocks().filter(l => 
      !(String(l.busId) === String(busId) && String(l.date) === String(travelDate) && Number(l.seatNum) === Number(seatNum) && l.sessionId === myId)
    );
    this.saveLocks(locks);

    // If no more seats locked by me, stop timer
    const remaining = this.getMyLockedSeats(busId, travelDate);
    if (remaining.length === 0) {
      this.stopCountdown();
    }
  },

  // Release all locks held by current session for a bus/date or globally
  releaseAllMyLocks(busId, travelDate) {
    const myId = this.getSessionId();
    let locks = this.getAllLocks();
    if (busId && travelDate) {
      locks = locks.filter(l => !(String(l.busId) === String(busId) && String(l.date) === String(travelDate) && l.sessionId === myId));
    } else {
      locks = locks.filter(l => l.sessionId !== myId);
    }
    this.saveLocks(locks);
    this.stopCountdown();
  },

  // Get list of seat numbers currently locked by me
  getMyLockedSeats(busId, travelDate) {
    const myId = this.getSessionId();
    return this.getAllLocks()
      .filter(l => String(l.busId) === String(busId) && String(l.date) === String(travelDate) && l.sessionId === myId)
      .map(l => Number(l.seatNum));
  },

  // Get remaining time in ms for current session's lock
  getRemainingTimeMs(busId, travelDate) {
    const myId = this.getSessionId();
    const myLocks = this.getAllLocks().filter(l => 
      String(l.busId) === String(busId) && String(l.date) === String(travelDate) && l.sessionId === myId
    );
    if (myLocks.length === 0) return 0;
    const earliestExp = Math.min(...myLocks.map(l => l.expiresAt));
    return Math.max(0, earliestExp - Date.now());
  },

  // Format milliseconds into MM:SS string
  formatTime(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  // Start live countdown timer on UI
  startCountdown(busId, travelDate) {
    this.activeBusId = busId;
    this.activeDate = travelDate;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    const updateUI = () => {
      const remMs = this.getRemainingTimeMs(this.activeBusId, this.activeDate);
      const banner = document.getElementById('seatLockTimerBanner');
      const timeEl = document.getElementById('seatLockCountdown');

      if (remMs <= 0) {
        this.stopCountdown();
        this.handleLockExpiry();
        return;
      }

      if (banner) {
        banner.classList.remove('d-none');
      }
      if (timeEl) {
        timeEl.textContent = this.formatTime(remMs);
      }
    };

    updateUI();
    this.timerInterval = setInterval(updateUI, 1000);
  },

  // Stop countdown timer and hide banner
  stopCountdown() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const banner = document.getElementById('seatLockTimerBanner');
    if (banner) {
      banner.classList.add('d-none');
    }
  },

  // Handle lock timeout expiry
  handleLockExpiry() {
    const bus = window.AppState ? window.AppState.currentBus : null;
    if (window.AppState) {
      window.AppState.selectedSeats = [];
    }
    if (typeof showToast === 'function') {
      showToast('Your 8-minute seat reservation session has expired. The seats have been released.', 'error');
    }
    if (bus && typeof renderSeatGrid === 'function') {
      renderSeatGrid(bus);
    }
    if (typeof updateSumSeatsDisplay === 'function') {
      updateSumSeatsDisplay(new Set());
    }
    if (typeof recalculateBookingFare === 'function') {
      recalculateBookingFare();
    }
  },

  // Initialize cross-tab synchronization listener
  initSyncListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === this.STORAGE_KEY) {
        const bus = window.AppState ? window.AppState.currentBus : null;
        const seatModal = document.getElementById('seatModal');
        const isOpen = seatModal && seatModal.classList.contains('active');
        if (bus && isOpen && typeof renderSeatGrid === 'function') {
          renderSeatGrid(bus);
        }
      }
    });
  }
};

// Initialize cross-tab synchronization listener on script load
SeatLockManager.initSyncListener();
