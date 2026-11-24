package com.busgo.util;

import java.sql.*;

/**
 * Pure JDBC Database Utility for managing MySQL connections,
 * table auto-creation, and sample data initialization.
 */
public class DBUtil {

    private static final String DB_NAME = "busgo_db";
    private static final String DRIVER = "com.mysql.cj.jdbc.Driver";

    // Ports to try: 3307 (configured for XAMPP) and 3306 (standard default)
    private static final String[] URLS = {
        "jdbc:mysql://localhost:3307/" + DB_NAME + "?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC",
        "jdbc:mysql://localhost:3306/" + DB_NAME + "?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
    };

    // Passwords to try: empty (XAMPP default) and root1122
    private static final String[] PASSWORDS = { "", "root1122", "root" };
    private static final String USER = "root";

    private static String workingUrl = null;
    private static String workingPass = null;

    static {
        try {
            Class.forName(DRIVER);
        } catch (ClassNotFoundException e) {
            System.err.println("MySQL JDBC Driver not found: " + e.getMessage());
        }
    }

    /**
     * Obtains a live JDBC Connection to the MySQL database.
     */
    public static synchronized Connection getConnection() throws SQLException {
        // 1. Check Cloud Environment Variables first (Render, Railway, AWS, TiDB, Aiven)
        String envUrl = System.getenv("MYSQL_URL");
        if (envUrl == null || envUrl.trim().isEmpty()) {
            envUrl = System.getenv("DATABASE_URL");
        }
        if (envUrl != null && !envUrl.trim().isEmpty()) {
            try {
                if (envUrl.startsWith("mysql://")) {
                    envUrl = "jdbc:" + envUrl;
                }
                String envUser = System.getenv("DB_USER");
                String envPass = System.getenv("DB_PASSWORD");
                if (envUser != null && envPass != null) {
                    return DriverManager.getConnection(envUrl, envUser, envPass);
                } else {
                    return DriverManager.getConnection(envUrl);
                }
            } catch (SQLException e) {
                System.err.println("Cloud database connection attempt: " + e.getMessage());
            }
        }

        if (workingUrl != null) {
            try {
                return DriverManager.getConnection(workingUrl, USER, workingPass);
            } catch (SQLException e) {
                // If previously working connection fails, reset cache and re-probe
                workingUrl = null;
            }
        }

        // Auto-detect working URL and Password combination
        for (String url : URLS) {
            for (String pass : PASSWORDS) {
                try {
                    Connection conn = DriverManager.getConnection(url, USER, pass);
                    workingUrl = url;
                    workingPass = pass;
                    return conn;
                } catch (SQLException ignored) {
                }
            }
        }

        throw new SQLException("Could not connect to MySQL on port 3307 or 3306. Please ensure MySQL is running in XAMPP.");
    }

    /**
     * Initializes tables and sample dataset if they do not exist.
     */
    public static void initDatabase() {
        try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
            // 1. Create users table
            stmt.execute("CREATE TABLE IF NOT EXISTS users (" +
                    "id BIGINT PRIMARY KEY AUTO_INCREMENT, " +
                    "name VARCHAR(100) NOT NULL, " +
                    "email VARCHAR(100) NOT NULL UNIQUE, " +
                    "phone VARCHAR(15) NOT NULL, " +
                    "password_hash VARCHAR(255) NOT NULL, " +
                    "role VARCHAR(20) DEFAULT 'USER', " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            // 2. Create buses table
            stmt.execute("CREATE TABLE IF NOT EXISTS buses (" +
                    "id BIGINT PRIMARY KEY AUTO_INCREMENT, " +
                    "operator VARCHAR(100) NOT NULL, " +
                    "type VARCHAR(20) NOT NULL, " +
                    "from_city VARCHAR(50) NOT NULL, " +
                    "to_city VARCHAR(50) NOT NULL, " +
                    "departure VARCHAR(20) NOT NULL, " +
                    "arrival VARCHAR(20) NOT NULL, " +
                    "duration VARCHAR(20) NOT NULL, " +
                    "price DECIMAL(8,2) NOT NULL, " +
                    "total_seats INT NOT NULL DEFAULT 40, " +
                    "rating DECIMAL(3,2) DEFAULT 4.0, " +
                    "amenities VARCHAR(255), " +
                    "active BOOLEAN DEFAULT TRUE, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            // 3. Create bookings table
            stmt.execute("CREATE TABLE IF NOT EXISTS bookings (" +
                    "id BIGINT PRIMARY KEY AUTO_INCREMENT, " +
                    "pnr VARCHAR(20) NOT NULL UNIQUE, " +
                    "bus_id BIGINT NOT NULL, " +
                    "user_id BIGINT, " +
                    "passenger_name VARCHAR(100) NOT NULL, " +
                    "phone VARCHAR(15) NOT NULL, " +
                    "email VARCHAR(100) NOT NULL, " +
                    "travel_date VARCHAR(20) NOT NULL, " +
                    "seats_booked VARCHAR(100) NOT NULL, " +
                    "total_amount DECIMAL(10,2) NOT NULL, " +
                    "status VARCHAR(20) DEFAULT 'CONFIRMED', " +
                    "payment_method VARCHAR(20) DEFAULT 'UPI', " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE" +
                    ")");

            // 4. Create OTP verifications table
            stmt.execute("CREATE TABLE IF NOT EXISTS otp_verifications (" +
                    "email VARCHAR(100) PRIMARY KEY, " +
                    "otp VARCHAR(6) NOT NULL, " +
                    "expiry_time TIMESTAMP NOT NULL, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            // 5. Seed sample buses if empty
            ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM buses");
            if (rs.next() && rs.getInt(1) == 0) {
                stmt.execute("INSERT INTO buses (operator, type, from_city, to_city, departure, arrival, duration, price, total_seats, rating, amenities) VALUES " +
                        "('VRL Travels', 'volvo', 'Bangalore', 'Mumbai', '08:00 PM', '08:00 AM', '12h', 1200.00, 40, 4.8, 'WiFi,AC,USB'), " +
                        "('Orange Tours', 'sleeper', 'Bangalore', 'Mumbai', '07:00 PM', '07:30 AM', '12h 30m', 900.00, 36, 4.3, 'AC,Blanket'), " +
                        "('SRS Travels', 'ac', 'Bangalore', 'Mumbai', '10:00 PM', '11:00 AM', '13h', 750.00, 44, 4.1, 'AC,Water'), " +
                        "('Konduskar', 'volvo', 'Pune', 'Goa', '08:00 AM', '02:00 PM', '6h', 650.00, 40, 4.6, 'WiFi,AC,Snacks'), " +
                        "('Paulo Travels', 'sleeper', 'Pune', 'Goa', '09:30 PM', '06:00 AM', '8h 30m', 800.00, 36, 4.5, 'AC,Pillow'), " +
                        "('MSRTC Shivneri', 'ac', 'Mumbai', 'Pune', '06:00 AM', '09:30 AM', '3h 30m', 350.00, 44, 4.4, 'AC'), " +
                        "('IntrCity SmartBus', 'volvo', 'Delhi', 'Jaipur', '07:00 AM', '12:00 PM', '5h', 499.00, 40, 4.7, 'WiFi,AC,USB'), " +
                        "('Raj National', 'ordinary', 'Delhi', 'Jaipur', '09:00 AM', '03:30 PM', '6h 30m', 250.00, 50, 3.9, 'Water'), " +
                        "('Neeta Tours', 'volvo', 'Mumbai', 'Ahmedabad', '11:00 PM', '07:00 AM', '8h', 700.00, 40, 4.5, 'WiFi,AC,Blanket'), " +
                        "('GSRTC', 'ac', 'Ahmedabad', 'Mumbai', '06:00 PM', '02:00 AM', '8h', 580.00, 44, 4.0, 'AC'), " +
                        "('KPN Travels', 'sleeper', 'Chennai', 'Bangalore', '10:30 PM', '04:30 AM', '6h', 600.00, 36, 4.2, 'AC,Blanket'), " +
                        "('APSRTC Garuda', 'volvo', 'Hyderabad', 'Bangalore', '08:45 PM', '07:00 AM', '10h 15m', 850.00, 40, 4.6, 'WiFi,AC'), " +
                        "('IntrCity SmartBus (Captain Kirtan)', 'volvo', 'Dharampuri (Dhar, MP)', 'Indore (Indore, MP)', '06:00 PM', '08:15 PM', '2h 15m', 240.00, 40, 4.9, 'WiFi,AC,USB'), " +
                        "('Maa Narmada Travels', 'ordinary', 'Dharampuri (Dhar, MP)', 'Indore (Indore, MP)', '06:30 AM', '08:45 AM', '2h 15m', 110.00, 50, 4.6, 'Water'), " +
                        "('Hans Travels', 'ac', 'Dharampuri (Dhar, MP)', 'Indore (Indore, MP)', '09:15 AM', '11:30 AM', '2h 15m', 180.00, 44, 4.7, 'AC,Charging Point'), " +
                        "('Chartered Bus', 'volvo', 'Dharampuri (Dhar, MP)', 'Bhopal (Bhopal, MP)', '07:00 AM', '12:30 PM', '5h 30m', 450.00, 40, 4.8, 'WiFi,AC,Snacks')");
                System.out.println(">>> BusGo JDBC: 16 Sample buses seeded successfully into MySQL!");
            }
            rs.close();
        } catch (SQLException e) {
            System.err.println("Database auto-init error: " + e.getMessage());
        }
    }

    public static void closeQuietly(AutoCloseable... closeables) {
        for (AutoCloseable c : closeables) {
            if (c != null) {
                try {
                    c.close();
                } catch (Exception ignored) {
                }
            }
        }
    }
}

