/**
 * BusGo Multi-Bus 360 Seat Viewer - Configuration Module
 * Architecture: Centralized Bus Configs, Seat-to-Camera Mappings, and UI Templates
 */

(function (window) {
  'use strict';

  // Helper to generate realistic seat-wise camera parameters and 3D positions
  function createSeatMapping(totalSeats, busId, busYawOffset) {
    const seats = {};
    const cols = ['A', 'B', 'C', 'D']; // 2+2 layout: A (Win L), B (Aisle L), C (Aisle R), D (Win R)
    const totalRows = Math.ceil(totalSeats / 4);
    const yawBase = busYawOffset || 0;
    const rad = yawBase * Math.PI / 180;
    const fx = Math.cos(rad);
    const fz = Math.sin(rad);
    const rx = -Math.sin(rad);
    const rz = Math.cos(rad);

    for (let i = 1; i <= totalSeats; i++) {
      const row = Math.floor((i - 1) / 4) + 1;
      const colIdx = (i - 1) % 4;
      const colLetter = cols[colIdx];
      const seatCode = `${row}${colLetter}`;

      // Row depth calculation along bus aisle:
      // Row 1 is closest to the driver cabin / windshield (+130)
      // Rear row is furthest back from the driver (-150)
      const rowFraction = totalRows > 1 ? (row - 1) / (totalRows - 1) : 0.5;
      const dRow = Math.round(130 - (rowFraction * 280)); // Row 1 = +130, Row 10 = -150

      let dCol = 0;
      let seatType = 'Aisle';
      let angleOffset = 0;
      let defaultPitch = -2;
      let fov = 75;

      // Column-specific horizontal offset across the aisle
      if (colIdx === 0) {
        // Left Window: Close to left window, angled slightly towards road & scenery
        dCol = -65;
        angleOffset = -8;
        seatType = 'Window (Left)';
      } else if (colIdx === 1) {
        // Left Aisle: Central corridor view looking straight towards driver
        dCol = -22;
        angleOffset = 0;
        seatType = 'Aisle (Left)';
      } else if (colIdx === 2) {
        // Right Aisle: Central corridor view looking straight towards driver
        dCol = 22;
        angleOffset = 0;
        seatType = 'Aisle (Right)';
      } else {
        // Right Window: Close to right scenic window
        dCol = 65;
        angleOffset = 8;
        seatType = 'Window (Right)';
      }

      // Height and FOV adjusted by row
      let camY = -5;
      if (row <= 2) {
        // Front rows: Close view of windshield, driver area, steering wheel, and highway
        fov = 68;
        defaultPitch = -3;
      } else if (row >= totalRows - 1) {
        // Rear rows: Wide perspective looking down the whole central cabin aisle towards driver
        fov = 80;
        defaultPitch = -1;
      } else {
        fov = 74;
      }

      // Convert along-aisle and across-aisle offsets to 3D Cartesian coordinates
      const camX = Math.round(dRow * fx + dCol * rx);
      const camZ = Math.round(dRow * fz + dCol * rz);

      seats[i] = {
        seatNumber: i,
        seatLabel: seatCode,
        seatType: seatType,
        row: row,
        col: colLetter,
        camX: camX,
        camY: camY,
        camZ: camZ,
        defaultYaw: yawBase + angleOffset,
        baseYaw: yawBase,
        defaultPitch: defaultPitch,
        defaultFov: fov
      };
    }
    return seats;
  }

  const BUS_CONFIGS = {
    // Bus 01: Volvo B11R / 9600 (Captain Kirtan)
    'bus-01': {
      busKey: 'bus-01',
      aliasIds: [1, 101, '1', '101', 'volvo-01'],
      operator: 'IntrCity SmartBus (Captain Kirtan)',
      model: 'Volvo B11R Multi-Axle A/C Sleeper',
      theme: 'template-01', // UI Template 01
      busYawOffset: 180, // Driver steering wheel and windshield centered at 180°
      panoramaUrl: 'assets/panoramas/bus01-day.jpg',
      panoramas: {
        day: 'assets/panoramas/bus01-day.jpg',
        night: 'assets/panoramas/bus01-night.jpg'
      },
      defaultTimeMode: 'day',
      totalSeats: 40,
      seats: createSeatMapping(40, 'bus-01', 180),
      metadata: {
        lighting: 'Dual Mode: Sunlit Day Expressway & Night Mood LED',
        features: ['Reclining Seat', 'Individual USB Port', 'Panoramic Window View', 'Dedicated AC Vent']
      }
    },

    // Bus 02: Hans Travels BharatBenz Luxury Coach
    'bus-02': {
      busKey: 'bus-02',
      aliasIds: [2, 102, '2', '102', 'bharatbenz-02'],
      operator: 'Hans Travels',
      model: 'BharatBenz Luxury A/C Sleeper',
      theme: 'template-01', // Reusable UI Template 01
      busYawOffset: 180, // Driver steering wheel and windshield centered at 180°
      panoramaUrl: 'assets/panoramas/bus02-day.jpg',
      panoramas: {
        day: 'assets/panoramas/bus02-day.jpg',
        night: 'assets/panoramas/bus02-night.jpg'
      },
      defaultTimeMode: 'day',
      totalSeats: 36,
      seats: createSeatMapping(36, 'bus-02', 180),
      metadata: {
        lighting: 'Dual Mode: Sunny Day & Warm Golden Amber Interior',
        features: ['Ergonomic Leatherette', 'Fast Charger', 'Double-Glazed Soundproof Glass', 'Air Purifier']
      }
    }
  };

  // UI Templates registry
  const UI_TEMPLATES = {
    'template-01': {
      id: 'template-01',
      name: 'Premium Blue Glassmorphism',
      accentColor: '#3B82F6',
      accentGradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
      hudBg: 'rgba(15, 23, 42, 0.88)',
      hudBorder: '1px solid rgba(59, 130, 246, 0.35)',
      buttonActiveGlow: '0 0 16px rgba(59, 130, 246, 0.55)',
      badgeClass: 'badge-premium-blue'
    }
  };

  const Bus360Config = {
    getBusConfig: function (busIdOrObj) {
      if (!busIdOrObj) return BUS_CONFIGS['bus-01'];

      // If full bus object was passed
      const rawId = (typeof busIdOrObj === 'object') ? (busIdOrObj.id || busIdOrObj.busKey) : busIdOrObj;

      for (const key in BUS_CONFIGS) {
        const cfg = BUS_CONFIGS[key];
        if (cfg.busKey === rawId || (cfg.aliasIds && cfg.aliasIds.includes(rawId))) {
          return cfg;
        }
      }

      // Default fallback: If odd ID -> Bus 01, if even ID -> Bus 02
      if (typeof rawId === 'number' && rawId % 2 === 0) {
        return BUS_CONFIGS['bus-02'];
      }
      return BUS_CONFIGS['bus-01'];
    },

    getSeatConfig: function (busIdOrObj, seatNum) {
      const busCfg = this.getBusConfig(busIdOrObj);
      const num = parseInt(seatNum, 10) || 1;
      if (busCfg && busCfg.seats && busCfg.seats[num]) {
        return busCfg.seats[num];
      }
      // Fallback
      return {
        seatNumber: num,
        seatLabel: `${num}`,
        seatType: 'standard',
        defaultYaw: 0,
        defaultPitch: -2,
        defaultFov: 75
      };
    },

    getTemplate: function (templateId) {
      return UI_TEMPLATES[templateId] || UI_TEMPLATES['template-01'];
    },

    getAllConfigs: function () {
      return BUS_CONFIGS;
    }
  };

  window.Bus360Config = Bus360Config;
})(window);
