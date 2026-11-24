-- ============================================================
-- BusGo Database Schema (MySQL / PostgreSQL)
-- SQL Layer for Java Spring Boot Backend
-- ============================================================

CREATE DATABASE IF NOT EXISTS busgo_db;
USE busgo_db;

-- Table: users
CREATE TABLE users (
    id             BIGINT PRIMARY KEY AUTO_INCREMENT,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(100) NOT NULL UNIQUE,
    phone          VARCHAR(15)  NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    role           ENUM('USER','ADMIN') DEFAULT 'USER',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: buses
CREATE TABLE buses (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    operator     VARCHAR(100) NOT NULL,
    type         ENUM('ac','sleeper','volvo','ordinary') NOT NULL,
    from_city    VARCHAR(50) NOT NULL,
    to_city      VARCHAR(50) NOT NULL,
    departure    TIME NOT NULL,
    arrival      TIME NOT NULL,
    duration     VARCHAR(20) NOT NULL,
    price        DECIMAL(8,2) NOT NULL,
    total_seats  INT NOT NULL DEFAULT 40,
    rating       DECIMAL(3,2) DEFAULT 4.0,
    amenities    VARCHAR(255),
    active       BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: seats
CREATE TABLE seats (
    id        BIGINT PRIMARY KEY AUTO_INCREMENT,
    bus_id    BIGINT NOT NULL,
    seat_no   INT NOT NULL,
    type      ENUM('window','aisle') DEFAULT 'window',
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_bus_seat (bus_id, seat_no)
);

-- Table: bookings
CREATE TABLE bookings (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    pnr             VARCHAR(20) NOT NULL UNIQUE,
    user_id         BIGINT,
    bus_id          BIGINT NOT NULL,
    passenger_name  VARCHAR(100) NOT NULL,
    phone           VARCHAR(15)  NOT NULL,
    email           VARCHAR(100) NOT NULL,
    travel_date     DATE NOT NULL,
    seats_booked    VARCHAR(100) NOT NULL,
    total_amount    DECIMAL(10,2) NOT NULL,
    payment_method  ENUM('card','upi','netbanking','phonepe') DEFAULT 'phonepe',
    payment_status  ENUM('PENDING','SUCCESS','FAILED') DEFAULT 'PENDING',
    status          ENUM('CONFIRMED','CANCELLED','PENDING') DEFAULT 'CONFIRMED',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id)  REFERENCES buses(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Table: popular_routes
CREATE TABLE popular_routes (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    from_city   VARCHAR(50) NOT NULL,
    to_city     VARCHAR(50) NOT NULL,
    base_price  DECIMAL(8,2),
    duration    VARCHAR(20),
    bookings    INT DEFAULT 0
);

-- ============================================================
-- SAMPLE DATA
-- ============================================================

INSERT INTO buses (operator, type, from_city, to_city, departure, arrival, duration, price, total_seats, rating, amenities) VALUES
('IntrCity SmartBus (Captain Kirtan)', 'volvo', 'Dharampuri', 'Indore', '18:00', '20:15', '2h 15m', 240.00, 40, 4.9, 'WiFi,AC,USB,Water,Blanket,Live Tracking'),
('Hans Travels', 'sleeper', 'Dharampuri', 'Indore', '09:15', '11:30', '2h 15m', 190.00, 36, 4.7, 'AC,Charging Point,Blanket,Water,CCTV'),
('Chartered Bus', 'volvo', 'Dharampuri', 'Indore', '07:30', '09:45', '2h 15m', 220.00, 40, 4.8, 'WiFi,AC,USB,Snacks,Water'),
('Maa Narmada Travels', 'ordinary', 'Dharampuri', 'Indore', '06:30', '08:45', '2h 15m', 110.00, 50, 4.5, 'Water,First Aid Box'),
('Chartered Bus (NueGo Electric)', 'volvo', 'Indore', 'Bhopal', '07:00', '10:15', '3h 15m', 350.00, 40, 4.9, 'WiFi,AC,USB,Water,CCTV,Deep Cleaned'),
('Hans Travels', 'sleeper', 'Indore', 'Bhopal', '08:30', '12:00', '3h 30m', 420.00, 36, 4.8, 'AC,Blanket,Charging Point,Water,Pillow'),
('Verma Travels', 'ac', 'Indore', 'Bhopal', '10:00', '13:30', '3h 30m', 320.00, 44, 4.7, 'AC,Water,Charging Point'),
('Hans Travels', 'sleeper', 'Indore', 'Mumbai', '19:00', '06:30', '11h 30m', 1250.00, 36, 4.8, 'WiFi,AC,Blanket,Charging Point,Pillow,Live Tracking'),
('MSRTC Shivneri (E-Shivneri)', 'volvo', 'Mumbai', 'Pune', '06:00', '09:30', '3h 30m', 380.00, 44, 4.7, 'WiFi,AC,USB,Clean Air,Live Tracking'),
('Paulo Travels', 'sleeper', 'Pune', 'Goa', '21:30', '06:00', '8h 30m', 950.00, 36, 4.6, 'AC,Pillow,Blanket,Live Tracking'),
('Zingbus Electric', 'volvo', 'Delhi', 'Jaipur', '06:30', '11:30', '5h', 499.00, 40, 4.9, 'WiFi,AC,USB,Snacks,Live Tracking'),
('VRL Travels', 'volvo', 'Bangalore', 'Mumbai', '16:00', '08:00', '16h', 1450.00, 40, 4.8, 'WiFi,AC,USB,Blanket,Live Tracking'),
('KSRTC Airavat Club Class', 'volvo', 'Bangalore', 'Hyderabad', '21:30', '06:30', '9h', 890.00, 40, 4.8, 'WiFi,AC,Water,Blanket,Live Tracking'),
('GSRTC Volvo', 'volvo', 'Mumbai', 'Ahmedabad', '06:30', '14:30', '8h', 650.00, 40, 4.6, 'WiFi,AC,Water');

INSERT INTO popular_routes (from_city, to_city, base_price, duration, bookings) VALUES
('Mumbai',    'Pune',      350, '3h 30m', 12500),
('Delhi',     'Jaipur',    249, '5h',      9800),
('Bangalore', 'Hyderabad', 699, '10h',     8700),
('Pune',      'Goa',       599, '6h',      7600),
('Chennai',   'Bangalore', 499, '6h',      7200),
('Mumbai',    'Ahmedabad', 599, '8h',      6900);

-- ============================================================
-- USEFUL QUERIES
-- ============================================================

-- Search buses by route
SELECT * FROM buses
WHERE from_city = 'Bangalore' AND to_city = 'Mumbai' AND active = TRUE
ORDER BY price ASC;

-- Get available seat count
SELECT b.id, b.operator,
       (b.total_seats - COUNT(bk.id)) AS available_seats
FROM buses b
LEFT JOIN bookings bk ON b.id = bk.bus_id AND bk.travel_date = CURDATE()
GROUP BY b.id;

-- Get booking by PNR
SELECT bk.*, b.operator, b.from_city, b.to_city, b.departure
FROM bookings bk
JOIN buses b ON bk.bus_id = b.id
WHERE bk.pnr = 'BG12345678';

-- Revenue report by operator
SELECT b.operator, COUNT(bk.id) AS total_bookings, SUM(bk.total_amount) AS revenue
FROM bookings bk
JOIN buses b ON bk.bus_id = b.id
WHERE bk.status = 'CONFIRMED'
GROUP BY b.operator
ORDER BY revenue DESC;
