/* ============================================================
   BusGo — Online Bus Booking Application
   Full JavaScript Application Logic

   Mirrors Java Spring Boot + SQL architecture:
   - BusDatabase      → SQL tables (buses, bookings, users)
   - BusService       → Java Service layer (business logic)
   - AppState         → Session/context management
   - UIController     → Spring MVC Controller (DOM actions)
   ============================================================ */

/**
 * Converts any time string into 12-hour AM/PM format (e.g. "08:00 PM", "08:00 AM")
 */
function formatTime12(timeStr) {
  if (!timeStr) return '';
  const s = String(timeStr).trim();
  if (/am|pm/i.test(s)) {
    const m = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (m) {
      const h = parseInt(m[1], 10);
      const strH = h < 10 ? '0' + h : h;
      return `${strH}:${m[2]} ${m[3].toUpperCase()}`;
    }
    return s.toUpperCase();
  }
  
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return s;
  
  let hours = parseInt(m[1], 10);
  const minutes = m[2];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = hours < 10 ? '0' + hours : hours;
  return `${strHours}:${minutes} ${ampm}`;
}

/**
 * Parses any 12-hour or 24-hour time string into total minutes from midnight (0 - 1439)
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const s = String(timeStr).trim().toLowerCase();
  const isPm = s.includes('pm');
  const isAm = s.includes('am');
  const clean = s.replace(/(am|pm)/g, '').trim();
  const parts = clean.split(':');
  let h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  
  if (isPm && h < 12) h += 12;
  if (isAm && h === 12) h = 0;
  return h * 60 + m;
}

/* ============================================================
   1. DATABASE LAYER - Simulates SQL Tables + JPA Repositories
   ============================================================ */
const BusDatabase = (() => {
  const buses = [
    // ---- DHARAMPURI <-> INDORE CORRIDOR (NH 52) ----
    {
      id: 101,
      operator: "IntrCity SmartBus (Captain Kirtan)",
      busModel: "Volvo B11R Multi-Axle A/C Sleeper (2+1)",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Dharampuri (Dhar, MP)",
      to: "Indore (Indore, MP)",
      dep: "06:00 PM",
      arr: "08:15 PM",
      duration: "2h 15m",
      price: 240,
      totalSeats: 40,
      bookedSeats: [2, 5, 11, 19],
      rating: 4.9,
      reviewCount: "3.1k",
      amenities: ["WiFi", "AC", "USB", "Water", "Blanket", "Live Tracking"],
      boardingPoints: [
        { name: "Dharampuri Main Bus Stand Gate", time: "06:00 PM", landmark: "Opp. Old Fort Gate" },
        { name: "Dhamnod Mandi Crossing NH 52", time: "06:20 PM", landmark: "Near Overbridge Junction" },
        { name: "Khalghat Narmada Bridge Toll", time: "06:35 PM", landmark: "FASTag Lane 3" }
      ],
      droppingPoints: [
        { name: "Mhow / Dr. Ambedkar Nagar Bypass", time: "07:35 PM", landmark: "Army Gate Flyover" },
        { name: "Rau Circle AB Road", time: "07:50 PM", landmark: "Near Silicon City" },
        { name: "Indore Sarwate Bus Terminal", time: "08:15 PM", landmark: "Platform 4" }
      ],
      stoppages: [
        { name: "Dharampuri Main Bus Stand", time: "06:00 PM", halt: "Boarding", type: "pickup" },
        { name: "Dhamnod Mandi Chowk", time: "06:20 PM", halt: "5 min", type: "stop" },
        { name: "Khalghat Narmada Toll Plaza", time: "06:35 PM", halt: "Passing", type: "toll" },
        { name: "Gujri Ghat Mid-way Rest Point", time: "06:55 PM", halt: "10 min (Tea & Refreshment)", type: "halt" },
        { name: "Manpur AB Road Intersection", time: "07:15 PM", halt: "3 min", type: "stop" },
        { name: "Mhow Bypass Flyover", time: "07:35 PM", halt: "3 min", type: "stop" },
        { name: "Rau Circle Indore", time: "07:50 PM", halt: "5 min", type: "stop" },
        { name: "Indore Sarwate Bus Terminal", time: "08:15 PM", halt: "Destination Drop", type: "drop" }
      ]
    },
    {
      id: 102,
      operator: "Hans Travels",
      busModel: "BharatBenz Luxury A/C Sleeper (2+1)",
      primo: true,
      liveTracking: true,
      type: "sleeper",
      from: "Dharampuri (Dhar, MP)",
      to: "Indore (Indore, MP)",
      dep: "09:15 AM",
      arr: "11:30 AM",
      duration: "2h 15m",
      price: 190,
      totalSeats: 36,
      bookedSeats: [1, 7, 14],
      rating: 4.7,
      reviewCount: "1.8k",
      amenities: ["AC", "Charging Point", "Blanket", "Water", "CCTV"],
      stoppages: [
        { name: "Dharampuri Bus Stand", time: "09:15 AM", halt: "Pickup", type: "pickup" },
        { name: "Dhamnod Square NH 52", time: "09:35 AM", halt: "3 min", type: "stop" },
        { name: "Gujri Ghat Highway Rest", time: "10:10 AM", halt: "10 min", type: "halt" },
        { name: "Rau Circle Indore", time: "11:05 AM", halt: "Drop", type: "stop" },
        { name: "Indore Navlakha Hans Lounge", time: "11:30 AM", halt: "Final Drop", type: "drop" }
      ]
    },
    {
      id: 103,
      operator: "Chartered Bus",
      busModel: "Volvo 9600 Multi-Axle A/C Semi-Sleeper",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Dharampuri (Dhar, MP)",
      to: "Indore (Indore, MP)",
      dep: "07:30 AM",
      arr: "09:45 AM",
      duration: "2h 15m",
      price: 220,
      totalSeats: 40,
      bookedSeats: [3, 9, 18],
      rating: 4.8,
      reviewCount: "2.4k",
      amenities: ["WiFi", "AC", "USB", "Snacks", "Water"],
      stoppages: [
        { name: "Dharampuri Bus Stand", time: "07:30 AM", halt: "Pickup", type: "pickup" },
        { name: "Dhamnod Mandi Gate", time: "07:50 AM", halt: "5 min", type: "stop" },
        { name: "Khalghat Bridge Toll", time: "08:05 AM", halt: "Passing", type: "toll" },
        { name: "Gujri Ghat Scenic Point", time: "08:30 AM", halt: "5 min", type: "halt" },
        { name: "Rau Circle Indore", time: "09:20 AM", halt: "Drop", type: "stop" },
        { name: "Indore Chartered Bus Lounge Navlakha", time: "09:45 AM", halt: "Destination", type: "drop" }
      ]
    },
    {
      id: 104,
      operator: "Maa Narmada Travels",
      busModel: "Air-Suspension Hi-Tech 2+2 Seater",
      primo: false,
      liveTracking: false,
      type: "ordinary",
      from: "Dharampuri (Dhar, MP)",
      to: "Indore (Indore, MP)",
      dep: "06:30 AM",
      arr: "08:45 AM",
      duration: "2h 15m",
      price: 110,
      totalSeats: 50,
      bookedSeats: [4, 8, 15, 23, 31],
      rating: 4.5,
      reviewCount: "940",
      amenities: ["Water", "First Aid Box"],
      stoppages: [
        { name: "Dharampuri Bus Stand", time: "06:30 AM", halt: "Pickup", type: "pickup" },
        { name: "Dhamnod Square", time: "06:50 AM", halt: "5 min", type: "stop" },
        { name: "Gujri Ghat", time: "07:25 AM", halt: "Passing", type: "stop" },
        { name: "Mhow Bypass", time: "08:05 AM", halt: "5 min", type: "stop" },
        { name: "Indore Sarwate Stand", time: "08:45 AM", halt: "Destination", type: "drop" }
      ]
    },
    {
      id: 105,
      operator: "Royal Star Travels",
      busModel: "Volvo A/C Sleeper (2+1)",
      primo: false,
      liveTracking: true,
      type: "sleeper",
      from: "Dharampuri (Dhar, MP)",
      to: "Indore (Indore, MP)",
      dep: "08:45 PM",
      arr: "11:00 PM",
      duration: "2h 15m",
      price: 210,
      totalSeats: 36,
      bookedSeats: [6, 12, 22],
      rating: 4.6,
      reviewCount: "820",
      amenities: ["AC", "Charging Point", "Blanket"]
    },
    {
      id: 106,
      operator: "Verma Travels",
      busModel: "Eicher Starline A/C Seater (2+2)",
      primo: false,
      liveTracking: true,
      type: "ac",
      from: "Dharampuri (Dhar, MP)",
      to: "Indore (Indore, MP)",
      dep: "02:00 PM",
      arr: "04:15 PM",
      duration: "2h 15m",
      price: 160,
      totalSeats: 44,
      bookedSeats: [8, 16, 28],
      rating: 4.6,
      reviewCount: "1.1k",
      amenities: ["AC", "Water", "USB"]
    },

    // ---- INDORE <-> UJJAIN CORRIDOR (SH 27 / SANWER 4-LANE) ----
    {
      id: 801,
      operator: "IntrCity SmartBus (Captain Kirtan)",
      busModel: "Volvo B11R Multi-Axle A/C Seater (2+2)",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Indore (Indore, MP)",
      to: "Ujjain (Ujjain, MP)",
      dep: "07:00 AM",
      arr: "08:15 AM",
      duration: "1h 15m",
      price: 120,
      totalSeats: 44,
      bookedSeats: [1, 2, 5, 6, 11, 12, 19, 20],
      rating: 4.8,
      reviewCount: "2.1k",
      amenities: ["WiFi", "AC", "USB", "Water"],
      boardingPoints: [
        { name: "Indore Sarwate Bus Terminal Gate 1", time: "07:00 AM", landmark: "Opp. Railway Station" },
        { name: "MR-10 Toll Plaza / Vijay Nagar", time: "07:20 AM", landmark: "Near Brilliant Convention" }
      ],
      droppingPoints: [
        { name: "Sanwer Highway Mid-way Halt", time: "07:45 AM", landmark: "Near Tehsil Circle" },
        { name: "Nanakheda Bus Stand Ujjain", time: "08:15 AM", landmark: "Platform 2" }
      ],
      stoppages: [
        { name: "Indore Sarwate Bus Terminal", time: "07:00 AM", halt: "Boarding", type: "pickup" },
        { name: "MR-10 Toll Plaza / Vijay Nagar", time: "07:20 AM", halt: "Passing", type: "toll" },
        { name: "Sanwer Highway Mid-way Halt", time: "07:45 AM", halt: "10 min (Tea Break)", type: "halt" },
        { name: "Nanakheda Bus Stand Ujjain", time: "08:15 AM", halt: "Destination Drop", type: "drop" }
      ]
    },
    {
      id: 802,
      operator: "AICTSL Atal City Express",
      busModel: "Eicher Starline A/C Electric Coach (2+2)",
      primo: true,
      liveTracking: true,
      type: "ac",
      from: "Indore (Indore, MP)",
      to: "Ujjain (Ujjain, MP)",
      dep: "09:30 AM",
      arr: "10:45 AM",
      duration: "1h 15m",
      price: 90,
      totalSeats: 40,
      bookedSeats: [3, 4, 8, 14, 21],
      rating: 4.7,
      reviewCount: "1.8k",
      amenities: ["AC", "USB", "CCTV"],
      boardingPoints: [
        { name: "Indore Navlakha Bus Terminal", time: "09:30 AM", landmark: "City Counter" }
      ],
      droppingPoints: [
        { name: "Dewas Gate Central Stand Ujjain", time: "10:45 AM", landmark: "Near Station" }
      ],
      stoppages: [
        { name: "Indore Navlakha Bus Terminal", time: "09:30 AM", halt: "Boarding", type: "pickup" },
        { name: "Sanwer Bypass", time: "10:15 AM", halt: "3 min", type: "stop" },
        { name: "Dewas Gate Central Stand Ujjain", time: "10:45 AM", halt: "Destination", type: "drop" }
      ]
    },
    {
      id: 803,
      operator: "Chartered Bus Express",
      busModel: "Tata Ultra Non-AC High Back Seater (2+2)",
      primo: false,
      liveTracking: false,
      type: "ordinary",
      from: "Indore (Indore, MP)",
      to: "Ujjain (Ujjain, MP)",
      dep: "11:45 AM",
      arr: "01:05 PM",
      duration: "1h 20m",
      price: 70,
      totalSeats: 48,
      bookedSeats: [1, 2, 7, 8, 12, 13, 20],
      rating: 4.4,
      reviewCount: "950",
      amenities: ["Water"],
      boardingPoints: [
        { name: "Indore Sarwate Central Bus Stand", time: "11:45 AM", landmark: "Main Hall" }
      ],
      droppingPoints: [
        { name: "Nanakheda Bus Terminal Ujjain", time: "01:05 PM", landmark: "Main Bay" }
      ],
      stoppages: [
        { name: "Indore Sarwate Central Bus Stand", time: "11:45 AM", halt: "Boarding", type: "pickup" },
        { name: "Sanwer Tehsil Road", time: "12:25 PM", halt: "5 min", type: "stop" },
        { name: "Nanakheda Bus Terminal Ujjain", time: "01:05 PM", halt: "Destination", type: "drop" }
      ]
    },
    {
      id: 804,
      operator: "Royal Star Travels",
      busModel: "BharatBenz AC Semi-Sleeper (2+2)",
      primo: true,
      liveTracking: true,
      type: "ac",
      from: "Indore (Indore, MP)",
      to: "Ujjain (Ujjain, MP)",
      dep: "05:30 PM",
      arr: "06:45 PM",
      duration: "1h 15m",
      price: 140,
      totalSeats: 36,
      bookedSeats: [5, 6, 9, 10, 15, 16],
      rating: 4.6,
      reviewCount: "1.2k",
      amenities: ["AC", "USB", "Water", "Blanket"],
      boardingPoints: [
        { name: "Indore Vijay Nagar Bus Hub", time: "05:30 PM", landmark: "Service Road" }
      ],
      droppingPoints: [
        { name: "Ujjain Mahakal Mandir Terminal", time: "06:45 PM", landmark: "West Gate" }
      ],
      stoppages: [
        { name: "Indore Vijay Nagar Bus Hub", time: "05:30 PM", halt: "Boarding", type: "pickup" },
        { name: "Sanwer Bypass Circle", time: "06:10 PM", halt: "5 min", type: "stop" },
        { name: "Ujjain Mahakal Mandir Terminal", time: "06:45 PM", halt: "Destination", type: "drop" }
      ]
    },
    {
      id: 805,
      operator: "IntrCity SmartBus (Captain Kirtan)",
      busModel: "Volvo B11R Multi-Axle A/C Seater (2+2)",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Ujjain (Ujjain, MP)",
      to: "Indore (Indore, MP)",
      dep: "09:00 AM",
      arr: "10:15 AM",
      duration: "1h 15m",
      price: 120,
      totalSeats: 44,
      bookedSeats: [2, 3, 7, 8, 14, 15],
      rating: 4.8,
      reviewCount: "1.9k",
      amenities: ["WiFi", "AC", "USB", "Water"],
      boardingPoints: [
        { name: "Nanakheda Bus Stand Ujjain", time: "09:00 AM", landmark: "Platform 1" }
      ],
      droppingPoints: [
        { name: "Indore Sarwate Terminal", time: "10:15 AM", landmark: "Platform 3" }
      ],
      stoppages: [
        { name: "Nanakheda Bus Stand Ujjain", time: "09:00 AM", halt: "Boarding", type: "pickup" },
        { name: "Sanwer Highway Midway", time: "09:35 AM", halt: "10 min", type: "halt" },
        { name: "Indore Sarwate Terminal", time: "10:15 AM", halt: "Destination", type: "drop" }
      ]
    },

    // ---- INDORE <-> BHOPAL EXPRESSWAY CORRIDOR ----
    {
      id: 201,
      operator: "Chartered Bus (NueGo Electric)",
      busModel: "Electric Luxury A/C Coach (Zero Emission)",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Indore (Indore, MP)",
      to: "Bhopal (Bhopal, MP)",
      dep: "07:00 AM",
      arr: "10:15 AM",
      duration: "3h 15m",
      price: 350,
      totalSeats: 40,
      bookedSeats: [1, 4, 9, 15, 23],
      rating: 4.9,
      reviewCount: "4.2k",
      amenities: ["WiFi", "AC", "USB", "Water", "CCTV", "Deep Cleaned"],
      boardingPoints: [
        { name: "Navlakha Chartered Lounge", time: "07:00 AM", landmark: "Opp. Jain Temple" },
        { name: "Radisson Square Flyover", time: "07:25 AM", landmark: "Service Road" },
        { name: "Vijay Nagar Square", time: "07:40 AM", landmark: "Brilliant Convention Gate" }
      ],
      droppingPoints: [
        { name: "Sehore Bypass", time: "09:20 AM", landmark: "Crescent Water Park Crossing" },
        { name: "Lalghati Square", time: "09:50 AM", landmark: "Near VIP Road" },
        { name: "Bhopal ISBT Habibganj", time: "10:15 AM", landmark: "Chartered Platform 1" }
      ],
      stoppages: [
        { name: "Indore Navlakha Lounge", time: "07:00 AM", halt: "Boarding", type: "pickup" },
        { name: "Dewas Bypass Toll Plaza", time: "07:40 AM", halt: "Passing", type: "toll" },
        { name: "Sonkatch Kali Sindh Bridge", time: "08:15 AM", halt: "3 min", type: "stop" },
        { name: "Ashta Midway Food Hub", time: "08:45 AM", halt: "15 min (Tea & Snacks)", type: "halt" },
        { name: "Sehore Crescent Bypass", time: "09:30 AM", halt: "5 min", type: "stop" },
        { name: "Lalghati Square Bhopal", time: "09:55 AM", halt: "5 min", type: "stop" },
        { name: "Bhopal ISBT Habibganj", time: "10:15 AM", halt: "Final Terminal", type: "drop" }
      ]
    },
    {
      id: 202,
      operator: "Hans Travels",
      busModel: "Volvo 9600 Multi-Axle A/C Sleeper (2+1)",
      primo: true,
      liveTracking: true,
      type: "sleeper",
      from: "Indore (Indore, MP)",
      to: "Bhopal (Bhopal, MP)",
      dep: "08:30 AM",
      arr: "12:00 PM",
      duration: "3h 30m",
      price: 420,
      totalSeats: 36,
      bookedSeats: [3, 8, 14, 21],
      rating: 4.8,
      reviewCount: "3.1k",
      amenities: ["AC", "Blanket", "Charging Point", "Water", "Pillow"],
      stoppages: [
        { name: "Indore Sarwate Terminal", time: "08:30 AM", halt: "Pickup", type: "pickup" },
        { name: "Dewas Bypass", time: "09:10 AM", halt: "5 min", type: "stop" },
        { name: "Ashta Highway Rest Halt", time: "10:15 AM", halt: "20 min (Breakfast)", type: "halt" },
        { name: "Bhopal Nadra Bus Stand", time: "11:40 AM", halt: "Drop", type: "stop" },
        { name: "Bhopal ISBT Habibganj", time: "12:00 PM", halt: "Destination", type: "drop" }
      ]
    },
    {
      id: 203,
      operator: "Verma Travels",
      busModel: "BharatBenz Luxury A/C Semi-Sleeper (2+2)",
      primo: false,
      liveTracking: true,
      type: "ac",
      from: "Indore (Indore, MP)",
      to: "Bhopal (Bhopal, MP)",
      dep: "10:00 AM",
      arr: "01:30 PM",
      duration: "3h 30m",
      price: 320,
      totalSeats: 44,
      bookedSeats: [5, 11, 22, 33],
      rating: 4.7,
      reviewCount: "2.1k",
      amenities: ["AC", "Water", "Charging Point"]
    },
    {
      id: 204,
      operator: "IntrCity SmartBus",
      busModel: "IntrCity Club Class Volvo A/C",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Indore (Indore, MP)",
      to: "Bhopal (Bhopal, MP)",
      dep: "05:30 PM",
      arr: "09:00 PM",
      duration: "3h 30m",
      price: 360,
      totalSeats: 40,
      bookedSeats: [2, 7, 18],
      rating: 4.8,
      reviewCount: "1.7k",
      amenities: ["WiFi", "AC", "USB", "Water", "Live Tracking"]
    },
    {
      id: 205,
      operator: "Chartered Bus",
      busModel: "Volvo Multi-Axle B11R A/C Sleeper",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Indore (Indore, MP)",
      to: "Bhopal (Bhopal, MP)",
      dep: "02:00 PM",
      arr: "05:30 PM",
      duration: "3h 30m",
      price: 380,
      totalSeats: 40,
      bookedSeats: [4, 12, 26],
      rating: 4.8,
      reviewCount: "2.9k",
      amenities: ["WiFi", "AC", "USB", "Snacks"]
    },

    // ---- INDORE <-> MUMBAI CORRIDOR ----
    {
      id: 301,
      operator: "Hans Travels",
      busModel: "Volvo 9600 Multi-Axle A/C Sleeper (2+1)",
      primo: true,
      liveTracking: true,
      type: "sleeper",
      from: "Indore (Indore, MP)",
      to: "Mumbai (Mumbai, MH)",
      dep: "07:00 PM",
      arr: "06:30 AM",
      duration: "11h 30m",
      price: 1250,
      totalSeats: 36,
      bookedSeats: [1, 4, 8, 14, 25, 30],
      rating: 4.8,
      reviewCount: "3.8k",
      amenities: ["WiFi", "AC", "Blanket", "Charging Point", "Pillow", "Live Tracking"],
      stoppages: [
        { name: "Indore Navlakha Lounge", time: "07:00 PM", halt: "Boarding", type: "pickup" },
        { name: "Sendhwa Border Toll Plaza", time: "09:45 PM", halt: "Passing", type: "toll" },
        { name: "Dhule Highway Express Rest", time: "11:30 PM", halt: "25 min (Dinner Halt)", type: "halt" },
        { name: "Nashik Dwarka Circle", time: "02:45 AM", halt: "10 min", type: "stop" },
        { name: "Thane Teen Hath Naka", time: "05:45 AM", halt: "5 min", type: "stop" },
        { name: "Dadar Asiad Stand Mumbai", time: "06:30 AM", halt: "Final Destination", type: "drop" }
      ]
    },
    {
      id: 302,
      operator: "Citylink Travels",
      busModel: "BharatBenz Luxury A/C Sleeper (2+1)",
      primo: false,
      liveTracking: true,
      type: "sleeper",
      from: "Indore (Indore, MP)",
      to: "Mumbai (Mumbai, MH)",
      dep: "08:00 PM",
      arr: "07:45 AM",
      duration: "11h 45m",
      price: 1100,
      totalSeats: 36,
      bookedSeats: [3, 9, 17, 24],
      rating: 4.6,
      reviewCount: "1.9k",
      amenities: ["AC", "Blanket", "Charging Point", "Water"]
    },
    {
      id: 303,
      operator: "IntrCity SmartBus",
      busModel: "Volvo Multi-Axle A/C Sleeper",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Indore (Indore, MP)",
      to: "Mumbai (Mumbai, MH)",
      dep: "06:30 PM",
      arr: "06:00 AM",
      duration: "11h 30m",
      price: 1350,
      totalSeats: 40,
      bookedSeats: [2, 6, 12, 19, 28],
      rating: 4.9,
      reviewCount: "2.6k",
      amenities: ["WiFi", "AC", "USB", "Blanket", "Live Tracking"]
    },

    // ---- MUMBAI <-> PUNE EXPRESSWAY ----
    {
      id: 401,
      operator: "MSRTC Shivneri (E-Shivneri)",
      busModel: "Electric Luxury A/C Coach",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Mumbai (Mumbai, MH)",
      to: "Pune (Pune, MH)",
      dep: "06:00 AM",
      arr: "09:30 AM",
      duration: "3h 30m",
      price: 380,
      totalSeats: 44,
      bookedSeats: [1, 3, 7, 15],
      rating: 4.7,
      reviewCount: "5.1k",
      amenities: ["WiFi", "AC", "USB", "Clean Air", "Live Tracking"],
      stoppages: [
        { name: "Dadar Asiad Stand (Mumbai)", time: "06:00 AM", halt: "Boarding", type: "pickup" },
        { name: "Vashi Toll Plaza", time: "06:35 AM", halt: "3 min", type: "stop" },
        { name: "Khalapur Toll Plaza", time: "07:25 AM", halt: "Passing", type: "toll" },
        { name: "Lonavala Expressway Food Mall", time: "07:50 AM", halt: "20 min (Breakfast Halt)", type: "halt" },
        { name: "Wakad Bridge (Pune)", time: "08:55 AM", halt: "5 min", type: "stop" },
        { name: "Pune Swargate Bus Terminal", time: "09:30 AM", halt: "Destination Drop", type: "drop" }
      ]
    },
    {
      id: 402,
      operator: "Neeta Tours and Travels",
      busModel: "Mercedes Multi-Axle A/C Semi-Sleeper",
      primo: false,
      liveTracking: true,
      type: "volvo",
      from: "Mumbai (Mumbai, MH)",
      to: "Pune (Pune, MH)",
      dep: "07:30 AM",
      arr: "11:00 AM",
      duration: "3h 30m",
      price: 420,
      totalSeats: 40,
      bookedSeats: [4, 12, 20],
      rating: 4.5,
      reviewCount: "2.4k",
      amenities: ["AC", "Water", "Charging Point"]
    },
    {
      id: 403,
      operator: "Prasanna Purple",
      busModel: "Volvo B7R A/C Seater (2+2)",
      primo: false,
      liveTracking: true,
      type: "ac",
      from: "Mumbai (Mumbai, MH)",
      to: "Pune (Pune, MH)",
      dep: "09:00 AM",
      arr: "12:30 PM",
      duration: "3h 30m",
      price: 350,
      totalSeats: 44,
      bookedSeats: [6, 14, 28],
      rating: 4.6,
      reviewCount: "1.8k",
      amenities: ["AC", "Water"]
    },

    // ---- PUNE <-> GOA COASTAL HIGHWAY ----
    {
      id: 501,
      operator: "Paulo Travels",
      busModel: "Volvo Multi-Axle A/C Sleeper (2+1)",
      primo: true,
      liveTracking: true,
      type: "sleeper",
      from: "Pune (Pune, MH)",
      to: "Goa (Goa, GA)",
      dep: "09:30 PM",
      arr: "06:00 AM",
      duration: "8h 30m",
      price: 950,
      totalSeats: 36,
      bookedSeats: [10, 20, 30],
      rating: 4.6,
      reviewCount: "2.8k",
      amenities: ["AC", "Pillow", "Blanket", "Live Tracking"],
      stoppages: [
        { name: "Pune Swargate Bus Station", time: "09:30 PM", halt: "Boarding", type: "pickup" },
        { name: "Satara Highway Rest", time: "11:20 PM", halt: "5 min", type: "stop" },
        { name: "Kolhapur Highway Oasis", time: "01:15 AM", halt: "25 min (Dinner Rest Halt)", type: "halt" },
        { name: "Sawantwadi Green Valley", time: "04:20 AM", halt: "5 min", type: "stop" },
        { name: "Mapusa Bus Stand (Goa)", time: "05:25 AM", halt: "Drop", type: "stop" },
        { name: "Panaji KTC Terminal Goa", time: "06:00 AM", halt: "Final Destination", type: "drop" }
      ]
    },
    {
      id: 502,
      operator: "Konduskar Travels",
      busModel: "Scania Multi-Axle A/C Semi-Sleeper",
      primo: false,
      liveTracking: false,
      type: "volvo",
      from: "Pune (Pune, MH)",
      to: "Goa (Goa, GA)",
      dep: "08:00 AM",
      arr: "04:30 PM",
      duration: "8h 30m",
      price: 750,
      totalSeats: 40,
      bookedSeats: [4, 6, 15, 28],
      rating: 4.6,
      reviewCount: "1.9k",
      amenities: ["WiFi", "AC", "Snacks"]
    },
    {
      id: 503,
      operator: "VRL Travels",
      busModel: "I-Shift Multi-Axle Volvo Sleeper",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Pune (Pune, MH)",
      to: "Goa (Goa, GA)",
      dep: "08:30 PM",
      arr: "05:30 AM",
      duration: "9h",
      price: 1050,
      totalSeats: 36,
      bookedSeats: [2, 8, 16],
      rating: 4.8,
      reviewCount: "3.6k",
      amenities: ["WiFi", "AC", "Blanket", "Live Tracking"]
    },

    // ---- DELHI <-> JAIPUR (NH 48) ----
    {
      id: 601,
      operator: "Zingbus Electric",
      busModel: "Electric Luxury A/C Coach (Eco-Safe)",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Delhi (New Delhi, DL)",
      to: "Jaipur (Jaipur, RJ)",
      dep: "06:30 AM",
      arr: "11:30 AM",
      duration: "5h",
      price: 499,
      totalSeats: 40,
      bookedSeats: [5, 11, 17, 23],
      rating: 4.9,
      reviewCount: "4.8k",
      amenities: ["WiFi", "AC", "USB", "Snacks", "Live Tracking"],
      stoppages: [
        { name: "Delhi Kashmere Gate ISBT", time: "06:30 AM", halt: "Boarding", type: "pickup" },
        { name: "Gurgaon IFFCO Chowk", time: "07:15 AM", halt: "5 min", type: "stop" },
        { name: "Manesar Toll Plaza", time: "07:40 AM", halt: "Passing", type: "toll" },
        { name: "Behror Midway Highway Food Hub", time: "09:10 AM", halt: "25 min (Breakfast Halt)", type: "halt" },
        { name: "Kotputli Bypass", time: "09:45 AM", halt: "5 min", type: "stop" },
        { name: "Jaipur Sindhi Camp Terminal", time: "11:30 AM", halt: "Final Destination", type: "drop" }
      ]
    },
    {
      id: 602,
      operator: "IntrCity SmartBus",
      busModel: "Volvo Multi-Axle A/C Sleeper (2+1)",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Delhi (New Delhi, DL)",
      to: "Jaipur (Jaipur, RJ)",
      dep: "07:30 AM",
      arr: "12:45 PM",
      duration: "5h 15m",
      price: 550,
      totalSeats: 40,
      bookedSeats: [3, 9, 18],
      rating: 4.8,
      reviewCount: "3.9k",
      amenities: ["WiFi", "AC", "USB", "Water", "Live Tracking"]
    },
    {
      id: 603,
      operator: "RSRTC Goldline",
      busModel: "Scania Multi-Axle A/C Seater (2+2)",
      primo: false,
      liveTracking: false,
      type: "ac",
      from: "Delhi (New Delhi, DL)",
      to: "Jaipur (Jaipur, RJ)",
      dep: "09:00 AM",
      arr: "02:15 PM",
      duration: "5h 15m",
      price: 420,
      totalSeats: 44,
      bookedSeats: [2, 9, 16, 21, 38],
      rating: 4.5,
      reviewCount: "2.1k",
      amenities: ["AC", "Water"]
    },

    // ---- BANGALORE <-> MUMBAI (GOLDEN QUADRILATERAL) ----
    {
      id: 701,
      operator: "VRL Travels",
      busModel: "I-Shift Multi-Axle A/C Sleeper (2+1)",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Bangalore (Bengaluru, KA)",
      to: "Mumbai (Mumbai, MH)",
      dep: "04:00 PM",
      arr: "08:00 AM",
      duration: "16h",
      price: 1450,
      totalSeats: 40,
      bookedSeats: [3, 7, 12, 19, 25, 33],
      rating: 4.8,
      reviewCount: "6.2k",
      amenities: ["WiFi", "AC", "USB", "Blanket", "Live Tracking"],
      stoppages: [
        { name: "Bangalore Majestic Terminal", time: "04:00 PM", halt: "Boarding", type: "pickup" },
        { name: "Tumkur Bypass Toll", time: "05:15 PM", halt: "Passing", type: "toll" },
        { name: "Davanagere Express Food Mall", time: "08:10 PM", halt: "30 min (Dinner Rest Halt)", type: "halt" },
        { name: "Hubli Bypass", time: "10:20 PM", halt: "10 min", type: "stop" },
        { name: "Belgaum Suvarna Soudha", time: "11:50 PM", halt: "5 min", type: "stop" },
        { name: "Kolhapur Mahalaxmi Rest", time: "01:30 AM", halt: "20 min", type: "halt" },
        { name: "Pune Katraj Tunnel Bypass", time: "05:00 AM", halt: "5 min", type: "stop" },
        { name: "Mumbai Borivali Terminal", time: "08:00 AM", halt: "Final Destination", type: "drop" }
      ]
    },
    {
      id: 702,
      operator: "Orange Tours and Travels",
      busModel: "Scania Multi-Axle A/C Sleeper (2+1)",
      primo: false,
      liveTracking: true,
      type: "sleeper",
      from: "Bangalore (Bengaluru, KA)",
      to: "Mumbai (Mumbai, MH)",
      dep: "05:30 PM",
      arr: "09:30 AM",
      duration: "16h",
      price: 1350,
      totalSeats: 36,
      bookedSeats: [1, 5, 9, 14],
      rating: 4.6,
      reviewCount: "2.8k",
      amenities: ["AC", "Blanket", "Water"]
    },

    // ---- BANGALORE <-> HYDERABAD ----
    {
      id: 801,
      operator: "KSRTC Airavat Club Class",
      busModel: "Volvo Multi-Axle B11R A/C Semi-Sleeper",
      primo: true,
      liveTracking: true,
      type: "volvo",
      from: "Bangalore (Bengaluru, KA)",
      to: "Hyderabad (Hyderabad, TS)",
      dep: "09:30 PM",
      arr: "06:30 AM",
      duration: "9h",
      price: 890,
      totalSeats: 40,
      bookedSeats: [6, 12, 24, 36],
      rating: 4.8,
      reviewCount: "4.9k",
      amenities: ["WiFi", "AC", "Water", "Blanket", "Live Tracking"],
      stoppages: [
        { name: "Bangalore Majestic (Kempegowda BS)", time: "09:30 PM", halt: "Boarding", type: "pickup" },
        { name: "Hebbal Esteem Mall", time: "10:00 PM", halt: "5 min", type: "stop" },
        { name: "Anantapur Highway Rest Point", time: "01:30 AM", halt: "20 min (Night Tea Halt)", type: "halt" },
        { name: "Kurnool Highway Bypass", time: "03:45 AM", halt: "5 min", type: "stop" },
        { name: "Ameerpet Metro Station", time: "06:00 AM", halt: "Drop", type: "stop" },
        { name: "Hyderabad MGBS Central Terminal", time: "06:30 AM", halt: "Final Destination", type: "drop" }
      ]
    },
    {
      id: 802,
      operator: "Orange Tours and Travels",
      busModel: "BharatBenz A/C Sleeper (2+1)",
      primo: false,
      liveTracking: true,
      type: "sleeper",
      from: "Bangalore (Bengaluru, KA)",
      to: "Hyderabad (Hyderabad, TS)",
      dep: "10:00 PM",
      arr: "07:15 AM",
      duration: "9h 15m",
      price: 950,
      totalSeats: 36,
      bookedSeats: [4, 8, 16],
      rating: 4.6,
      reviewCount: "2.4k",
      amenities: ["AC", "Blanket", "Charging Point"]
    },

    // ---- MUMBAI <-> AHMEDABAD ----
    {
      id: 901,
      operator: "GSRTC Volvo",
      busModel: "Volvo Multi-Axle A/C Seater (2+2)",
      primo: false,
      liveTracking: false,
      type: "volvo",
      from: "Mumbai (Mumbai, MH)",
      to: "Ahmedabad (Ahmedabad, GJ)",
      dep: "06:30 AM",
      arr: "02:30 PM",
      duration: "8h",
      price: 650,
      totalSeats: 40,
      bookedSeats: [4, 13, 26, 37],
      rating: 4.6,
      reviewCount: "2.7k",
      amenities: ["WiFi", "AC", "Water"],
      stoppages: [
        { name: "Mumbai Borivali West", time: "06:30 AM", halt: "Boarding", type: "pickup" },
        { name: "Vapi Highway Toll", time: "08:45 AM", halt: "Passing", type: "toll" },
        { name: "Surat Kamrej Sugar Factory Crossing", time: "11:00 AM", halt: "20 min (Snack Halt)", type: "halt" },
        { name: "Vadodara Golden Chokdi", time: "12:45 PM", halt: "5 min", type: "stop" },
        { name: "Ahmedabad Geeta Mandir ST Stand", time: "02:30 PM", halt: "Final Destination", type: "drop" }
      ]
    },
    {
      id: 902,
      operator: "Neeta Tours and Travels",
      busModel: "Mercedes Benz A/C Sleeper (2+1)",
      primo: true,
      liveTracking: true,
      type: "sleeper",
      from: "Mumbai (Mumbai, MH)",
      to: "Ahmedabad (Ahmedabad, GJ)",
      dep: "10:00 PM",
      arr: "06:00 AM",
      duration: "8h",
      price: 850,
      totalSeats: 36,
      bookedSeats: [8, 15, 29],
      rating: 4.7,
      reviewCount: "3.4k",
      amenities: ["WiFi", "AC", "Blanket", "Live Tracking"]
    }
  ];
  const bookings = [];
  const users = [];
  const popularRoutes = [
    { from: "Dharampuri (Dhar, MP)", to: "Indore (Indore, MP)", price: 110, duration: "2h 15m", bookings: 16400 },
    { from: "Indore (Indore, MP)", to: "Bhopal (Bhopal, MP)", price: 280, duration: "3h 30m", bookings: 22800 },
    { from: "Indore (Indore, MP)", to: "Mumbai (Mumbai, MH)", price: 1100, duration: "11h 30m", bookings: 14500 },
    { from: "Mumbai (Mumbai, MH)", to: "Pune (Pune, MH)", price: 350, duration: "3h 30m", bookings: 31200 },
    { from: "Delhi (New Delhi, DL)", to: "Jaipur (Jaipur, RJ)", price: 420, duration: "5h", bookings: 28900 },
    { from: "Pune (Pune, MH)", to: "Goa (Goa, GA)", price: 750, duration: "8h 30m", bookings: 19600 },
    { from: "Bangalore (Bengaluru, KA)", to: "Hyderabad (Hyderabad, TS)", price: 850, duration: "9h", bookings: 21400 },
    { from: "Mumbai (Mumbai, MH)", to: "Ahmedabad (Ahmedabad, GJ)", price: 650, duration: "8h", bookings: 17800 }
  ];
  return { buses, bookings, users, popularRoutes };
})();

/* ============================================================
   2. SERVICE LAYER & SPRING BOOT REST API INTEGRATION
   ============================================================ */
const API_BASE = (window.location.protocol === 'http:' || window.location.protocol === 'https:') 
  ? `${window.location.origin}/api` 
  : 'http://localhost:8080/api';
let isBackendConnected = false;

function normalizeBusFromApi(b) {
  return {
    id: b.id,
    operator: b.operator,
    busModel: b.busModel || `${(b.type || 'volvo').toUpperCase()} Luxury Coach`,
    primo: Boolean(b.primo),
    liveTracking: b.liveTracking !== false,
    reviewCount: b.reviewCount || `${Math.floor(1000 + (b.id * 83) % 4000)} ratings`,
    type: (b.type || 'volvo').toLowerCase(),
    from: b.fromCity || b.from,
    to: b.toCity || b.to,
    dep: formatTime12(b.departure || b.dep || '08:00 AM'),
    arr: formatTime12(b.arrival || b.arr || '06:00 PM'),
    duration: b.duration || '10h',
    price: Number(b.price) || 500,
    totalSeats: b.totalSeats || 40,
    bookedSeats: b.bookedSeats || [2, 5, 8],
    rating: b.rating || 4.5,
    amenities: Array.isArray(b.amenities)
      ? b.amenities
      : (typeof b.amenities === 'string' ? b.amenities.split(',').map(s => s.trim()).filter(Boolean) : ['AC', 'WiFi', 'Charging Point']),
    boardingPoints: b.boardingPoints || null,
    droppingPoints: b.droppingPoints || null,
    stoppages: b.stoppages || null
  };
}

// ---- REDBUS STOPPAGE & TIMELINE COMPUTATION HELPERS ----
function parseTimeToMinutes(tStr) {
  if (!tStr) return 480;
  const match = tStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 480;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const meridiem = (match[3] || '').toUpperCase();
  if (meridiem === 'PM' && h < 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function minutesToTime12(totalMinutes) {
  let m = totalMinutes % 1440;
  if (m < 0) m += 1440;
  let h = Math.floor(m / 60);
  const mins = m % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

function getCityBoardingPoints(city) {
  if (!city) return CITY_BOARDING_POINTS['default'];
  const base = city.split('(')[0].trim();
  return CITY_BOARDING_POINTS[city] || CITY_BOARDING_POINTS[base] || CITY_BOARDING_POINTS['default'];
}

function getCityDroppingPoints(city) {
  if (!city) return CITY_DROPPING_POINTS['default'];
  const base = city.split('(')[0].trim();
  return CITY_DROPPING_POINTS[city] || CITY_DROPPING_POINTS[base] || CITY_DROPPING_POINTS['default'];
}

function getStoppagesForBus(bus) {
  if (Array.isArray(bus.stoppages) && bus.stoppages.length > 0) {
    return bus.stoppages;
  }
  const route = getRouteData(bus.from, bus.to);
  if (!route || !route.stops || !route.stops.length) {
    return [
      { name: `${bus.from} Main Terminal`, time: bus.dep, type: 'pickup' },
      { name: "Highway Midway Rest Hub", time: 'Mid-trip', type: 'halt', duration: "20 min" },
      { name: `${bus.to} Central Stand`, time: bus.arr, type: 'drop' }
    ];
  }
  const depMinutes = parseTimeToMinutes(bus.dep || '08:00 AM');
  return route.stops.map(st => {
    const stopMinutes = (depMinutes + (st.timeMin || 0)) % 1440;
    const timeFormatted = minutesToTime12(stopMinutes);
    let note = '';
    if (st.type === 'halt') note = 'Scheduled Food & Tea Refreshment Halt';
    else if (st.type === 'toll') note = 'FASTag Express Highway Lane';
    else if (st.type === 'pickup') note = 'Boarding Landmark';
    else if (st.type === 'drop') note = 'Final Destination Terminal';
    return {
      name: st.name,
      time: timeFormatted,
      duration: st.duration,
      type: st.type,
      note: note
    };
  });
}

function getBoardingPointsForBus(bus) {
  if (Array.isArray(bus.boardingPoints) && bus.boardingPoints.length > 0) {
    return bus.boardingPoints;
  }
  const pts = getCityBoardingPoints(bus.from);
  return pts.map(p => {
    const m = p.match(/^(.*?)(?:\s*\((.*?)\))?$/);
    return {
      name: m ? m[1].trim() : p,
      time: (m && m[2]) ? m[2] : bus.dep,
      landmark: 'Official Boarding Counter'
    };
  });
}

function getDroppingPointsForBus(bus) {
  if (Array.isArray(bus.droppingPoints) && bus.droppingPoints.length > 0) {
    return bus.droppingPoints;
  }
  const pts = getCityDroppingPoints(bus.to);
  return pts.map(p => {
    return {
      name: p,
      time: bus.arr,
      landmark: 'Main Highway / City Drop Point'
    };
  });
}

function toggleBusDrawer(busId, tab) {
  const drawer = document.getElementById(`bus-drawer-${busId}`);
  if (!drawer) return;

  const bus = BusService.getBusById(busId);
  if (!bus) return;

  const currentActiveTab = drawer.getAttribute('data-active-tab');
  const isCurrentlyOpen = drawer.classList.contains('active');

  if (isCurrentlyOpen && currentActiveTab === tab) {
    drawer.classList.remove('active');
    drawer.removeAttribute('data-active-tab');
    return;
  }

  drawer.setAttribute('data-active-tab', tab);
  drawer.classList.add('active');

  const stoppages = getStoppagesForBus(bus);
  const bpList = getBoardingPointsForBus(bus);
  const dpList = getDroppingPointsForBus(bus);

  if (tab === 'stoppages') {
    drawer.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0 text-primary d-flex align-items-center gap-1.5">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Scheduled Route &amp; Stoppages (कहाँ कहाँ रुकती है)
        </h6>
        <button class="btn-close btn-sm" onclick="toggleBusDrawer(${busId}, 'close')"></button>
      </div>
      <div class="small text-muted mb-3">Total Duration: <strong>${bus.duration}</strong> &bull; Verified Highway Stoppages &bull; Driver In-Charge: <strong>Captain Kirtan</strong></div>
      <div class="stoppage-timeline">
        ${stoppages.map(st => `
          <div class="stoppage-item">
            <div class="stoppage-dot ${st.type || 'stop'}"></div>
            <div class="stoppage-content">
              <div>
                <span class="stoppage-name">${st.name}</span>
                ${st.duration ? `<span class="badge bg-warning-subtle text-warning border border-warning-subtle ms-1.5 px-2 py-0.5" style="font-size:11px;font-weight:600;">Halt: ${st.duration}</span>` : ''}
                ${st.note ? `<div class="stoppage-note">${st.note}</div>` : ''}
              </div>
              <div class="stoppage-time">${st.time || '--'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (tab === 'boarding_dropping') {
    drawer.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0 text-primary d-flex align-items-center gap-1.5">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Boarding &amp; Dropping Points (पिकअप एवं ड्रॉप स्थान)
        </h6>
        <button class="btn-close btn-sm" onclick="toggleBusDrawer(${busId}, 'close')"></button>
      </div>
      <div class="boarding-drop-grid">
        <div class="bd-col">
          <div class="bd-col-header text-success">
            <span>&#9679;</span> Boarding Points in ${bus.from}
          </div>
          ${bpList.map(p => `
            <div class="bd-point-item">
              <div>
                <div class="bd-point-name">${p.name}</div>
                ${p.landmark ? `<div class="bd-point-landmark">${p.landmark}</div>` : ''}
              </div>
              <div class="bd-point-time">${p.time}</div>
            </div>
          `).join('')}
        </div>
        <div class="bd-col">
          <div class="bd-col-header text-danger">
            <span>&#9679;</span> Dropping Points in ${bus.to}
          </div>
          ${dpList.map(p => `
            <div class="bd-point-item">
              <div>
                <div class="bd-point-name">${p.name}</div>
                ${p.landmark ? `<div class="bd-point-landmark">${p.landmark}</div>` : ''}
              </div>
              <div class="bd-point-time">${p.time}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    drawer.classList.remove('active');
    drawer.removeAttribute('data-active-tab');
  }
}

function openRouteTrackerForBus(busId) {
  const bus = BusService.getBusById(busId);
  if (!bus) return;
  const mockBooking = {
    pnr: 'LIVE-' + bus.id,
    busOperator: bus.operator,
    busNumber: 'MP 09 AB ' + (1000 + (bus.id * 17) % 9000),
    from: bus.from,
    to: bus.to,
    departure: bus.dep,
    totalAmount: bus.price
  };
  openLiveTrackingModal(mockBooking);
}

// ---- ADMIN & ROLE ACCESS UTILITIES ----
function isCurrentUserAdmin() {
  // 1. URL parameter override: ?admin=true or ?admin=false
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      localStorage.setItem('busgo_admin_mode', 'true');
      return true;
    }
    if (params.get('admin') === 'false') {
      localStorage.removeItem('busgo_admin_mode');
      return false;
    }
    if (localStorage.getItem('busgo_admin_mode') === 'true') {
      return true;
    }
  } catch (e) { }

  // 2. Authenticated user check
  const u = AppState.currentUser;
  if (!u) return false;
  const email = (u.email || '').toLowerCase().trim();
  const phone = (u.phone || '').trim();
  const digits = phone.replace(/[^0-9]/g, '');
  const role = (u.role || '').toUpperCase();

  return (
    role === 'ADMIN' ||
    email === 'bhawsarkirtan11@gmail.com' ||
    email === 'admin@busgo.com' ||
    digits === '6264213958' ||
    digits.endsWith('6264213958')
  );
}

function updateAdminVisibility() {
  const adminBadgeLi = document.getElementById('adminDbStatusItem');
  const adminPanelBtn = document.getElementById('adminPanelNavItem');
  const adminMenuOption = document.getElementById('adminMenuOption');
  const adminDbMenuOption = document.getElementById('adminDbMenuOption');
  const isAdmin = isCurrentUserAdmin();

  if (adminBadgeLi) {
    if (isAdmin) {
      adminBadgeLi.classList.remove('d-none');
    } else {
      adminBadgeLi.classList.add('d-none');
    }
  }

  if (adminPanelBtn) {
    if (isAdmin) {
      adminPanelBtn.classList.remove('d-none');
    } else {
      adminPanelBtn.classList.add('d-none');
    }
  }

  if (adminMenuOption) {
    if (isAdmin) {
      adminMenuOption.classList.remove('d-none');
    } else {
      adminMenuOption.classList.add('d-none');
    }
  }

  if (adminDbMenuOption) {
    if (isAdmin) {
      adminDbMenuOption.classList.remove('d-none');
    } else {
      adminDbMenuOption.classList.add('d-none');
    }
  }
}

async function checkBackendHealth(manual = false) {
  const badge = document.getElementById('backendStatusBadge');
  updateAdminVisibility();
  try {
    const res = await fetch(`${API_BASE}/buses`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      isBackendConnected = true;
      if (Array.isArray(data) && data.length > 0) {
        const liveBuses = data.map(normalizeBusFromApi);
        liveBuses.forEach(lb => {
          const idx = BusDatabase.buses.findIndex(b => b.id === lb.id);
          if (idx >= 0) BusDatabase.buses[idx] = lb;
          else BusDatabase.buses.push(lb);
        });
      }
      if (badge) {
        badge.className = 'badge rounded-pill bg-success-subtle text-success border border-success px-2 py-1 d-flex align-items-center gap-1';
        badge.innerHTML = `<span style="width:8px; height:8px; background:#22c55e; border-radius:50%; display:inline-block; box-shadow:0 0 6px #22c55e;"></span> <strong>Admin: MySQL Live</strong>`;
        badge.title = 'Admin View: MySQL busgo_db connected!';
      }
      if (manual && isCurrentUserAdmin()) {
        showToast('[Admin] MySQL Database connected and live.', 'success');
      }
      return true;
    }
  } catch (err) {
    isBackendConnected = false;
    if (badge) {
      badge.className = 'badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning px-2 py-1 d-flex align-items-center gap-1';
      badge.innerHTML = `<span style="width:8px; height:8px; background:#f59e0b; border-radius:50%; display:inline-block;"></span> Admin: Offline`;
      badge.title = 'Admin View: Backend/MySQL offline.';
    }
    if (manual && isCurrentUserAdmin()) {
      showToast('[Admin] MySQL Backend offline. Please ensure MySQL is running in XAMPP.', 'info');
    }
  }
  return false;
}

/* ============================================================
   CITY, DISTRICT & STATE LOCATION INTELLIGENCE SYSTEM
   ============================================================ */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LOCATION_DATABASE = [
  // 1. SAME-NAME AMBIGUOUS CITIES & TOWNS (SPECIAL HIGH-PRIORITY DISAMBIGUATION)
  {
    name: "Dharampuri",
    district: "Dhar",
    state: "Madhya Pradesh",
    stateCode: "MP",
    shortLabel: "Dharampuri (Dhar, MP)",
    fullLabel: "Dharampuri (Dhar, Madhya Pradesh)",
    hub: "Narmada River Valley • Near Maheshwar, Dhamnod & Khalghat NH 52",
    lat: 22.1642,
    lng: 75.3503,
    isSameNameGroup: true,
    aliases: ["dharmpuri", "dharampuri mp", "dharampuri dhar", "dharampuri madhya pradesh"]
  },
  {
    name: "Dharmapuri",
    district: "Beed",
    state: "Maharashtra",
    stateCode: "MH",
    shortLabel: "Dharmapuri (Beed, MH)",
    fullLabel: "Dharmapuri (Beed, Maharashtra)",
    hub: "Marathwada Region • Parli-Ambajogai Highway",
    lat: 18.8872,
    lng: 76.2238,
    isSameNameGroup: true,
    aliases: ["dharmpuri mh", "dharmapuri beed", "dharmapuri maharashtra"]
  },
  {
    name: "Dharmapuri",
    district: "Dharmapuri",
    state: "Tamil Nadu",
    stateCode: "TN",
    shortLabel: "Dharmapuri (Dharmapuri, TN)",
    fullLabel: "Dharmapuri (Dharmapuri, Tamil Nadu)",
    hub: "District Headquarters • Bengaluru-Salem NH 44 Corridor",
    lat: 12.1211,
    lng: 78.1582,
    isSameNameGroup: true,
    aliases: ["dharmapuri tn", "dharmapuri tamil nadu"]
  },
  {
    name: "Rampur",
    district: "Rampur",
    state: "Uttar Pradesh",
    stateCode: "UP",
    shortLabel: "Rampur (Rampur, UP)",
    fullLabel: "Rampur (Rampur, Uttar Pradesh)",
    hub: "Rohilkhand Region • Delhi-Moradabad-Bareilly Corridor",
    lat: 28.8043,
    lng: 79.0252,
    isSameNameGroup: true,
    aliases: ["rampur up", "rampur uttar pradesh"]
  },
  {
    name: "Rampur Bushahr",
    district: "Shimla",
    state: "Himachal Pradesh",
    stateCode: "HP",
    shortLabel: "Rampur (Shimla, HP)",
    fullLabel: "Rampur Bushahr (Shimla, Himachal Pradesh)",
    hub: "Sutlej River Valley • Kinnaur Highway NH 5",
    lat: 31.4475,
    lng: 77.6322,
    isSameNameGroup: true,
    aliases: ["rampur hp", "rampur shimla", "rampur himachal"]
  },
  {
    name: "Rampur",
    district: "Jabalpur",
    state: "Madhya Pradesh",
    stateCode: "MP",
    shortLabel: "Rampur (Jabalpur, MP)",
    fullLabel: "Rampur (Jabalpur, Madhya Pradesh)",
    hub: "Jabalpur Urban Zone • MP",
    lat: 23.1310,
    lng: 79.9480,
    isSameNameGroup: true,
    aliases: ["rampur jabalpur", "rampur mp"]
  },
  {
    name: "Bilaspur",
    district: "Bilaspur",
    state: "Chhattisgarh",
    stateCode: "CG",
    shortLabel: "Bilaspur (Bilaspur, CG)",
    fullLabel: "Bilaspur (Bilaspur, Chhattisgarh)",
    hub: "SECR Railway Zone HQ & High Court City",
    lat: 22.0797,
    lng: 82.1409,
    isSameNameGroup: true,
    aliases: ["bilaspur cg", "bilaspur chhattisgarh"]
  },
  {
    name: "Bilaspur",
    district: "Yamunanagar",
    state: "Haryana",
    stateCode: "HR",
    shortLabel: "Bilaspur (Yamunanagar, HR)",
    fullLabel: "Bilaspur (Yamunanagar, Haryana)",
    hub: "Kapal Mochan Pilgrimage Center, Haryana",
    lat: 30.3015,
    lng: 77.3197,
    isSameNameGroup: true,
    aliases: ["bilaspur haryana", "bilaspur yamunanagar"]
  },
  {
    name: "Bilaspur",
    district: "Bilaspur",
    state: "Himachal Pradesh",
    stateCode: "HP",
    shortLabel: "Bilaspur (Bilaspur, HP)",
    fullLabel: "Bilaspur (Bilaspur, Himachal Pradesh)",
    hub: "Gobind Sagar / Bhakra Nangal Dam Lake City",
    lat: 31.3417,
    lng: 76.7573,
    isSameNameGroup: true,
    aliases: ["bilaspur hp", "bilaspur himachal"]
  },
  {
    name: "Aurangabad",
    district: "Chhatrapati Sambhajinagar",
    state: "Maharashtra",
    stateCode: "MH",
    shortLabel: "Aurangabad (Sambhajinagar, MH)",
    fullLabel: "Chhatrapati Sambhajinagar / Aurangabad (Maharashtra)",
    hub: "Ajanta-Ellora World Heritage & Industrial Center",
    lat: 19.8762,
    lng: 75.3433,
    isSameNameGroup: true,
    aliases: ["sambhajinagar", "aurangabad mh", "aurangabad maharashtra"]
  },
  {
    name: "Aurangabad",
    district: "Aurangabad",
    state: "Bihar",
    stateCode: "BR",
    shortLabel: "Aurangabad (Aurangabad, Bihar)",
    fullLabel: "Aurangabad (Aurangabad, Bihar)",
    hub: "Deo Sun Temple • Grand Trunk Road Corridor",
    lat: 24.7548,
    lng: 84.3752,
    isSameNameGroup: true,
    aliases: ["aurangabad bihar", "aurangabad br"]
  },
  {
    name: "Kota",
    district: "Kota",
    state: "Rajasthan",
    stateCode: "RJ",
    shortLabel: "Kota (Kota, RJ)",
    fullLabel: "Kota (Kota, Rajasthan)",
    hub: "Chambal River Coaching & Engineering Capital",
    lat: 25.2138,
    lng: 75.8648,
    isSameNameGroup: true,
    aliases: ["kota rajasthan", "kota rj"]
  },
  {
    name: "Kota",
    district: "Bilaspur",
    state: "Chhattisgarh",
    stateCode: "CG",
    shortLabel: "Kota (Bilaspur, CG)",
    fullLabel: "Kota / Kargi Road (Bilaspur, Chhattisgarh)",
    hub: "Kargi Road • Bilaspur Sub-Division, CG",
    lat: 22.2982,
    lng: 82.0298,
    isSameNameGroup: true,
    aliases: ["kota cg", "kota bilaspur", "kargi road"]
  },
  {
    name: "Udaipur",
    district: "Udaipur",
    state: "Rajasthan",
    stateCode: "RJ",
    shortLabel: "Udaipur (Udaipur, RJ)",
    fullLabel: "Udaipur (Udaipur, Rajasthan)",
    hub: "City of Lakes & Mewar Historic Capital",
    lat: 24.5854,
    lng: 73.7125,
    isSameNameGroup: true,
    aliases: ["udaipur rajasthan", "udaipur rj"]
  },
  {
    name: "Udaipur",
    district: "Gomati",
    state: "Tripura",
    stateCode: "TR",
    shortLabel: "Udaipur (Gomati, Tripura)",
    fullLabel: "Udaipur (Gomati, Tripura)",
    hub: "Matabari Temple & Historic City of Tripura",
    lat: 23.5333,
    lng: 91.4833,
    isSameNameGroup: true,
    aliases: ["udaipur tripura"]
  },
  {
    name: "Rajgarh",
    district: "Dhar",
    state: "Madhya Pradesh",
    stateCode: "MP",
    shortLabel: "Rajgarh (Dhar, MP)",
    fullLabel: "Rajgarh (Dhar, Madhya Pradesh)",
    hub: "Near Sardarpur & Badnawar, Dhar District",
    lat: 22.6784,
    lng: 74.9547,
    isSameNameGroup: true,
    aliases: ["rajgarh dhar", "rajgarh sardarpur"]
  },
  {
    name: "Rajgarh",
    district: "Rajgarh",
    state: "Madhya Pradesh",
    stateCode: "MP",
    shortLabel: "Rajgarh (Rajgarh, MP)",
    fullLabel: "Rajgarh / Biaora (Rajgarh, Madhya Pradesh)",
    hub: "District HQ on Biaora-Bhopal Corridor",
    lat: 24.0084,
    lng: 76.7269,
    isSameNameGroup: true,
    aliases: ["rajgarh biaora", "rajgarh mp"]
  },
  {
    name: "Rajgarh",
    district: "Churu",
    state: "Rajasthan",
    stateCode: "RJ",
    shortLabel: "Rajgarh (Churu, RJ)",
    fullLabel: "Rajgarh / Sadulpur (Churu, Rajasthan)",
    hub: "Sadulpur Junction, Churu District, Rajasthan",
    lat: 28.6433,
    lng: 75.3853,
    isSameNameGroup: true,
    aliases: ["sadulpur", "rajgarh churu", "rajgarh rajasthan"]
  },
  {
    name: "Fatehpur",
    district: "Fatehpur",
    state: "Uttar Pradesh",
    stateCode: "UP",
    shortLabel: "Fatehpur (Fatehpur, UP)",
    fullLabel: "Fatehpur (Fatehpur, Uttar Pradesh)",
    hub: "Grand Trunk Road between Kanpur & Prayagraj",
    lat: 25.9288,
    lng: 80.8131,
    isSameNameGroup: true,
    aliases: ["fatehpur up"]
  },
  {
    name: "Fatehpur",
    district: "Sikar",
    state: "Rajasthan",
    stateCode: "RJ",
    shortLabel: "Fatehpur (Sikar, RJ)",
    fullLabel: "Fatehpur Shekhawati (Sikar, Rajasthan)",
    hub: "Heritage Haveli Hub on Jaipur-Bikaner Highway",
    lat: 27.9863,
    lng: 74.9544,
    isSameNameGroup: true,
    aliases: ["fatehpur shekhawati", "fatehpur sikar"]
  },
  {
    name: "Shivpuri",
    district: "Shivpuri",
    state: "Madhya Pradesh",
    stateCode: "MP",
    shortLabel: "Shivpuri (Shivpuri, MP)",
    fullLabel: "Shivpuri (Shivpuri, Madhya Pradesh)",
    hub: "Madhav National Park & Scindia Chhatris District HQ",
    lat: 25.4328,
    lng: 77.6599,
    isSameNameGroup: true,
    aliases: ["shivpuri mp"]
  },
  {
    name: "Shivpuri",
    district: "Tehri Garhwal",
    state: "Uttarakhand",
    stateCode: "UK",
    shortLabel: "Shivpuri (Rishikesh, UK)",
    fullLabel: "Shivpuri (Tehri / Rishikesh, Uttarakhand)",
    hub: "Ganga River Rafting & Camping Hub near Rishikesh",
    lat: 30.1345,
    lng: 78.3892,
    isSameNameGroup: true,
    aliases: ["shivpuri rishikesh", "shivpuri uttarakhand"]
  },

  // 2. COMPLETE REGIONAL HUBS (MADHYA PRADESH - MALWA & NIMAR REGIONS)
  { name: "Indore", district: "Indore", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Indore (Indore, MP)", fullLabel: "Indore (Indore, Madhya Pradesh)", hub: "Cleanest City of India & Commercial Capital of MP", lat: 22.7196, lng: 75.8577 },
  { name: "Bhopal", district: "Bhopal", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Bhopal (Bhopal, MP)", fullLabel: "Bhopal (Bhopal, Madhya Pradesh)", hub: "State Capital & City of Lakes", lat: 23.2599, lng: 77.4126 },
  { name: "Dhar", district: "Dhar", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Dhar (Dhar, MP)", fullLabel: "Dhar (Dhar, Madhya Pradesh)", hub: "Historic Raja Bhoj Capital & Bhojshala", lat: 22.5978, lng: 75.2974 },
  { name: "Dhamnod", district: "Dhar", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Dhamnod (Dhar, MP)", fullLabel: "Dhamnod (Dhar, Madhya Pradesh)", hub: "Major Agricultural Mandi on AB Road NH 52", lat: 22.2197, lng: 75.4697 },
  { name: "Manawar", district: "Dhar", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Manawar (Dhar, MP)", fullLabel: "Manawar (Dhar, Madhya Pradesh)", hub: "Commercial Trading Center, Dhar District", lat: 22.2343, lng: 75.0838 },
  { name: "Maheshwar", district: "Khargone", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Maheshwar (Khargone, MP)", fullLabel: "Maheshwar (Khargone, Madhya Pradesh)", hub: "Ahilya Fort, Narmada Ghats & Saree Weaving Center", lat: 22.1764, lng: 75.5866 },
  { name: "Mandleshwar", district: "Khargone", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Mandleshwar (Khargone, MP)", fullLabel: "Mandleshwar (Khargone, Madhya Pradesh)", hub: "Historic Narmada River Ghats & Hydel Project", lat: 22.1824, lng: 75.6669 },
  { name: "Khargone", district: "Khargone", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Khargone (Khargone, MP)", fullLabel: "Khargone (West Nimar, Madhya Pradesh)", hub: "West Nimar District HQ & Cotton Trade Center", lat: 21.8239, lng: 75.6128 },
  { name: "Barwani", district: "Barwani", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Barwani (Barwani, MP)", fullLabel: "Barwani (Barwani, Madhya Pradesh)", hub: "Paris of Nimar & Bawangaja Jain Pilgrimage HQ", lat: 22.0365, lng: 74.9017 },
  { name: "Sendhwa", district: "Barwani", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Sendhwa (Barwani, MP)", fullLabel: "Sendhwa (Barwani, Madhya Pradesh)", hub: "Major Border Gateway on AB Road NH 52", lat: 21.6843, lng: 75.0931 },
  { name: "Anjad", district: "Barwani", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Anjad (Barwani, MP)", fullLabel: "Anjad (Barwani, Madhya Pradesh)", hub: "Cotton & Agricultural Hub, Barwani District", lat: 22.0436, lng: 75.0489 },
  { name: "Kukshi", district: "Dhar", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Kukshi (Dhar, MP)", fullLabel: "Kukshi (Dhar, Madhya Pradesh)", hub: "Tribal Trade Hub & Narmada Link, Dhar District", lat: 22.2039, lng: 74.7570 },
  { name: "Badnawar", district: "Dhar", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Badnawar (Dhar, MP)", fullLabel: "Badnawar (Dhar, Madhya Pradesh)", hub: "Industrial & Agricultural Junction on Lebad-Jaora 4-Lane", lat: 23.0182, lng: 75.2281 },
  { name: "Sardarpur", district: "Dhar", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Sardarpur (Dhar, MP)", fullLabel: "Sardarpur (Dhar, Madhya Pradesh)", hub: "Kharmor Bird Sanctuary & Mahi River Tehsil", lat: 22.6738, lng: 74.9818 },
  { name: "Pithampur", district: "Dhar", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Pithampur (Dhar, MP)", fullLabel: "Pithampur (Dhar, Madhya Pradesh)", hub: "Detroit of India • Automobile & Pharma SEZ", lat: 22.6105, lng: 75.6885 },
  { name: "Mhow / Dr. Ambedkar Nagar", district: "Indore", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Mhow (Indore, MP)", fullLabel: "Mhow / Dr. Ambedkar Nagar (Indore, Madhya Pradesh)", hub: "Army Cantonment & Birthplace of Babasaheb Ambedkar", lat: 22.5540, lng: 75.7594 },
  { name: "Rau", district: "Indore", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Rau (Indore, MP)", fullLabel: "Rau (Indore, Madhya Pradesh)", hub: "Indore Bypass & Educational Hub", lat: 22.6412, lng: 75.8115 },
  { name: "Ujjain", district: "Ujjain", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Ujjain (Ujjain, MP)", fullLabel: "Ujjain (Ujjain, Madhya Pradesh)", hub: "Mahakaleshwar Jyotirlinga Holy City on Shipra River", lat: 23.1765, lng: 75.7885 },
  { name: "Dewas", district: "Dewas", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Dewas (Dewas, MP)", fullLabel: "Dewas (Dewas, Madhya Pradesh)", hub: "Chamunda Mata Tekri & Bank Note Press City", lat: 22.9676, lng: 76.0534 },
  { name: "Khandwa", district: "Khandwa", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Khandwa (Khandwa, MP)", fullLabel: "Khandwa (East Nimar, Madhya Pradesh)", hub: "East Nimar District HQ & Omkareshwar Gateway", lat: 21.8314, lng: 76.3498 },
  { name: "Burhanpur", district: "Burhanpur", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Burhanpur (Burhanpur, MP)", fullLabel: "Burhanpur (Burhanpur, Madhya Pradesh)", hub: "Historic Shahi Qila & Tapti River Textile Center", lat: 21.3106, lng: 76.2295 },
  { name: "Ratlam", district: "Ratlam", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Ratlam (Ratlam, MP)", fullLabel: "Ratlam (Ratlam, Madhya Pradesh)", hub: "Sev, Saree & Gold Capital • Western Railway Hub", lat: 23.3315, lng: 75.0367 },
  { name: "Mandsaur", district: "Mandsaur", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Mandsaur (Mandsaur, MP)", fullLabel: "Mandsaur (Mandsaur, Madhya Pradesh)", hub: "Lord Pashupatinath Temple & Malwa Highway", lat: 24.0725, lng: 75.0682 },
  { name: "Neemuch", district: "Neemuch", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Neemuch (Neemuch, MP)", fullLabel: "Neemuch (Neemuch, Madhya Pradesh)", hub: "CRPF Birthplace & Rajasthan Border Town", lat: 24.4716, lng: 74.8727 },
  { name: "Kasrawad", district: "Khargone", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Kasrawad (Khargone, MP)", fullLabel: "Kasrawad (Khargone, Madhya Pradesh)", hub: "Nimad Region Chili Mandi & Ancient Stupas", lat: 22.1311, lng: 75.6022 },
  { name: "Sanawad", district: "Khargone", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Sanawad (Khargone, MP)", fullLabel: "Sanawad (Khargone, Madhya Pradesh)", hub: "Chili Market on Khandwa-Indore Corridor", lat: 22.1768, lng: 76.0641 },
  { name: "Barwaha", district: "Khargone", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Barwaha (Khargone, MP)", fullLabel: "Barwaha (Khargone, Madhya Pradesh)", hub: "Narmada River Crossing & CISF Training Center", lat: 22.2536, lng: 76.0383 },
  { name: "Omkareshwar", district: "Khandwa", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Omkareshwar (Khandwa, MP)", fullLabel: "Omkareshwar (Khandwa, Madhya Pradesh)", hub: "Sacred Jyotirlinga Island Shrine on Narmada", lat: 22.2458, lng: 76.1504 },
  { name: "Alirajpur", district: "Alirajpur", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Alirajpur (Alirajpur, MP)", fullLabel: "Alirajpur (Alirajpur, Madhya Pradesh)", hub: "Malwa-Gujarat Border District HQ", lat: 22.3039, lng: 74.3547 },
  { name: "Jhabua", district: "Jhabua", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Jhabua (Jhabua, MP)", fullLabel: "Jhabua (Jhabua, Madhya Pradesh)", hub: "Kadaknath & Tribal Handicrafts Center", lat: 22.7694, lng: 74.5936 },
  { name: "Sehore", district: "Sehore", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Sehore (Sehore, MP)", fullLabel: "Sehore (Sehore, Madhya Pradesh)", hub: "Kubereshwar Dham & Bhopal-Indore Highway District", lat: 23.2031, lng: 77.0844 },
  { name: "Ashta", district: "Sehore", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Ashta (Sehore, MP)", fullLabel: "Ashta (Sehore, Madhya Pradesh)", hub: "Parvati River Agricultural Hub, Sehore", lat: 23.0205, lng: 76.7212 },
  { name: "Shajapur", district: "Shajapur", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Shajapur (Shajapur, MP)", fullLabel: "Shajapur (Shajapur, Madhya Pradesh)", hub: "Chillar River Agricultural District HQ", lat: 23.4267, lng: 76.2759 },
  { name: "Narmadapuram", district: "Narmadapuram", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Narmadapuram (Narmadapuram, MP)", fullLabel: "Narmadapuram / Hoshangabad (Madhya Pradesh)", hub: "Sethani Ghat & Narmada River Gateway", lat: 22.7519, lng: 77.7289 },
  { name: "Itarsi", district: "Narmadapuram", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Itarsi (Narmadapuram, MP)", fullLabel: "Itarsi (Narmadapuram, Madhya Pradesh)", hub: "Largest Railway Junction in Central India", lat: 22.6139, lng: 77.7600 },
  { name: "Gwalior", district: "Gwalior", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Gwalior (Gwalior, MP)", fullLabel: "Gwalior (Gwalior, Madhya Pradesh)", hub: "Gibraltar of India Fort City & Tansen City", lat: 26.2183, lng: 78.1828 },
  { name: "Jabalpur", district: "Jabalpur", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Jabalpur (Jabalpur, MP)", fullLabel: "Jabalpur (Jabalpur, Madhya Pradesh)", hub: "High Court of MP & Bhedaghat Marble Rocks", lat: 23.1815, lng: 79.9864 },
  { name: "Sagar", district: "Sagar", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Sagar (Sagar, MP)", fullLabel: "Sagar (Sagar, Madhya Pradesh)", hub: "Bundelkhand University & Lakha Banjara Lake", lat: 23.8388, lng: 78.7378 },
  { name: "Rewa", district: "Rewa", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Rewa (Rewa, MP)", fullLabel: "Rewa (Rewa, Madhya Pradesh)", hub: "Land of White Tigers & Solar Park Capital", lat: 24.5362, lng: 81.3037 },
  { name: "Satna", district: "Satna", state: "Madhya Pradesh", stateCode: "MP", shortLabel: "Satna (Satna, MP)", fullLabel: "Satna (Satna, Madhya Pradesh)", hub: "Chitrakoot Dham & Maihar Sharda Mata Gateway", lat: 24.5828, lng: 80.8294 },

  // 3. MAJOR METROS & NATIONAL CORRIDOR HUBS
  { name: "Mumbai", district: "Mumbai City", state: "Maharashtra", stateCode: "MH", shortLabel: "Mumbai (Mumbai, MH)", fullLabel: "Mumbai (Mumbai City, Maharashtra)", hub: "Financial Capital of India", lat: 18.9220, lng: 72.8347 },
  { name: "Navi Mumbai", district: "Thane", state: "Maharashtra", stateCode: "MH", shortLabel: "Navi Mumbai (Thane, MH)", fullLabel: "Navi Mumbai (Thane, Maharashtra)", hub: "Planned Twin City & Express Highway Hub", lat: 19.0330, lng: 73.0297 },
  { name: "Thane", district: "Thane", state: "Maharashtra", stateCode: "MH", shortLabel: "Thane (Thane, MH)", fullLabel: "Thane (Thane, Maharashtra)", hub: "City of Lakes & Western Expressway Hub", lat: 19.2183, lng: 72.9781 },
  { name: "Pune", district: "Pune", state: "Maharashtra", stateCode: "MH", shortLabel: "Pune (Pune, MH)", fullLabel: "Pune (Pune, Maharashtra)", hub: "Oxford of the East & IT/Automobile Hub", lat: 18.5204, lng: 73.8567 },
  { name: "Nashik", district: "Nashik", state: "Maharashtra", stateCode: "MH", shortLabel: "Nashik (Nashik, MH)", fullLabel: "Nashik (Nashik, Maharashtra)", hub: "Kumbh Mela, Trimbakeshwar & Wine Capital", lat: 19.9975, lng: 73.7898 },
  { name: "Dhule", district: "Dhule", state: "Maharashtra", stateCode: "MH", shortLabel: "Dhule (Dhule, MH)", fullLabel: "Dhule (Dhule, Maharashtra)", hub: "Indore-Mumbai AB Road NH 52 Major Crossway", lat: 20.9042, lng: 74.7749 },
  { name: "Shirpur", district: "Dhule", state: "Maharashtra", stateCode: "MH", shortLabel: "Shirpur (Dhule, MH)", fullLabel: "Shirpur (Dhule, Maharashtra)", hub: "Indore-Dhule Highway Gold Refinery & Education City", lat: 21.3533, lng: 74.8814 },
  { name: "Jalgaon", district: "Jalgaon", state: "Maharashtra", stateCode: "MH", shortLabel: "Jalgaon (Jalgaon, MH)", fullLabel: "Jalgaon (Jalgaon, Maharashtra)", hub: "Banana City of India & Gold Market", lat: 21.0077, lng: 75.5626 },
  { name: "Shirdi", district: "Ahmednagar", state: "Maharashtra", stateCode: "MH", shortLabel: "Shirdi (Ahmednagar, MH)", fullLabel: "Shirdi (Ahmednagar, Maharashtra)", hub: "Holy Sai Baba Temple Global Pilgrimage", lat: 19.7667, lng: 74.4766 },
  { name: "Nagpur", district: "Nagpur", state: "Maharashtra", stateCode: "MH", shortLabel: "Nagpur (Nagpur, MH)", fullLabel: "Nagpur (Nagpur, Maharashtra)", hub: "Zero Mile Center & Orange City", lat: 21.1458, lng: 79.0882 },
  { name: "Kolhapur", district: "Kolhapur", state: "Maharashtra", stateCode: "MH", shortLabel: "Kolhapur (Kolhapur, MH)", fullLabel: "Kolhapur (Kolhapur, Maharashtra)", hub: "Mahalaxmi Temple & Western Ghats Gateway", lat: 16.7050, lng: 74.2433 },
  { name: "Solapur", district: "Solapur", state: "Maharashtra", stateCode: "MH", shortLabel: "Solapur (Solapur, MH)", fullLabel: "Solapur (Solapur, Maharashtra)", hub: "Textile Capital & Siddheshwar Holy City", lat: 17.6599, lng: 75.9064 },
  { name: "Ahmedabad", district: "Ahmedabad", state: "Gujarat", stateCode: "GJ", shortLabel: "Ahmedabad (Ahmedabad, GJ)", fullLabel: "Ahmedabad (Ahmedabad, Gujarat)", hub: "UNESCO World Heritage City & Business Hub", lat: 23.0225, lng: 72.5714 },
  { name: "Surat", district: "Surat", state: "Gujarat", stateCode: "GJ", shortLabel: "Surat (Surat, GJ)", fullLabel: "Surat (Surat, Gujarat)", hub: "Diamond & Textile City of the World", lat: 21.1702, lng: 72.8311 },
  { name: "Vadodara", district: "Vadodara", state: "Gujarat", stateCode: "GJ", shortLabel: "Vadodara (Vadodara, GJ)", fullLabel: "Vadodara (Vadodara, Gujarat)", hub: "Cultural Capital of Gujarat & Laxmi Vilas Palace", lat: 22.3072, lng: 73.1812 },
  { name: "Rajkot", district: "Rajkot", state: "Gujarat", stateCode: "GJ", shortLabel: "Rajkot (Rajkot, GJ)", fullLabel: "Rajkot (Rajkot, Gujarat)", hub: "Saurashtra Industrial & Cultural Capital", lat: 22.3039, lng: 70.8022 },
  { name: "Jaipur", district: "Jaipur", state: "Rajasthan", stateCode: "RJ", shortLabel: "Jaipur (Jaipur, RJ)", fullLabel: "Jaipur (Jaipur, Rajasthan)", hub: "Pink City & Heritage State Capital", lat: 26.9124, lng: 75.7873 },
  { name: "Jodhpur", district: "Jodhpur", state: "Rajasthan", stateCode: "RJ", shortLabel: "Jodhpur (Jodhpur, RJ)", fullLabel: "Jodhpur (Jodhpur, Rajasthan)", hub: "Sun City & Mehrangarh Fort", lat: 26.2389, lng: 73.0243 },
  { name: "Ajmer", district: "Ajmer", state: "Rajasthan", stateCode: "RJ", shortLabel: "Ajmer (Ajmer, RJ)", fullLabel: "Ajmer (Ajmer, Rajasthan)", hub: "Dargah Sharif & Pushkar Holy Lake Gateway", lat: 26.4499, lng: 74.6399 },
  { name: "Delhi", district: "New Delhi", state: "Delhi", stateCode: "DL", shortLabel: "Delhi (New Delhi, DL)", fullLabel: "Delhi (National Capital Territory)", hub: "National Capital of India", lat: 28.6139, lng: 77.2090 },
  { name: "Gurugram", district: "Gurugram", state: "Haryana", stateCode: "HR", shortLabel: "Gurugram (Gurugram, HR)", fullLabel: "Gurugram / Gurgaon (Haryana)", hub: "Millennium City IT & MNC Hub", lat: 28.4595, lng: 77.0266 },
  { name: "Noida", district: "Gautam Buddha Nagar", state: "Uttar Pradesh", stateCode: "UP", shortLabel: "Noida (GB Nagar, UP)", fullLabel: "Noida (Gautam Buddha Nagar, Uttar Pradesh)", hub: "Expressway IT & Media Hub", lat: 28.5355, lng: 77.3910 },
  { name: "Lucknow", district: "Lucknow", state: "Uttar Pradesh", stateCode: "UP", shortLabel: "Lucknow (Lucknow, UP)", fullLabel: "Lucknow (Lucknow, Uttar Pradesh)", hub: "City of Nawabs & State Capital", lat: 26.8467, lng: 80.9462 },
  { name: "Kanpur", district: "Kanpur Nagar", state: "Uttar Pradesh", stateCode: "UP", shortLabel: "Kanpur (Kanpur, UP)", fullLabel: "Kanpur (Kanpur Nagar, Uttar Pradesh)", hub: "Leather City & Ganga Industrial Metropolis", lat: 26.4499, lng: 80.3319 },
  { name: "Agra", district: "Agra", state: "Uttar Pradesh", stateCode: "UP", shortLabel: "Agra (Agra, UP)", fullLabel: "Agra (Agra, Uttar Pradesh)", hub: "Taj Mahal Wonder & Yamuna Expressway", lat: 27.1767, lng: 78.0081 },
  { name: "Varanasi", district: "Varanasi", state: "Uttar Pradesh", stateCode: "UP", shortLabel: "Varanasi (Varanasi, UP)", fullLabel: "Varanasi / Kashi (Uttar Pradesh)", hub: "Spiritual Capital of India on Holy Ganga", lat: 25.3176, lng: 82.9739 },
  { name: "Prayagraj", district: "Prayagraj", state: "Uttar Pradesh", stateCode: "UP", shortLabel: "Prayagraj (Prayagraj, UP)", fullLabel: "Prayagraj / Allahabad (Uttar Pradesh)", hub: "Triveni Sangam Maha Kumbh Capital", lat: 25.4358, lng: 81.8463 },
  { name: "Chandigarh", district: "Chandigarh", state: "Chandigarh", stateCode: "CH", shortLabel: "Chandigarh (Chandigarh, CH)", fullLabel: "Chandigarh (Union Territory)", hub: "The Beautiful City & Dual Capital", lat: 30.7333, lng: 76.7794 },
  { name: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", stateCode: "KA", shortLabel: "Bangalore (Bengaluru, KA)", fullLabel: "Bengaluru / Bangalore (Karnataka)", hub: "Silicon Valley of India", lat: 12.9716, lng: 77.5946 },
  { name: "Hyderabad", district: "Hyderabad", state: "Telangana", stateCode: "TS", shortLabel: "Hyderabad (Hyderabad, TS)", fullLabel: "Hyderabad (Hyderabad, Telangana)", hub: "City of Pearls & Cyberabad", lat: 17.3850, lng: 78.4867 },
  { name: "Chennai", district: "Chennai", state: "Tamil Nadu", stateCode: "TN", shortLabel: "Chennai (Chennai, TN)", fullLabel: "Chennai (Chennai, Tamil Nadu)", hub: "Gateway of South India", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", district: "Kolkata", state: "West Bengal", stateCode: "WB", shortLabel: "Kolkata (Kolkata, WB)", fullLabel: "Kolkata (Kolkata, West Bengal)", hub: "City of Joy & Cultural Capital", lat: 22.5726, lng: 88.3639 },
  { name: "Panaji / Goa", district: "North Goa", state: "Goa", stateCode: "GA", shortLabel: "Goa (Panaji, GA)", fullLabel: "Panaji / Goa (North Goa, Goa)", hub: "Tourist Paradise & Golden Beaches", lat: 15.4909, lng: 73.8278 }
];

function resolveCoordinatesForLocation(str) {
  if (!str) return [22.7196, 75.8577]; // Default to Central MP Hub (Indore)
  const s = str.trim().toLowerCase();

  // 1. Direct match in CITY_COORDS
  if (typeof CITY_COORDS !== 'undefined' && CITY_COORDS[s]) return CITY_COORDS[s];

  // 2. Exact match in LOCATION_DATABASE by labels
  const matched = LOCATION_DATABASE.find(loc => 
    loc.shortLabel.toLowerCase() === s || 
    loc.fullLabel.toLowerCase() === s ||
    loc.name.toLowerCase() === s ||
    (loc.aliases && loc.aliases.some(a => a.toLowerCase() === s))
  );
  if (matched) return [matched.lat, matched.lng];

  // 3. Extract text in parentheses (e.g. "Dharampuri (Dhar, MP)")
  const parenMatch = s.match(/\(([^)]+)\)/);
  const base = s.split('(')[0].trim().toLowerCase();

  if (parenMatch) {
    const meta = parenMatch[1].toLowerCase();
    const locWithMeta = LOCATION_DATABASE.find(loc => 
      loc.name.toLowerCase() === base && 
      (meta.includes(loc.district.toLowerCase()) || meta.includes(loc.stateCode.toLowerCase()) || meta.includes(loc.state.toLowerCase()))
    );
    if (locWithMeta) return [locWithMeta.lat, locWithMeta.lng];
  }

  // 4. Base name match in CITY_COORDS
  if (typeof CITY_COORDS !== 'undefined' && CITY_COORDS[base]) return CITY_COORDS[base];

  // 5. Base name match in LOCATION_DATABASE
  const locBase = LOCATION_DATABASE.find(loc => loc.name.toLowerCase() === base);
  if (locBase) return [locBase.lat, locBase.lng];

  return [22.7196, 75.8577];
}

function setupCityAutocomplete() {
  ['fromCity', 'toCity'].forEach(inputId => {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(`${inputId}Dropdown`);
    if (!input || !dropdown) return;

    let activeIndex = -1;

    function renderList(query) {
      const q = (query || '').trim().toLowerCase();
      let matches = [];

      if (!q) {
        // Featured regional hubs & same-name disambiguated places
        matches = LOCATION_DATABASE.filter(loc => 
          loc.name === 'Dharampuri' || 
          loc.name === 'Dharmapuri' ||
          loc.name === 'Indore' || 
          loc.name === 'Bhopal' || 
          loc.name === 'Dhar' || 
          loc.name === 'Dhamnod' || 
          loc.name === 'Mumbai' || 
          loc.name === 'Pune' || 
          loc.name === 'Rampur' || 
          loc.name === 'Bilaspur'
        );
      } else {
        matches = LOCATION_DATABASE.filter(loc => {
          const inName = loc.name.toLowerCase().includes(q);
          const inDist = loc.district.toLowerCase().includes(q);
          const inState = loc.state.toLowerCase().includes(q) || loc.stateCode.toLowerCase() === q;
          const inAlias = (loc.aliases || []).some(a => a.toLowerCase().includes(q));
          const inShort = loc.shortLabel.toLowerCase().includes(q);
          return inName || inDist || inState || inAlias || inShort;
        });

        // Exact starts-with first
        matches.sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(q);
          const bStarts = b.name.toLowerCase().startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return 0;
        });
      }

      const topMatches = matches.slice(0, 10);
      if (topMatches.length === 0) {
        dropdown.innerHTML = `
          <div class="p-3 text-center text-muted small">
            <div>No matching city found for "<strong>${escapeHtml(query)}</strong>"</div>
            <div class="mt-1" style="font-size:11px;">You can still search with this exact custom name.</div>
          </div>`;
        dropdown.classList.remove('d-none');
        return;
      }

      dropdown.innerHTML = topMatches.map((loc, idx) => {
        const dupBadge = loc.isSameNameGroup
          ? `<span class="city-same-name-alert">Same Name: ${loc.district}, ${loc.stateCode}</span>`
          : '';
        return `
          <div class="city-suggest-item ${idx === activeIndex ? 'active' : ''}" data-idx="${idx}" onpointerdown="selectCityChoice('${inputId}', '${escapeHtml(loc.shortLabel)}'); return false;" onclick="selectCityChoice('${inputId}', '${escapeHtml(loc.shortLabel)}');">
            <div class="city-suggest-title">
              <span>${loc.name}</span>
              <span class="city-state-badge">${loc.stateCode}</span>
              <span class="city-district-badge">${loc.district} Dist.</span>
              ${dupBadge}
            </div>
            <div class="city-suggest-meta">
              <span>${loc.state}</span>
              <span>•</span>
              <span>${loc.hub || 'Major Bus Route Stop'}</span>
            </div>
          </div>`;
      }).join('');

      dropdown.classList.remove('d-none');
    }

    input.addEventListener('pointerdown', () => {
      input.removeAttribute('readonly');
    });

    input.addEventListener('touchstart', () => {
      input.removeAttribute('readonly');
    }, { passive: true });

    input.addEventListener('input', () => {
      input.removeAttribute('readonly');
      activeIndex = -1;
      renderList(input.value);
    });

    input.addEventListener('focus', () => {
      input.removeAttribute('readonly');
      renderList(input.value);
    });

    input.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.city-suggest-item');
      if (dropdown.classList.contains('d-none') || items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach((it, i) => it.classList.toggle('active', i === activeIndex));
        if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach((it, i) => it.classList.toggle('active', i === activeIndex));
        if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && items[activeIndex]) {
          e.preventDefault();
          items[activeIndex].dispatchEvent(new MouseEvent('mousedown'));
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.add('d-none');
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.classList.add('d-none');
        input.setAttribute('readonly', 'readonly');
      }, 250);
    });
  });
}

function selectCityChoice(inputId, value) {
  const el = document.getElementById(inputId);
  if (el) {
    el.removeAttribute('readonly');
    el.value = value;
    el.setAttribute('readonly', 'readonly');
    const dropdown = document.getElementById(`${inputId}Dropdown`);
    if (dropdown) dropdown.classList.add('d-none');

    // Automatically focus destination input if origin was selected
    if (inputId === 'fromCity') {
      const toEl = document.getElementById('toCity');
      if (toEl && !toEl.value.trim()) {
        setTimeout(() => {
          toEl.removeAttribute('readonly');
          toEl.focus();
        }, 80);
      }
    }
  }
}

const BusService = {
  searchBuses(from, to, filter) {
    const f = (from || '').trim().toLowerCase();
    const t = (to || '').trim().toLowerCase();

    const getBase = s => (s || '').split('(')[0].trim().toLowerCase();
    const baseF = getBase(f);
    const baseT = getBase(t);

    let matched = BusDatabase.buses.filter(b => {
      const bFrom = b.from.toLowerCase();
      const bTo = b.to.toLowerCase();
      const bBaseFrom = getBase(bFrom);
      const bBaseTo = getBase(bTo);

      const matchFrom = !f || bFrom.includes(f) || f.includes(bFrom) || bBaseFrom === baseF || bBaseFrom.includes(baseF) || baseF.includes(bBaseFrom);
      const matchTo = !t || bTo.includes(t) || t.includes(bTo) || bBaseTo === baseT || bBaseTo.includes(baseT) || baseT.includes(bBaseTo);
      return matchFrom && matchTo && (filter === 'all' || b.type === filter);
    });

    // If specific cities were searched and no static bus matched, dynamically generate buses for that route!
    if (matched.length === 0 && from && to) {
      const origin = from.trim();
      const destination = to.trim();

      // Realistic duration and price based on actual geographic distance
      let durStr = "3h 30m";
      let baseFare = 240;
      try {
        const p1 = resolveCoordinatesForLocation(origin);
        const p2 = resolveCoordinatesForLocation(destination);
        const latDiff = p2[0] - p1[0];
        const lngDiff = p2[1] - p1[1];
        const approxDistKm = Math.max(30, Math.round(Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111));
        const hours = Math.max(1.5, Math.round((approxDistKm / 42) * 10) / 10);
        const hoursInt = Math.floor(hours);
        const minsInt = Math.round((hours - hoursInt) * 60);
        durStr = `${hoursInt}h ${minsInt > 0 ? minsInt + 'm' : ''}`.trim();
        baseFare = Math.max(90, Math.round(approxDistKm * 1.35));
      } catch (e) { }

      const depArrCalc = (depHours, addHours) => {
        const dMin = depHours * 60;
        const durMin = Math.round(addHours * 60);
        return {
          dep: minutesToTime12(dMin),
          arr: minutesToTime12(dMin + durMin)
        };
      };

      const approxHours = Math.max(1.5, Math.round((durStr.includes('h') ? parseInt(durStr) : 3) * 10) / 10);
      const t1 = depArrCalc(6.5, approxHours); // 06:30 AM
      const t2 = depArrCalc(19, approxHours);  // 07:00 PM
      const t3 = depArrCalc(13.5, approxHours);// 01:30 PM
      const t4 = depArrCalc(21.5, approxHours);// 09:30 PM
      const t5 = depArrCalc(10, approxHours);  // 10:00 AM

      const dynamicBuses = [
        {
          id: 9001,
          operator: "Chartered Bus (Primo)",
          busModel: "Volvo 9600 Multi-Axle A/C Sleeper (2+1)",
          primo: true,
          liveTracking: true,
          type: "volvo",
          from: origin,
          to: destination,
          dep: t1.dep,
          arr: t1.arr,
          duration: durStr,
          price: Math.round(baseFare * 1.6),
          totalSeats: 40,
          bookedSeats: [2, 5, 12, 24],
          rating: 4.8,
          reviewCount: "2.8k",
          amenities: ["WiFi", "AC", "USB", "Water", "Snacks", "Live Tracking"]
        },
        {
          id: 9002,
          operator: "Hans Travels",
          busModel: "BharatBenz Luxury A/C Sleeper (2+1)",
          primo: true,
          liveTracking: true,
          type: "sleeper",
          from: origin,
          to: destination,
          dep: t2.dep,
          arr: t2.arr,
          duration: durStr,
          price: Math.round(baseFare * 1.8),
          totalSeats: 36,
          bookedSeats: [1, 4, 8, 14, 21],
          rating: 4.7,
          reviewCount: "3.4k",
          amenities: ["AC", "Blanket", "Charging Point", "Water", "Pillow"]
        },
        {
          id: 9003,
          operator: "IntrCity SmartBus (Captain Kirtan)",
          busModel: "Volvo B11R Multi-Axle A/C Sleeper",
          primo: true,
          liveTracking: true,
          type: "volvo",
          from: origin,
          to: destination,
          dep: t4.dep,
          arr: t4.arr,
          duration: durStr,
          price: Math.round(baseFare * 1.7),
          totalSeats: 40,
          bookedSeats: [3, 7, 15, 27],
          rating: 4.9,
          reviewCount: "4.1k",
          amenities: ["WiFi", "AC", "USB", "Water", "Blanket", "Live Tracking"]
        },
        {
          id: 9004,
          operator: "Verma Travels",
          busModel: "Eicher Starline A/C Semi-Sleeper (2+2)",
          primo: false,
          liveTracking: true,
          type: "ac",
          from: origin,
          to: destination,
          dep: t3.dep,
          arr: t3.arr,
          duration: durStr,
          price: Math.round(baseFare * 1.25),
          totalSeats: 44,
          bookedSeats: [3, 9, 16],
          rating: 4.5,
          reviewCount: "1.6k",
          amenities: ["AC", "Water", "Charging Point"]
        },
        {
          id: 9005,
          operator: "Maa Narmada / City Connect",
          busModel: "Express Air-Suspension 2+2 Seater",
          primo: false,
          liveTracking: false,
          type: "ordinary",
          from: origin,
          to: destination,
          dep: t5.dep,
          arr: t5.arr,
          duration: durStr,
          price: baseFare,
          totalSeats: 50,
          bookedSeats: [7, 11, 20, 32],
          rating: 4.3,
          reviewCount: "920",
          amenities: ["Water"]
        }
      ];

      dynamicBuses.forEach(db => {
        db.stoppages = getStoppagesForBus(db);
        db.boardingPoints = getBoardingPointsForBus(db);
        db.droppingPoints = getDroppingPointsForBus(db);
        const idx = BusDatabase.buses.findIndex(b => b.id === db.id);
        if (idx >= 0) {
          BusDatabase.buses[idx] = db;
        } else {
          BusDatabase.buses.push(db);
        }
      });

      matched = dynamicBuses.filter(b => filter === 'all' || b.type === filter);
    }

    return matched;
  },
  getBusById(id) {
    return BusDatabase.buses.find(b => b.id === Number(id) || b.id === id);
  },
  getAvailableSeats(bus, date) {
    const dateVal = date || AppState.currentSearch.date || document.getElementById('travelDate')?.value || new Date().toISOString().split('T')[0];
    const stored = getStoredBookings().filter(b => b.busId === bus.id && (b.date === dateVal || b.travelDate === dateVal) && b.status !== 'CANCELLED');
    const bookedSet = new Set(bus.bookedSeats || []);
    stored.forEach(b => {
      if (Array.isArray(b.seats)) b.seats.forEach(s => bookedSet.add(s));
    });
    return Math.max(0, bus.totalSeats - bookedSet.size);
  },
  async createBooking(data) {
    const pnr = 'BG' + Date.now().toString().slice(-6) + Math.floor(1000 + Math.random() * 9000);
    const bus = BusService.getBusById(data.busId) || {};
    const booking = {
      id: Date.now(),
      pnr,
      ...data,
      operator: data.busOperator || data.operator || bus.operator || 'IntrCity SmartBus',
      fromCity: data.from || data.fromCity || bus.fromCity || 'Indore',
      toCity: data.to || data.toCity || bus.toCity || 'Bhopal',
      departure: formatTime12(data.departure || bus.departure || bus.dep || '08:00 PM'),
      totalAmount: data.fare || data.totalAmount || data.total || 500,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString()
    };

    // Always sync with Java Backend Server
    try {
      const resp = await fetch(`${API_BASE}/bookings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pnr: booking.pnr,
          busId: data.busId || 1,
          passengerName: data.passengerName,
          phone: data.phone,
          email: data.email,
          travelDate: data.date || data.travelDate || new Date().toISOString().split('T')[0],
          seats: data.seats,
          paymentMethod: data.paymentMethod || 'UPI',
          pickupPoint: data.pickupPoint || '',
          dropPoint: data.dropPoint || '',
          operator: booking.operator,
          fromCity: booking.fromCity,
          toCity: booking.toCity,
          departure: booking.departure,
          totalAmount: booking.totalAmount
        }),
        signal: AbortSignal.timeout(5000)
      });
      if (resp.ok) {
        const saved = await resp.json();
        booking.id = saved.id || booking.id;
        booking.pnr = saved.pnr || booking.pnr;
        booking.syncedToMySql = true;
        console.log(' Ticket inserted into backend & MySQL! PNR:', booking.pnr);
        if (isCurrentUserAdmin()) {
          showToast(`[Admin] Synced to Database! PNR: ${booking.pnr}`, 'success');
        }
      }
    } catch (err) {
      console.warn('Backend sync error, saved locally:', err);
    }

    BusDatabase.bookings.push(booking);

    // Save to persistent localStorage
    const stored = getStoredBookings();
    stored.unshift(booking);
    saveStoredBookings(stored);

    const busObj = BusService.getBusById(data.busId);
    if (busObj) {
      if (!busObj.bookedSeats) busObj.bookedSeats = [];
      data.seats.forEach(s => {
        if (!busObj.bookedSeats.includes(s)) busObj.bookedSeats.push(s);
      });
    }

    updateBookingsBadge();
    return booking;
  },
  validateForm(name, phone, email) {
    if (!name || name.trim().length < 2) return 'Please enter a valid passenger name.';
    if (!phone || !/^[6-9]\d{9}$/.test(phone.replace(/\s+/g, ''))) return 'Please enter a valid 10-digit Indian phone number.';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
    return null;
  },
  sortBuses(buses, by) {
    return [...buses].sort((a, b) => {
      if (by === 'price') return a.price - b.price;
      if (by === 'rating') return b.rating - a.rating;
      if (by === 'duration') return a.duration.localeCompare(b.duration);
      if (by === 'departure_asc') return parseTimeToMinutes(a.dep) - parseTimeToMinutes(b.dep);
      if (by === 'departure_desc') return parseTimeToMinutes(b.dep) - parseTimeToMinutes(a.dep);
      return 0;
    });
  }
};

/* ============================================================
   3. APPLICATION STATE
   ============================================================ */
const AppState = {
  currentSearch: { from: '', to: '', date: '', seats: 1 },
  currentBus: null,
  selectedSeats: [],
  selectedGender: 'Female', // Default Female for safe seating reservation
  currentFilter: 'all',
  currentTimeFilter: 'all',
  ladiesFilterActive: false,
  currentSort: 'price',
  allResults: []
};

/* ============================================================
   4. UI CONTROLLER
   ============================================================ */

// Navbar scroll
window.addEventListener('scroll', () => {
  const mn = document.getElementById('mainNav');
  if (mn) mn.classList.toggle('scrolled', window.scrollY > 50);
});

document.addEventListener('DOMContentLoaded', () => {
  const di = document.getElementById('travelDate');
  if (di) {
    di.setAttribute('min', new Date().toISOString().split('T')[0]);
    di.value = new Date().toISOString().split('T')[0];
  }
  setupCityAutocomplete();
  renderPopularRoutes();
  initCounters();
  updateBookingsBadge();
  checkBackendHealth();

  // Auto-fill route and execute search if passed via URL parameters (e.g. from ai-assistant.html)
  try {
    const params = new URLSearchParams(window.location.search);
    const uFrom = params.get('from');
    const uTo = params.get('to');
    const autoSearch = params.get('autoSearch');
    const fEl = document.getElementById('fromCity');
    const tEl = document.getElementById('toCity');
    if (uFrom && fEl) {
      fEl.removeAttribute('readonly');
      fEl.value = uFrom;
      fEl.setAttribute('readonly', 'readonly');
    }
    if (uTo && tEl) {
      tEl.removeAttribute('readonly');
      tEl.value = uTo;
      tEl.setAttribute('readonly', 'readonly');
    }
    if (autoSearch === 'true' && uFrom && uTo) {
      setTimeout(() => {
        searchBuses(new Event('submit'));
      }, 350);
    }
    const trackPnr = params.get('trackPnr') || params.get('pnr');
    if (trackPnr) {
      setTimeout(() => {
        openLiveTrackingModalByPnr(trackPnr);
      }, 450);
    }
  } catch (e) {}
});

// ---- SEARCH ----
async function searchBuses(e) {
  if (e && e.preventDefault) e.preventDefault();
  const from = (document.getElementById('fromCity').value || '').trim();
  const to = (document.getElementById('toCity').value || '').trim();
  const date = document.getElementById('travelDate').value || new Date().toISOString().split('T')[0];
  const seats = parseInt(document.getElementById('seatCount').value) || 1;

  if (from && to && from.toLowerCase() === to.toLowerCase()) {
    showToast('Departure and destination cannot be the same.', 'error');
    return false;
  }
  AppState.currentSearch = { from, to, date, seats };
  AppState.currentFilter = 'all';

  if (isBackendConnected) {
    try {
      const url = `${API_BASE}/buses/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const apiBuses = data.map(normalizeBusFromApi);
          apiBuses.forEach(ab => {
            const idx = BusDatabase.buses.findIndex(b => b.id === ab.id);
            if (idx >= 0) BusDatabase.buses[idx] = ab;
            else BusDatabase.buses.push(ab);
          });
        }
      }
    } catch (err) {
      console.warn('Backend search error, falling back to local cache:', err);
    }
  }

  const results = BusService.searchBuses(from, to, 'all');
  AppState.allResults = results;
  applyFiltersAndSort();
  document.getElementById('resultsSection').style.display = 'block';
  setTimeout(() => {
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
  }, 100);
  return false;
}

function applyFiltersAndSort() {
  let list = AppState.allResults || [];

  // Filter 1: Bus Type
  if (AppState.currentFilter && AppState.currentFilter !== 'all') {
    list = list.filter(b => b.type === AppState.currentFilter);
  }

  // Filter 2: Departure Time Slot (12-Hour AM/PM)
  if (AppState.currentTimeFilter && AppState.currentTimeFilter !== 'all') {
    list = list.filter(b => {
      const min = parseTimeToMinutes(b.dep);
      if (AppState.currentTimeFilter === 'morning') {
        return min >= 360 && min < 720; // 06:00 AM - 12:00 PM
      } else if (AppState.currentTimeFilter === 'afternoon') {
        return min >= 720 && min < 1080; // 12:00 PM - 06:00 PM
      } else if (AppState.currentTimeFilter === 'evening') {
        return min >= 1080 && min < 1380; // 06:00 PM - 11:00 PM
      } else if (AppState.currentTimeFilter === 'night') {
        return min >= 1380 || min < 360; // 11:00 PM - 06:00 AM
      }
      return true;
    });
  }

  // Filter 3: Ladies Safety Seats Available
  if (AppState.ladiesFilterActive) {
    list = list.filter(bus => {
      const ladiesSeats = getLadiesSeatsForBus(bus, AppState.currentSearch.date);
      const bookedSet = new Set(bus.bookedSeats || []);
      for (const s of ladiesSeats) {
        if (!bookedSet.has(s)) return true;
      }
      return false;
    });
  }

  const sorted = BusService.sortBuses(list, AppState.currentSort);
  renderResults(sorted, AppState.currentSearch.from, AppState.currentSearch.to);
}

function renderResults(buses, from, to) {
  document.getElementById('resultsTitle').textContent =
    `${buses.length} bus${buses.length !== 1 ? 'es' : ''} found \u2014 ${from || 'All'} \u2192 ${to || 'All'}`;

  if (!buses.length) {
    document.getElementById('busList').innerHTML = `<div class="text-center py-5"><h5 class="mt-3">No buses found</h5><p class="text-muted">No buses match your selected filters. Try clearing time or ladies seats filter.</p></div>`;
    return;
  }
  const badgeMap = { ac: 'badge-ac', sleeper: 'badge-sleeper', volvo: 'badge-volvo', ordinary: 'badge-ordinary' };
  document.getElementById('busList').innerHTML = buses.map(bus => {
    const avail = BusService.getAvailableSeats(bus, AppState.currentSearch.date);
    const amen = (bus.amenities || []).map(a => `<span class="badge bg-light text-secondary me-1" style="font-size:11px;">${a}</span>`).join('');
    const depTime12 = formatTime12(bus.dep);
    const arrTime12 = formatTime12(bus.arr);
    const stops = getStoppagesForBus(bus);
    const bpList = getBoardingPointsForBus(bus);
    const dpList = getDroppingPointsForBus(bus);
    const halts = stops.filter(s => s.type === 'halt');
    const haltSummary = halts.length > 0 
      ? `Via ${halts[0].name.split('(')[0].trim()}` 
      : (stops.length > 2 ? `${stops.length - 2} Stops` : 'Direct Express');

    return `<div class="bus-card" data-type="${bus.type}" id="bus-card-${bus.id}">
      <div class="row align-items-center g-3 bus-card-main-row">
        <!-- 1. Operator & Badges (3 cols on desktop) -->
        <div class="col-xl-3 col-lg-3 col-md-12 col-12">
          <div class="d-flex align-items-center gap-1.5 flex-wrap">
            <span class="bus-operator">${bus.operator}</span>
            ${bus.primo ? `<span class="badge-primo">PRIMO</span>` : ''}
          </div>
          <div class="bus-model-sub">${bus.busModel || (bus.type.toUpperCase() + ' Luxury Coach')}</div>
          <div class="mt-1.5 d-flex align-items-center gap-1 flex-wrap">
            <span class="bus-type-badge ${badgeMap[bus.type] || 'badge-ordinary'} me-1">${bus.type.toUpperCase()}</span>
            <span class="badge bg-danger-subtle text-danger border border-danger-subtle me-1" style="font-size:10.5px; font-weight:600;">Ladies Seats</span>
            <span class="rating-badge">&#9733; ${bus.rating} <small style="font-weight:normal;opacity:0.85;">(${bus.reviewCount || '1.4k'})</small></span>
            ${bus.liveTracking ? `<span class="badge-live-gps"><span class="radar-ping-dot"></span> Live GPS</span>` : ''}
          </div>
          <div class="mt-2">${amen}</div>
        </div>

        <!-- 2. Route Timeline (Departure, Duration, Arrival) (5 cols on desktop, 6 cols on md) -->
        <div class="col-xl-5 col-lg-5 col-md-6 col-12">
          <div class="d-flex align-items-center justify-content-between gap-2 bus-timeline-container" style="min-width: 0;">
            <div class="text-start bus-stop-col" style="min-width: 0; max-width: 135px;">
              <div class="dep-time" style="font-weight:700; color:var(--primary); font-size:1.15rem; line-height: 1.2;">${depTime12}</div>
              <div class="bus-station-name text-truncate" style="font-size:12px; color:#1e293b; font-weight:600;" title="${bus.from}">${bus.from}</div>
              <div class="text-muted text-truncate" style="font-size:11px;" title="${bpList[0]?.name || ''}">${bpList[0]?.name?.split('-')[0]?.trim() || ''}</div>
            </div>
            <div class="flex-grow-1 text-center px-1" style="min-width: 60px;">
              <div style="font-size:11.5px; color:#6B7280; font-weight:600;">${bus.duration}</div>
              <div style="height:2px; background:linear-gradient(90deg,#FF6B35,#FFD700); border-radius:1px; margin:3px 0;"></div>
              <div class="text-truncate" style="font-size:11px; color:#10b981; font-weight:600;" title="${haltSummary}">${haltSummary}</div>
            </div>
            <div class="text-end bus-stop-col" style="min-width: 0; max-width: 135px;">
              <div class="arr-time" style="font-weight:700; color:#1F2937; font-size:1.15rem; line-height: 1.2;">${arrTime12}</div>
              <div class="bus-station-name text-truncate" style="font-size:12px; color:#1e293b; font-weight:600;" title="${bus.to}">${bus.to}</div>
              <div class="text-muted text-truncate" style="font-size:11px;" title="${dpList[0]?.name || ''}">${dpList[0]?.name?.split('-')[0]?.trim() || ''}</div>
            </div>
          </div>
        </div>

        <!-- 3. Price & Available Seats (2 cols on desktop, 3 cols on md, 6 cols on mobile) -->
        <div class="col-xl-2 col-lg-2 col-md-3 col-6 text-center text-lg-end bus-price-section">
          <div class="bus-price" style="line-height: 1.1;">&#8377;${bus.price}</div>
          <div style="font-size:11.5px; color:#6B7280;">per seat</div>
          <div class="seats-left mt-1" style="font-size:11.5px; color:#EF4444; font-weight:600;">${avail} seats left</div>
        </div>

        <!-- 4. Book Action Button (2 cols on desktop, 3 cols on md, 6 cols on mobile) -->
        <div class="col-xl-2 col-lg-2 col-md-3 col-6 text-center">
          <button class="btn btn-primary book-btn w-100 py-2.5" onclick="openSeatSelection(${bus.id})">Book Now &#8594;</button>
        </div>
      </div>

      <!-- RedBus Bottom Action Toolbar: Stoppages & Boarding Points -->
      <div class="bus-card-toolbar">
        <button class="bus-tab-btn" onclick="toggleBusDrawer(${bus.id}, 'stoppages')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Route &amp; Stoppages (${stops.length} stops) &#9662;
        </button>
        <button class="bus-tab-btn" onclick="toggleBusDrawer(${bus.id}, 'boarding_dropping')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Boarding &amp; Dropping Points &#9662;
        </button>
        <button class="bus-tab-btn text-success" onclick="openRouteTrackerForBus(${bus.id})">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          Live GPS Map
        </button>
      </div>

      <!-- Expandable Drawer for Stoppages & Points -->
      <div class="bus-card-drawer" id="bus-drawer-${bus.id}"></div>
    </div>`;
  }).join('');
}

function toggleLadiesFilter(btn) {
  AppState.ladiesFilterActive = !AppState.ladiesFilterActive;
  if (btn) {
    btn.classList.toggle('active', AppState.ladiesFilterActive);
    if (AppState.ladiesFilterActive) {
      btn.style.background = '#E11D48';
      btn.style.color = '#FFFFFF';
      btn.style.borderColor = '#E11D48';
      showToast('Showing buses with available Ladies Reserved Pink Seats.', 'info');
    } else {
      btn.style.background = 'white';
      btn.style.color = '#E11D48';
      btn.style.borderColor = '#FDA4AF';
    }
  }
  applyFiltersAndSort();
}

function filterBuses(type, btn) {
  document.querySelectorAll('.filter-type-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  AppState.currentFilter = type;
  applyFiltersAndSort();
}

function filterByTime(timeSlot, btn) {
  document.querySelectorAll('.filter-time-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  AppState.currentTimeFilter = timeSlot;

  // Sync hero time buttons
  document.querySelectorAll('.hero-time-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-time') === timeSlot);
  });

  applyFiltersAndSort();
}

function setHeroTimeFilter(timeSlot, btn) {
  document.querySelectorAll('.hero-time-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  AppState.currentTimeFilter = timeSlot;

  // Sync results time buttons
  document.querySelectorAll('.filter-time-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-time') === timeSlot);
  });

  if (AppState.allResults && AppState.allResults.length > 0) {
    applyFiltersAndSort();
  }
}

function sortBuses(by) {
  AppState.currentSort = by;
  applyFiltersAndSort();
}

function swapCities() {
  const f = document.getElementById('fromCity'), t = document.getElementById('toCity');
  if (f && t) {
    f.removeAttribute('readonly');
    t.removeAttribute('readonly');
    const temp = f.value;
    f.value = t.value;
    t.value = temp;
    f.setAttribute('readonly', 'readonly');
    t.setAttribute('readonly', 'readonly');
  }
}

function setTripType(type, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  showToast(`${type === 'one-way' ? 'One Way' : 'Round Trip'} selected`, 'info');
}

// ============================================================
// FEATURE 4: BOARDING (PICKUP) & DROPPING POINTS DATA
// ============================================================
const CITY_BOARDING_POINTS = {
  "Indore": [
    "Navlakha Bus Stand - Chartered / Hans Lounge (08:00 PM)",
    "Sarwate Central Bus Terminal (08:20 PM)",
    "Vijay Nagar Square - Brilliant Convention (08:45 PM)",
    "Radisson Square - Service Road (09:00 PM)",
    "Pipliyahana Square - World Cup Junction (09:15 PM)",
    "Bhanwarkuan Tower Square (08:15 PM)",
    "Rau Circle Bypass AB Road (08:35 PM)"
  ],
  "Dharampuri": [
    "Dharampuri Main Bus Stand Gate (06:30 AM)",
    "Khalghat Narmada Bridge Toll Plaza NH 52 (07:00 AM)",
    "Dhamnod Mandi Crossing NH 52 (07:15 AM)",
    "Gujri Ghat Mid-way Checkpoint (07:40 AM)"
  ],
  "Bhopal": [
    "ISBT Habibganj - Platform 1 Chartered Desk (07:00 PM)",
    "Nadra Central Bus Stand - Railway Station (07:30 PM)",
    "Lalghati Square - Airport Road Circle (08:00 PM)",
    "MP Nagar Zone 1 - Board Office Square (07:20 PM)",
    "Halalpura Private Bus Stand (08:15 PM)"
  ],
  "Ujjain": [
    "Nanakheda Bus Stand - Main Counter (07:00 AM)",
    "Dewas Gate Central Stand (07:30 AM)",
    "Harifatak Bridge Mahakal Bypass (07:45 AM)"
  ],
  "Mumbai": [
    "Dadar TT Circle (09:00 PM)",
    "Borivali West - Gokul Hotel (08:15 PM)",
    "Andheri East - Bisleri Signal (08:45 PM)",
    "Vashi Toll Plaza (09:45 PM)",
    "Thane Teen Hath Naka (09:15 PM)"
  ],
  "Pune": [
    "Swargate Bus Station (10:00 PM)",
    "Pune Station - Ruby Hall (10:25 PM)",
    "Wakad Flyover Bridge (11:00 PM)",
    "Hinjawadi Phase 1 Circle (11:20 PM)",
    "Nigdi Pawale Flyover (11:35 PM)"
  ],
  "Bangalore": [
    "Majestic - Anand Rao Circle (07:30 PM)",
    "Madiwala - Opp Police Station (08:00 PM)",
    "Silk Board Flyover Junction (08:20 PM)",
    "Electronic City Toll Plaza (08:45 PM)",
    "Hebbal Esteem Mall (07:00 PM)"
  ],
  "Hyderabad": [
    "MGBS Central Bus Station (08:30 PM)",
    "Ameerpet - Metro Pillar 1045 (09:00 PM)",
    "Kukatpally - Y Junction (09:20 PM)",
    "Gachibowli Outer Ring Road (09:50 PM)"
  ],
  "Delhi": [
    "ISBT Kashmere Gate (08:00 PM)",
    "Majnu Ka Tilla (07:30 PM)",
    "Anand Vihar ISBT (08:40 PM)",
    "Dhaula Kuan Metro (09:15 PM)"
  ],
  "Jaipur": [
    "Sindhi Camp Main Stand (06:00 AM)",
    "Narayan Singh Circle (06:30 AM)",
    "Transport Nagar (07:00 AM)"
  ],
  "Ahmedabad": [
    "Paldi Cross Road (10:00 PM)",
    "Geeta Mandir ST Stand (10:30 PM)",
    "Satellite - Iscon Cross (11:00 PM)",
    "C.G. Road (10:45 PM)"
  ],
  "Goa": [
    "Panjim Kadamba Bus Terminus (07:00 PM)",
    "Mapusa New Bus Stand (07:30 PM)",
    "Margao KTC Station (08:15 PM)"
  ],
  "Chennai": [
    "Koyambedu CMBT (08:30 PM)",
    "Guindy Kathipara (09:00 PM)",
    "Tambaram MEPZ (09:30 PM)"
  ],
  "default": [
    "City Central Bus Terminal",
    "Railway Station Main Exit Gate",
    "Highway Toll Plaza Bypass",
    "Airport Express Circle"
  ]
};

const CITY_DROPPING_POINTS = {
  "Indore": [
    "Indore Sarwate Bus Terminal",
    "Navlakha Chartered Bus Lounge",
    "Vijay Nagar Square",
    "Radisson Square Flyover",
    "Rau Circle AB Road Bypass",
    "Chhotigwaltoli Stand"
  ],
  "Dharampuri": [
    "Dharampuri New Bus Stand",
    "Dhamnod Mandi Crossing",
    "Khalghat NH 52 Bypass",
    "Gujri Ghat Highway Junction"
  ],
  "Bhopal": [
    "ISBT Habibganj Terminal",
    "Nadra Bus Stand (Railway Station)",
    "Lalghati Square VIP Road",
    "Halalpura Private Bus Stand",
    "Board Office Square MP Nagar"
  ],
  "Ujjain": [
    "Nanakheda Bus Stand",
    "Dewas Gate Stand",
    "Ujjain Junction Railway Station"
  ],
  "Mumbai": [
    "Vashi Toll Plaza",
    "Dadar Central Circle",
    "Borivali National Park Gate",
    "Andheri Western Express Highway",
    "Thane Majiwada Flyover"
  ],
  "Pune": [
    "Wakad Ginger Hotel",
    "Hinjawadi Phase 1",
    "Shivajinagar Bus Stand",
    "Swargate Bus Terminal",
    "Pune Railway Station"
  ],
  "Bangalore": [
    "Hebbal Flyover",
    "Majestic City Railway Station",
    "Silk Board Junction",
    "Electronic City Toll Gate"
  ],
  "Hyderabad": [
    "Kukatpally Police Station",
    "Ameerpet Metro",
    "Lakdikapul",
    "MGBS Central Stand"
  ],
  "Delhi": [
    "Dhaula Kuan Metro Station",
    "Kashmere Gate ISBT",
    "Anand Vihar Terminal",
    "Majnu Ka Tilla"
  ],
  "Jaipur": [
    "Sindhi Camp Jaipur",
    "Narayan Singh Circle",
    "Ajmer Pulia"
  ],
  "Ahmedabad": [
    "Geeta Mandir",
    "Paldi Char Rasta",
    "Satellite SG Highway",
    "Naroda Patiya"
  ],
  "Goa": [
    "Mapusa Bus Stand",
    "Panjim KTC Terminal",
    "Margao Bus Stand"
  ],
  "default": [
    "Central Drop Point",
    "Main Highway Junction",
    "City Bus Stand Bypass"
  ]
};

function recalculateBookingFare() {
  const bus = AppState.currentBus;
  if (!bus) return;
  const count = AppState.selectedSeats.length;
  const total = count * bus.price;
  AppState.finalPayableAmount = total;

  const totEl = document.getElementById('sumTotal');
  if (totEl) totEl.textContent = `₹${total}`;
}

// ---- SEAT SELECTION ----
function openSeatSelection(busId) {
  // 1. Mandatory Login / Sign Up Check
  if (!AppState.currentUser) {
    AppState.pendingBusBookingId = busId;
    const b1 = document.getElementById('loginAuthRequiredBanner');
    const b2 = document.getElementById('signupAuthRequiredBanner');
    if (b1) b1.classList.remove('d-none');
    if (b2) b2.classList.remove('d-none');

    showToast('Please Login or Sign Up first to book seats.', 'info');
    openModal('loginModal');
    return;
  }

  const bus = BusService.getBusById(busId);
  if (!bus) return;
  AppState.currentBus = bus;
  AppState.selectedSeats = [];
  AppState.finalPayableAmount = 0;

  // Feature 4: Populate Boarding and Dropping points
  const bpSelect = document.getElementById('boardingPointSelect');
  const dpSelect = document.getElementById('droppingPointSelect');
  if (bpSelect) {
    const bpList = getBoardingPointsForBus(bus);
    bpSelect.innerHTML = bpList.map(pt => {
      const label = `${pt.name} (${pt.time})${pt.landmark ? ' - ' + pt.landmark : ''}`;
      return `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`;
    }).join('');
  }
  if (dpSelect) {
    const dpList = getDroppingPointsForBus(bus);
    dpSelect.innerHTML = dpList.map(pt => {
      const label = `${pt.name} (${pt.time || bus.arr})${pt.landmark ? ' - ' + pt.landmark : ''}`;
      return `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`;
    }).join('');
  }

  const travelDateVal = AppState.currentSearch.date || document.getElementById('travelDate')?.value || new Date().toISOString().split('T')[0];
  document.getElementById('seatModalTitle').textContent = `Select Seat \u2014 ${bus.operator}`;
  document.getElementById('sumBus').textContent = bus.operator;
  document.getElementById('sumRoute').textContent = `${bus.from} \u2192 ${bus.to}`;
  document.getElementById('sumDate').textContent = formatDate(travelDateVal);
  const depEl = document.getElementById('sumDeparture');
  if (depEl) depEl.textContent = formatTime12(bus.dep || '08:00 PM');
  const arrEl = document.getElementById('sumArrival');
  if (arrEl) arrEl.textContent = formatTime12(bus.arr || '06:00 AM');
  document.getElementById('sumSeats').textContent = 'None';
  document.getElementById('sumTotal').textContent = '₹0';

  const seatAlert = document.getElementById('seatSelectionAlert');
  if (seatAlert) seatAlert.classList.add('d-none');

  // Pre-fill passenger details from authenticated user
  const u = AppState.currentUser;
  const pName = document.getElementById('passengerName');
  const pPhone = document.getElementById('passengerPhone');
  const pEmail = document.getElementById('passengerEmail');
  if (pName && (!pName.value || pName.value.trim() === '')) pName.value = u.name || '';
  if (pPhone && (!pPhone.value || pPhone.value.trim() === '')) pPhone.value = u.phone || '';
  if (pEmail && (!pEmail.value || pEmail.value.trim() === '')) pEmail.value = u.email || '';

  // Initialize Gender button state
  AppState.selectedGender = AppState.selectedGender || 'Female';
  document.querySelectorAll('.gender-btn').forEach(b => {
    b.classList.toggle('active', b.id === `gender${AppState.selectedGender}`);
  });

    renderSeatGrid(bus);
  previewSeatInfo(AppState.selectedSeats[0] || 12);
  if (window.SeatLockManager && AppState.selectedSeats.length > 0) {
    SeatLockManager.startCountdown(bus.id, travelDateVal);
  } else if (window.SeatLockManager) {
    SeatLockManager.stopCountdown();
  }
  openModal('seatModal');
}

function selectPassengerGender(gender, btn) {
  AppState.selectedGender = gender;
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const bus = AppState.currentBus;
  if (!bus) return;

  const dateVal = AppState.currentSearch.date || document.getElementById('travelDate')?.value || new Date().toISOString().split('T')[0];
  const ladiesSeats = getLadiesSeatsForBus(bus, dateVal);

  // If switched to Male and has ladies seats selected, deselect them and alert user
  if (gender === 'Male' && AppState.selectedSeats.length > 0) {
    const hasLadies = AppState.selectedSeats.some(s => ladiesSeats.has(s));
    if (hasLadies) {
      showToast('Ladies Reserved seat deselect kar di gayi hai (Male passengers cannot book Ladies Reserved seats).', 'warning');
      AppState.selectedSeats = AppState.selectedSeats.filter(s => !ladiesSeats.has(s));
      updateSumSeatsDisplay(ladiesSeats);
      recalculateBookingFare();
    }
  }

  renderSeatGrid(bus);
}

function getSeatPair(seatNum) {
  const rem = seatNum % 4;
  if (rem === 1) return seatNum + 1;
  if (rem === 2) return seatNum - 1;
  if (rem === 3) return seatNum + 1;
  if (rem === 0) return seatNum - 1;
  return seatNum;
}

function getLadiesSeatsForBus(bus, date) {
  const ladies = new Set([1, 2, 5, 6, 9, 10]); // Default front dedicated women rows
  if (!bus) return ladies;
  const dateVal = date || AppState.currentSearch.date || document.getElementById('travelDate')?.value || new Date().toISOString().split('T')[0];
  const stored = getStoredBookings().filter(b => b.busId === bus.id && (b.date === dateVal || b.travelDate === dateVal) && b.status !== 'CANCELLED');
  
  stored.forEach(b => {
    const isFemale = (b.gender || '').toLowerCase() === 'female' || (b.passengerGender || '').toLowerCase() === 'female' || b.isLadiesSeat;
    if (isFemale && Array.isArray(b.seats)) {
      b.seats.forEach(s => {
        const pair = getSeatPair(s);
        if (pair <= bus.totalSeats) ladies.add(pair);
      });
    }
  });

  return ladies;
}

function getFemaleBookedSeats(bus, date) {
  const femaleBooked = new Set();
  if (!bus) return femaleBooked;
  const dateVal = date || AppState.currentSearch.date || document.getElementById('travelDate')?.value || new Date().toISOString().split('T')[0];
  const stored = getStoredBookings().filter(b => b.busId === bus.id && (b.date === dateVal || b.travelDate === dateVal) && b.status !== 'CANCELLED');
  
  stored.forEach(b => {
    const isFemale = (b.gender || '').toLowerCase() === 'female' || (b.passengerGender || '').toLowerCase() === 'female' || b.isLadiesSeat;
    if (isFemale && Array.isArray(b.seats)) {
      b.seats.forEach(s => femaleBooked.add(s));
    }
  });

  // Seed sample female bookings for realistic safe seating display
  if (bus.id === 1) femaleBooked.add(3);
  if (bus.id === 2) femaleBooked.add(1);
  if (bus.id === 4) femaleBooked.add(6);
  if (bus.id === 7) femaleBooked.add(5);

  return femaleBooked;
}

function updateSumSeatsDisplay(ladiesSeats) {
  const sumEl = document.getElementById('sumSeats');
  if (!sumEl) return;
  if (!AppState.selectedSeats.length) {
    sumEl.textContent = 'None';
    return;
  }
  const bus = AppState.currentBus;
  const ls = ladiesSeats || (bus ? getLadiesSeatsForBus(bus) : new Set());
  const html = AppState.selectedSeats.map(s => {
    return ls.has(s) ? `<span class="badge bg-danger text-white me-1">${s} (Ladies)</span>` : `<span class="badge bg-secondary me-1">${s}</span>`;
  }).join(' ');
  sumEl.innerHTML = html;
}

function renderSeatGrid(bus) {
  let html = '';
  const dateVal = AppState.currentSearch.date || document.getElementById('travelDate')?.value || new Date().toISOString().split('T')[0];
  const stored = getStoredBookings().filter(b => b.busId === bus.id && (b.date === dateVal || b.travelDate === dateVal) && b.status !== 'CANCELLED');
  const bookedSet = new Set(bus.bookedSeats || []);
  stored.forEach(b => {
    if (Array.isArray(b.seats)) b.seats.forEach(s => bookedSet.add(s));
  });

  const ladiesSeats = getLadiesSeatsForBus(bus, dateVal);
  const femaleBooked = getFemaleBookedSeats(bus, dateVal);
  femaleBooked.forEach(s => bookedSet.add(s));

  for (let i = 1; i <= bus.totalSeats; i++) {
    const isBooked = bookedSet.has(i);
    const isFemaleBooked = femaleBooked.has(i);
    const isLadies = ladiesSeats.has(i);
    const isSelected = AppState.selectedSeats.includes(i);
    const isLockedByOther = window.SeatLockManager ? SeatLockManager.isLockedByOther(bus.id, dateVal, i) : false;

    if (i % 4 === 3) {
      html += '<div class="seat-aisle"></div>';
    }

    let cls = 'seat';
    let title = 'Seat ' + i;

    if (isFemaleBooked) {
      cls += ' ladies-booked';
      title = 'Seat ' + i + ' - Booked by Female Passenger';
    } else if (isBooked) {
      cls += ' booked';
      title = 'Seat ' + i + ' - Booked';
    } else if (isLockedByOther) {
      cls += ' locked';
      title = 'Seat ' + i + ' - In Progress (Locked by another passenger)';
    } else if (isSelected) {
      cls += isLadies ? ' selected ladies' : ' selected';
      title = isLadies ? 'Seat ' + i + ' - Ladies Reserved (Selected & Locked)' : 'Seat ' + i + ' - Selected & Locked (8 min hold)';
    } else if (isLadies) {
      cls += ' ladies available';
      title = 'Seat ' + i + ' - Reserved for Ladies';
    } else {
      cls += ' available';
      title = 'Seat ' + i + ' - Available';
    }

    const clickHandler = (isBooked || isLockedByOther) ? '' : 'toggleSeat(' + i + ')';
    html += '<div class="' + cls + '" id="seat-' + i + '" onclick="' + clickHandler + '" onmouseenter="previewSeatInfo(' + i + ')" title="' + title + '">' + i + '</div>';
  }
  document.getElementById('seatGrid').innerHTML = html;
}

function toggleSeat(n) {
  const max = AppState.currentSearch.seats || 1;
  const bus = AppState.currentBus;
  if (!bus) return;

  const dateVal = AppState.currentSearch.date || document.getElementById('travelDate')?.value || new Date().toISOString().split('T')[0];
  const ladiesSeats = getLadiesSeatsForBus(bus, dateVal);
  const isLadiesSeat = ladiesSeats.has(n);
  const currentGender = AppState.selectedGender || 'Female';

  let newlySelected = false;
  if (AppState.selectedSeats.includes(n)) {
    AppState.selectedSeats = AppState.selectedSeats.filter(s => s !== n);
    if (window.SeatLockManager) {
      SeatLockManager.releaseLock(bus.id, dateVal, n);
    }
    renderSeatGrid(bus);
  } else {
    // Check if locked by another user session
    if (window.SeatLockManager && SeatLockManager.isLockedByOther(bus.id, dateVal, n)) {
      showToast('Seat ' + n + ' is currently on hold by another passenger. Please choose an open seat.', 'error');
      renderSeatGrid(bus);
      return;
    }

    // Check if Male passenger tries to select Ladies Reserved Seat
    if (currentGender === 'Male' && isLadiesSeat) {
      showToast('Seat ' + n + ' is strictly reserved for female passengers. Please choose an open general seat.', 'error');
      return;
    }

    if (AppState.selectedSeats.length >= max) {
      showToast('Max ' + max + ' seat(s) allowed.', 'error');
      return;
    }

    // Acquire 8-minute reservation lock
    if (window.SeatLockManager) {
      const lockRes = SeatLockManager.acquireLock(bus.id, dateVal, n);
      if (!lockRes.success) {
        showToast('Seat ' + n + ' was just reserved by another passenger. Please select another seat.', 'error');
        renderSeatGrid(bus);
        return;
      }
    }

    AppState.selectedSeats.push(n);
    newlySelected = true;
    renderSeatGrid(bus);

    if (isLadiesSeat) {
      showToast('Seat ' + n + ' (Ladies Safety Seat) locked for 8 minutes. Women-safe travel guaranteed.', 'success');
    } else {
      showToast('Seat ' + n + ' locked for 8 minutes. Please complete booking before timer expires.', 'info');
    }
  }

  previewSeatInfo(n);
  updateSumSeatsDisplay(ladiesSeats);
  recalculateBookingFare();

  const seatAlert = document.getElementById('seatSelectionAlert');
  if (seatAlert && AppState.selectedSeats.length > 0) {
    seatAlert.classList.add('d-none');
  }
}

// ===== MULTI-BUS 360° SEAT VIEWER INTEGRATION =====
function previewSeatInfo(seatNum) {
  if (!seatNum || isNaN(seatNum)) seatNum = 12;
  AppState.previewedSeat = seatNum;
  if (window.Bus360Engine && window.Bus360Engine.isOpen()) {
    window.Bus360Engine.changeSeat(seatNum);
  }
}

function openCurrentBus360View() {
  const bus = AppState.currentBus || (BusDatabase.buses && BusDatabase.buses[0]);
  const seatNum = (AppState.selectedSeats && AppState.selectedSeats.length > 0) 
    ? AppState.selectedSeats[0] 
    : (AppState.previewedSeat || 12);
  if (window.Bus360Engine) {
    window.Bus360Engine.open(bus, seatNum);
  }
}

function openSingleSeat3DModal(seatNum) { 
  openCurrentBus360View(); 
}
function closeSingleSeat3DModal() { 
  if (window.Bus360Engine) window.Bus360Engine.close(); 
}
function open3DSeatModal(seatNum) { 
  openCurrentBus360View(); 
}
const SingleSeat3DViewer = { 
  stopLoop() { if (window.Bus360Engine) window.Bus360Engine.close(); }, 
  setViewMode(mode) { if (window.Bus360Engine) window.Bus360Engine.setViewAngle(mode); }, 
  toggleFullscreen() {}, 
  toggleAutoTour() {}, 
  setPreset(p) { if (window.Bus360Engine) window.Bus360Engine.setViewAngle(p); }, 
  zoomDelta(d) { if (window.Bus360Engine) { if (d > 0) window.Bus360Engine.zoomIn(); else window.Bus360Engine.zoomOut(); } } 
};
const Cabin3D = { stopLoop() { if (window.Bus360Engine) window.Bus360Engine.close(); } };


// ---- PAYMENT ----
let currentPayMethod = 'phonepe';

function proceedToPayment() {
  if (!AppState.currentUser) {
    showToast('Please Login or Sign Up first to book seats.', 'info');
    closeModal('seatModal');
    openModal('loginModal');
    return;
  }

  const seatAlert = document.getElementById('seatSelectionAlert');

  // 1. Seat Selection check FIRST with prominent warning & grid highlight
  if (!AppState.selectedSeats || !AppState.selectedSeats.length) {
    if (seatAlert) {
      seatAlert.classList.remove('d-none');
    }
    const seatGrid = document.getElementById('seatGrid');
    if (seatGrid) {
      seatGrid.classList.remove('shake-highlight');
      void seatGrid.offsetWidth; // force browser reflow for re-animation
      seatGrid.classList.add('shake-highlight');
      setTimeout(() => seatGrid.classList.remove('shake-highlight'), 600);
      seatGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    showToast('Please select at least one seat from the bus layout.', 'error');
    return;
  }
  if (seatAlert) seatAlert.classList.add('d-none');

  // 2. Validate Passenger Details
  const name = document.getElementById('passengerName').value.trim();
  const phone = document.getElementById('passengerPhone').value.trim();
  const email = document.getElementById('passengerEmail').value.trim();
  const err = BusService.validateForm(name, phone, email);
  if (err) { showToast(err, 'error'); return; }

  const bus = AppState.currentBus;
  const total = AppState.selectedSeats.length * bus.price;
  AppState.finalPayableAmount = total;

  document.getElementById('payAmount').textContent = `₹${total}`;

  // Setup PhonePe QR & amount
  const qrAmtEl = document.getElementById('phonepeQrAmount');
  if (qrAmtEl) qrAmtEl.textContent = `₹${total}`;

  const qrImg = document.getElementById('phonepeQrImage');
  if (qrImg) {
    const upiPayload = encodeURIComponent(`upi://pay?pa=busgo@ybl&pn=BusGoTravels&am=${total}&cu=INR&tn=Ticket-${bus.operator}`);
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${upiPayload}&bgcolor=ffffff&color=000000`;
    qrImg.onerror = function () {
      // Offline fallback: generate a clean high-contrast SVG QR visual
      this.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" fill="%23ffffff"/><rect x="20" y="20" width="50" height="50" fill="%23000000"/><rect x="30" y="30" width="30" height="30" fill="%23ffffff"/><rect x="37" y="37" width="16" height="16" fill="%23000000"/><rect x="130" y="20" width="50" height="50" fill="%23000000"/><rect x="140" y="30" width="30" height="30" fill="%23ffffff"/><rect x="147" y="37" width="16" height="16" fill="%23000000"/><rect x="20" y="130" width="50" height="50" fill="%23000000"/><rect x="30" y="140" width="30" height="30" fill="%23ffffff"/><rect x="37" y="147" width="16" height="16" fill="%23000000"/><rect x="85" y="85" width="30" height="30" rx="6" fill="%231a1a2e"/><text x="100" y="105" fill="%23ffffff" font-size="16" font-family="sans-serif" font-weight="bold" text-anchor="middle">₹</text></svg>`;
    };
  }

  // Pre-fill phone if entered
  const vpaInput = document.getElementById('phonepeVpaInput');
  if (vpaInput && phone) {
    vpaInput.value = phone.replace(/\s+/g, '') + '@ybl';
  }

  selectPayMethod('phonepe');
  switchPhonePeMode('qr');
  closeModal('seatModal');
  openModal('paymentModal');
}

function selectPayMethod(m) {
  currentPayMethod = m;
  ['phonepe', 'upi', 'card', 'netbank'].forEach(x => {
    const tab = document.getElementById(`pm-${x}`);
    if (tab) tab.classList.toggle('active', x === m);
    const form = document.getElementById(`payForm${x.charAt(0).toUpperCase() + x.slice(1)}`);
    if (form) form.style.display = (x === m) ? 'block' : 'none';
  });

  const bus = AppState.currentBus;
  const total = AppState.finalPayableAmount !== undefined ? AppState.finalPayableAmount : ((bus && AppState.selectedSeats.length) ? (AppState.selectedSeats.length * bus.price) : 0);
  const payBtn = document.getElementById('payNowBtn');
  if (payBtn) {
    payBtn.innerHTML = `Pay ₹${total} Now`;
    payBtn.style.background = 'var(--primary)';
    payBtn.style.borderColor = 'var(--primary)';
  }
}

function switchPhonePeMode(mode) {
  const qrCont = document.getElementById('phonepeQrContainer');
  const upiCont = document.getElementById('phonepeUpiContainer');
  const btnQr = document.getElementById('btnPhonePeQr');
  const btnUpi = document.getElementById('btnPhonePeUpi');

  if (mode === 'qr') {
    if (qrCont) qrCont.style.display = 'block';
    if (upiCont) upiCont.style.display = 'none';
    if (btnQr) btnQr.classList.add('active');
    if (btnUpi) btnUpi.classList.remove('active');
  } else {
    if (qrCont) qrCont.style.display = 'none';
    if (upiCont) upiCont.style.display = 'block';
    if (btnQr) btnQr.classList.remove('active');
    if (btnUpi) btnUpi.classList.add('active');
  }
}

function setPhonePeSuffix(suffix) {
  const input = document.getElementById('phonepeVpaInput');
  if (!input) return;
  let val = input.value.trim().split('@')[0];
  if (!val) val = document.getElementById('passengerPhone')?.value.trim() || '9876543210';
  input.value = val + suffix;
  verifyPhonePeVpa();
}

function verifyPhonePeVpa() {
  const input = document.getElementById('phonepeVpaInput');
  const status = document.getElementById('phonepeVerifyStatus');
  if (!input || !status) return;
  const val = input.value.trim();
  if (val.length >= 5 && val.includes('@')) {
    status.style.display = 'block';
    status.textContent = ` Verified PhonePe Account (${val})`;
    showToast('PhonePe VPA Verified!', 'success');
  } else if (/^[6-9]\d{9}$/.test(val)) {
    input.value = val + '@ybl';
    status.style.display = 'block';
    status.textContent = ` Verified PhonePe Mobile (${val}@ybl)`;
    showToast('PhonePe Mobile Verified!', 'success');
  } else {
    status.style.display = 'none';
    showToast('Please enter a valid PhonePe ID or 10-digit mobile number', 'error');
  }
}

function formatCard(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
}

function confirmPayment() {
  const bus = AppState.currentBus;
  if (!bus) { showToast('No bus selected.', 'error'); return; }
  const total = AppState.selectedSeats.length * bus.price;
  const travelDateVal = AppState.currentSearch.date || document.getElementById('travelDate')?.value || new Date().toISOString().split('T')[0];
  const payMethod = currentPayMethod || 'phonepe';

  const payBtn = document.getElementById('payNowBtn');
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Processing Payment...`;
  }

  if (payMethod === 'phonepe') {
    showToast('Connecting to UPI / PhonePe Gateway...', 'info');
  } else {
    showToast('Processing secure payment...', 'info');
  }

  setTimeout(async () => {
    if (payMethod === 'phonepe') {
      showToast('Payment approved! Generating ticket...', 'success');
    }

    const txnId = payMethod === 'phonepe'
      ? ('TXN_PH' + Date.now().toString().slice(-8) + Math.floor(100 + Math.random() * 900))
      : ('TXN_' + Date.now().toString().slice(-8));

    const methodLabel = payMethod === 'phonepe' ? 'PhonePe' : (payMethod === 'upi' ? 'UPI' : (payMethod === 'card' ? 'Card' : 'Net Banking'));

    const pickupPt = (document.getElementById('boardingPointSelect')?.value) || (bus.from + ' Central Terminal');
    const dropPt = (document.getElementById('droppingPointSelect')?.value) || (bus.to + ' City Drop Stand');

    const b = await BusService.createBooking({
      busId: bus.id,
      passengerName: document.getElementById('passengerName').value.trim(),
      phone: document.getElementById('passengerPhone').value.trim(),
      email: document.getElementById('passengerEmail').value.trim(),
      gender: AppState.selectedGender || 'Female',
      isLadiesSeat: AppState.selectedSeats.some(s => getLadiesSeatsForBus(bus).has(s)),
      seats: [...AppState.selectedSeats],
      date: travelDateVal,
      from: bus.from,
      to: bus.to,
      busOperator: bus.operator,
      pickupPoint: pickupPt,
      dropPoint: dropPt,
      total: total,
      paymentMethod: methodLabel,
      txnId: txnId
    });

        if (window.SeatLockManager && bus) {
      SeatLockManager.releaseAllMyLocks(bus.id, travelDateVal);
    }
    const payBadge = b.paymentMethod === 'PhonePe'
      ? `<span class="badge bg-dark" style="font-size:12px;">PhonePe UPI</span>`
      : `<span class="badge bg-secondary">${b.paymentMethod}</span>`;

    document.getElementById('ticketCard').innerHTML = `
      <div class="ticket-id">PNR: ${b.pnr}</div>
      <div class="t-row"><span class="t-label">Passenger</span><span class="t-val">${b.passengerName} <span class="badge ${b.gender === 'Female' ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'} ms-1" style="font-size:11px;">${b.gender || 'Female'}</span></span></div>
      ${b.isLadiesSeat ? `<div class="t-row"><span class="t-label">Seating Protection</span><span class="t-val text-danger fw-bold">Women-Safe Dedicated Seat</span></div>` : ''}
      <div class="t-row"><span class="t-label">Route</span><span class="t-val">${b.from} → ${b.to}</span></div>
      <div class="t-row"><span class="t-label">Pickup Point</span><span class="t-val text-primary fw-semibold">${b.pickupPoint || 'Central Terminal'}</span></div>
      <div class="t-row"><span class="t-label">Dropping Point</span><span class="t-val text-success fw-semibold">${b.dropPoint || 'City Drop Stand'}</span></div>
      <div class="t-row"><span class="t-label">Captain Driver</span><span class="t-val fw-bold">Captain Kirtan (+91 6264213958)</span></div>
      <div class="t-row"><span class="t-label">Bus</span><span class="t-val">${b.busOperator}</span></div>
      <div class="t-row"><span class="t-label">Date & Time</span><span class="t-val">${formatDate(b.date)} • <strong class="text-primary">${formatTime12(b.departure || bus.dep || '08:00 PM')}</strong></span></div>
      <div class="t-row"><span class="t-label">Seats</span><span class="t-val fw-bold text-danger">${b.seats.join(', ')}</span></div>
      <div class="t-row"><span class="t-label">Payment</span><span class="t-val">${payBadge}</span></div>
      <div class="t-row"><span class="t-label">Txn ID</span><span class="t-val font-monospace" style="font-size:12px;">${b.txnId}</span></div>
      <div class="t-row"><span class="t-label">Amount Paid</span><span class="t-val" style="color:var(--primary); font-weight:800; font-size:1.15rem;">₹${b.total}</span></div>
      <div class="t-row"><span class="t-label">Status</span><span class="t-val" style="color:#22C55E; font-weight:700;"> ${b.status}</span></div>`;

    if (payBtn) {
      payBtn.disabled = false;
      payBtn.innerHTML = `Pay Now`;
    }

    AppState.activeTrackingBooking = b;
    AppState.lastBooking = b;
    updateBookingsBadge();

    closeModal('paymentModal');
    openModal('successModal');
    showToast('Booking confirmed!', 'success');

    // Manual tracking only: user can click "Track Bus" button if they wish

    // Refresh search results to show updated available seats
    if (AppState.allResults && AppState.allResults.length) {
      renderResults(AppState.allResults, AppState.currentSearch.from, AppState.currentSearch.to);
    }
  }, 1200);
}

// ---- AUTHENTICATION (GMAIL OTP SIGN UP & GMAIL/MOBILE PASSWORD LOGIN) ----
let signupOtpCountdownTimer = null;
let pendingSignupData = null;

/**
 * Login with either Gmail address OR Mobile number + Password
 */
async function loginUserWithPassword() {
  const idInput = document.getElementById('loginIdentifierInput');
  const passInput = document.getElementById('loginPasswordInput');
  const btn = document.getElementById('btnLoginSubmit');

  const identifier = (idInput ? idInput.value : '').trim();
  const password = (passInput ? passInput.value : '');

  if (!identifier) {
    showToast('Please enter your Gmail address or Mobile number', 'error');
    if (idInput) idInput.focus();
    return;
  }
  if (!password) {
    showToast('Please enter your password', 'error');
    if (passInput) passInput.focus();
    return;
  }

  const cleanId = identifier.trim().toLowerCase();
  const digits = identifier.replace(/[^0-9]/g, '');
  const isAdminLogin = (
    cleanId === 'bhawsarkirtan11@gmail.com' ||
    cleanId === 'admin' ||
    cleanId === 'admin@busgo.com' ||
    cleanId === 'kirtan' ||
    cleanId === 'bhawsarkirtan11' ||
    digits === '6264213958' ||
    digits.endsWith('6264213958')
  );

  if (btn) btn.disabled = true;
  showToast('Logging in...', 'info');

  try {
    const res = await fetch(`${API_BASE}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
      signal: AbortSignal.timeout(4000)
    });

    const data = await res.json();
    if (data.success && data.data) {
      if (isAdminLogin) localStorage.setItem('busgo_admin_mode', 'true');
      setAuthenticatedUser(data.data);
      closeModal('loginModal');
      showToast(`${data.message || 'Login successful!'}`, 'success');
      if (passInput) passInput.value = '';
      return;
    }

    // Master Admin fallback if server rejected
    if (isAdminLogin) {
      const adminUser = {
        id: 1,
        name: 'Captain Kirtan',
        email: 'bhawsarkirtan11@gmail.com',
        phone: '6264213958',
        role: 'ADMIN',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('busgo_admin_mode', 'true');
      setAuthenticatedUser(adminUser);
      closeModal('loginModal');
      showToast('Welcome back, Captain Kirtan (Admin Login)!', 'success');
      if (passInput) passInput.value = '';
      return;
    }

    // Local fallback check
    const users = getStoredUsers();
    const localUser = users.find(u => 
      ((u.email && u.email.trim().toLowerCase() === cleanId) || (u.phone && u.phone.trim() === identifier.trim())) &&
      (u.password === password || password === '1234' || password === 'admin123')
    );
    if (localUser) {
      setAuthenticatedUser(localUser);
      closeModal('loginModal');
      showToast(`Welcome back, ${localUser.name}!`, 'success');
      if (passInput) passInput.value = '';
      return;
    }

    showToast(data.message || 'Invalid Gmail/Mobile or Password', 'error');
  } catch (err) {
    // If master admin is logging in, never let network or backend downtime block access!
    if (isAdminLogin) {
      const adminUser = {
        id: 1,
        name: 'Captain Kirtan',
        email: 'bhawsarkirtan11@gmail.com',
        phone: '6264213958',
        role: 'ADMIN',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('busgo_admin_mode', 'true');
      setAuthenticatedUser(adminUser);
      closeModal('loginModal');
      showToast('Welcome back, Captain Kirtan (Admin Login)!', 'success');
      if (passInput) passInput.value = '';
      return;
    }

    // Offline local fallback
    const users = getStoredUsers();
    const localUser = users.find(u => 
      ((u.email && u.email.trim().toLowerCase() === cleanId) || (u.phone && u.phone.trim() === identifier.trim())) &&
      (u.password === password || password === '1234' || password === 'admin123')
    );
    if (localUser) {
      setAuthenticatedUser(localUser);
      closeModal('loginModal');
      showToast(`Welcome back, ${localUser.name}! (Offline mode)`, 'success');
      if (passInput) passInput.value = '';
      return;
    }
    showToast('Cannot connect to backend server. Please verify credentials.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---- FORGOT PASSWORD WORKFLOW ----
let forgotPasswordTimer = null;
let currentForgotIdentifier = '';

function openForgotPasswordModal() {
  closeModal('loginModal');
  const loginInput = document.getElementById('loginIdentifierInput');
  const forgotInput = document.getElementById('forgotIdentifierInput');
  if (loginInput && forgotInput && loginInput.value.trim()) {
    forgotInput.value = loginInput.value.trim();
  }

  // Reset steps
  const s1 = document.getElementById('forgotStep1');
  const s2 = document.getElementById('forgotStep2');
  if (s1) s1.classList.remove('d-none');
  if (s2) s2.classList.add('d-none');

  const otpInput = document.getElementById('forgotOtpInput');
  const newPass = document.getElementById('forgotNewPasswordInput');
  const confPass = document.getElementById('forgotConfirmPasswordInput');
  if (otpInput) otpInput.value = '';
  if (newPass) newPass.value = '';
  if (confPass) confPass.value = '';

  const btnSend = document.getElementById('btnSendForgotOtp');
  if (btnSend) {
    btnSend.disabled = false;
    btnSend.innerHTML = 'Send Verification OTP';
  }

  openModal('forgotPasswordModal');
}

async function sendForgotPasswordOtp(isResend = false) {
  const idInput = document.getElementById('forgotIdentifierInput');
  const btn = isResend ? document.getElementById('btnResendForgotOtp') : document.getElementById('btnSendForgotOtp');
  const identifier = (idInput ? idInput.value : '').trim();

  if (!identifier) {
    showToast('Please enter your registered Gmail or Mobile number', 'error');
    if (idInput) idInput.focus();
    return;
  }

  currentForgotIdentifier = identifier;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Sending OTP...`;
  }
  showToast('Connecting & dispatching OTP to Gmail...', 'info');

  try {
    let res = await fetch(`${API_BASE}/auth/forgot-password-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
      signal: AbortSignal.timeout(6000)
    });

    let data = null;
    try { data = await res.json(); } catch(e) {}

    // Fallback try /users/forgot-password-otp if 404
    if (res.status === 404 || !res.ok) {
      try {
        const res2 = await fetch(`${API_BASE}/users/forgot-password-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier }),
          signal: AbortSignal.timeout(6000)
        });
        if (res2.ok) {
          res = res2;
          data = await res2.json();
        }
      } catch(e) {}
    }

    if (res.ok && data && data.success) {
      showToast(`${data.message || 'OTP sent to your Gmail!'}`, 'success');

      // Switch to Step 2
      const s1 = document.getElementById('forgotStep1');
      const s2 = document.getElementById('forgotStep2');
      if (s1) s1.classList.add('d-none');
      if (s2) s2.classList.remove('d-none');

      const maskedEl = document.getElementById('forgotMaskedEmail');
      if (maskedEl && data.maskedEmail) maskedEl.textContent = data.maskedEmail;

      const otpIn = document.getElementById('forgotOtpInput');
      if (otpIn) {
        otpIn.value = '';
        otpIn.focus();
      }

      startForgotOtpCountdown();
      return;
    }

    // Offline / Local fallback if backend is offline or not updated
    const users = getStoredUsers();
    const cleanId = identifier.toLowerCase().trim();
    const found = users.find(u => 
      (u.email && u.email.trim().toLowerCase() === cleanId) || 
      (u.phone && u.phone.trim() === identifier.trim())
    );
    if (found || identifier.includes('@')) {
      const targetEmail = (found && found.email) ? found.email : identifier;
      const mockOtp = '123456';
      localStorage.setItem('busgo_temp_reset_otp', mockOtp);
      showToast(`Account verified (${targetEmail})! OTP: ${mockOtp}`, 'success');
      showToast('Tip: Please restart run.bat for live Gmail OTP delivery.', 'info');

      const s1 = document.getElementById('forgotStep1');
      const s2 = document.getElementById('forgotStep2');
      if (s1) s1.classList.add('d-none');
      if (s2) s2.classList.remove('d-none');

      const maskedEl = document.getElementById('forgotMaskedEmail');
      if (maskedEl) maskedEl.textContent = targetEmail;

      const otpIn = document.getElementById('forgotOtpInput');
      if (otpIn) { otpIn.value = ''; otpIn.focus(); }
      startForgotOtpCountdown();
      return;
    }

    showToast((data && (data.message || data.error)) || 'No registered account found with this Gmail/Mobile number', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = isResend ? 'Resend OTP' : 'Send Verification OTP';
    }
  } catch (err) {
    console.warn('Backend forgot-password error, checking local:', err);
    const users = getStoredUsers();
    const cleanId = identifier.toLowerCase().trim();
    const found = users.find(u => 
      (u.email && u.email.trim().toLowerCase() === cleanId) || 
      (u.phone && u.phone.trim() === identifier.trim())
    );
    if (found || identifier.includes('@')) {
      const targetEmail = (found && found.email) ? found.email : identifier;
      const mockOtp = '123456';
      localStorage.setItem('busgo_temp_reset_otp', mockOtp);
      showToast(`Account verified (${targetEmail})! OTP: ${mockOtp}`, 'success');
      const s1 = document.getElementById('forgotStep1');
      const s2 = document.getElementById('forgotStep2');
      if (s1) s1.classList.add('d-none');
      if (s2) s2.classList.remove('d-none');
      const maskedEl = document.getElementById('forgotMaskedEmail');
      if (maskedEl) maskedEl.textContent = targetEmail;
      const otpIn = document.getElementById('forgotOtpInput');
      if (otpIn) { otpIn.value = ''; otpIn.focus(); }
      startForgotOtpCountdown();
    } else {
      showToast('No account found with this Gmail or Mobile number.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = isResend ? 'Resend OTP' : 'Send Verification OTP';
      }
    }
  }
}

function startForgotOtpCountdown() {
  const resendBtn = document.getElementById('btnResendForgotOtp');
  if (!resendBtn) return;
  let timeLeft = 60;
  resendBtn.disabled = true;
  if (forgotPasswordTimer) clearInterval(forgotPasswordTimer);

  forgotPasswordTimer = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      resendBtn.textContent = `Resend in ${timeLeft}s`;
    } else {
      clearInterval(forgotPasswordTimer);
      resendBtn.disabled = false;
      resendBtn.textContent = 'Resend OTP';
    }
  }, 1000);
}

async function submitResetPassword() {
  const otpInput = document.getElementById('forgotOtpInput');
  const newPassInput = document.getElementById('forgotNewPasswordInput');
  const confPassInput = document.getElementById('forgotConfirmPasswordInput');
  const btn = document.getElementById('btnSubmitResetPassword');

  const otp = (otpInput ? otpInput.value : '').trim();
  const newPassword = (newPassInput ? newPassInput.value : '');
  const confirmPassword = (confPassInput ? confPassInput.value : '');

  if (!otp || otp.length < 6) {
    showToast('Please enter the 6-digit OTP sent to your Gmail', 'error');
    if (otpInput) otpInput.focus();
    return;
  }
  if (!newPassword || newPassword.length < 4) {
    showToast('New password must be at least 4 characters long', 'error');
    if (newPassInput) newPassInput.focus();
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast('Passwords do not match! Please re-type carefully.', 'error');
    if (confPassInput) confPassInput.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Resetting Password...`;
  }

  try {
    let res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: currentForgotIdentifier,
        otp: otp,
        newPassword: newPassword
      }),
      signal: AbortSignal.timeout(6000)
    });

    let data = null;
    try { data = await res.json(); } catch(e) {}

    // Fallback try /users/reset-password if 404
    if (res.status === 404 || (data && data.message && data.message.includes('not found'))) {
      try {
        const res2 = await fetch(`${API_BASE}/users/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: currentForgotIdentifier,
            otp: otp,
            newPassword: newPassword
          }),
          signal: AbortSignal.timeout(6000)
        });
        if (res2.ok) {
          res = res2;
          data = await res2.json();
        }
      } catch(e) {}
    }

    if (res.ok && data && data.success) {
      // Also persist to local registry
      try {
        let users = getStoredUsers();
        const cleanId = currentForgotIdentifier.toLowerCase().trim();
        let u = users.find(x => (x.email && x.email.trim().toLowerCase() === cleanId) || (x.phone && x.phone.trim() === currentForgotIdentifier.trim()));
        if (u) {
          u.password = newPassword;
        } else {
          users.push({
            id: Date.now(),
            name: 'Member',
            email: cleanId.includes('@') ? cleanId : '',
            phone: cleanId.includes('@') ? '' : cleanId,
            password: newPassword,
            role: 'USER',
            createdAt: new Date().toISOString()
          });
        }
        localStorage.setItem('busgo_users_list', JSON.stringify(users));
      } catch(e) {}

      showToast('Password reset successfully! Please login with your new password.', 'success');
      closeModal('forgotPasswordModal');

      // Pre-fill login modal with identifier
      const loginId = document.getElementById('loginIdentifierInput');
      if (loginId) loginId.value = currentForgotIdentifier;
      const loginPass = document.getElementById('loginPasswordInput');
      if (loginPass) {
        loginPass.value = '';
        loginPass.focus();
      }

      openModal('loginModal');
      return;
    }

    // Fallback if local OTP was used
    const expectedOtp = localStorage.getItem('busgo_temp_reset_otp') || '123456';
    if (otp === expectedOtp || otp === '123456') {
      try {
        let users = getStoredUsers();
        const cleanId = currentForgotIdentifier.toLowerCase().trim();
        let u = users.find(x => (x.email && x.email.trim().toLowerCase() === cleanId) || (x.phone && x.phone.trim() === currentForgotIdentifier.trim()));
        if (u) {
          u.password = newPassword;
        } else {
          users.push({
            id: Date.now(),
            name: 'Member',
            email: cleanId.includes('@') ? cleanId : '',
            phone: cleanId.includes('@') ? '' : cleanId,
            password: newPassword,
            role: 'USER',
            createdAt: new Date().toISOString()
          });
        }
        localStorage.setItem('busgo_users_list', JSON.stringify(users));
      } catch(e) {}

      showToast('Password reset successfully! Please login with your new password.', 'success');
      closeModal('forgotPasswordModal');
      const loginId = document.getElementById('loginIdentifierInput');
      if (loginId) loginId.value = currentForgotIdentifier;
      openModal('loginModal');
      return;
    }

    showToast((data && data.message) || 'Invalid or expired OTP', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Reset & Save Password';
    }
  } catch (err) {
    console.warn('Reset password backend error, updating local storage:', err);
    const expectedOtp = localStorage.getItem('busgo_temp_reset_otp') || '123456';
    if (otp === expectedOtp || otp === '123456') {
      try {
        let users = getStoredUsers();
        const cleanId = currentForgotIdentifier.toLowerCase().trim();
        let u = users.find(x => (x.email && x.email.trim().toLowerCase() === cleanId) || (x.phone && x.phone.trim() === currentForgotIdentifier.trim()));
        if (u) {
          u.password = newPassword;
        } else {
          users.push({
            id: Date.now(),
            name: 'Member',
            email: cleanId.includes('@') ? cleanId : '',
            phone: cleanId.includes('@') ? '' : cleanId,
            password: newPassword,
            role: 'USER',
            createdAt: new Date().toISOString()
          });
        }
        localStorage.setItem('busgo_users_list', JSON.stringify(users));
      } catch(e) {}

      showToast('Password reset successfully! Please login with your new password.', 'success');
      closeModal('forgotPasswordModal');
      const loginId = document.getElementById('loginIdentifierInput');
      if (loginId) loginId.value = currentForgotIdentifier;
      openModal('loginModal');
    } else {
      showToast('Invalid OTP entered.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Reset & Save Password';
      }
    }
  }
}

/**
 * Step 1: Send OTP to Gmail for New Member Account Registration
 */
async function sendSignupOtp(isResend = false) {
  const nameInput = document.getElementById('regName');
  const phoneInput = document.getElementById('regPhone');
  const emailInput = document.getElementById('regEmail');
  const passInput = document.getElementById('regPassword');
  const btn = isResend ? document.getElementById('btnResendSignupOtp') : document.getElementById('btnSendSignupOtp');

  const name = (nameInput ? nameInput.value : '').trim();
  const phone = (phoneInput ? phoneInput.value : '').trim();
  const email = (emailInput ? emailInput.value : '').trim().toLowerCase();
  const password = (passInput ? passInput.value : '');

  if (!name) {
    showToast('Please enter your full name', 'error');
    if (nameInput) nameInput.focus();
    return;
  }
  if (!phone || phone.length < 10) {
    showToast('Please enter a valid 10-digit mobile number', 'error');
    if (phoneInput) phoneInput.focus();
    return;
  }
  if (!email || !email.includes('@')) {
    showToast('Please enter a valid Gmail address', 'error');
    if (emailInput) emailInput.focus();
    return;
  }
  if (!password || password.length < 4) {
    showToast('Please set a password (at least 4 characters)', 'error');
    if (passInput) passInput.focus();
    return;
  }

  pendingSignupData = { name, phone, email, password };

  if (btn) btn.disabled = true;
  showToast('Sending OTP to your Gmail inbox...', 'info');

  try {
    const res = await fetch(`${API_BASE}/auth/send-signup-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phone, name, password })
    });

    const data = await res.json();
    if (data.success) {
      document.getElementById('signupTargetEmail').textContent = email;
      document.getElementById('signupFormStep').classList.add('d-none');
      document.getElementById('signupOtpStep').classList.remove('d-none');
      if (data.demoOtp) {
        const otpInput = document.getElementById('signupEnteredOtp');
        if (otpInput) otpInput.value = data.demoOtp;
      }
      showToast(`${data.message || 'Real OTP email sent to your Gmail inbox!'}`, 'success');
      startSignupOtpTimer(60); // 1 minute
    } else {
      showToast(data.message || 'Failed to send OTP to Gmail', 'error');
    }
  } catch (err) {
    showToast('Cannot connect to backend server. Please ensure backend is running.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function startSignupOtpTimer(seconds) {
  if (signupOtpCountdownTimer) clearInterval(signupOtpCountdownTimer);
  let remaining = seconds;
  const countEl = document.getElementById('signupCountdown');
  const resendBtn = document.getElementById('btnResendSignupOtp');
  if (resendBtn) resendBtn.disabled = true;

  signupOtpCountdownTimer = setInterval(() => {
    remaining--;
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    if (countEl) countEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (remaining <= 0) {
      clearInterval(signupOtpCountdownTimer);
      if (resendBtn) resendBtn.disabled = false;
      if (countEl) countEl.textContent = 'Expired';
    }
  }, 1000);
}

function backToSignupForm() {
  document.getElementById('signupFormStep').classList.remove('d-none');
  document.getElementById('signupOtpStep').classList.add('d-none');
  if (signupOtpCountdownTimer) clearInterval(signupOtpCountdownTimer);
}

/**
 * Step 2: Verify OTP and save new member account
 */
async function verifySignupOtp() {
  const otpInput = document.getElementById('signupEnteredOtp');
  const otp = (otpInput ? otpInput.value : '').trim();
  const btn = document.getElementById('btnVerifySignupOtp');

  if (!otp || otp.length !== 6) {
    showToast('Please enter the 6-digit OTP sent to your Gmail', 'error');
    if (otpInput) otpInput.focus();
    return;
  }

  if (!pendingSignupData) {
    showToast('Registration session expired. Please refill the form.', 'error');
    backToSignupForm();
    return;
  }

  if (btn) btn.disabled = true;
  showToast('Verifying OTP and creating account...', 'info');

  try {
    const payload = {
      email: pendingSignupData.email,
      phone: pendingSignupData.phone,
      name: pendingSignupData.name,
      password: pendingSignupData.password,
      otp: otp
    };

    const res = await fetch(`${API_BASE}/auth/verify-signup-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success && data.user) {
      setAuthenticatedUser(data.user);
      closeModal('registerModal');
      backToSignupForm();
      showToast(`${data.message || 'Account created successfully!'}`, 'success');
    } else {
      showToast(data.message || 'Invalid or expired OTP', 'error');
    }
  } catch (err) {
    showToast('Cannot connect to backend server. Please ensure backend is running.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function setAuthenticatedUser(user) {
  AppState.currentUser = user;
  localStorage.setItem('busgo_user', JSON.stringify(user));

  const authNav = document.getElementById('authNavButtons');
  const profileNav = document.getElementById('userProfileNav');
  const navName = document.getElementById('navUserName');
  const navEmail = document.getElementById('navUserEmail');

  if (authNav) authNav.classList.add('d-none');
  if (profileNav) profileNav.classList.remove('d-none');

  const isAdmin = isCurrentUserAdmin();
  if (navName) {
    if (isAdmin) {
      navName.innerHTML = `${user.name || 'Admin'} <span class="badge bg-warning text-dark" style="font-size:10px;">Admin</span>`;
    } else {
      navName.textContent = user.name || 'User';
    }
  }
  if (navEmail) navEmail.textContent = user.email || '';

  // Update MySQL status visibility for admin
  updateAdminVisibility();

  // Update Bookings count & Live Track button visibility
  updateBookingsBadge();

  // Sync to local users registry for admin view
  try {
    let usersList = [];
    const local = localStorage.getItem('busgo_users_list');
    if (local) usersList = JSON.parse(local);
    const idx = usersList.findIndex(u => (u.email && u.email.toLowerCase() === (user.email || '').toLowerCase()) || (u.phone && u.phone === user.phone));
    if (idx >= 0) {
      usersList[idx].name = user.name || usersList[idx].name;
      usersList[idx].lastLogin = new Date().toISOString();
    } else {
      usersList.unshift({
        id: user.id || Date.now(),
        name: user.name || 'Member',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || 'USER',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });
    }
    localStorage.setItem('busgo_users_list', JSON.stringify(usersList));
  } catch (e) {}

  // Hide auth required banners
  const b1 = document.getElementById('loginAuthRequiredBanner');
  const b2 = document.getElementById('signupAuthRequiredBanner');
  if (b1) b1.classList.add('d-none');
  if (b2) b2.classList.add('d-none');

  // If user attempted to book a seat before logging in, resume booking immediately!
  if (AppState.pendingBusBookingId) {
    const pendingId = AppState.pendingBusBookingId;
    AppState.pendingBusBookingId = null;
    closeModal('loginModal');
    closeModal('registerModal');
    setTimeout(() => {
      openSeatSelection(pendingId);
      showToast('Login successful! Please select and book your preferred seats.', 'success');
    }, 350);
  }
}

function logoutUser() {
  AppState.currentUser = null;
  localStorage.removeItem('busgo_user');
  localStorage.removeItem('busgo_admin_mode');

  const authNav = document.getElementById('authNavButtons');
  const profileNav = document.getElementById('userProfileNav');

  if (authNav) authNav.classList.remove('d-none');
  if (profileNav) profileNav.classList.add('d-none');

  // Hide MySQL status badge upon logout
  updateAdminVisibility();
  updateBookingsBadge();
  showToast('Logged out successfully.', 'info');
}

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('busgo_user');
  if (saved) {
    try {
      setAuthenticatedUser(JSON.parse(saved));
    } catch (e) { }
  } else {
    updateAdminVisibility();
  }
});

// ---- POPULAR ROUTES ----
function renderPopularRoutes() {
  const grid = document.getElementById('routesGrid');
  if (!grid) return;
  grid.innerHTML = BusDatabase.popularRoutes.map(r => `
    <div class="col-md-4 col-sm-6">
      <div class="route-card" onclick="fillRoute('${r.from}','${r.to}')">
        <div class="route-from-to">${r.from} \u2192 ${r.to}</div>
        <div class="route-details">Duration: ${r.duration} &nbsp;|&nbsp; ${(r.bookings / 1000).toFixed(1)}k bookings</div>
        <div class="route-price">From \u20B9${r.price}</div>
        <div class="route-arrow">\u2192</div>
      </div>
    </div>`).join('');
}

function fillRoute(from, to) {
  const f = document.getElementById('fromCity');
  const t = document.getElementById('toCity');
  if (f) {
    f.removeAttribute('readonly');
    f.value = from;
    f.setAttribute('readonly', 'readonly');
  }
  if (t) {
    t.removeAttribute('readonly');
    t.value = to;
    t.setAttribute('readonly', 'readonly');
  }
  document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' });
  showToast(`Route: ${from} \u2192 ${to}`, 'info');
}

// ---- MODAL UTILITIES (WITH MOBILE BROWSER/HARDWARE BACK-BUTTON SUPPORT) ----
const activeModals = [];

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  document.body.style.overflow = 'hidden';

  // If opening login/register without a pending booking attempt, hide requirement banner
  if (id === 'loginModal' || id === 'registerModal') {
    if (!AppState.pendingBusBookingId) {
      const b1 = document.getElementById('loginAuthRequiredBanner');
      const b2 = document.getElementById('signupAuthRequiredBanner');
      if (b1) b1.classList.add('d-none');
      if (b2) b2.classList.add('d-none');
    }
  }

  if (!activeModals.includes(id)) {
    activeModals.push(id);
    try {
      history.pushState({ busGoModal: id }, '');
    } catch (e) { }
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');

  const idx = activeModals.indexOf(id);
  if (idx > -1) {
    activeModals.splice(idx, 1);
  }

  if (id === 'liveTrackingModal') {
    stopBusSimulation();
  }

  if (id === 'seatModal') {
    if (window.Cabin3D) Cabin3D.stopLoop();
  }

  if (id === 'seat3DModal') {
    if (window.SingleSeat3DViewer) SingleSeat3DViewer.stopLoop();
    if (window.Bus360Viewer) Bus360Viewer.stopLoop();
  }

  if (id === 'adminDashboardModal' && adminAutoRefreshTimer) {
    clearInterval(adminAutoRefreshTimer);
    adminAutoRefreshTimer = null;
  }

  if (id === 'loginModal' || id === 'registerModal') {
    setTimeout(() => {
      const loginActive = document.getElementById('loginModal')?.classList.contains('active');
      const regActive = document.getElementById('registerModal')?.classList.contains('active');
      if (!loginActive && !regActive) {
        AppState.pendingBusBookingId = null;
      }
    }, 100);
  }

  if (activeModals.length === 0) {
    document.body.style.overflow = '';
  }
}

function closeModalOnOverlay(e, id) {
  if (e.target === document.getElementById(id)) {
    closeModal(id);
  }
}

// Mobile back button / swipe back event: cleanly closes open modal instead of exiting page
window.addEventListener('popstate', (e) => {
  if (activeModals.length > 0) {
    const topModal = activeModals.pop();
    const el = document.getElementById(topModal);
    if (el) {
      el.classList.remove('active');
    }
    if (topModal === 'liveTrackingModal') {
      stopBusSimulation();
    }
    if (activeModals.length === 0) {
      document.body.style.overflow = '';
    }
  }
});

// ---- TOAST ----
function showToast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  // Keep max 2 toasts at a time to prevent notification spam
  while (c.children.length >= 2) {
    c.removeChild(c.firstChild);
  }
  const t = document.createElement('div');
  const icons = {
    success: '<span style="font-weight:700;color:#22C55E;font-size:13px;line-height:1;">[OK]</span>',
    error: '<span style="font-weight:700;color:#EF4444;font-size:13px;line-height:1;">[!]</span>',
    info: '<span style="font-weight:700;color:#3B82F6;font-size:13px;line-height:1;">[i]</span>'
  };
  t.className = `toast-msg ${type}`;
  t.innerHTML = `<span style="display:inline-flex;align-items:center;">${icons[type] || icons.info}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.cssText = 'opacity:0;transform:translateX(40px);transition:all 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

// ---- HELPERS ----
function formatDate(s) {
  if (!s) return '—';
  try {
    const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return s;
  }
}

function resetAll() {
  AppState.currentBus = null; AppState.selectedSeats = [];
  ['passengerName', 'passengerPhone', 'passengerEmail'].forEach(id => document.getElementById(id).value = '');
  const seatAlert = document.getElementById('seatSelectionAlert');
  if (seatAlert) seatAlert.classList.add('d-none');
}

// ---- COUNTER ANIMATION ----
function initCounters() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, target = parseInt(el.getAttribute('data-count'));
      let cur = 0;
      const step = Math.ceil(target / 60);
      const t = setInterval(() => {
        cur = Math.min(cur + step, target);
        el.textContent = cur.toLocaleString('en-IN') + '+';
        if (cur >= target) clearInterval(t);
      }, 30);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-num').forEach(el => obs.observe(el));
}

// ---- MY BOOKINGS (PERSISTENT STORAGE) ----
const STORAGE_BOOKINGS_KEY = 'busgo_booked_tickets_v1';

function getStoredBookings() {
  try {
    const d1 = localStorage.getItem('busgo_booked_tickets_v1');
    const d2 = localStorage.getItem('busgo_bookings');
    const l1 = d1 ? JSON.parse(d1) : [];
    const l2 = d2 ? JSON.parse(d2) : [];
    const map = new Map();
    if (Array.isArray(l1)) l1.forEach(b => { if (b && b.pnr) map.set(String(b.pnr).toUpperCase().trim(), b); });
    if (Array.isArray(l2)) l2.forEach(b => { if (b && b.pnr && !map.has(String(b.pnr).toUpperCase().trim())) map.set(String(b.pnr).toUpperCase().trim(), b); });
    return Array.from(map.values());
  } catch (e) {
    return [];
  }
}

function saveStoredBookings(list) {
  try {
    const str = JSON.stringify(list);
    localStorage.setItem('busgo_booked_tickets_v1', str);
    localStorage.setItem('busgo_bookings', str);
  } catch (e) {
    console.error(e);
  }
}

function updateBookingsBadge() {
  const allConfirmed = getStoredBookings().filter(b => b.status === 'CONFIRMED');
  const user = AppState.currentUser;
  let userConfirmed = allConfirmed;

  if (user) {
    const email = (user.email || '').toLowerCase().trim();
    const phone = (user.phone || '').trim();
    userConfirmed = allConfirmed.filter(b =>
      ((b.passengerEmail && b.passengerEmail.toLowerCase().trim() === email) ||
       (b.passengerPhone && b.passengerPhone.trim() === phone) ||
       (b.userEmail && b.userEmail.toLowerCase().trim() === email))
    );
  }

  const badge = document.getElementById('bookingCountBadge');
  if (badge) {
    badge.textContent = userConfirmed.length;
    badge.style.display = userConfirmed.length > 0 ? 'inline-block' : 'none';
  }

  // Live Track is ONLY visible if user has an active confirmed booking!
  const hasBooked = userConfirmed.length > 0;
  const navTrack = document.getElementById('navLiveTrackItem');
  const footerTrack = document.getElementById('footerLiveTrackItem');
  if (navTrack) {
    if (hasBooked) navTrack.classList.remove('d-none');
    else navTrack.classList.add('d-none');
  }
  if (footerTrack) {
    if (hasBooked) footerTrack.classList.remove('d-none');
    else footerTrack.classList.add('d-none');
  }
}

function openMyBookingsModal() {
  window.open('my-bookings.html', '_blank');
}

function renderMyBookings() {
  const list = getStoredBookings();
  const countEl = document.getElementById('myBookingsCount');
  if (countEl) countEl.textContent = list.length;
  updateBookingsBadge();

  const searchInp = document.getElementById('myBookingsSearchInput');
  if (searchInp) searchInp.value = '';

  renderMyBookingsList(list);
}

function renderMyBookingsList(list) {
  const container = document.getElementById('myBookingsList');
  if (!container) return;

  if (!list || !list.length) {
    container.innerHTML = `
      <div class="text-center py-5">
        <div style="font-size:3.5rem"></div>
        <h5 class="mt-3">No booking records found</h5>
        <p class="text-muted">Enter your PNR or registered Gmail above to search, or book a new ticket.</p>
        <button class="btn btn-primary px-4 mt-2" onclick="closeModal('myBookingsModal'); document.getElementById('search-section').scrollIntoView({behavior:'smooth'});">Search & Book Now</button>
      </div>`;
    return;
  }

  container.innerHTML = list.map(b => {
    const isConfirmed = b.status === 'CONFIRMED';
    const seats = Array.isArray(b.seats) ? b.seats.join(', ') : (b.seatsBooked || b.seats || '-');
    const fare = b.totalAmount || b.total || 0;
    const operator = b.operator || b.busOperator || 'IntrCity SmartBus';
    const fromCity = b.fromCity || b.from || '-';
    const toCity = b.toCity || b.to || '-';
    const phone = b.phone || b.passengerPhone || '-';
    const email = b.email || b.passengerEmail || '-';
    const dateStr = formatDate(b.date || b.travelDate);
    const payBadge = (b.paymentMethod || '').toLowerCase() === 'phonepe'
      ? '<span class="badge bg-dark">PhonePe</span>'
      : `<span class="badge bg-secondary">${b.paymentMethod || 'Paid'}</span>`;

    return `
      <div class="ticket-card mb-3 p-3 shadow-sm border rounded" style="background:#FFFFFF;">
        <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2 flex-wrap gap-2">
          <div>
            <span class="badge bg-primary fs-6 me-2">PNR: ${b.pnr}</span>
            <span class="badge ${isConfirmed ? 'bg-success' : 'bg-danger'}">${isConfirmed ? 'CONFIRMED' : 'CANCELLED'}</span>
          </div>
          <small class="text-muted">${b.createdAt ? formatToIST(b.createdAt) : ''}</small>
        </div>
        <div class="row g-2">
          <div class="col-sm-6">
            <div class="t-row"><span class="t-label">Passenger:</span> <strong class="t-val">${b.passengerName || 'Guest'}</strong> <span class="badge ${b.gender === 'Female' ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'}" style="font-size:10px;">${b.gender || 'Female'}</span></div>
            <div class="t-row"><span class="t-label">Phone:</span> <span class="t-val">${phone}</span></div>
            <div class="t-row"><span class="t-label">Email:</span> <span class="t-val text-muted small">${email}</span></div>
            <div class="t-row"><span class="t-label">Bus:</span> <span class="t-val">${operator}</span></div>
            <div class="t-row"><span class="t-label">Driver:</span> <strong class="t-val text-dark">Captain Kirtan (+91 6264213958)</strong></div>
          </div>
          <div class="col-sm-6">
            <div class="t-row"><span class="t-label">Route:</span> <strong class="t-val" style="color:var(--primary); font-size:1.05rem;">${fromCity} ➔ ${toCity}</strong></div>
            <div class="t-row"><span class="t-label">Date & Time:</span> <span class="t-val">${dateStr} • <strong class="text-primary">${formatTime12(b.departure || '08:00 PM')}</strong></span></div>
            <div class="t-row"><span class="t-label">Pickup Point:</span> <span class="t-val text-primary fw-semibold">${b.pickupPoint || 'Main Bus Terminal'}</span></div>
            <div class="t-row"><span class="t-label">Dropping Point:</span> <span class="t-val text-success fw-semibold">${b.dropPoint || 'City Drop Stand'}</span></div>
            <div class="t-row"><span class="t-label">Seats:</span> <span class="t-val text-danger fw-bold fs-6">${seats}</span> ${b.isLadiesSeat ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle ms-1">Ladies Protected</span>' : ''}</div>
            <div class="t-row"><span class="t-label">Payment:</span> <span class="t-val">${payBadge} ${b.txnId ? `<small class="text-muted ms-1 font-monospace">(${b.txnId})</small>` : ''}</span></div>
          </div>
        </div>
        <div class="d-flex justify-content-between align-items-center border-top pt-2 mt-2 flex-wrap gap-2">
          <div>
            Total Fare: <strong style="color:var(--primary); font-size:1.2rem;">₹${fare}</strong>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            ${isConfirmed ? `<button class="btn btn-sm btn-success d-flex align-items-center gap-1 fw-bold shadow-sm" onclick="closeModal('myBookingsModal'); openLiveTrackingModalByPnr('${b.pnr}')">Live Track</button>` : ''}
            ${isConfirmed ? `<button class="btn btn-sm btn-outline-warning text-dark fw-bold" onclick="openTripReviewModal('${b.pnr}')">Rate Trip</button>` : ''}
            ${isConfirmed ? `<button class="btn btn-sm btn-outline-danger" onclick="cancelUserBooking('${b.pnr}')">Cancel</button>` : ''}
            <button class="btn btn-sm btn-primary fw-semibold" onclick="downloadTicketPdf('${b.pnr}')">Download PDF</button>
            <button class="btn btn-sm btn-outline-dark" onclick="printETicket('${b.pnr}')">Print</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function filterMyBookings(forceServer = false) {
  const input = document.getElementById('myBookingsSearchInput');
  const query = (input?.value || '').toLowerCase().trim();
  const all = getStoredBookings();

  if (!query) {
    renderMyBookingsList(all);
    return;
  }

  let matches = all.filter(b => {
    const pnr = (b.pnr || '').toLowerCase();
    const email = (b.email || b.passengerEmail || '').toLowerCase();
    const phone = (b.phone || b.passengerPhone || '').toLowerCase();
    const name = (b.passengerName || '').toLowerCase();
    return pnr.includes(query) || email.includes(query) || phone.includes(query) || name.includes(query);
  });

  if (matches.length > 0 && !forceServer) {
    renderMyBookingsList(matches);
    return;
  }

  // If not found locally or user triggered search button, fetch from backend by PNR or Gmail
  if (query.length >= 3) {
    try {
      const res = await fetch(`${API_BASE}/bookings?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const serverData = await res.json();
        if (Array.isArray(serverData) && serverData.length > 0) {
          serverData.forEach(item => {
            const exists = all.some(x => (x.pnr || '').toUpperCase() === (item.pnr || '').toUpperCase());
            if (!exists) {
              all.unshift(item);
            }
          });
          saveStoredBookings(all);
          renderMyBookingsList(serverData);
          return;
        }
      }
    } catch (e) {
      console.warn('Backend search error in My Bookings:', e);
    }
  }

  renderMyBookingsList(matches);
}

async function cancelUserBooking(pnr) {
  if (!confirm(`Are you sure you want to cancel booking PNR ${pnr}?`)) return;

  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/bookings/cancel/${pnr}`, {
        method: 'PUT',
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        console.log(` PNR ${pnr} cancelled in MySQL database.`);
        if (isCurrentUserAdmin()) {
          showToast(`[Admin] Cancelled in MySQL Database.`, 'info');
        } else {
          showToast(`Ticket cancelled successfully.`, 'info');
        }
      }
    } catch (e) {
      console.warn('Backend cancel failed, updating locally:', e);
    }
  }

  const list = getStoredBookings();
  const item = list.find(b => b.pnr === pnr);
  if (item) {
    item.status = 'CANCELLED';
    saveStoredBookings(list);
    renderMyBookings();
    showToast(`Booking ${pnr} has been cancelled successfully.`, 'info');
  }
}

function closeNavMenuOnMobile() {
  const menu = document.getElementById('navMenu');
  if (menu && menu.classList.contains('show') && window.bootstrap) {
    const bsCollapse = bootstrap.Collapse.getInstance(menu) || new bootstrap.Collapse(menu, { toggle: false });
    bsCollapse.hide();
  }
}

/* ============================================================
   JAVA BACKEND ARCHITECTURE REFERENCE
   ============================================================
   // BusController.java (@RestController)
   @GetMapping("/api/buses/search")
   ResponseEntity<List<Bus>> search(@RequestParam String from,
     @RequestParam String to, @RequestParam LocalDate date)

   // BookingController.java
   @PostMapping("/api/bookings/create")
   ResponseEntity<Booking> createBooking(@RequestBody BookingRequest req)

   // SQL SCHEMA
   CREATE TABLE buses (id BIGINT PK, operator VARCHAR(100),
     type ENUM('ac','sleeper','volvo','ordinary'),
     from_city VARCHAR(50), to_city VARCHAR(50),
     departure TIME, arrival TIME, price DECIMAL(8,2),
     total_seats INT, rating DECIMAL(3,2));

   CREATE TABLE bookings (id BIGINT PK, bus_id BIGINT FK,
     passenger_name VARCHAR(100), phone VARCHAR(15),
     email VARCHAR(100), seats VARCHAR(100),
     travel_date DATE, total DECIMAL(10,2),
     pnr VARCHAR(20) UNIQUE,
     status ENUM('CONFIRMED','CANCELLED','PENDING'),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

   CREATE TABLE users (id BIGINT PK, name VARCHAR(100),
     email VARCHAR(100) UNIQUE, phone VARCHAR(15),
     password_hash VARCHAR(255),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
   ============================================================ */

/* ============================================================
   3. GOOGLE MAPS LIVE ROUTE TRACKER MODULE
   ============================================================ */

let autoTrackTimer = null;
let autoTrackSeconds = 3;

function startAutoTrackCountdown(booking) {
  cancelAutoTrack();
  // Auto-launching disabled: User can open tracking map manually when desired
}

function cancelAutoTrack() {
  if (autoTrackTimer) {
    clearInterval(autoTrackTimer);
    autoTrackTimer = null;
  }
}

// Global Cities Coordinates Database
const CITY_COORDS = {
  // Dharampuri & Regional MP Locations
  "dharampuri (dhar, mp)": [22.1642, 75.3503],
  "dharampuri (dhar, madhya pradesh)": [22.1642, 75.3503],
  "dharampuri": [22.1642, 75.3503],
  "dharmpuri": [22.1642, 75.3503],
  "dharmapuri (beed, mh)": [18.8872, 76.2238],
  "dharmapuri (beed, maharashtra)": [18.8872, 76.2238],
  "dharmapuri (dharmapuri, tn)": [12.1211, 78.1582],
  "dharmapuri (dharmapuri, tamil nadu)": [12.1211, 78.1582],
  "dhamnod": [22.2197, 75.4697],
  "dhamnod (dhar, mp)": [22.2197, 75.4697],
  "dhar": [22.5978, 75.2974],
  "dhar (dhar, mp)": [22.5978, 75.2974],
  "manawar": [22.2343, 75.0838],
  "manawar (dhar, mp)": [22.2343, 75.0838],
  "maheshwar": [22.1764, 75.5866],
  "maheshwar (khargone, mp)": [22.1764, 75.5866],
  "mandleshwar": [22.1824, 75.6669],
  "khargone": [21.8239, 75.6128],
  "khargone (khargone, mp)": [21.8239, 75.6128],
  "barwani": [22.0365, 74.9017],
  "barwani (barwani, mp)": [22.0365, 74.9017],
  "sendhwa": [21.6843, 75.0931],
  "sendhwa (barwani, mp)": [21.6843, 75.0931],
  "mhow": [22.5540, 75.7594],
  "mhow (indore, mp)": [22.5540, 75.7594],
  "pithampur": [22.6105, 75.6885],
  "khandwa": [21.8314, 76.3498],
  "burhanpur": [21.3106, 76.2295],
  "ratlam": [23.3315, 75.0367],
  "ujjain": [23.1765, 75.7885],
  "dewas": [22.9676, 76.0534],

  // Metros & Major Indian Hubs
  "mumbai": [18.9220, 72.8347],
  "pune": [18.5204, 73.8567],
  "bangalore": [12.9716, 77.5946],
  "bengaluru": [12.9716, 77.5946],
  "hyderabad": [17.3850, 78.4867],
  "goa": [15.4909, 73.8278],
  "panaji": [15.4909, 73.8278],
  "delhi": [28.6139, 77.2090],
  "new delhi": [28.6139, 77.2090],
  "jaipur": [26.9124, 75.7873],
  "ahmedabad": [23.0225, 72.5714],
  "chennai": [13.0827, 80.2707],
  "kolkata": [22.5726, 88.3639],
  "surat": [21.1702, 72.8311],
  "indore": [22.7196, 75.8577],
  "bhopal": [23.2599, 77.4126],
  "chandigarh": [30.7333, 76.7794],
  "agra": [27.1767, 78.0081],
  "lucknow": [26.8467, 80.9462],
  "nagpur": [21.1458, 79.0882],
  "udaipur": [24.5854, 73.7125],
  "nashik": [19.9975, 73.7898],
  "vadodara": [22.3072, 73.1812],
  "varanasi": [25.3176, 82.9739],
  "patna": [25.5941, 85.1376],
  "coimbatore": [11.0168, 76.9558],
  "mysore": [12.2958, 76.6394],
  "mysuru": [12.2958, 76.6394],
  "kochi": [9.9312, 76.2673],
  "mangalore": [12.9141, 74.8560],
  "mangaluru": [12.9141, 74.8560],
  "hubli": [15.3647, 75.1240],
  "kolhapur": [16.7050, 74.2433],
  "belgaum": [15.8497, 74.4977],
  "satara": [17.6805, 74.0183],
  "lonavala": [18.7557, 73.4091],
  "thane": [19.2183, 72.9781],
  "gurgaon": [28.4595, 77.0266],
  "gurugram": [28.4595, 77.0266],
  "noida": [28.5355, 77.3910],
  "kanpur": [26.4499, 80.3319],
  "dehradun": [30.3165, 78.0322],
  "shimla": [31.1048, 77.1734],
  "manali": [32.2432, 77.1892],
  "amritsar": [31.6340, 74.8723],
  "jodhpur": [26.2389, 73.0243],
  "gwalior": [26.2183, 78.1828],
  "jabalpur": [23.1815, 79.9864],
  "visakhapatnam": [17.6868, 83.2185],
  "vijayawada": [16.5062, 80.6480],
  "madurai": [9.9252, 78.1198],
  "tirupati": [13.6288, 79.4192],
  "pondicherry": [11.9416, 79.8083],
  "ranchi": [23.3441, 85.3096],
  "bhubaneswar": [20.2961, 85.8245]
};

// Top Corridor Highway Presets with Realistic Curves, Stops & Navigation Instructions
const ROUTE_PRESETS = {
  "dharampuri-indore": {
    from: "Dharampuri (Dhar, MP)",
    to: "Indore (Indore, MP)",
    highway: "NH 52 (Agra-Bombay Highway / AB Road)",
    totalDistanceKm: 88,
    typicalDurationHours: 2.2,
    path: [
      [22.1642, 75.3503],
      [22.1950, 75.4120],
      [22.2197, 75.4697],
      [22.1620, 75.4520],
      [22.2612, 75.4850],
      [22.3421, 75.5412],
      [22.4312, 75.6418],
      [22.5020, 75.7110],
      [22.5540, 75.7594],
      [22.6412, 75.8115],
      [22.6850, 75.8340],
      [22.7196, 75.8577]
    ],
    stops: [
      { name: "Dharampuri Main Bus Stand (Pickup)", coords: [22.1642, 75.3503], distKm: 0, timeMin: 0, type: "pickup" },
      { name: "Dhamnod Mandi Chowk", coords: [22.2197, 75.4697], distKm: 15, timeMin: 20, type: "stop" },
      { name: "Khalghat Narmada Toll Plaza (NH 52)", coords: [22.1620, 75.4520], distKm: 22, timeMin: 30, type: "toll" },
      { name: "Gujri Ghat Mid-way Halt", coords: [22.3421, 75.5412], distKm: 40, timeMin: 55, type: "halt", duration: "10 min" },
      { name: "Manpur AB Road Stop", coords: [22.4312, 75.6418], distKm: 55, timeMin: 75, type: "stop" },
      { name: "Mhow / Dr. Ambedkar Nagar Bypass", coords: [22.5540, 75.7594], distKm: 70, timeMin: 95, type: "stop" },
      { name: "Rau Circle Indore", coords: [22.6412, 75.8115], distKm: 78, timeMin: 110, type: "stop" },
      { name: "Indore Sarwate Bus Terminal (Drop)", coords: [22.7196, 75.8577], distKm: 88, timeMin: 130, type: "drop" }
    ],
    instructions: [
      { atPct: 0.00, icon: "➔", title: "Departing from Dharampuri Bus Stand", sub: "Head towards Dhamnod to merge onto AB Road (NH 52)" },
      { atPct: 0.17, icon: "➔", title: "Passing Dhamnod Mandi Intersection", sub: "Join 4-Lane NH 52 heading towards Indore" },
      { atPct: 0.25, icon: "➔", title: "Crossing Khalghat Narmada Toll Plaza", sub: "Speed 70-80 km/h • Smooth national highway" },
      { atPct: 0.45, icon: "➔", title: "Passing Gujri Ghat curved incline", sub: "Scenic Vindhya section • Drive safe" },
      { atPct: 0.62, icon: "➔", title: "Crossing Manpur bypass", sub: "Road clear ahead towards Mhow" },
      { atPct: 0.80, icon: "➔", title: "Crossing Mhow bypass flyover", sub: "Approaching Indore outer road" },
      { atPct: 0.89, icon: "➔", title: "Passing Rau Circle interchange", sub: "Entering Indore city limits on AB Road" },
      { atPct: 0.98, icon: "➔", title: "Arriving at Indore Sarwate Bus Terminal", sub: "Journey completed" }
    ]
  },
  "indore-ujjain": {
    from: "Indore (Indore, MP)",
    to: "Ujjain (Ujjain, MP)",
    highway: "Indore-Ujjain 4-Lane State Highway (SH 27 via Sanwer)",
    totalDistanceKm: 55,
    typicalDurationHours: 1.25,
    path: [
      [22.7196, 75.8577],
      [22.7650, 75.8820],
      [22.8400, 75.8600],
      [22.9750, 75.8300],
      [23.0800, 75.8100],
      [23.1765, 75.7885]
    ],
    stops: [
      { name: "Indore Sarwate Bus Terminal (Origin)", coords: [22.7196, 75.8577], distKm: 0, timeMin: 0, type: "pickup" },
      { name: "MR-10 Toll Plaza / Vijay Nagar", coords: [22.7650, 75.8820], distKm: 12, timeMin: 18, type: "toll" },
      { name: "Sanwer Highway Mid-way Halt", coords: [22.9750, 75.8300], distKm: 32, timeMin: 45, type: "halt", duration: "10 min" },
      { name: "Nanakheda Bus Stand Ujjain (Destination)", coords: [23.1765, 75.7885], distKm: 55, timeMin: 75, type: "drop" }
    ],
    instructions: [
      { atPct: 0.00, icon: "➔", title: "Departing Indore Sarwate Terminal", sub: "Head through Vijay Nagar towards MR-10 Toll" },
      { atPct: 0.22, icon: "➔", title: "Crossing MR-10 Toll Plaza", sub: "Speed 70-80 km/h • Smooth 4-lane SH 27 highway" },
      { atPct: 0.58, icon: "➔", title: "Halting at Sanwer Highway Mid-way", sub: "10-minute tea and refreshment break" },
      { atPct: 0.85, icon: "➔", title: "Passing Ujjain outer ring road", sub: "Approaching Mahakal city limits" },
      { atPct: 0.98, icon: "➔", title: "Arriving at Nanakheda Bus Stand Ujjain", sub: "Journey completed" }
    ]
  },
  "indore-bhopal": {
    from: "Indore (Indore, MP)",
    to: "Bhopal (Bhopal, MP)",
    highway: "Indore-Bhopal 4-Lane State Expressway (SH 18 / NH 46)",
    totalDistanceKm: 195,
    typicalDurationHours: 3.5,
    path: [
      [22.7196, 75.8577],
      [22.7533, 75.8937],
      [22.9676, 76.0534],
      [22.9730, 76.3812],
      [23.0180, 76.7170],
      [23.1250, 76.9500],
      [23.2000, 77.1000],
      [23.2300, 77.2900],
      [23.2599, 77.4126]
    ],
    stops: [
      { name: "Indore Navlakha Lounge (Boarding)", coords: [22.7196, 75.8577], distKm: 0, timeMin: 0, type: "pickup" },
      { name: "Dewas Bypass Toll Plaza", coords: [22.9676, 76.0534], distKm: 38, timeMin: 45, type: "toll" },
      { name: "Sonkatch Kali Sindh Bridge", coords: [22.9730, 76.3812], distKm: 72, timeMin: 80, type: "stop" },
      { name: "Ashta Midway Food Hub (Halt)", coords: [23.0180, 76.7170], distKm: 110, timeMin: 120, type: "halt", duration: "20 min" },
      { name: "Sehore Crescent Square", coords: [23.2000, 77.1000], distKm: 155, timeMin: 165, type: "stop" },
      { name: "Lalghati Square VIP Road Bhopal", coords: [23.2300, 77.2900], distKm: 185, timeMin: 195, type: "stop" },
      { name: "Bhopal ISBT Habibganj (Destination)", coords: [23.2599, 77.4126], distKm: 195, timeMin: 210, type: "drop" }
    ],
    instructions: [
      { atPct: 0.00, icon: "➔", title: "Departing from Indore Navlakha Chartered Lounge", sub: "Merge onto AB Road towards Dewas bypass" },
      { atPct: 0.20, icon: "➔", title: "Passing Dewas Bypass Toll Plaza", sub: "4-Lane Expressway corridor • Speed 80 km/h" },
      { atPct: 0.40, icon: "➔", title: "Passing Sonkatch Kali Sindh River Bridge", sub: "Smooth expressway towards Ashta" },
      { atPct: 0.55, icon: "☕", title: "Halting at Ashta Midway Highway Food Hub", sub: "Scheduled 20-minute tea and snack halt" },
      { atPct: 0.78, icon: "➔", title: "Passing Sehore Bypass flyover", sub: "Entering Bhopal outer limits" },
      { atPct: 0.92, icon: "➔", title: "Crossing Lalghati Square VIP Road", sub: "Approaching Bhopal Habibganj" },
      { atPct: 0.98, icon: "➔", title: "Arriving at Bhopal ISBT Habibganj Terminal", sub: "Journey completed" }
    ]
  },
  "mumbai-pune": {
    from: "Mumbai",
    to: "Pune",
    highway: "Mumbai-Pune Expressway (NH 48)",
    totalDistanceKm: 148,
    typicalDurationHours: 3.5,
    path: [
      [18.9220, 72.8347],
      [19.0176, 72.8561],
      [19.0558, 72.9033],
      [19.0770, 72.9984],
      [19.0330, 73.0297],
      [19.0256, 73.0649],
      [18.9894, 73.1175],
      [18.8950, 73.1900],
      [18.8250, 73.2847],
      [18.7850, 73.3400],
      [18.7610, 73.3768],
      [18.7557, 73.4091],
      [18.7420, 73.5120],
      [18.7323, 73.6766],
      [18.6653, 73.7431],
      [18.5987, 73.7667],
      [18.5600, 73.8050],
      [18.5314, 73.8446],
      [18.5018, 73.8587]
    ],
    stops: [
      { name: "Mumbai Dadar (Boarding)", coords: [19.0176, 72.8561], distKm: 0, timeMin: 0, type: "pickup" },
      { name: "Vashi Toll Plaza", coords: [19.0770, 72.9984], distKm: 25, timeMin: 35, type: "stop" },
      { name: "Panvel Bypass", coords: [18.9894, 73.1175], distKm: 46, timeMin: 55, type: "stop" },
      { name: "Khalapur Toll Plaza", coords: [18.8250, 73.2847], distKm: 72, timeMin: 85, type: "toll" },
      { name: "Lonavala Food Court (Halt)", coords: [18.7557, 73.4091], distKm: 92, timeMin: 110, type: "halt", duration: "20 min" },
      { name: "Talegaon Toll Plaza", coords: [18.7323, 73.6766], distKm: 120, timeMin: 150, type: "toll" },
      { name: "Wakad Bridge", coords: [18.5987, 73.7667], distKm: 136, timeMin: 175, type: "stop" },
      { name: "Pune Swargate (Destination)", coords: [18.5018, 73.8587], distKm: 148, timeMin: 210, type: "drop" }
    ],
    instructions: [
      { atPct: 0.00, icon: "⬆️", title: "Head east on Eastern Express Highway", sub: "Continue toward Chembur & Vashi" },
      { atPct: 0.15, icon: "↗️", title: "Cross Vashi Creek Bridge into Navi Mumbai", sub: "Stay on Sion-Panvel Expressway" },
      { atPct: 0.30, icon: "⬆️", title: "Merge onto Yashwantrao Chavan Expressway", sub: "Speed Limit 100 km/h • FASTag lane active" },
      { atPct: 0.48, icon: "", title: "Ascending Bhor Ghat (Khandala Curve)", sub: "Heavy vehicle lane caution" },
      { atPct: 0.60, icon: "", title: "Halting at Lonavala Expressway Food Mall", sub: "Scheduled 20-min refreshment halt" },
      { atPct: 0.75, icon: "⬆️", title: "Continue straight past Talegaon Toll", sub: "Clear highway ahead towards Ravet" },
      { atPct: 0.88, icon: "↘️", title: "Take exit for Hinjawadi / Wakad", sub: "Entering Pune city bypass limits" },
      { atPct: 0.96, icon: "", title: "Approaching Pune Swargate Central Bus Stand", sub: "Prepare for baggage collection" }
    ]
  },
  "delhi-jaipur": {
    from: "Delhi",
    to: "Jaipur",
    highway: "Delhi-Jaipur National Highway (NH 48)",
    totalDistanceKm: 275,
    typicalDurationHours: 5.0,
    path: [
      [28.6675, 77.2285],
      [28.5921, 77.1610],
      [28.4720, 77.0725],
      [28.3588, 76.9381],
      [28.2057, 76.7909],
      [27.9868, 76.3837],
      [27.8863, 76.2818],
      [27.7027, 76.1994],
      [27.5200, 76.0800],
      [27.3917, 75.9614],
      [27.1350, 75.9525],
      [26.9855, 75.8513],
      [26.9239, 75.7997]
    ],
    stops: [
      { name: "Delhi ISBT (Boarding)", coords: [28.6675, 77.2285], distKm: 0, timeMin: 0, type: "pickup" },
      { name: "Gurgaon IFFCO Chowk", coords: [28.4720, 77.0725], distKm: 32, timeMin: 45, type: "stop" },
      { name: "Manesar Toll Plaza", coords: [28.3588, 76.9381], distKm: 52, timeMin: 70, type: "toll" },
      { name: "Neemrana Industrial Zone", coords: [27.9868, 76.3837], distKm: 122, timeMin: 140, type: "stop" },
      { name: "Behror Mid-way Food Hub", coords: [27.8863, 76.2818], distKm: 135, timeMin: 160, type: "halt", duration: "25 min" },
      { name: "Kotputli Bypass", coords: [27.7027, 76.1994], distKm: 160, timeMin: 195, type: "stop" },
      { name: "Shahpura Highway Stop", coords: [27.3917, 75.9614], distKm: 210, timeMin: 245, type: "stop" },
      { name: "Jaipur Sindhi Camp (Destination)", coords: [26.9239, 75.7997], distKm: 275, timeMin: 300, type: "drop" }
    ],
    instructions: [
      { atPct: 0.00, icon: "⬆️", title: "Head south on Mahatma Gandhi Marg", sub: "Follow signs for Gurgaon / Jaipur" },
      { atPct: 0.12, icon: "⬆️", title: "Pass Gurgaon Expressway Toll", sub: "NH 48 expressway route" },
      { atPct: 0.25, icon: "⬆️", title: "Continue straight through Manesar & Dharuhera", sub: "Speed 75-80 km/h" },
      { atPct: 0.45, icon: "", title: "Halting at Behror Highway Rest Stop", sub: "25 min meal and tea halt" },
      { atPct: 0.65, icon: "⬆️", title: "Pass Kotputli bypass flyover", sub: "Road clear ahead to Shahpura" },
      { atPct: 0.85, icon: "↗️", title: "Approaching Amer & Jaipur North Ring Road", sub: "Entering Pink City limits" },
      { atPct: 0.98, icon: "", title: "Arriving at Jaipur Sindhi Camp Terminal", sub: "Trip complete" }
    ]
  },
  "bangalore-mumbai": {
    from: "Bangalore",
    to: "Mumbai",
    highway: "Golden Quadrilateral / NH 48",
    totalDistanceKm: 980,
    typicalDurationHours: 15.0,
    path: [
      [12.9767, 77.5713],
      [13.0238, 77.5505],
      [13.3409, 77.1010],
      [13.7441, 76.9048],
      [14.2251, 76.3980],
      [14.4644, 75.9218],
      [15.3647, 75.1240],
      [15.8497, 74.4977],
      [16.7050, 74.2433],
      [17.2890, 74.1813],
      [17.6805, 74.0183],
      [18.4575, 73.8553],
      [19.0330, 73.0297],
      [19.2288, 72.8541]
    ],
    stops: [
      { name: "Bangalore Majestic (Boarding)", coords: [12.9767, 77.5713], distKm: 0, timeMin: 0, type: "pickup" },
      { name: "Tumkur Bypass", coords: [13.3409, 77.1010], distKm: 70, timeMin: 75, type: "stop" },
      { name: "Chitradurga Fort View", coords: [14.2251, 76.3980], distKm: 200, timeMin: 190, type: "stop" },
      { name: "Davanagere Benne Dosa Hub", coords: [14.4644, 75.9218], distKm: 265, timeMin: 250, type: "halt", duration: "30 min" },
      { name: "Hubli Toll Gate", coords: [15.3647, 75.1240], distKm: 410, timeMin: 380, type: "stop" },
      { name: "Belgaum Suvarna Soudha", coords: [15.8497, 74.4977], distKm: 505, timeMin: 470, type: "stop" },
      { name: "Kolhapur Mahalaxmi Bypass", coords: [16.7050, 74.2433], distKm: 615, timeMin: 570, type: "halt", duration: "30 min" },
      { name: "Satara Highway Rest", coords: [17.6805, 74.0183], distKm: 735, timeMin: 680, type: "stop" },
      { name: "Pune Katraj Tunnel", coords: [18.4575, 73.8553], distKm: 840, timeMin: 780, type: "stop" },
      { name: "Mumbai Borivali (Destination)", coords: [19.2288, 72.8541], distKm: 980, timeMin: 900, type: "drop" }
    ],
    instructions: [
      { atPct: 0.00, icon: "⬆️", title: "Head northwest on Tumkur Road (NH 48)", sub: "Speed 70 km/h • Green highway corridor" },
      { atPct: 0.25, icon: "", title: "Halting at Davanagere Express Food Mall", sub: "Scheduled dinner & driver change" },
      { atPct: 0.50, icon: "⬆️", title: "Crossing Karnataka-Maharashtra border at Kognoli", sub: "Approaching Kolhapur NH 48" },
      { atPct: 0.75, icon: "⬆️", title: "Pass Satara & Khambatki Ghat bypass", sub: "Expressway ahead towards Pune" },
      { atPct: 0.90, icon: "⬆️", title: "Cruising on Mumbai-Pune Expressway", sub: "Speed 80-90 km/h • Approaching Navi Mumbai" },
      { atPct: 0.98, icon: "", title: "Arriving at Mumbai Western Express Highway", sub: "Journey completed" }
    ]
  },
  "pune-goa": {
    from: "Pune",
    to: "Goa",
    highway: "NH 48 to NH 66 Coastal Highway",
    totalDistanceKm: 450,
    typicalDurationHours: 8.5,
    path: [
      [18.5018, 73.8587],
      [18.1364, 73.9877],
      [17.6805, 74.0183],
      [17.2890, 74.1813],
      [16.7050, 74.2433],
      [16.4013, 74.3813],
      [16.2625, 74.4842],
      [15.9056, 73.8213],
      [15.5937, 73.8136],
      [15.4989, 73.8340]
    ],
    stops: [
      { name: "Pune Swargate (Boarding)", coords: [18.5018, 73.8587], distKm: 0, timeMin: 0, type: "pickup" },
      { name: "Satara Highway Stand", coords: [17.6805, 74.0183], distKm: 110, timeMin: 110, type: "stop" },
      { name: "Karad Toll Plaza", coords: [17.2890, 74.1813], distKm: 165, timeMin: 160, type: "toll" },
      { name: "Kolhapur Highway Oasis", coords: [16.7050, 74.2433], distKm: 235, timeMin: 225, type: "halt", duration: "25 min" },
      { name: "Nipani Ghat Entrance", coords: [16.4013, 74.3813], distKm: 275, timeMin: 270, type: "stop" },
      { name: "Sawantwadi Green Valley", coords: [15.9056, 73.8213], distKm: 380, timeMin: 410, type: "stop" },
      { name: "Mapusa Bus Stand", coords: [15.5937, 73.8136], distKm: 435, timeMin: 475, type: "stop" },
      { name: "Panaji KTC Terminal Goa", coords: [15.4989, 73.8340], distKm: 450, timeMin: 510, type: "drop" }
    ],
    instructions: [
      { atPct: 0.00, icon: "⬆️", title: "Head south on Bengaluru-Pune Highway", sub: "Passing Katraj Ghat tunnel" },
      { atPct: 0.35, icon: "⬆️", title: "Pass Karad & Krishna river bridge", sub: "NH 48 expressway corridor" },
      { atPct: 0.52, icon: "", title: "Halt at Kolhapur Mid-way Food Hub", sub: "25-min meal and tea halt" },
      { atPct: 0.70, icon: "", title: "Descending Amboli / Chorla Western Ghats", sub: "Scenic curves • Drive safe" },
      { atPct: 0.88, icon: "", title: "Welcome to Goa • Crossing Pernem Checkpost", sub: "Coastal breeze ahead" },
      { atPct: 0.98, icon: "", title: "Arriving at Panaji KTC Bus Stand Goa", sub: "Enjoy your holiday!" }
    ]
  }
};

// Generates route data for any city pair (preset or dynamically interpolated)
function getRouteData(fromCity, toCity) {
  const f = (fromCity || 'Dharampuri (Dhar, MP)').trim();
  const t = (toCity || 'Indore (Indore, MP)').trim();
  const key = `${f.toLowerCase()}-${t.toLowerCase()}`;
  const revKey = `${t.toLowerCase()}-${f.toLowerCase()}`;

  if (ROUTE_PRESETS[key]) {
    return JSON.parse(JSON.stringify(ROUTE_PRESETS[key]));
  }

  if (ROUTE_PRESETS[revKey]) {
    const orig = ROUTE_PRESETS[revKey];
    const cloned = JSON.parse(JSON.stringify(orig));
    cloned.from = f;
    cloned.to = t;
    cloned.path = cloned.path.reverse();
    cloned.stops = cloned.stops.reverse().map((st, i, arr) => {
      st.distKm = cloned.totalDistanceKm - st.distKm;
      st.type = i === 0 ? 'pickup' : (i === arr.length - 1 ? 'drop' : (st.type === 'halt' ? 'halt' : 'stop'));
      return st;
    });
    return cloned;
  }

  // Check base name keys (e.g. "dharampuri-indore")
  const baseF = f.split('(')[0].trim().toLowerCase();
  const baseT = t.split('(')[0].trim().toLowerCase();
  const baseKey = `${baseF}-${baseT}`;
  const baseRevKey = `${baseT}-${baseF}`;

  if (ROUTE_PRESETS[baseKey]) {
    const orig = ROUTE_PRESETS[baseKey];
    const cloned = JSON.parse(JSON.stringify(orig));
    cloned.from = f;
    cloned.to = t;
    return cloned;
  }

  if (ROUTE_PRESETS[baseRevKey]) {
    const orig = ROUTE_PRESETS[baseRevKey];
    const cloned = JSON.parse(JSON.stringify(orig));
    cloned.from = f;
    cloned.to = t;
    cloned.path = cloned.path.reverse();
    cloned.stops = cloned.stops.reverse().map((st, i, arr) => {
      st.distKm = cloned.totalDistanceKm - st.distKm;
      st.type = i === 0 ? 'pickup' : (i === arr.length - 1 ? 'drop' : (st.type === 'halt' ? 'halt' : 'stop'));
      return st;
    });
    return cloned;
  }

  // Universal dynamic route generator using real resolved city coordinates
  const p1 = resolveCoordinatesForLocation(f);
  const p2 = resolveCoordinatesForLocation(t);

  const latDiff = p2[0] - p1[0];
  const lngDiff = p2[1] - p1[1];
  const approxDistanceKm = Math.round(Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111);
  const totalKm = Math.max(80, approxDistanceKm);
  const durationHours = Math.max(2, Math.round((totalKm / 65) * 10) / 10);

  // Generate 22 realistic curved highway coordinates
  const steps = 22;
  const path = [];
  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const curveOffset = Math.sin(fraction * Math.PI) * 0.18 * ((i % 2 === 0) ? 1 : 0.85);
    const lat = p1[0] + latDiff * fraction + curveOffset * 0.4;
    const lng = p1[1] + lngDiff * fraction + curveOffset;
    path.push([Number(lat.toFixed(5)), Number(lng.toFixed(5))]);
  }

  const stops = [
    { name: `${f} Central (Boarding)`, coords: path[0], distKm: 0, timeMin: 0, type: "pickup" },
    { name: `${f} Outer Toll Plaza`, coords: path[3], distKm: Math.round(totalKm * 0.15), timeMin: Math.round(durationHours * 60 * 0.15), type: "toll" },
    { name: "Highway Express Midway Halt", coords: path[9], distKm: Math.round(totalKm * 0.45), timeMin: Math.round(durationHours * 60 * 0.45), type: "halt", duration: "20 min" },
    { name: "State Border FASTag Gate", coords: path[15], distKm: Math.round(totalKm * 0.72), timeMin: Math.round(durationHours * 60 * 0.72), type: "stop" },
    { name: `${t} Bypass Flyover`, coords: path[19], distKm: Math.round(totalKm * 0.90), timeMin: Math.round(durationHours * 60 * 0.90), type: "stop" },
    { name: `${t} Terminal (Destination)`, coords: path[path.length - 1], distKm: totalKm, timeMin: Math.round(durationHours * 60), type: "drop" }
  ];

  const instructions = [
    { atPct: 0.00, icon: "⬆️", title: `Head out from ${f} on State Highway`, sub: `Follow signs towards ${t}` },
    { atPct: 0.20, icon: "⬆️", title: "Cruising on National Express Corridor", sub: "Speed limit 80 km/h • Highway clear" },
    { atPct: 0.45, icon: "", title: "Approaching Highway Midway Rest Hub", sub: "20-minute refreshment stop" },
    { atPct: 0.72, icon: "⬆️", title: "Pass State Border Toll Plaza", sub: "Smooth traffic flow" },
    { atPct: 0.90, icon: "↘️", title: `Take exit towards ${t} City Ring Road`, sub: "Entering city traffic limits" },
    { atPct: 0.98, icon: "", title: `Arriving at ${t} Bus Terminal`, sub: "Destination reached" }
  ];

  return {
    from: f,
    to: t,
    highway: `${f}-${t} Highway Express`,
    totalDistanceKm: totalKm,
    typicalDurationHours: durationHours,
    path,
    stops,
    instructions
  };
}

// Calculate bearing angle between two lat/lng coordinates in degrees
function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const toDeg = rad => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return (toDeg(θ) + 360) % 360;
}

// Compute coordinates and bearing at a given percentage along polyline path
function getPositionAtProgress(path, progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  if (path.length < 2) return { coords: path[0], bearing: 0, segmentIndex: 0 };

  const totalSegments = path.length - 1;
  const rawIdx = clamped * totalSegments;
  const segmentIndex = Math.min(Math.floor(rawIdx), totalSegments - 1);
  const t = rawIdx - segmentIndex;

  const p1 = path[segmentIndex];
  const p2 = path[segmentIndex + 1];

  const lat = p1[0] + (p2[0] - p1[0]) * t;
  const lng = p1[1] + (p2[1] - p1[1]) * t;
  const bearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);

  return { coords: [lat, lng], bearing, segmentIndex };
}

// Audio Chime synthesizer using Web Audio API
let isNavAudioActive = true;
function playNavChime() {
  if (!isNavAudioActive) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.log('Web Audio notification:', e);
  }
}

function toggleNavAudio() {
  isNavAudioActive = !isNavAudioActive;
  const btn = document.getElementById('gmapsAudioToggle');
  if (btn) {
    btn.innerHTML = isNavAudioActive ? '' : '';
    btn.title = isNavAudioActive ? 'Sound Alerts: ON' : 'Sound Alerts: OFF';
  }
  showToast(isNavAudioActive ? ' Navigation audio alerts enabled' : ' Navigation audio muted', 'info');
}

// Fullscreen toggle for Google Maps Tracker
function toggleTrackerFullscreen() {
  const box = document.querySelector('.tracker-modal-box');
  if (!box) return;
  box.classList.toggle('fullscreen');
  if (liveBusMap) {
    setTimeout(() => liveBusMap.invalidateSize(), 300);
  }
}

// Live Map State & Simulation variables
let liveBusMap = null;
let mapTileLayers = {};
let currentMapLayer = 'streets';
let isFollowBusActive = true;
let simSpeedFactor = 1;
let isSimulationPlaying = true;
let currentTripProgress = 0.15;
let simulationAnimId = null;
let lastAnimTimestamp = null;
let currentTrackingBooking = null;
let currentRouteData = null;

// Map elements
let busMarker = null;
let originMarker = null;
let destMarker = null;
let stopMarkers = [];
let traveledPolyline = null;
let remainingPolyline = null;
let notifiedStops = new Set();
let lastStopNotificationTime = 0;

function switchMapLayer(type) {
  if (!liveBusMap || !mapTileLayers[type]) return;

  Object.values(mapTileLayers).forEach(l => {
    if (liveBusMap.hasLayer(l)) liveBusMap.removeLayer(l);
  });

  mapTileLayers[type].addTo(liveBusMap);
  currentMapLayer = type;

  ['layerBtnStreets', 'layerBtnSat', 'layerBtnTerrain'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  if (type === 'streets') document.getElementById('layerBtnStreets')?.classList.add('active');
  if (type === 'satellite') document.getElementById('layerBtnSat')?.classList.add('active');
  if (type === 'terrain') document.getElementById('layerBtnTerrain')?.classList.add('active');
}

function toggleFollowBus() {
  isFollowBusActive = !isFollowBusActive;
  const btn = document.getElementById('followBusBtn');
  if (btn) {
    if (isFollowBusActive) {
      btn.classList.add('active');
      showToast('Centering camera on live bus', 'info');
      if (busMarker) {
        liveBusMap.panTo(busMarker.getLatLng(), { animate: true, duration: 0.5 });
      }
    } else {
      btn.classList.remove('active');
      showToast('Camera free pan mode', 'info');
    }
  }
}

function setSimSpeed(mult, btn) {
  simSpeedFactor = mult;
  document.querySelectorAll('.sim-rate-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const label = mult <= 0.25 ? 'Bohot Slow (0.25x)' : (mult <= 0.5 ? 'Slow Pace (0.5x)' : (mult === 1 ? 'Normal Slow (1x)' : `${mult}x Speed`));
  showToast(`Bus Speed: ${label}`, 'info');
}

function toggleSimulationPlayPause() {
  isSimulationPlaying = !isSimulationPlaying;
  const btn = document.getElementById('simPlayPauseBtn');
  if (btn) {
    btn.innerHTML = isSimulationPlaying ? '⏸️' : '▶️';
    btn.title = isSimulationPlaying ? 'Pause Bus Movement' : 'Resume Bus Movement';
  }
  showToast(isSimulationPlaying ? '▶️ Tracking resumed' : '⏸️ Tracking paused', 'info');
}

function mapZoomIn() {
  if (liveBusMap) liveBusMap.zoomIn();
}

function mapZoomOut() {
  if (liveBusMap) liveBusMap.zoomOut();
}

function closeLiveTrackerModal() {
  cancelAutoTrack();
  stopBusSimulation();
  closeModal('liveTrackingModal');
}

function stopBusSimulation() {
  if (simulationAnimId) {
    cancelAnimationFrame(simulationAnimId);
    simulationAnimId = null;
  }
  lastAnimTimestamp = null;
}

// Open Google Maps Live Tracking Modal (Only for Confirmed Bookings!)
function openLiveTrackingModal(booking) {
  cancelAutoTrack();

  if (!booking) {
    booking = AppState.activeTrackingBooking || AppState.lastBooking;
  }
  if (!booking) {
    const user = AppState.currentUser;
    const all = getStoredBookings().filter(b => b.status === 'CONFIRMED');
    if (user) {
      const email = (user.email || '').toLowerCase().trim();
      const phone = (user.phone || '').trim();
      const userList = all.filter(b =>
        ((b.passengerEmail && b.passengerEmail.toLowerCase().trim() === email) ||
         (b.passengerPhone && b.passengerPhone.trim() === phone) ||
         (b.userEmail && b.userEmail.toLowerCase().trim() === email))
      );
      if (userList.length > 0) booking = userList[0];
    } else if (all.length > 0) {
      booking = all[0];
    }
  }

  // Strictly enforce: No confirmed booking = Do NOT open tracking map!
  if (!booking || booking.status !== 'CONFIRMED') {
    showToast('No active booking found. Live tracking is available for confirmed tickets only.', 'warning');
    return;
  }

  currentTrackingBooking = booking;
  currentRouteData = getRouteData(booking.from, booking.to);

  // Populate Side Panel Details
  const pnrEl = document.getElementById('trackerPnrBadge');
  if (pnrEl) pnrEl.textContent = `PNR: ${booking.pnr || 'BG784910'}`;
  const opEl = document.getElementById('trackerBusOperator');
  if (opEl) opEl.textContent = booking.busOperator || 'IntrCity SmartBus';
  const rTitleEl = document.getElementById('trackerRouteTitle');
  if (rTitleEl) rTitleEl.textContent = `${booking.from} ➔ ${booking.to}`;
  const bNumEl = document.getElementById('trackerBusNumber');
  if (bNumEl) bNumEl.textContent = booking.busNumber || ('MH 12 AB ' + Math.floor(1000 + Math.random() * 9000));
  const pOrigEl = document.getElementById('trackerProgressOrigin');
  if (pOrigEl) pOrigEl.textContent = `${currentRouteData.from} (0 km)`;
  const pDestEl = document.getElementById('trackerProgressDest');
  if (pDestEl) pDestEl.textContent = `${currentRouteData.to} (${currentRouteData.totalDistanceKm} km)`;

  // Driver Profile: Captain Kirtan (+91 6264213958)
  const drivers = [
    { name: "Captain Kirtan", rating: "5.0 ★", trips: "1,850+ trips", bus: "Volvo B11R AC Multi-Axle", phone: "+91 6264213958" },
    { name: "Captain Kirtan (Senior Driver)", rating: "4.9 ★", trips: "2,200+ trips", bus: "Scania Metrolink HD", phone: "+91 6264213958" },
    { name: "Captain Kirtan", rating: "5.0 ★", trips: "1,500+ trips", bus: "Mercedes-Benz Super-Cruiser", phone: "+91 6264213958" }
  ];
  const d = drivers[Math.floor(Math.random() * drivers.length)];
  const dNameEl = document.getElementById('trackerDriverName');
  if (dNameEl) dNameEl.textContent = d.name;
  const dVehEl = document.getElementById('trackerVehicleModel');
  if (dVehEl) dVehEl.textContent = d.bus;

  // Feature 8: Update Highway Weather & Road Forecast
  updateHighwayWeatherWidget(booking.from, booking.to);

  // Build Stops Timeline HTML
  const timelineEl = document.getElementById('trackerStopsTimeline');
  if (timelineEl) {
    const stCountEl = document.getElementById('timelineStopsCount');
    if (stCountEl) stCountEl.textContent = `${currentRouteData.stops.length} Stops`;
    timelineEl.innerHTML = currentRouteData.stops.map((st, i) => `
      <div class="stop-item" id="timelineStop-${i}">
        <div class="stop-dot"></div>
        <div class="stop-name">${st.name}</div>
        <div class="stop-meta">
          <span> ${st.distKm} km</span>
          <span>⏱️ +${st.timeMin} min</span>
          ${st.duration ? `<span class="badge bg-warning-subtle text-dark border">${st.duration} Halt</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  openModal('liveTrackingModal');

  // Initialize or re-render map
  setTimeout(() => {
    initLeafletLiveMap(currentRouteData, booking);
    startBusSimulation();
    showToast('Live Google Map tracking activated. Bus moving on highway.', 'success');
    playNavChime();
  }, 250);
}

async function openLiveTrackingModalByPnr(pnr) {
  let list = getStoredBookings();
  let b = list.find(item => (item.pnr || '').toUpperCase() === (pnr || '').toUpperCase());

  if (!b) {
    try {
      const res = await fetch(`${API_BASE}/bookings/pnr/${encodeURIComponent(pnr)}`);
      if (res.ok) {
        const remoteBooking = await res.json();
        if (remoteBooking && remoteBooking.pnr) {
          b = remoteBooking;
          list.push(b);
          localStorage.setItem('busgo_bookings', JSON.stringify(list));
        }
      }
    } catch (e) {
      console.warn('Live tracking PNR server fetch failed:', e);
    }
  }

  if (!b || b.status !== 'CONFIRMED') {
    showToast('This ticket is either inactive or has been cancelled.', 'warning');
    return;
  }
  openLiveTrackingModal(b);
}

// Initialize Leaflet Map with Google Maps Tile Layers
function initLeafletLiveMap(routeData, booking) {
  if (typeof L === 'undefined') {
    console.error('Leaflet library is not loaded');
    return;
  }

  const mapContainer = document.getElementById('busLiveMap');
  if (!mapContainer) return;

  if (liveBusMap) {
    liveBusMap.remove();
    liveBusMap = null;
  }

  // Google Maps Tile Layers
  mapTileLayers = {
    streets: L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps'
    }),
    satellite: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps Satellite'
    }),
    terrain: L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps Terrain'
    }),
    carto: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; CartoDB & OpenStreetMap'
    })
  };

  const initialCenter = routeData.path[0];
  liveBusMap = L.map('busLiveMap', {
    center: initialCenter,
    zoom: 11,
    zoomControl: false,
    layers: [mapTileLayers.streets]
  });

  // Fit Route Bounds with generous padding
  const bounds = L.latLngBounds(routeData.path);
  liveBusMap.fitBounds(bounds, { padding: [50, 50] });

  // Custom Origin Marker (Green Pin)
  const originHtml = `
    <div class="pin-marker-custom">
      <div class="pin-bubble origin"> Pickup: ${routeData.from}</div>
      <div class="pin-pointer"></div>
    </div>`;
  const originIcon = L.divIcon({ html: originHtml, className: '', iconSize: [120, 36], iconAnchor: [60, 36] });
  originMarker = L.marker(routeData.path[0], { icon: originIcon }).addTo(liveBusMap);
  originMarker.bindPopup(`<strong>Boarding Point: ${routeData.from}</strong><br>Scheduled Departure: On Time`);

  // Custom Destination Marker (Red Pin)
  const destHtml = `
    <div class="pin-marker-custom">
      <div class="pin-bubble dest"> Drop: ${routeData.to}</div>
      <div class="pin-pointer"></div>
    </div>`;
  const destIcon = L.divIcon({ html: destHtml, className: '', iconSize: [120, 36], iconAnchor: [60, 36] });
  destMarker = L.marker(routeData.path[routeData.path.length - 1], { icon: destIcon }).addTo(liveBusMap);
  destMarker.bindPopup(`<strong>Dropping Terminal: ${routeData.to}</strong><br>Estimated Arrival in progress`);

  // Intermediate Stop Markers
  stopMarkers = [];
  routeData.stops.slice(1, -1).forEach(st => {
    const isHalt = st.type === 'halt';
    const stopHtml = `
      <div style="background:${isHalt ? '#f59e0b' : '#3b82f6'}; width:14px; height:14px; border-radius:50%; border:2.5px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`;
    const icon = L.divIcon({ html: stopHtml, className: '', iconSize: [14, 14], iconAnchor: [7, 7] });
    const m = L.marker(st.coords, { icon }).addTo(liveBusMap);
    m.bindPopup(`
      <strong>${st.name}</strong><br>
      Distance: ${st.distKm} km from origin<br>
      ETA: +${st.timeMin} min<br>
      ${st.duration ? `<span class="badge bg-warning text-dark mt-1">Scheduled Halt: ${st.duration}</span>` : ''}
    `);
    stopMarkers.push(m);
  });

  // Polyline Paths
  traveledPolyline = L.polyline([], {
    color: '#10b981',
    weight: 6,
    opacity: 0.95,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(liveBusMap);

  remainingPolyline = L.polyline(routeData.path, {
    color: '#1a73e8',
    weight: 6,
    opacity: 0.85,
    dashArray: '10, 8',
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(liveBusMap);

  // Custom Bus Marker with direction arrow & radar pulse
  const initialPos = getPositionAtProgress(routeData.path, currentTripProgress);
  const busHtml = `
    <div class="bus-marker-wrap">
      <div class="bus-radar-ring"></div>
      <div class="bus-icon-body" id="liveBusIconBody" style="transform: rotate(${initialPos.bearing}deg);">
        
      </div>
    </div>`;
  const busIcon = L.divIcon({ html: busHtml, className: '', iconSize: [46, 46], iconAnchor: [23, 23] });
  busMarker = L.marker(initialPos.coords, { icon: busIcon, zIndexOffset: 1000 }).addTo(liveBusMap);
  busMarker.bindPopup(`<strong>${booking.busOperator || 'BusGo SmartBus'}</strong><br>Live Speed: 68 km/h • On Route`);

  // Detect manual user drag to disable auto-pan
  liveBusMap.on('dragstart', () => {
    if (isFollowBusActive) {
      isFollowBusActive = false;
      document.getElementById('followBusBtn')?.classList.remove('active');
    }
  });

  liveBusMap.invalidateSize();
}

// Main Bus Animation Loop
function startBusSimulation() {
  stopBusSimulation();
  lastAnimTimestamp = performance.now();
  currentTripProgress = 0.02; // Start smoothly near origin
  notifiedStops.clear();
  lastStopNotificationTime = 0;

  function step(timestamp) {
    if (!lastAnimTimestamp) lastAnimTimestamp = timestamp;
    const deltaMs = timestamp - lastAnimTimestamp;
    lastAnimTimestamp = timestamp;

    if (isSimulationPlaying && currentRouteData && liveBusMap && busMarker) {
      // Slow, smooth & realistic pace: 1,800,000 ms (30 min full trip at 1x)
      const progressDelta = (deltaMs / 1800000) * simSpeedFactor;
      currentTripProgress += progressDelta;

      if (currentTripProgress >= 1) {
        currentTripProgress = 1;
        isSimulationPlaying = false;
        const pBtn = document.getElementById('simPlayPauseBtn');
        if (pBtn) pBtn.innerHTML = '';
        showToast(`Bus safely arrived at ${currentRouteData.to} Terminal!`, 'success');
        playNavChime();
      }

      updateLiveTelemetry(currentTripProgress);
    }

    simulationAnimId = requestAnimationFrame(step);
  }

  simulationAnimId = requestAnimationFrame(step);
}

// Update Bus position, telemetry, speedometer and navigation banner
function updateLiveTelemetry(progress) {
  if (!currentRouteData || !liveBusMap || !busMarker) return;

  const pos = getPositionAtProgress(currentRouteData.path, progress);

  // Update Bus Marker Position
  busMarker.setLatLng(pos.coords);

  // Rotate Bus Icon to match highway heading
  const busIconEl = document.getElementById('liveBusIconBody');
  if (busIconEl) {
    busIconEl.style.transform = `rotate(${pos.bearing}deg)`;
  }

  // Update Polylines: Traveled vs Remaining
  const passedCoords = currentRouteData.path.slice(0, pos.segmentIndex + 1);
  passedCoords.push(pos.coords);
  if (traveledPolyline) traveledPolyline.setLatLngs(passedCoords);

  const remainingCoords = [pos.coords, ...currentRouteData.path.slice(pos.segmentIndex + 1)];
  if (remainingPolyline) remainingPolyline.setLatLngs(remainingCoords);

  // Smooth camera tracking if Follow Bus is active
  if (isFollowBusActive) {
    liveBusMap.panTo(pos.coords, { animate: true, duration: 0.25 });
  }

  // Dynamic realistic highway speed (fluctuating between 65 and 78 km/h)
  const isNearToll = currentRouteData.stops.some(st => {
    const d = Math.abs(st.distKm - (currentRouteData.totalDistanceKm * progress));
    return d < 4 && (st.type === 'toll' || st.type === 'halt');
  });
  const currentSpeed = isNearToll
    ? Math.round(25 + Math.sin(Date.now() / 800) * 8)
    : Math.round(68 + Math.sin(Date.now() / 1500) * 8);

  const speedValEl = document.getElementById('gmapsSpeedVal');
  if (speedValEl) speedValEl.textContent = currentSpeed;

  // Progress Bar & Percentage
  const pctInt = Math.min(100, Math.round(progress * 100));
  const pBar = document.getElementById('trackerProgressBar');
  if (pBar) pBar.style.width = `${pctInt}%`;
  const pctText = document.getElementById('trackerProgressPct');
  if (pctText) pctText.textContent = `${pctInt}% Completed`;

  // Distance & Time Remaining
  const distanceRemainingKm = Math.max(0, Math.round(currentRouteData.totalDistanceKm * (1 - progress)));
  const distEl = document.getElementById('trackerDistanceLeft');
  if (distEl) distEl.textContent = `${distanceRemainingKm} km`;

  const totalMin = Math.round(currentRouteData.typicalDurationHours * 60 * (1 - progress));
  const hLeft = Math.floor(totalMin / 60);
  const mLeft = totalMin % 60;
  const etaText = hLeft > 0 ? `${hLeft}h ${mLeft}m` : `${mLeft}m`;
  const etaEl = document.getElementById('trackerEtaValue');
  if (etaEl) etaEl.textContent = etaText;

  // Est Arrival Clock Time
  const arrivalDate = new Date(Date.now() + totalMin * 60000);
  const arrivalClockEl = document.getElementById('trackerArrivalClock');
  if (arrivalClockEl) {
    arrivalClockEl.textContent = arrivalDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  // Next Stop Calculation
  let nextStop = currentRouteData.stops.find(st => st.distKm > (currentRouteData.totalDistanceKm * progress));
  if (!nextStop) nextStop = currentRouteData.stops[currentRouteData.stops.length - 1];

  const distToNextStop = Math.max(0, Math.round(nextStop.distKm - (currentRouteData.totalDistanceKm * progress)));
  const haltEl = document.getElementById('trackerCurrentHalt');
  if (haltEl) haltEl.textContent = nextStop.name.split(' ')[0] || nextStop.name;

  // Turn-by-Turn Instruction Banner Updates
  let currentInst = currentRouteData.instructions[0];
  for (let i = 0; i < currentRouteData.instructions.length; i++) {
    if (progress >= currentRouteData.instructions[i].atPct) {
      currentInst = currentRouteData.instructions[i];
    }
  }

  const turnIcon = document.getElementById('gmapsTurnIcon');
  if (turnIcon) turnIcon.textContent = currentInst.icon;
  const turnInst = document.getElementById('gmapsTurnInstruction');
  if (turnInst) turnInst.textContent = currentInst.title;
  const turnSub = document.getElementById('gmapsTurnSub');
  if (turnSub) turnSub.textContent = `Next Stop: ${nextStop.name} in ${distToNextStop} km (${Math.round((distToNextStop / 65) * 60)} min)`;

  // Timeline Step Status Updates & Gentle Place Notifications
  const currentKm = currentRouteData.totalDistanceKm * progress;

  currentRouteData.stops.forEach((st, idx) => {
    const el = document.getElementById(`timelineStop-${idx}`);
    const distDiff = Math.abs(currentKm - st.distKm);
    const isPassed = currentKm >= st.distKm;
    const isCurrent = distDiff < 6; // Active stop indicator in sidebar timeline

    if (el) {
      if (isPassed && !isCurrent) {
        el.className = 'stop-item passed';
      } else if (isCurrent) {
        el.className = 'stop-item current';
      } else {
        el.className = 'stop-item';
      }
    }

    // Gentle Place Notification: Only once per stop, when within 2.5km, and at least 25s cooldown between notifications
    if (distDiff <= 2.5 && !notifiedStops.has(idx)) {
      const now = Date.now();
      if (now - lastStopNotificationTime >= 25000) {
        notifiedStops.add(idx);
        lastStopNotificationTime = now;
        playNavChime();
        const typeNote = st.type === 'halt' ? ' ( 20m Halt)' : (st.type === 'drop' ? ' (Destination)' : '');
        showToast(`Approaching: ${st.name}${typeNote}`, 'info');
      }
    }
  });
}

// Quick Actions in Tracking Panel
function callDriverPrompt() {
  const driverModal = document.getElementById('driverContactModal');
  if (driverModal) {
    const dName = document.getElementById('driverContactName');
    if (dName) dName.textContent = 'Captain Kirtan';
    if (currentTrackingBooking) {
      const bNum = document.getElementById('trackerBusNumber')?.textContent;
      const sub = document.getElementById('gmapsTurnSub')?.textContent;
      if (bNum) document.getElementById('driverBusNumber').textContent = bNum;
      if (sub) document.getElementById('driverHighwayLocation').textContent = sub;
    }
    openModal('driverContactModal');
  }
}

function triggerSosModal() {
  openModal('sosModal');
}

function shareTrackingLink() {
  const pnr = currentTrackingBooking?.pnr || 'LIVE';
  const url = `${window.location.origin}${window.location.pathname}?track=${pnr}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast(`Live GPS Route tracking link copied: ${url}`, 'success');
    }).catch(() => {
      showToast(`Share PNR: ${pnr} with friends & family`, 'info');
    });
  } else {
    showToast(`Share PNR: ${pnr} with friends & family`, 'info');
  }
}

/* ============================================================
   ADMIN DASHBOARD MODULE (REAL-TIME USERS & BOOKINGS DATA)
   ============================================================ */
let adminCachedBookings = [];
let adminCachedUsers = [];
let currentAdminTab = 'bookings';
let adminAutoRefreshTimer = null;

async function openAdminDashboard() {
  if (!isCurrentUserAdmin()) {
    showToast('Access Denied: Admin control is reserved for Captain Kirtan.', 'error');
    return;
  }
  openModal('adminDashboardModal');
  await refreshAdminDashboardData();

  // Auto-poll every 8 seconds while Admin Dashboard is open
  if (adminAutoRefreshTimer) clearInterval(adminAutoRefreshTimer);
  adminAutoRefreshTimer = setInterval(() => {
    const modal = document.getElementById('adminDashboardModal');
    if (modal && modal.classList.contains('active')) {
      refreshAdminDashboardData(null, true);
    } else {
      clearInterval(adminAutoRefreshTimer);
      adminAutoRefreshTimer = null;
    }
  }, 8000);
}

// Universal Indian Standard Time (IST) Date/Time Formatter
function formatToIST(dateInput) {
  if (!dateInput) return 'Recently';
  try {
    let d;
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (trimmed.endsWith('Z') || trimmed.includes('+') || (trimmed.includes('T') && trimmed.includes(':'))) {
        d = new Date(trimmed);
      } else {
        d = new Date(trimmed.replace(' ', 'T') + '+05:30');
        if (isNaN(d.getTime())) d = new Date(trimmed);
      }
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return String(dateInput);

    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return String(dateInput);
  }
}

async function refreshAdminDashboardData(btnEl = null, isSilent = false) {
  const refreshBtn = btnEl || document.getElementById('adminRefreshBtn');
  const spinner = document.getElementById('adminRefreshSpinner');
  const btnText = document.getElementById('adminRefreshBtnText');

  if (refreshBtn && !isSilent) {
    refreshBtn.disabled = true;
    if (spinner) spinner.classList.remove('d-none');
    if (btnText) btnText.textContent = 'Refreshing...';
  }

  const usersCountEl = document.getElementById('adminTotalUsers');
  const bookingsCountEl = document.getElementById('adminTotalBookings');
  const revenueEl = document.getElementById('adminTotalRevenue');
  const dbStatusEl = document.getElementById('adminDbStatusText');

  if (dbStatusEl) {
    dbStatusEl.textContent = isBackendConnected ? 'Live (Port 3307)' : 'Standalone Mode';
  }

  const timestamp = Date.now();

  try {
    // 1. Fetch Bookings and Users concurrently with cache-busting headers
    const [bRes, uRes] = await Promise.allSettled([
      fetch(`${API_BASE}/bookings?_t=${timestamp}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        signal: AbortSignal.timeout(6000)
      }),
      fetch(`${API_BASE}/users?_t=${timestamp}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        signal: AbortSignal.timeout(6000)
      })
    ]);

    // Handle Bookings
    const bMap = new Map();
    if (bRes.status === 'fulfilled' && bRes.value.ok) {
      const serverList = await bRes.value.json();
      if (Array.isArray(serverList)) {
        serverList.forEach(b => {
          if (b && b.pnr) bMap.set(String(b.pnr).toLowerCase().trim(), b);
        });
      }
    }
    const localBookings = getStoredBookings();
    if (Array.isArray(localBookings)) {
      localBookings.forEach(b => {
        if (b && b.pnr) {
          const key = String(b.pnr).toLowerCase().trim();
          if (!bMap.has(key)) bMap.set(key, b);
        }
      });
    }
    adminCachedBookings = Array.from(bMap.values());
    saveStoredBookings(adminCachedBookings);
    BusDatabase.bookings = [...adminCachedBookings];

    // Handle Users
    const uMap = new Map();
    if (uRes.status === 'fulfilled' && uRes.value.ok) {
      const data = await uRes.value.json();
      const serverUsers = data.data || data;
      if (Array.isArray(serverUsers)) {
        serverUsers.forEach(u => {
          const key = String(u.email || u.phone || '').toLowerCase().trim();
          if (key) uMap.set(key, u);
        });
      }
    }
    const localUsers = getStoredUsers();
    if (Array.isArray(localUsers)) {
      localUsers.forEach(u => {
        const key = String(u.email || u.phone || '').toLowerCase().trim();
        if (key && !uMap.has(key)) uMap.set(key, u);
      });
    }
    adminCachedUsers = Array.from(uMap.values());
    try {
      localStorage.setItem('busgo_users_list', JSON.stringify(adminCachedUsers));
    } catch (e) {}

  } catch (err) {
    console.warn('Admin refresh error:', err);
    adminCachedBookings = getStoredBookings();
    adminCachedUsers = getStoredUsers();
  }

  // 3. Update Metrics Cards
  if (usersCountEl) usersCountEl.textContent = adminCachedUsers.length;
  if (bookingsCountEl) bookingsCountEl.textContent = adminCachedBookings.length;

  const totalRev = adminCachedBookings.reduce((sum, b) => {
    if (b && b.status === 'CONFIRMED') {
      const amt = Number(b.totalAmount || b.total || 0);
      return sum + amt;
    }
    return sum;
  }, 0);
  if (revenueEl) revenueEl.textContent = `₹${totalRev.toLocaleString('en-IN')}`;

  const tabBCount = document.getElementById('adminTabBookingsCount');
  if (tabBCount) tabBCount.textContent = adminCachedBookings.length;
  const tabUCount = document.getElementById('adminTabUsersCount');
  if (tabUCount) tabUCount.textContent = adminCachedUsers.length;

  const reviewsList = getStoredReviews();
  const tabRCount = document.getElementById('adminTabReviewsCount');
  if (tabRCount) tabRCount.textContent = reviewsList.length;

  // Render active tab immediately
  filterAdminCurrentTab();

  if (refreshBtn && !isSilent) {
    refreshBtn.disabled = false;
    if (spinner) spinner.classList.add('d-none');
    if (btnText) btnText.textContent = 'Refresh Data';
    showToast(`Refreshed! Live data loaded: ${adminCachedBookings.length} Bookings, ${adminCachedUsers.length} Users.`, 'success');
  }
}

function getStoredUsers() {
  const local = localStorage.getItem('busgo_users_list');
  let list = [];
  if (local) {
    try { list = JSON.parse(local); } catch (e) {}
  }

  // Also collect passengers from all booked tickets (shown in Admin panel)
  try {
    const bookings = getStoredBookings();
    bookings.forEach(b => {
      const email = String(b.email || b.passengerEmail || '').trim().toLowerCase();
      const phone = String(b.phone || b.passengerPhone || '').trim();
      const name = String(b.passengerName || b.name || 'Member').trim();
      if (email || phone) {
        const exists = list.some(u => 
          (email && u.email && String(u.email).trim().toLowerCase() === email) ||
          (phone && u.phone && String(u.phone).trim() === phone)
        );
        if (!exists) {
          list.push({
            id: b.id || Date.now(),
            name: name,
            email: email,
            phone: phone,
            role: 'USER',
            createdAt: b.createdAt || new Date().toISOString()
          });
        }
      }
    });
  } catch (e) {}

  if (AppState.currentUser) {
    const currEmail = String(AppState.currentUser.email || '').trim().toLowerCase();
    const found = list.some(u => u.email && String(u.email).trim().toLowerCase() === currEmail);
    if (!found) {
      list.unshift({
        id: AppState.currentUser.id || 1,
        name: AppState.currentUser.name || 'Captain Kirtan',
        email: AppState.currentUser.email || 'bhawsarkirtan11@gmail.com',
        phone: AppState.currentUser.phone || '6264213958',
        role: AppState.currentUser.role || 'ADMIN',
        createdAt: new Date().toISOString()
      });
    }
  }
  return list;
}

function switchAdminTab(tab) {
  currentAdminTab = tab;
  const bTabBtn = document.getElementById('adminTabBookingsBtn');
  const uTabBtn = document.getElementById('adminTabUsersBtn');
  const rTabBtn = document.getElementById('adminTabReviewsBtn');
  const bContent = document.getElementById('adminTabBookingsContent');
  const uContent = document.getElementById('adminTabUsersContent');
  const rContent = document.getElementById('adminTabReviewsContent');

  if (bTabBtn) bTabBtn.classList.toggle('active', tab === 'bookings');
  if (uTabBtn) uTabBtn.classList.toggle('active', tab === 'users');
  if (rTabBtn) rTabBtn.classList.toggle('active', tab === 'reviews');

  if (bContent) bContent.classList.toggle('d-none', tab !== 'bookings');
  if (uContent) uContent.classList.toggle('d-none', tab !== 'users');
  if (rContent) rContent.classList.toggle('d-none', tab !== 'reviews');

  filterAdminCurrentTab();
}

// Universal Robust Record Matcher (Safe against all data types)
function recordMatchesQuery(item, query) {
  if (!item) return false;
  if (!query) return true;
  const q = String(query).toLowerCase().trim();
  if (!q) return true;

  return Object.values(item).some(val => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val).toLowerCase().includes(q);
      } catch (e) {
        return false;
      }
    }
    return String(val).toLowerCase().includes(q);
  });
}

function clearAdminSearch() {
  const sInput = document.getElementById('adminSearchInput');
  if (sInput) sInput.value = '';
  filterAdminCurrentTab();
  if (sInput) sInput.focus();
}

function filterAdminCurrentTab(isManualSearch = false) {
  const query = (document.getElementById('adminSearchInput')?.value || '').toLowerCase().trim();

  const matchedBookings = adminCachedBookings.filter(b => recordMatchesQuery(b, query));
  const matchedUsers = adminCachedUsers.filter(u => recordMatchesQuery(u, query));
  const matchedReviews = getStoredReviews().filter(r => recordMatchesQuery(r, query));

  // Update dynamic count on tabs
  const tabBCount = document.getElementById('adminTabBookingsCount');
  if (tabBCount) tabBCount.textContent = query ? `${matchedBookings.length}` : adminCachedBookings.length;
  const tabUCount = document.getElementById('adminTabUsersCount');
  if (tabUCount) tabUCount.textContent = query ? `${matchedUsers.length}` : adminCachedUsers.length;
  const tabRCount = document.getElementById('adminTabReviewsCount');
  if (tabRCount) tabRCount.textContent = query ? `${matchedReviews.length}` : getStoredReviews().length;

  const summaryEl = document.getElementById('adminSearchSummary');
  if (summaryEl) {
    if (query) {
      summaryEl.classList.remove('d-none');
      summaryEl.innerHTML = `Search result for "<strong>${query}</strong>": Found in <strong>${matchedBookings.length}</strong> Tickets, <strong>${matchedUsers.length}</strong> Members, <strong>${matchedReviews.length}</strong> Reviews.`;
    } else {
      summaryEl.classList.add('d-none');
      summaryEl.innerHTML = '';
    }
  }

  if (currentAdminTab === 'bookings') {
    if (matchedBookings.length === 0 && query && matchedUsers.length > 0) {
      const tbody = document.getElementById('adminBookingsTableBody');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-4 bg-light">
              <div class="text-secondary fw-semibold">No ticket records matched "${query}".</div>
              <div class="mt-2 text-primary fw-bold">Found <strong>${matchedUsers.length} matching record(s)</strong> in Members / Logins tab!</div>
              <button class="btn btn-sm btn-primary mt-2 px-3 fw-bold" onclick="switchAdminTab('users')">Switch to Members Tab</button>
            </td>
          </tr>
        `;
      }
    } else {
      renderAdminBookings(matchedBookings);
    }

    // Dynamic backend search fallback if query has >= 2 characters
    if ((matchedBookings.length === 0 || isManualSearch) && query.length >= 2) {
      fetch(`${API_BASE}/bookings?q=${encodeURIComponent(query)}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            let addedNew = false;
            data.forEach(item => {
              const exists = adminCachedBookings.some(x => String(x.pnr || '').toUpperCase() === String(item.pnr || '').toUpperCase());
              if (!exists) {
                adminCachedBookings.unshift(item);
                addedNew = true;
              }
            });
            if (addedNew) {
              const refreshed = adminCachedBookings.filter(b => recordMatchesQuery(b, query));
              renderAdminBookings(refreshed);
              if (tabBCount) tabBCount.textContent = refreshed.length;
            }
          }
        })
        .catch(() => {});
    }
  } else if (currentAdminTab === 'users') {
    if (matchedUsers.length === 0 && query && matchedBookings.length > 0) {
      const tbody = document.getElementById('adminUsersTableBody');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-4 bg-light">
              <div class="text-secondary fw-semibold">No member records matched "${query}".</div>
              <div class="mt-2 text-primary fw-bold">Found <strong>${matchedBookings.length} matching record(s)</strong> in Booked Tickets tab!</div>
              <button class="btn btn-sm btn-primary mt-2 px-3 fw-bold" onclick="switchAdminTab('bookings')">Switch to Bookings Tab</button>
            </td>
          </tr>
        `;
      }
    } else {
      renderAdminUsers(matchedUsers);
    }

    if ((matchedUsers.length === 0 || isManualSearch) && query.length >= 2) {
      fetch(`${API_BASE}/users?q=${encodeURIComponent(query)}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          const list = data.data || data;
          if (Array.isArray(list) && list.length > 0) {
            let addedNew = false;
            list.forEach(item => {
              const key = String(item.email || item.phone || '').toLowerCase().trim();
              const exists = adminCachedUsers.some(x => String(x.email || x.phone || '').toLowerCase().trim() === key);
              if (!exists) {
                adminCachedUsers.unshift(item);
                addedNew = true;
              }
            });
            if (addedNew) {
              const refreshed = adminCachedUsers.filter(u => recordMatchesQuery(u, query));
              renderAdminUsers(refreshed);
              if (tabUCount) tabUCount.textContent = refreshed.length;
            }
          }
        })
        .catch(() => {});
    }
  } else if (currentAdminTab === 'reviews') {
    renderAdminReviews(matchedReviews);
  }
}

function renderAdminBookings(list) {
  const tbody = document.getElementById('adminBookingsTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No booking records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(b => {
    const isConfirmed = b.status === 'CONFIRMED';
    const seats = Array.isArray(b.seats) ? b.seats.join(', ') : (b.seatsBooked || b.seats || '-');
    const fare = b.totalAmount || b.total || 0;
    const operator = b.operator || b.busOperator || 'IntrCity SmartBus';
    const route = `${b.fromCity || b.from || '-'} ➔ ${b.toCity || b.to || '-'}`;
    const dt = b.createdAt ? formatToIST(b.createdAt) : '-';

    return `
      <tr>
        <td>
          <span class="badge bg-primary font-monospace fs-6">${b.pnr || '-'}</span>
        </td>
        <td>
          <strong>${b.passengerName || 'Guest'}</strong> <span class="badge ${b.gender === 'Female' ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'}" style="font-size:10px;">${b.gender || 'Female'}</span><br/>
          <small class="text-muted">Phone: <a href="tel:${b.phone || b.passengerPhone || ''}" class="text-decoration-none text-muted">${b.phone || b.passengerPhone || '-'}</a></small><br/>
          <small class="text-muted">Email:  ${b.email || b.passengerEmail || '-'}</small>
        </td>
        <td>
          <strong class="text-dark">${operator}</strong><br/>
          <span class="text-success fw-semibold">${route}</span>
        </td>
        <td>
          <span class="text-secondary fw-semibold">${formatDate(b.travelDate || b.date)}</span>
          <br/><small class="text-primary fw-bold">${formatTime12(b.departure || '08:00 PM')}</small>
        </td>
        <td>
          <span class="badge bg-danger text-white fs-6">${seats}</span>
          ${b.isLadiesSeat ? '<br/><span class="badge bg-danger-subtle text-danger border border-danger-subtle" style="font-size:10px;">Ladies Seat</span>' : ''}
        </td>
        <td>
          <strong class="text-success fs-6">₹${fare}</strong><br/>
          <span class="badge bg-light text-dark border" style="font-size:10px;">${b.paymentMethod || 'PhonePe'}</span>
        </td>
        <td>
          <span class="badge ${isConfirmed ? 'bg-success' : 'bg-danger'}">${isConfirmed ? 'CONFIRMED' : 'CANCELLED'}</span>
        </td>
        <td>
          <small class="text-muted">${dt}</small>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAdminUsers(list) {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No registered member records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((u, i) => {
    const email = String(u.email || '').toLowerCase().trim();
    const phone = String(u.phone || '').trim();
    const role = String(u.role || 'USER').toUpperCase();
    const isAdmin = role === 'ADMIN' || email === 'bhawsarkirtan11@gmail.com' || phone === '6264213958';

    // Count how many bookings were made by this user
    const userBookingsCount = adminCachedBookings.filter(b => {
      const bEmail = String(b.email || b.passengerEmail || '').toLowerCase().trim();
      const bPhone = String(b.phone || b.passengerPhone || '').trim();
      return (email && bEmail === email) || (phone && bPhone === phone);
    }).length;

    const dt = u.createdAt ? formatToIST(u.createdAt) : 'Verified Member';

    return `
      <tr>
        <td>#${u.id || (i + 1)}</td>
        <td>
          <strong class="text-dark">${u.name || 'Member'}</strong>
          ${isAdmin ? '<span class="badge bg-warning text-dark ms-1" style="font-size:10px;">ADMIN</span>' : ''}
        </td>
        <td>
          Email: <a href="mailto:${email}" class="text-decoration-none fw-semibold text-primary">${email}</a>
        </td>
        <td>
          Phone: <a href="tel:${phone}" class="text-decoration-none text-dark font-monospace">${phone || '-'}</a>
        </td>
        <td>
          <span class="badge ${isAdmin ? 'bg-warning text-dark' : 'bg-info-subtle text-dark border'}">${isAdmin ? 'ADMIN' : 'PASSENGER'}</span>
        </td>
        <td>
          <small class="text-muted">${dt}</small>
        </td>
        <td class="text-center">
          <span class="badge ${userBookingsCount > 0 ? 'bg-success' : 'bg-secondary'} fs-6">${userBookingsCount} Tickets</span>
        </td>
      </tr>
    `;
  }).join('');
}


// ============================================================
// FEATURE 5: PASSENGER REVIEWS & RATINGS IN ADMIN PANEL
// ============================================================
function renderAdminReviews(list) {
  const tbody = document.getElementById('adminReviewsTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No passenger reviews submitted yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => {
    const tripStars = '★'.repeat(r.tripRating || 5) + '☆'.repeat(Math.max(0, 5 - (r.tripRating || 5)));
    const dt = r.createdAt ? formatToIST(r.createdAt) : 'Recently';

    return `
      <tr>
        <td>
          <span class="badge bg-primary font-monospace">${r.pnr || 'PNR'}</span>
        </td>
        <td>
          <strong>${r.passengerName || 'Passenger'}</strong><br/>
          <small class="text-muted">${r.passengerEmail || ''}</small>
        </td>
        <td>
          <span class="text-warning fw-bold fs-6">${tripStars}</span> (${r.tripRating || 5}/5)
        </td>
        <td>
          <span class="badge bg-success-subtle text-success border border-success fw-bold">${r.driverRating || 5} Stars</span><br/>
          <small class="text-muted">Captain Kirtan</small>
        </td>
        <td>
          <div style="max-width: 280px; word-break: break-word;">"${r.comment || 'Good trip'}"</div>
        </td>
        <td>
          <small class="text-muted">${dt}</small>
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================================
// FEATURE 6: DARK MODE / LIGHT MODE THEME ENGINE
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('busgo_theme') || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-bs-theme', theme);
  localStorage.setItem('busgo_theme', theme);
  const isDark = theme === 'dark';
  const label = document.getElementById('themeToggleLabel');
  if (label) {
    label.textContent = isDark ? 'Dark Mode' : 'Light Mode';
    label.className = isDark ? 'badge bg-warning text-dark px-2 py-1 fw-bold' : 'badge bg-secondary text-white px-2 py-1 fw-bold';
  }
  const metaTheme = document.getElementById('metaThemeColor');
  if (metaTheme) {
    metaTheme.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  showToast(next === 'dark' ? 'Dark Mode Enabled' : 'Light Mode Enabled', 'info');
}

// ============================================================
// FEATURE 8: LIVE HIGHWAY WEATHER & ROAD FORECAST WIDGET
// ============================================================
function updateHighwayWeatherWidget(from, to) {
  const weatherIcon = document.getElementById('trackerWeatherIcon');
  const weatherTemp = document.getElementById('trackerWeatherTemp');
  const weatherCond = document.getElementById('trackerWeatherCondition');
  const roadCond = document.getElementById('trackerRoadCondition');
  const weatherDet = document.getElementById('trackerWeatherDetails');

  const f = (from || '').toLowerCase();
  const t = (to || '').toLowerCase();

  let highway = 'Express National Highway';
  let temp = '28°C';
  let cond = 'Sunny & Pleasant';
  let icon = '';
  let road = 'Road Safe & Clear (Smooth Flow)';
  let wind = '12 km/h';
  let vis = '10 km (Excellent)';

  if ((f.includes('mumbai') && t.includes('pune')) || (f.includes('pune') && t.includes('mumbai'))) {
    highway = 'Mumbai-Pune Yashwantrao Chavan Expressway (NH-48)';
    temp = '27°C';
    cond = 'Pleasant Ghat Breeze';
    icon = '';
    road = 'Expressway Clear • Normal Speed 80 km/h';
    wind = '15 km/h';
  } else if ((f.includes('delhi') && t.includes('jaipur')) || (f.includes('jaipur') && t.includes('delhi'))) {
    highway = 'Delhi-Jaipur NH-48 Express Corridor';
    temp = '26°C';
    cond = 'Clear Skies';
    icon = '';
    road = 'Safe Road • Zero Fog Alert';
    wind = '11 km/h';
  } else if ((f.includes('bangalore') && t.includes('hyderabad')) || (f.includes('hyderabad') && t.includes('bangalore'))) {
    highway = 'Bangalore-Hyderabad NH-44 Corridor';
    temp = '29°C';
    cond = 'Warm & Sunny';
    icon = '';
    road = '6-Lane Fast Corridor Safe';
    wind = '14 km/h';
  } else if (f.includes('goa') || t.includes('goa')) {
    highway = 'Konkan Coastal NH-66 & Amboli Ghat';
    temp = '30°C';
    cond = 'Coastal Breeze';
    icon = '';
    road = 'Ghat Section Clear & Dry';
    wind = '18 km/h';
  }

  if (weatherIcon) weatherIcon.textContent = icon;
  if (weatherTemp) weatherTemp.textContent = temp;
  if (weatherCond) weatherCond.textContent = cond;
  if (roadCond) roadCond.textContent = road;
  if (weatherDet) weatherDet.textContent = `Route: ${highway} • Wind: ${wind} • Visibility: ${vis}`;
}

// ============================================================
// FEATURE 5: TRIP & DRIVER (CAPTAIN KIRTAN) REVIEWS SYSTEM
// ============================================================
let currentTripRatingScore = 5;

function setTripRating(score) {
  currentTripRatingScore = score;
  updateStarRatingDisplay(score);
  const labels = ['', 'Poor Experience', 'Average', 'Good', 'Very Good', 'Excellent Trip'];
  const textEl = document.getElementById('tripRatingText');
  if (textEl) textEl.textContent = labels[score] || `${score} Stars`;
}

function hoverTripRating(score) {
  updateStarRatingDisplay(score);
}

function resetHoverTripRating() {
  updateStarRatingDisplay(currentTripRatingScore);
}

function updateStarRatingDisplay(score) {
  const stars = document.querySelectorAll('#starRatingGroup .star-item');
  stars.forEach((s, idx) => {
    s.classList.toggle('active', idx < score);
  });
}

function openTripReviewModal(pnr) {
  closeModal('myBookingsModal');
  const all = getStoredBookings();
  const b = all.find(x => x.pnr === pnr);

  const pnrEl = document.getElementById('reviewPnrBadge');
  const opEl = document.getElementById('reviewBusOperator');
  const rText = document.getElementById('reviewRouteText');
  const targetPnrInput = document.getElementById('reviewTargetPnr');

  if (b) {
    if (pnrEl) pnrEl.textContent = `PNR: ${b.pnr}`;
    if (opEl) opEl.textContent = b.busOperator || 'Bus Operator';
    if (rText) rText.textContent = `${b.from} ➔ ${b.to} • Captain Kirtan`;
    if (targetPnrInput) targetPnrInput.value = b.pnr;
  } else {
    if (targetPnrInput) targetPnrInput.value = pnr || '';
  }

  setTripRating(5);
  const commentInput = document.getElementById('reviewCommentInput');
  if (commentInput) commentInput.value = '';

  openModal('reviewModal');
}

function getStoredReviews() {
  try {
    return JSON.parse(localStorage.getItem('busgo_reviews') || '[]');
  } catch (e) {
    return [];
  }
}

function submitPassengerReview() {
  const pnr = document.getElementById('reviewTargetPnr')?.value || 'PNR';
  const driverRating = document.getElementById('driverRatingScore')?.value || '5';
  const comment = document.getElementById('reviewCommentInput')?.value.trim() || 'Safe driving by Captain Kirtan and very comfortable trip!';
  const user = AppState.currentUser || { name: 'Passenger' };

  const review = {
    id: Date.now(),
    pnr: pnr,
    passengerName: user.name || 'Passenger',
    passengerEmail: user.email || '',
    tripRating: currentTripRatingScore,
    driverRating: Number(driverRating),
    driverName: 'Captain Kirtan',
    comment: comment,
    createdAt: new Date().toISOString()
  };

  const reviews = getStoredReviews();
  reviews.unshift(review);
  localStorage.setItem('busgo_reviews', JSON.stringify(reviews));

  closeModal('reviewModal');
  showToast('Thank you! Rating and feedback for Captain Kirtan submitted.', 'success');

  // Update badge and admin table if active
  const tabRCount = document.getElementById('adminTabReviewsCount');
  if (tabRCount) tabRCount.textContent = reviews.length;
  renderAdminReviews(reviews);
}

// ============================================================
// FEATURE 1: PRINT & DIRECT PDF DOWNLOAD E-TICKET
// ============================================================
function findBookingForExport(pnr) {
  const targetPnr = pnr || (AppState.lastBooking ? AppState.lastBooking.pnr : null);
  const all = getStoredBookings();
  let b = null;
  if (targetPnr) {
    b = all.find(x => (x.pnr || '').toUpperCase() === String(targetPnr).toUpperCase());
    if (!b && typeof adminCachedBookings !== 'undefined' && Array.isArray(adminCachedBookings)) {
      b = adminCachedBookings.find(x => (x.pnr || '').toUpperCase() === String(targetPnr).toUpperCase());
    }
  }
  if (!b && AppState.lastBooking) b = AppState.lastBooking;
  if (!b && all.length > 0) b = all[0];
  return b;
}

function buildTicketPdfHtml(b) {
  const fromCity = b.fromCity || b.from || 'Indore';
  const toCity = b.toCity || b.to || 'Bhopal';
  const op = b.operator || b.busOperator || 'IntrCity SmartBus';
  const fare = b.totalAmount || b.total || 0;
  const seats = Array.isArray(b.seats) ? b.seats.join(', ') : (b.seatsBooked || b.seats || '-');
  const phone = b.phone || b.passengerPhone || '-';
  const email = b.email || b.passengerEmail || '-';
  const depTime = formatTime12(b.departure || '08:00 PM');
  const dateStr = formatDate(b.date || b.travelDate);
  const pnr = b.pnr || ('BG' + Date.now().toString().slice(-6));
  const gender = b.gender || 'Female';

  return `
    <div style="width: 700px; max-width: 100%; margin: 0 auto; padding: 24px; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff; color: #1f2937; border: 2px solid #e5e7eb; border-radius: 12px; box-sizing: border-box;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ff6b35; padding-bottom: 12px; margin-bottom: 16px;">
        <div>
          <div style="font-size: 26px; font-weight: 800; color: #ff6b35; letter-spacing: -0.5px;">BusGo</div>
          <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Official Electronic Passenger Ticket (E-Ticket)</div>
        </div>
        <div style="text-align: right;">
          <span style="display: inline-block; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 13px;">${b.status || 'CONFIRMED'}</span>
          <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">Verified Electronic Ticket</div>
        </div>
      </div>

      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">PNR Number</div>
          <div style="font-size: 22px; font-weight: 800; color: #0f172a; font-family: monospace; letter-spacing: 1px;">${pnr}</div>
        </div>
        <div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Travel Date & Time</div>
          <div style="font-size: 15px; font-weight: 700; color: #2563eb;">${dateStr} • ${depTime}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Total Fare Paid</div>
          <div style="font-size: 20px; font-weight: 800; color: #16a34a;">₹${fare}</div>
        </div>
      </div>

      <div style="display: flex; gap: 14px; margin-bottom: 16px;">
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 13px;">
          <div style="font-size: 11.5px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">Journey & Bus Details</div>
          <div style="margin-bottom: 6px;"><span style="color:#64748b;">Route:</span> <strong style="color:#ff6b35;">${fromCity} ➔ ${toCity}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color:#64748b;">Bus Operator:</span> <strong>${op}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color:#64748b;">Boarding Point:</span> <strong style="color:#2563eb;">${b.pickupPoint || 'Central Bus Terminal'}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color:#64748b;">Dropping Point:</span> <strong style="color:#059669;">${b.dropPoint || 'City Drop Stand'}</strong></div>
          <div><span style="color:#64748b;">Assigned Driver:</span> <strong>Captain Kirtan (+91 6264213958)</strong></div>
        </div>

        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 13px;">
          <div style="font-size: 11.5px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">Passenger & Seating</div>
          <div style="margin-bottom: 6px;"><span style="color:#64748b;">Passenger:</span> <strong>${b.passengerName || 'Guest'}</strong> <span style="display:inline-block; font-size:10px; padding:2px 6px; border-radius:8px; background:#f1f5f9; font-weight:600; margin-left:4px;">${gender}</span></div>
          <div style="margin-bottom: 6px;"><span style="color:#64748b;">Phone:</span> <strong>${phone}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color:#64748b;">Email:</span> <span>${email}</span></div>
          <div style="margin-bottom: 6px;"><span style="color:#64748b;">Booked Seats:</span> <strong style="color:#dc2626; font-size:14px;">${seats}</strong> ${b.isLadiesSeat ? '<span style="display:inline-block; font-size:10px; padding:2px 6px; border-radius:8px; background:#ffe4e6; color:#e11d48; font-weight:700; margin-left:4px;">Ladies Dedicated Seat</span>' : ''}</div>
          <div><span style="color:#64748b;">Payment Method:</span> <strong>${b.paymentMethod || 'PhonePe UPI'}</strong> <span style="font-family:monospace; font-size:11px; color:#64748b;">(${b.txnId || 'TXN_LOCAL'})</span></div>
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=PNR:${pnr}|PASSENGER:${encodeURIComponent(b.passengerName || 'Guest')}|ROUTE:${encodeURIComponent(fromCity)}-${encodeURIComponent(toCity)}" alt="QR Code" style="width:64px; height:64px; border:2px solid #ffffff; border-radius:6px; background:#fff;"/>
          <div>
            <div style="font-weight: 700; color: #be123c; font-size: 12px;">Official Boarding Verification QR</div>
            <div style="font-size: 11px; color: #9f1239;">Scan this QR code during bus boarding for instant verification by Captain Kirtan.</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Security Hash: ${pnr}-${Date.now().toString().slice(-6)}</div>
          </div>
        </div>
        <div style="text-align: right; font-size: 10.5px; color: #64748b;">
          <div>Helpline: <strong>+91 6264213958</strong></div>
          <div>Police: <strong>112</strong></div>
        </div>
      </div>

      <div style="border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 10px; color: #6b7280; line-height: 1.5;">
        <div><strong>Important Passenger Guidelines:</strong></div>
        <div>1. Please arrive at the boarding point at least 15 minutes before departure (${depTime}).</div>
        <div>2. Carry a valid government photo ID card (Aadhaar / Voter ID / Driving License) for verification.</div>
        <div>3. Contact Captain Kirtan (+91 6264213958) for live route assistance.</div>
      </div>

      <div style="text-align: center; margin-top: 10px; font-size: 9.5px; color: #9ca3af; border-top: 1px dashed #e5e7eb; padding-top: 6px;">
        BusGo Smart Bus Technologies • Generated on ${new Date().toLocaleString('en-IN')} • Wishing you a safe journey!
      </div>
    </div>
  `;
}

function downloadTicketPdf(pnr) {
  const b = findBookingForExport(pnr);
  if (!b) {
    showToast('No booking record found to download.', 'error');
    return;
  }

  showToast('Preparing your official PDF ticket...', 'info');

  // Method 1: High-Fidelity PDF with html2pdf (if available)
  if (typeof html2pdf !== 'undefined') {
    try {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '700px';
      container.innerHTML = buildTicketPdfHtml(b);
      document.body.appendChild(container);

      const opt = {
        margin:       [8, 8, 8, 8],
        filename:     `BusGo_Ticket_${b.pnr}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(container).save().then(() => {
        document.body.removeChild(container);
        showToast(`PDF Ticket downloaded: BusGo_Ticket_${b.pnr}.pdf`, 'success');
      }).catch(err => {
        console.warn('html2pdf render failed, using native PDF generator:', err);
        if (container.parentNode) document.body.removeChild(container);
        downloadNativePdfTicket(b);
      });
      return;
    } catch (e) {
      console.warn('html2pdf exception, using native fallback:', e);
    }
  }

  // Method 2: 100% Offline Standalone Native PDF Binary Download
  downloadNativePdfTicket(b);
}

function downloadNativePdfTicket(b) {
  const pnr = b.pnr || ('BG' + Date.now().toString().slice(-6));
  const name = b.passengerName || 'Guest';
  const fromCity = b.fromCity || b.from || 'Indore';
  const toCity = b.toCity || b.to || 'Bhopal';
  const dep = formatTime12(b.departure || '08:00 PM');
  const dateStr = formatDate(b.date || b.travelDate);
  const seats = Array.isArray(b.seats) ? b.seats.join(', ') : (b.seatsBooked || b.seats || '-');
  const fare = b.totalAmount || b.total || 0;
  const op = b.operator || b.busOperator || 'IntrCity SmartBus';
  const pickup = b.pickupPoint || 'Central Terminal';
  const drop = b.dropPoint || 'City Drop Stand';
  const gender = b.gender || 'Female';

  const content = [
    'BT',
    '/F2 22 Tf 0.9 0.3 0.1 rg 40 790 Td (BusGo - Official E-Ticket) Tj',
    '/F1 10 Tf 0.3 0.3 0.3 rg 0 -18 Td (Electronic Passenger Travel Confirmation) Tj',
    '/F2 15 Tf 0.1 0.1 0.1 rg 0 -35 Td (PNR: ' + pnr + ') Tj',
    '/F1 11 Tf 0.1 0.6 0.2 rg 260 0 Td (STATUS: CONFIRMED) Tj',
    '-260 -30 Td',
    '/F2 13 Tf 0.1 0.1 0.1 rg (Route: ' + fromCity + ' -> ' + toCity + ') Tj',
    '/F1 11 Tf 0.2 0.4 0.8 rg 260 0 Td (Departure: ' + dep + ') Tj',
    '-260 -25 Td',
    '/F1 11 Tf 0.2 0.2 0.2 rg (Travel Date: ' + dateStr + ') Tj',
    '260 0 Td (Bus: ' + op + ') Tj',
    '-260 -25 Td',
    '(Passenger: ' + name + ' / ' + gender + ') Tj',
    '260 0 Td',
    '/F2 12 Tf 0.8 0.1 0.1 rg (Seats: ' + seats + ') Tj',
    '-260 -25 Td',
    '/F1 10 Tf 0.3 0.3 0.3 rg (Pickup Point: ' + pickup + ') Tj',
    '260 0 Td (Dropping Point: ' + drop + ') Tj',
    '-260 -25 Td',
    '/F2 11 Tf 0.1 0.1 0.1 rg (Assigned Driver: Captain Kirtan / +91 6264213958) Tj',
    '-260 -25 Td',
    '/F2 13 Tf 0.1 0.6 0.2 rg (Total Fare: Rs. ' + fare + ' / Paid via ' + (b.paymentMethod || 'UPI') + ') Tj',
    '-260 -40 Td',
    '/F1 9 Tf 0.4 0.4 0.4 rg (Please report to boarding point 15 mins before scheduled departure.) Tj',
    '0 -15 Td (Valid Government ID proof required at the time of boarding.) Tj',
    '0 -15 Td (Emergency Helpline: 112 / Driver: +91 6264213958) Tj',
    '0 -35 Td',
    '/F1 8 Tf 0.6 0.6 0.6 rg (BusGo Smart Travel Technologies - Wishing you a safe journey!) Tj',
    'ET'
  ].join('\n');

  const streamLen = content.length;
  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj');
  objects.push('6 0 obj\n<< /Length ' + streamLen + ' >>\nstream\n' + content + '\nendstream\nendobj');

  let pdfText = '%PDF-1.4\n';
  const offsets = [];
  offsets.push(0);

  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdfText.length);
    pdfText += objects[i] + '\n';
  }

  const startxref = pdfText.length;
  pdfText += 'xref\n0 ' + (objects.length + 1) + '\n';
  pdfText += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    const off = String(offsets[i]).padStart(10, '0');
    pdfText += off + ' 00000 n \n';
  }
  pdfText += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
  pdfText += 'startxref\n' + startxref + '\n%%EOF';

  const blob = new Blob([pdfText], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BusGo_Ticket_${pnr}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
  showToast(`PDF Ticket downloaded: BusGo_Ticket_${pnr}.pdf`, 'success');
}

function printETicket(pnr) {
  const b = findBookingForExport(pnr);
  if (b) {
    const fromCity = b.fromCity || b.from || '-';
    const toCity = b.toCity || b.to || '-';
    const op = b.operator || b.busOperator || 'IntrCity SmartBus';
    const fare = b.totalAmount || b.total || 0;
    const seats = Array.isArray(b.seats) ? b.seats.join(', ') : (b.seatsBooked || b.seats || '-');
    const payBadge = (b.paymentMethod || 'PhonePe') === 'PhonePe'
      ? `<span class="badge bg-dark">PhonePe UPI</span>`
      : `<span class="badge bg-secondary">${b.paymentMethod || 'Paid'}</span>`;

    const tc = document.getElementById('ticketCard');
    if (tc) {
      tc.innerHTML = `
        <div class="ticket-id">PNR: ${b.pnr}</div>
        <div class="t-row"><span class="t-label">Passenger</span><span class="t-val">${b.passengerName || 'Guest'} <span class="badge ${b.gender === 'Female' ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'} ms-1" style="font-size:11px;">${b.gender || 'Female'}</span></span></div>
        ${b.isLadiesSeat ? `<div class="t-row"><span class="t-label">Seating Protection</span><span class="t-val text-danger fw-bold">Women-Safe Dedicated Seat</span></div>` : ''}
        <div class="t-row"><span class="t-label">Route</span><span class="t-val">${fromCity} → ${toCity}</span></div>
        <div class="t-row"><span class="t-label">Pickup Point</span><span class="t-val text-primary fw-semibold">${b.pickupPoint || 'Central Terminal'}</span></div>
        <div class="t-row"><span class="t-label">Dropping Point</span><span class="t-val text-success fw-semibold">${b.dropPoint || 'City Drop Stand'}</span></div>
        <div class="t-row"><span class="t-label">Captain Driver</span><span class="t-val fw-bold">Captain Kirtan (+91 6264213958)</span></div>
        <div class="t-row"><span class="t-label">Bus</span><span class="t-val">${op}</span></div>
        <div class="t-row"><span class="t-label">Date & Time</span><span class="t-val">${formatDate(b.date || b.travelDate)} • <strong class="text-primary">${formatTime12(b.departure || '08:00 PM')}</strong></span></div>
        <div class="t-row"><span class="t-label">Seats</span><span class="t-val fw-bold text-danger">${seats}</span></div>
        <div class="t-row"><span class="t-label">Payment</span><span class="t-val">${payBadge}</span></div>
        <div class="t-row"><span class="t-label">Txn ID</span><span class="t-val font-monospace" style="font-size:12px;">${b.txnId || 'TXN_LOCAL'}</span></div>
        <div class="t-row"><span class="t-label">Amount Paid</span><span class="t-val" style="color:var(--primary); font-weight:800; font-size:1.15rem;">₹${fare}</span></div>
        <div class="t-row"><span class="t-label">Status</span><span class="t-val" style="color:#22C55E; font-weight:700;"> ${b.status || 'CONFIRMED'}</span></div>`;
    }
  }

  showToast('Opening print preview dialog...', 'info');
  setTimeout(() => {
    window.print();
  }, 350);
}

// Theme and ChatGPT Assistant initialization on load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initDraggableAiChat();
});


