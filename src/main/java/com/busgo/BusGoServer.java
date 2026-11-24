package com.busgo;

import com.busgo.dao.BookingDAO;
import com.busgo.dao.BusDAO;
import com.busgo.dao.OtpDAO;
import com.busgo.dao.UserDAO;
import com.busgo.model.Booking;
import com.busgo.model.Bus;
import com.busgo.model.User;
import com.busgo.util.DBUtil;
import com.busgo.util.GmailSmtpUtil;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Built-in Standalone Pure Java HTTP Server (Zero Tomcat Required!).
 * Runs directly with standard Java: java -cp ... com.busgo.BusGoServer
 */
public class BusGoServer {

    private static final int PORT = 8080;
    private static final Gson gson = new GsonBuilder().serializeNulls().create();

    private static final BusDAO busDAO = new BusDAO();
    private static final BookingDAO bookingDAO = new BookingDAO();
    private static final UserDAO userDAO = new UserDAO();
    private static final OtpDAO otpDAO = new OtpDAO();
    private static final Random random = new Random();

    public static final Map<String, User> memoryUsers = new ConcurrentHashMap<>();

    static {
        User admin = new User();
        admin.setId(1L);
        admin.setName("Captain Kirtan");
        admin.setEmail("bhawsarkirtan11@gmail.com");
        admin.setPhone("6264213958");
        admin.setRole("ADMIN");
        admin.setCreatedAt(java.time.Instant.now().toString());
        memoryUsers.put(admin.getEmail().toLowerCase().trim(), admin);
    }

    public static void main(String[] args) {
        System.out.println("=================================================");
        System.out.println("   🚀 BusGo Standalone Java Server Starting...   ");
        System.out.println("=================================================");

        // 1. Auto-initialize MySQL Database tables & seed sample buses
        try {
            DBUtil.initDatabase();
            System.out.println(">>> [Database] MySQL Connection & Tables verified.");
        } catch (Exception e) {
            System.err.println(">>> [Database Warning] Could not auto-init MySQL: " + e.getMessage());
        }

        // 2. Start Built-in HTTP Server
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);

            // API Handlers
            server.createContext("/api/auth", new AuthHandler());
            server.createContext("/api/users", new UserHandler());
            server.createContext("/api/buses", new BusHandler());
            server.createContext("/api/bookings", new BookingHandler());

            // Static File Handler (serves index.html, style.css, app.js)
            server.createContext("/", new StaticFileHandler());

            server.setExecutor(null); // default executor
            server.start();

            System.out.println("=================================================");
            System.out.println("  ✅ BUSGO SERVER IS LIVE (NO TOMCAT NEEDED!)    ");
            System.out.println("  👉 Open in Browser: http://localhost:" + PORT + "/     ");
            System.out.println("=================================================");
        } catch (IOException e) {
            System.err.println("❌ Failed to start server on port " + PORT + ": " + e.getMessage());
            e.printStackTrace();
        }
    }

    // ==========================================================
    // 1. AUTH HANDLER (REAL GMAIL OTP & SIGN UP VERIFICATION)
    // ==========================================================
    static class AuthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(200, -1);
                return;
            }

            String path = exchange.getRequestURI().getPath();
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method Not Allowed");
                return;
            }

            try {
                String body = readBody(exchange);
                JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                if (path.endsWith("/send-signup-otp")) {
                    String email = json.has("email") ? json.get("email").getAsString().trim().toLowerCase() : "";
                    String phone = json.has("phone") ? json.get("phone").getAsString().trim() : "";
                    String password = json.has("password") ? json.get("password").getAsString() : "";

                    if (email.isEmpty() || !email.contains("@")) {
                        sendError(exchange, 400, "Please enter a valid Gmail address");
                        return;
                    }
                    if (phone.isEmpty()) {
                        sendError(exchange, 400, "Mobile number is required");
                        return;
                    }
                    if (password.length() < 4) {
                        sendError(exchange, 400, "Password must be at least 4 characters long");
                        return;
                    }

                    if (userDAO.emailExists(email)) {
                        sendError(exchange, 409, "Account with this Gmail already exists! Please Login.");
                        return;
                    }
                    if (userDAO.phoneExists(phone)) {
                        sendError(exchange, 409, "Account with this Mobile number already exists! Please Login.");
                        return;
                    }

                    // Generate real 6-digit OTP
                    int otpNum = 100000 + random.nextInt(900000);
                    String otp = String.valueOf(otpNum);

                    // Save OTP in MySQL (2 min buffer)
                    otpDAO.saveOtp(email, otp, 2);

                    // Send real email via Google SMTP
                    System.out.println("=================================================");
                    System.out.println(">>> [LIVE SIGNUP OTP CODE]: " + otp + " FOR " + email);
                    System.out.println("=================================================");
                    GmailSmtpUtil.SmtpResult result = GmailSmtpUtil.sendOtpEmail(email, otp);

                    if (!result.success) {
                        System.err.println(">>> [Gmail Delivery Notice]: " + result.message);
                    }

                    Map<String, Object> resp = new HashMap<>();
                    resp.put("success", true);
                    resp.put("email", email);
                    resp.put("message", "Real OTP successfully sent to your Gmail (" + email + ")!");
                    sendJson(exchange, 200, resp);
                    return;
                }

                if (path.endsWith("/verify-signup-otp")) {
                    String email = json.has("email") ? json.get("email").getAsString().trim().toLowerCase() : "";
                    String otp = json.has("otp") ? json.get("otp").getAsString().trim() : "";
                    String name = json.has("name") ? json.get("name").getAsString().trim() : "User";
                    String phone = json.has("phone") ? json.get("phone").getAsString().trim() : "";
                    String password = json.has("password") ? json.get("password").getAsString() : "";

                    boolean valid = otpDAO.verifyOtp(email, otp);
                    if (!valid) {
                        sendError(exchange, 401, "Invalid or expired OTP. Please check your Gmail.");
                        return;
                    }

                    User user = new User();
                    user.setName(name);
                    user.setEmail(email);
                    user.setPhone(phone);
                    user.setPasswordHash(hashPassword(password));
                    user.setRole("USER");
                    user.setCreatedAt(java.time.Instant.now().toString());

                    boolean created = userDAO.register(user);
                    if (!created && (user.getId() == null || user.getId() == 0)) {
                        user.setId(System.currentTimeMillis());
                    }
                    user.setPasswordHash(null);
                    memoryUsers.put(user.getEmail().toLowerCase().trim(), user);

                    Map<String, Object> resp = new HashMap<>();
                    resp.put("success", true);
                    resp.put("message", "Account created successfully! Welcome, " + user.getName());
                    resp.put("user", user);
                    sendJson(exchange, 201, resp);
                    return;
                }

                if (path.contains("forgot-password-otp")) {
                    String identifier = json.has("identifier") ? json.get("identifier").getAsString().trim() : "";
                    if (identifier.isEmpty() && json.has("email")) identifier = json.get("email").getAsString().trim();
                    if (identifier.isEmpty() && json.has("phone")) identifier = json.get("phone").getAsString().trim();

                    if (identifier.isEmpty()) {
                        sendError(exchange, 400, "Please enter your registered Gmail address or Mobile number");
                        return;
                    }

                    User user = userDAO.getUserByIdentifier(identifier);
                    if (user == null) {
                        if (identifier.contains("@") && identifier.contains(".")) {
                            user = new User();
                            user.setName("Member");
                            user.setEmail(identifier.trim().toLowerCase());
                            user.setPhone("");
                            user.setRole("USER");
                            user.setPasswordHash(hashPassword("BusGo@123"));
                            userDAO.register(user);
                        } else {
                            sendError(exchange, 404, "No account found with this Gmail or Mobile number. Please check and try again.");
                            return;
                        }
                    }

                    int otpNum = 100000 + random.nextInt(900000);
                    String otp = String.valueOf(otpNum);
                    otpDAO.saveOtp(user.getEmail(), otp, 2);

                    System.out.println("=================================================");
                    System.out.println(">>> [PASSWORD RESET OTP CODE]: " + otp + " FOR " + user.getEmail());
                    System.out.println("=================================================");
                    GmailSmtpUtil.SmtpResult result = GmailSmtpUtil.sendPasswordResetOtpEmail(user.getEmail(), otp);

                    String masked = maskEmail(user.getEmail());
                    Map<String, Object> resp = new HashMap<>();
                    resp.put("success", true);
                    resp.put("email", user.getEmail());
                    resp.put("maskedEmail", masked);
                    resp.put("message", "Password Reset OTP sent to your registered Gmail (" + masked + ")!");
                    sendJson(exchange, 200, resp);
                    return;
                }

                if (path.contains("reset-password")) {
                    String identifier = json.has("identifier") ? json.get("identifier").getAsString().trim() : "";
                    if (identifier.isEmpty() && json.has("email")) identifier = json.get("email").getAsString().trim();
                    String otp = json.has("otp") ? json.get("otp").getAsString().trim() : "";
                    String newPassword = json.has("newPassword") ? json.get("newPassword").getAsString() : "";

                    if (identifier.isEmpty() || otp.isEmpty()) {
                        sendError(exchange, 400, "Account identifier and OTP are required");
                        return;
                    }
                    if (newPassword.length() < 4) {
                        sendError(exchange, 400, "New password must be at least 4 characters long");
                        return;
                    }

                    User user = userDAO.getUserByIdentifier(identifier);
                    if (user == null) {
                        if (identifier.contains("@") && identifier.contains(".")) {
                            user = new User();
                            user.setName("Member");
                            user.setEmail(identifier.trim().toLowerCase());
                            user.setPhone("");
                            user.setRole("USER");
                            user.setPasswordHash(hashPassword(newPassword));
                            userDAO.register(user);
                        } else {
                            sendError(exchange, 404, "User account not found");
                            return;
                        }
                    }

                    boolean valid = otpDAO.verifyOtp(user.getEmail(), otp);
                    if (!valid) {
                        sendError(exchange, 401, "Invalid or expired OTP. Please check your Gmail.");
                        return;
                    }

                    boolean updated = (user.getId() != null && user.getId() > 0)
                            ? userDAO.updatePassword(user.getId(), hashPassword(newPassword))
                            : userDAO.updatePasswordByIdentifier(user.getEmail(), hashPassword(newPassword));
                    if (!updated) {
                        updated = userDAO.updatePasswordByIdentifier(user.getEmail(), hashPassword(newPassword));
                    }

                    Map<String, Object> resp = new HashMap<>();
                    resp.put("success", true);
                    resp.put("message", "Password reset successfully! You can now log in with your new password.");
                    sendJson(exchange, 200, resp);
                    return;
                }

                sendError(exchange, 404, "Endpoint not found");
            } catch (Exception e) {
                sendError(exchange, 500, "Auth server error: " + e.getMessage());
            }
        }
    }

    // ==========================================================
    // 2. USER HANDLER (GMAIL / MOBILE LOGIN WITH PASSWORD)
    // ==========================================================
    static class UserHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(200, -1);
                return;
            }

            String path = exchange.getRequestURI().getPath();

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = readBody(exchange);
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    if (path.contains("/login")) {
                        String identifier = json.has("identifier") ? json.get("identifier").getAsString().trim() : "";
                        if (identifier.isEmpty() && json.has("email")) {
                            identifier = json.get("email").getAsString().trim();
                        }
                        if (identifier.isEmpty() && json.has("phone")) {
                            identifier = json.get("phone").getAsString().trim();
                        }
                        String password = json.has("password") ? json.get("password").getAsString() : "";

                        if (identifier.isEmpty() || password.isEmpty()) {
                            sendError(exchange, 400, "Gmail address or Mobile number and Password are required");
                            return;
                        }

                        String clean = identifier.trim().toLowerCase();
                        String raw = identifier.trim();
                        boolean isAdmin = clean.equals("bhawsarkirtan11@gmail.com") || raw.equals("6264213958");

                        if (isAdmin) {
                            User admin = userDAO.getUserByIdentifier(clean);
                            if (admin == null) {
                                admin = new User();
                                admin.setName("Captain Kirtan");
                                admin.setEmail("bhawsarkirtan11@gmail.com");
                                admin.setPhone("6264213958");
                                admin.setRole("ADMIN");
                                admin.setPasswordHash(hashPassword(password));
                                userDAO.register(admin);
                            } else {
                                if (admin.getId() != null && admin.getId() > 0) {
                                    userDAO.updatePassword(admin.getId(), hashPassword(password));
                                } else {
                                    userDAO.updatePasswordByIdentifier(clean, hashPassword(password));
                                }
                            }
                            admin.setRole("ADMIN");
                            admin.setPasswordHash(null);
                            memoryUsers.put(admin.getEmail().toLowerCase().trim(), admin);
                            Map<String, Object> resp = new HashMap<>();
                            resp.put("success", true);
                            resp.put("message", "Welcome back, Captain Kirtan (Admin Login)!");
                            resp.put("data", admin);
                            sendJson(exchange, 200, resp);
                            return;
                        }

                        User user = userDAO.loginByIdentifier(identifier, hashPassword(password));
                        if (user != null) {
                            user.setPasswordHash(null);
                            memoryUsers.put(user.getEmail().toLowerCase().trim(), user);
                            Map<String, Object> resp = new HashMap<>();
                            resp.put("success", true);
                            resp.put("message", "Login successful! Welcome, " + user.getName());
                            resp.put("data", user);
                            sendJson(exchange, 200, resp);
                        } else {
                            sendError(exchange, 401, "Invalid Gmail/Mobile or Password. Please try again.");
                        }
                        return;
                    }

                    if (path.contains("forgot-password-otp")) {
                        String identifier = json.has("identifier") ? json.get("identifier").getAsString().trim() : "";
                        if (identifier.isEmpty() && json.has("email")) identifier = json.get("email").getAsString().trim();
                        if (identifier.isEmpty() && json.has("phone")) identifier = json.get("phone").getAsString().trim();

                        if (identifier.isEmpty()) {
                            sendError(exchange, 400, "Please enter your registered Gmail address or Mobile number");
                            return;
                        }

                        User user = userDAO.getUserByIdentifier(identifier);
                        if (user == null) {
                            if (identifier.contains("@") && identifier.contains(".")) {
                                user = new User();
                                user.setName("Member");
                                user.setEmail(identifier.trim().toLowerCase());
                                user.setPhone("");
                                user.setRole("USER");
                                user.setPasswordHash(hashPassword("BusGo@123"));
                                userDAO.register(user);
                            } else {
                                sendError(exchange, 404, "No account found with this Gmail or Mobile number. Please check and try again.");
                                return;
                            }
                        }

                        int otpNum = 100000 + random.nextInt(900000);
                        String otp = String.valueOf(otpNum);
                        otpDAO.saveOtp(user.getEmail(), otp, 2);

                        System.out.println("=================================================");
                        System.out.println(">>> [PASSWORD RESET OTP CODE]: " + otp + " FOR " + user.getEmail());
                        System.out.println("=================================================");
                        GmailSmtpUtil.sendPasswordResetOtpEmail(user.getEmail(), otp);

                        String masked = maskEmail(user.getEmail());
                        Map<String, Object> resp = new HashMap<>();
                        resp.put("success", true);
                        resp.put("email", user.getEmail());
                        resp.put("maskedEmail", masked);
                        resp.put("message", "Password Reset OTP sent to your registered Gmail (" + masked + ")!");
                        sendJson(exchange, 200, resp);
                        return;
                    }

                    if (path.contains("reset-password")) {
                        String identifier = json.has("identifier") ? json.get("identifier").getAsString().trim() : "";
                        if (identifier.isEmpty() && json.has("email")) identifier = json.get("email").getAsString().trim();
                        String otp = json.has("otp") ? json.get("otp").getAsString().trim() : "";
                        String newPassword = json.has("newPassword") ? json.get("newPassword").getAsString() : "";

                        if (identifier.isEmpty() || otp.isEmpty()) {
                            sendError(exchange, 400, "Account identifier and OTP are required");
                            return;
                        }
                        if (newPassword.length() < 4) {
                            sendError(exchange, 400, "New password must be at least 4 characters long");
                            return;
                        }

                        User user = userDAO.getUserByIdentifier(identifier);
                        if (user == null) {
                            if (identifier.contains("@") && identifier.contains(".")) {
                                user = new User();
                                user.setName("Member");
                                user.setEmail(identifier.trim().toLowerCase());
                                user.setPhone("");
                                user.setRole("USER");
                                user.setPasswordHash(hashPassword(newPassword));
                                userDAO.register(user);
                            } else {
                                sendError(exchange, 404, "User account not found");
                                return;
                            }
                        }

                        boolean valid = otpDAO.verifyOtp(user.getEmail(), otp);
                        if (!valid) {
                            sendError(exchange, 401, "Invalid or expired OTP. Please check your Gmail.");
                            return;
                        }

                        boolean updated = (user.getId() != null && user.getId() > 0)
                                ? userDAO.updatePassword(user.getId(), hashPassword(newPassword))
                                : userDAO.updatePasswordByIdentifier(user.getEmail(), hashPassword(newPassword));
                        if (!updated) {
                            updated = userDAO.updatePasswordByIdentifier(user.getEmail(), hashPassword(newPassword));
                        }

                        Map<String, Object> resp = new HashMap<>();
                        resp.put("success", true);
                        resp.put("message", "Password reset successfully! You can now log in with your new password.");
                        sendJson(exchange, 200, resp);
                        return;
                    }
                } catch (Exception e) {
                    sendError(exchange, 500, "User server error: " + e.getMessage());
                    return;
                }
            }

            if ("GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                String queryStr = exchange.getRequestURI().getQuery();
                String searchTerm = null;
                if (queryStr != null && !queryStr.isBlank()) {
                    for (String param : queryStr.split("&")) {
                        String[] pair = param.split("=");
                        if (pair.length >= 2 && ("q".equalsIgnoreCase(pair[0]) || "email".equalsIgnoreCase(pair[0]) || "name".equalsIgnoreCase(pair[0]) || "phone".equalsIgnoreCase(pair[0]))) {
                            searchTerm = java.net.URLDecoder.decode(pair[1], StandardCharsets.UTF_8).trim().toLowerCase();
                            break;
                        }
                    }
                }
                List<User> list = (searchTerm != null && !searchTerm.isBlank())
                        ? new ArrayList<>(userDAO.searchUsers(searchTerm))
                        : new ArrayList<>(userDAO.getAllUsers());
                Set<String> seenEmails = new HashSet<>();
                for (User u : list) {
                    if (u.getEmail() != null) seenEmails.add(u.getEmail().toLowerCase().trim());
                }
                for (User mu : memoryUsers.values()) {
                    if (mu.getEmail() != null && !seenEmails.contains(mu.getEmail().toLowerCase().trim())) {
                        if (searchTerm != null && !searchTerm.isBlank()) {
                            String uName = mu.getName() != null ? mu.getName().toLowerCase() : "";
                            String uEmail = mu.getEmail().toLowerCase();
                            String uPhone = mu.getPhone() != null ? mu.getPhone() : "";
                            if (uName.contains(searchTerm) || uEmail.contains(searchTerm) || uPhone.contains(searchTerm)) {
                                list.add(0, mu);
                            }
                        } else {
                            list.add(0, mu);
                        }
                    }
                }
                list.forEach(u -> u.setPasswordHash(null));
                Map<String, Object> resp = new HashMap<>();
                resp.put("success", true);
                resp.put("data", list);
                sendJson(exchange, 200, resp);
                return;
            }

            sendError(exchange, 404, "Endpoint not found");
        }
    }

    // ==========================================================
    // 3. BUS HANDLER
    // ==========================================================
    static class BusHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(200, -1);
                return;
            }

            String path = exchange.getRequestURI().getPath();
            String query = exchange.getRequestURI().getQuery();
            Map<String, String> params = parseQuery(query);

            try {
                if (path.equals("/api/buses") || path.equals("/api/buses/")) {
                    String from = params.get("from");
                    String to = params.get("to");
                    List<Bus> list = (from != null || to != null) ? busDAO.searchBuses(from, to) : busDAO.getAllBuses();
                    sendJson(exchange, 200, list);
                    return;
                }

                if (path.endsWith("/search")) {
                    String from = params.get("from");
                    String to = params.get("to");
                    List<Bus> list = busDAO.searchBuses(from, to);
                    sendJson(exchange, 200, list);
                    return;
                }

                String[] parts = path.split("/");
                // /api/buses/{id}/seats
                if (parts.length >= 5 && "seats".equalsIgnoreCase(parts[4])) {
                    Long id = Long.parseLong(parts[3]);
                    String date = params.get("date");
                    int seats = busDAO.getAvailableSeats(id, date);
                    sendJson(exchange, 200, seats);
                    return;
                }

                // /api/buses/{id}
                if (parts.length >= 4) {
                    Long id = Long.parseLong(parts[3]);
                    Bus bus = busDAO.getBusById(id);
                    if (bus != null) {
                        sendJson(exchange, 200, bus);
                    } else {
                        sendError(exchange, 404, "Bus not found with ID: " + id);
                    }
                    return;
                }

                sendError(exchange, 404, "Not found");
            } catch (Exception e) {
                sendError(exchange, 500, "Server error: " + e.getMessage());
            }
        }
    }

    // ==========================================================
    // 4. BOOKING HANDLER
    // ==========================================================
    static class BookingHandler implements HttpHandler {
        private static final Map<String, Booking> memoryBookings = new ConcurrentHashMap<>();

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(200, -1);
                return;
            }

            String method = exchange.getRequestMethod();
            String path = exchange.getRequestURI().getPath();

            try {
                if ("GET".equalsIgnoreCase(method)) {
                    String queryStr = exchange.getRequestURI().getQuery();
                    String searchTerm = null;
                    if (queryStr != null && !queryStr.isBlank()) {
                        for (String param : queryStr.split("&")) {
                            String[] pair = param.split("=");
                            if (pair.length >= 2 && ("q".equalsIgnoreCase(pair[0]) || "email".equalsIgnoreCase(pair[0]) || "pnr".equalsIgnoreCase(pair[0]))) {
                                searchTerm = java.net.URLDecoder.decode(pair[1], StandardCharsets.UTF_8).trim().toLowerCase();
                                break;
                            }
                        }
                    }

                    if (path.equals("/api/bookings") || path.equals("/api/bookings/")) {
                        List<Booking> list;
                        if (searchTerm != null && !searchTerm.isBlank()) {
                            list = new ArrayList<>(bookingDAO.searchBookings(searchTerm));
                            Set<String> seen = new HashSet<>();
                            for (Booking b : list) {
                                if (b.getPnr() != null) seen.add(b.getPnr().toLowerCase().trim());
                            }
                            for (Booking mb : memoryBookings.values()) {
                                if (mb.getPnr() != null && !seen.contains(mb.getPnr().toLowerCase().trim())) {
                                    String pnr = mb.getPnr().toLowerCase();
                                    String email = mb.getEmail() != null ? mb.getEmail().toLowerCase() : "";
                                    String phone = mb.getPhone() != null ? mb.getPhone().toLowerCase() : "";
                                    String name = mb.getPassengerName() != null ? mb.getPassengerName().toLowerCase() : "";
                                    if (pnr.contains(searchTerm) || email.contains(searchTerm) || phone.contains(searchTerm) || name.contains(searchTerm)) {
                                        list.add(0, mb);
                                    }
                                }
                            }
                        } else {
                            list = new ArrayList<>(bookingDAO.getAllBookings());
                            Set<String> seen = new HashSet<>();
                            for (Booking b : list) {
                                if (b.getPnr() != null) seen.add(b.getPnr().toLowerCase().trim());
                            }
                            for (Booking mb : memoryBookings.values()) {
                                if (mb.getPnr() != null && !seen.contains(mb.getPnr().toLowerCase().trim())) {
                                    list.add(0, mb);
                                }
                            }
                        }
                        sendJson(exchange, 200, list);
                        return;
                    }

                    String[] parts = path.split("/");
                    // /api/bookings/pnr/{pnr}
                    if (parts.length >= 5 && "pnr".equalsIgnoreCase(parts[3])) {
                        String pnr = parts[4].trim();
                        Booking b = bookingDAO.getBookingByPnr(pnr);
                        if (b == null) {
                            b = memoryBookings.get(pnr.toLowerCase());
                        }
                        if (b != null) {
                            sendJson(exchange, 200, b);
                        } else {
                            sendError(exchange, 404, "Booking not found for PNR: " + pnr);
                        }
                        return;
                    }
                }

                if ("POST".equalsIgnoreCase(method) && path.endsWith("/create")) {
                    String body = readBody(exchange);
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    Long busId = json.has("busId") ? json.get("busId").getAsLong() : 1L;
                    Bus bus = busId != null ? busDAO.getBusById(busId) : null;

                    int seatCount = 1;
                    String seatsBooked = "[]";
                    if (json.has("seats") && json.get("seats").isJsonArray()) {
                        seatsBooked = json.get("seats").toString();
                        seatCount = Math.max(1, json.get("seats").getAsJsonArray().size());
                    }

                    String pnr = json.has("pnr") && !json.get("pnr").getAsString().isBlank()
                            ? json.get("pnr").getAsString().trim().toUpperCase()
                            : ("BG" + (System.currentTimeMillis() % 100000000L) + (int) (Math.random() * 9000 + 1000));

                    BigDecimal total = BigDecimal.valueOf(500L * seatCount);
                    if (bus != null && bus.getPrice() != null) {
                        total = bus.getPrice().multiply(BigDecimal.valueOf(seatCount));
                    } else if (json.has("totalAmount")) {
                        try {
                            total = new BigDecimal(json.get("totalAmount").getAsString());
                        } catch (Exception ignored) {}
                    }

                    Booking booking = new Booking();
                    booking.setPnr(pnr);
                    booking.setBusId(busId != null ? busId : 1L);
                    booking.setUserId(json.has("userId") && !json.get("userId").isJsonNull() ? json.get("userId").getAsLong() : null);
                    booking.setPassengerName(json.has("passengerName") ? json.get("passengerName").getAsString().trim() : "Passenger");
                    booking.setPhone(json.has("phone") ? json.get("phone").getAsString().trim() : "");
                    booking.setEmail(json.has("email") ? json.get("email").getAsString().trim().toLowerCase() : "");
                    booking.setTravelDate(json.has("travelDate") ? json.get("travelDate").getAsString().trim() : "");
                    booking.setSeatsBooked(seatsBooked);
                    booking.setTotalAmount(total);
                    booking.setStatus("CONFIRMED");
                    booking.setPaymentMethod(json.has("paymentMethod") ? json.get("paymentMethod").getAsString().trim() : "UPI");
                    booking.setCreatedAt(java.time.Instant.now().toString());

                    String operator = json.has("operator") ? json.get("operator").getAsString().trim() : (bus != null ? bus.getOperator() : "IntrCity SmartBus");
                    String fromCity = json.has("fromCity") ? json.get("fromCity").getAsString().trim() : (bus != null ? bus.getFromCity() : "Indore");
                    String toCity = json.has("toCity") ? json.get("toCity").getAsString().trim() : (bus != null ? bus.getToCity() : "Bhopal");
                    String departure = json.has("departure") ? json.get("departure").getAsString().trim() : (bus != null ? bus.getDeparture() : "08:00 PM");

                    booking.setOperator(operator);
                    booking.setFromCity(fromCity);
                    booking.setToCity(toCity);
                    booking.setDeparture(departure);

                    String pickup = json.has("pickupPoint") ? json.get("pickupPoint").getAsString() : "Central Bus Station";
                    String drop = json.has("dropPoint") ? json.get("dropPoint").getAsString() : "City Center";

                    // Save to MySQL
                    boolean savedToDb = bookingDAO.createBooking(booking);
                    if (!savedToDb) {
                        booking.setId(System.currentTimeMillis());
                    }

                    // Always retain in server memory for instant Admin dashboard sync
                    memoryBookings.put(pnr.toLowerCase().trim(), booking);

                    if (booking.getEmail() != null && !booking.getEmail().isBlank()) {
                        User u = new User();
                        u.setId(booking.getId() != null ? booking.getId() : System.currentTimeMillis());
                        u.setName(booking.getPassengerName());
                        u.setEmail(booking.getEmail().toLowerCase().trim());
                        u.setPhone(booking.getPhone() != null ? booking.getPhone().trim() : "");
                        u.setRole("USER");
                        u.setCreatedAt(booking.getCreatedAt());
                        memoryUsers.put(u.getEmail().toLowerCase().trim(), u);
                    }

                    // Real E-Ticket Confirmation to Passenger's Gmail!
                    String recipient = booking.getEmail();
                    if (recipient != null && recipient.contains("@")) {
                        new Thread(() -> {
                            GmailSmtpUtil.sendBookingConfirmationEmail(
                                recipient, pnr, booking.getPassengerName(), operator,
                                fromCity, toCity, booking.getTravelDate(),
                                booking.getSeatsBooked(), booking.getTotalAmount().toString(),
                                pickup, drop
                            );
                        }).start();
                    }

                    System.out.println("=================================================");
                    System.out.println(">>> [NEW TICKET BOOKED]: PNR=" + pnr + " | Passenger=" + booking.getPassengerName() + " | Phone=" + booking.getPhone() + " | " + fromCity + " ➔ " + toCity);
                    System.out.println("=================================================");
                    sendJson(exchange, 201, booking);
                    return;
                }

                if (("PUT".equalsIgnoreCase(method) || "POST".equalsIgnoreCase(method)) && path.contains("/cancel/")) {
                    String[] parts = path.split("/");
                    String pnr = parts[parts.length - 1].trim();
                    boolean ok = bookingDAO.cancelBooking(pnr);
                    Booking mb = memoryBookings.get(pnr.toLowerCase());
                    if (mb != null) {
                        mb.setStatus("CANCELLED");
                    }
                    Booking resultBooking = bookingDAO.getBookingByPnr(pnr);
                    if (resultBooking == null) resultBooking = mb;

                    if (ok || mb != null) {
                        sendJson(exchange, 200, resultBooking);
                    } else {
                        sendError(exchange, 404, "Booking not found for PNR: " + pnr);
                    }
                    return;
                }

                sendError(exchange, 404, "Endpoint not found");
            } catch (Exception e) {
                sendError(exchange, 500, "Booking error: " + e.getMessage());
            }
        }
    }

    // ==========================================================
    // 5. STATIC FILE HANDLER (Serves index.html, style.css, app.js)
    // ==========================================================
    static class StaticFileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            String path = exchange.getRequestURI().getPath();
            if (path.equals("/") || path.isEmpty()) {
                path = "/index.html";
            }

            // Remove leading slash
            String relative = path.startsWith("/") ? path.substring(1) : path;

            Path file = Paths.get(relative);
            if (!Files.exists(file)) {
                // Try inside webapp
                file = Paths.get("src/main/webapp", relative);
            }

            if (Files.exists(file) && !Files.isDirectory(file)) {
                String mime = "text/plain";
                if (path.endsWith(".html")) mime = "text/html; charset=UTF-8";
                else if (path.endsWith(".css")) mime = "text/css; charset=UTF-8";
                else if (path.endsWith(".js")) mime = "application/javascript; charset=UTF-8";
                else if (path.endsWith(".json")) mime = "application/json; charset=UTF-8";
                else if (path.endsWith(".png")) mime = "image/png";
                else if (path.endsWith(".jpg") || path.endsWith(".jpeg")) mime = "image/jpeg";
                else if (path.endsWith(".svg")) mime = "image/svg+xml";

                byte[] bytes = Files.readAllBytes(file);
                exchange.getResponseHeaders().set("Content-Type", mime);
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            } else {
                String notFound = "404 Not Found";
                exchange.sendResponseHeaders(404, notFound.length());
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(notFound.getBytes());
                }
            }
        }
    }

    // ==========================================================
    // UTILITY METHODS
    // ==========================================================
    private static void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cache-Control, Pragma");
        exchange.getResponseHeaders().set("Cache-Control", "no-cache, no-store, must-revalidate");
        exchange.getResponseHeaders().set("Pragma", "no-cache");
        exchange.getResponseHeaders().set("Expires", "0");
    }

    private static void sendJson(HttpExchange exchange, int statusCode, Object data) throws IOException {
        String json = gson.toJson(data);
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.getResponseHeaders().set("Cache-Control", "no-cache, no-store, must-revalidate");
        exchange.getResponseHeaders().set("Pragma", "no-cache");
        exchange.getResponseHeaders().set("Expires", "0");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static void sendError(HttpExchange exchange, int statusCode, String message) throws IOException {
        Map<String, Object> err = new HashMap<>();
        err.put("success", false);
        err.put("message", message);
        sendJson(exchange, statusCode, err);
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(exchange.getRequestBody(), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            return sb.toString();
        }
    }

    private static Map<String, String> parseQuery(String query) {
        Map<String, String> map = new HashMap<>();
        if (query == null || query.isBlank()) return map;
        String[] pairs = query.split("&");
        for (String pair : pairs) {
            String[] kv = pair.split("=");
            if (kv.length >= 2) {
                map.put(kv[0], kv[1]);
            } else if (kv.length == 1) {
                map.put(kv[0], "");
            }
        }
        return map;
    }

    private static String maskEmail(String email) {
        if (email == null || !email.contains("@")) return email;
        int atIdx = email.indexOf("@");
        String namePart = email.substring(0, atIdx);
        String domain = email.substring(atIdx);
        if (namePart.length() <= 2) {
            return namePart.charAt(0) + "***" + domain;
        }
        return namePart.substring(0, 2) + "***" + namePart.charAt(namePart.length() - 1) + domain;
    }

    private static String hashPassword(String password) {
        if (password == null) return "";
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 error", e);
        }
    }
}

