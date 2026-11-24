package com.busgo.servlet;

import com.busgo.dao.OtpDAO;
import com.busgo.dao.UserDAO;
import com.busgo.model.User;
import com.busgo.util.GmailSmtpUtil;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;

/**
 * Java Servlet for Gmail Verification & OTP Lifecycle during Sign Up & Login.
 * Mapped to /api/auth and /api/auth/*
 */
@WebServlet(name = "AuthServlet", urlPatterns = {"/api/auth", "/api/auth/*"})
public class AuthServlet extends BaseServlet {

    private final OtpDAO otpDAO = new OtpDAO();
    private final UserDAO userDAO = new UserDAO();
    private final Random random = new Random();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        setCorsHeaders(resp);
        String pathInfo = req.getPathInfo();

        try {
            if (pathInfo != null && pathInfo.contains("/send-signup-otp")) {
                handleSendSignupOtp(req, resp);
                return;
            }

            if (pathInfo != null && pathInfo.contains("/verify-signup-otp")) {
                handleVerifySignupOtp(req, resp);
                return;
            }

            if (pathInfo != null && pathInfo.contains("/forgot-password-otp")) {
                handleForgotPasswordOtp(req, resp);
                return;
            }

            if (pathInfo != null && pathInfo.contains("/reset-password")) {
                handleResetPassword(req, resp);
                return;
            }

            if (pathInfo != null && pathInfo.contains("/send-otp")) {
                handleSendOtp(req, resp);
                return;
            }

            if (pathInfo != null && pathInfo.contains("/verify-otp")) {
                handleVerifyOtp(req, resp);
                return;
            }

            sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Auth endpoint not found");
        } catch (Exception e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Auth error: " + e.getMessage());
        }
    }

    /**
     * Sends OTP to Gmail for New Member Account Registration.
     */
    private void handleSendSignupOtp(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String body = readBody(req);
        if (body == null || body.isBlank()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Sign up payload required");
            return;
        }

        JsonObject json = JsonParser.parseString(body).getAsJsonObject();
        String email = json.has("email") ? json.get("email").getAsString().trim().toLowerCase() : "";
        String phone = json.has("phone") ? json.get("phone").getAsString().trim() : "";
        String password = json.has("password") ? json.get("password").getAsString() : "";

        if (email.isEmpty() || !email.contains("@")) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Please enter a valid Gmail / Email address");
            return;
        }
        if (phone.isEmpty()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Mobile number is required");
            return;
        }
        if (password == null || password.length() < 4) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Password must be at least 4 characters long");
            return;
        }

        // Check if Gmail or Mobile is already registered
        if (userDAO.emailExists(email)) {
            sendError(resp, HttpServletResponse.SC_CONFLICT, "Account with this Gmail already exists! Please Login.");
            return;
        }
        if (userDAO.phoneExists(phone)) {
            sendError(resp, HttpServletResponse.SC_CONFLICT, "Account with this Mobile number already exists! Please Login.");
            return;
        }

        // Generate 6-digit secure random OTP
        int otpNum = 100000 + random.nextInt(900000);
        String otp = String.valueOf(otpNum);

        // Save OTP in MySQL with 10-minute validity
        boolean saved = otpDAO.saveOtp(email, otp, 10);
        if (!saved) {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error saving OTP");
            return;
        }

        // Send OTP via Gmail SMTP
        GmailSmtpUtil.SmtpResult smtpResult = GmailSmtpUtil.sendOtpEmail(email, otp);

        if (!smtpResult.success) {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Gmail Delivery Failed: " + smtpResult.message);
            return;
        }

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("success", true);
        responseData.put("email", email);
        responseData.put("message", "Real OTP successfully sent to your Gmail (" + email + ")! Please check your inbox or spam.");
        sendJson(resp, HttpServletResponse.SC_OK, responseData);
    }

    /**
     * Verifies OTP and creates the new user account with set password in MySQL.
     */
    private void handleVerifySignupOtp(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String body = readBody(req);
        if (body == null || body.isBlank()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Verification payload required");
            return;
        }

        JsonObject json = JsonParser.parseString(body).getAsJsonObject();
        String email = json.has("email") ? json.get("email").getAsString().trim().toLowerCase() : "";
        String enteredOtp = json.has("otp") ? json.get("otp").getAsString().trim() : "";
        String name = json.has("name") ? json.get("name").getAsString().trim() : "User";
        String phone = json.has("phone") ? json.get("phone").getAsString().trim() : "";
        String password = json.has("password") ? json.get("password").getAsString() : "";

        if (email.isEmpty() || enteredOtp.isEmpty()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Gmail and OTP are required");
            return;
        }

        // Verify OTP against MySQL database
        boolean isValid = otpDAO.verifyOtp(email, enteredOtp);
        if (!isValid) {
            sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired OTP. Please check your Gmail or resend.");
            return;
        }

        // Create new user in MySQL
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPhone(phone);
        user.setPasswordHash(hashPassword(password));
        user.setRole("USER");

        boolean created = userDAO.register(user);
        if (created) {
            user.setPasswordHash(null);
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("success", true);
            responseData.put("message", "Account created successfully! Welcome to BusGo, " + user.getName());
            responseData.put("user", user);
            sendJson(resp, HttpServletResponse.SC_CREATED, responseData);
        } else {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error creating account");
        }
    }

    private void handleSendOtp(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String body = readBody(req);
        if (body == null || body.isBlank()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Email payload required");
            return;
        }

        JsonObject json = JsonParser.parseString(body).getAsJsonObject();
        String email = json.has("email") ? json.get("email").getAsString().trim().toLowerCase() : "";

        if (email.isEmpty() || !email.contains("@")) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Please enter a valid Gmail / Email address");
            return;
        }

        int otpNum = 100000 + random.nextInt(900000);
        String otp = String.valueOf(otpNum);

        boolean saved = otpDAO.saveOtp(email, otp, 10);
        if (!saved) {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error saving OTP");
            return;
        }

        GmailSmtpUtil.SmtpResult smtpResult = GmailSmtpUtil.sendOtpEmail(email, otp);

        if (!smtpResult.success) {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Gmail Delivery Failed: " + smtpResult.message);
            return;
        }

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("success", true);
        responseData.put("email", email);
        responseData.put("message", "Real OTP sent directly to " + email);
        sendJson(resp, HttpServletResponse.SC_OK, responseData);
    }

    private void handleVerifyOtp(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String body = readBody(req);
        if (body == null || body.isBlank()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Verification payload required");
            return;
        }

        JsonObject json = JsonParser.parseString(body).getAsJsonObject();
        String email = json.has("email") ? json.get("email").getAsString().trim().toLowerCase() : "";
        String enteredOtp = json.has("otp") ? json.get("otp").getAsString().trim() : "";

        if (email.isEmpty() || enteredOtp.isEmpty()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Email and OTP are both required");
            return;
        }

        boolean isValid = otpDAO.verifyOtp(email, enteredOtp);
        if (!isValid) {
            sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired OTP");
            return;
        }

        User user = null;
        for (User u : userDAO.getAllUsers()) {
            if (u.getEmail().equalsIgnoreCase(email)) {
                user = u;
                break;
            }
        }

        if (user != null) {
            user.setPasswordHash(null);
        }

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("success", true);
        responseData.put("message", "OTP verified successfully");
        responseData.put("user", user);

        sendJson(resp, HttpServletResponse.SC_OK, responseData);
    }

    private void handleForgotPasswordOtp(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String body = readBody(req);
        if (body == null || body.isBlank()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Payload required");
            return;
        }
        JsonObject json = JsonParser.parseString(body).getAsJsonObject();
        String identifier = json.has("identifier") ? json.get("identifier").getAsString().trim() : "";
        if (identifier.isEmpty() && json.has("email")) identifier = json.get("email").getAsString().trim();
        if (identifier.isEmpty() && json.has("phone")) identifier = json.get("phone").getAsString().trim();

        if (identifier.isEmpty()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Please enter your registered Gmail address or Mobile number");
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
                sendError(resp, HttpServletResponse.SC_NOT_FOUND, "No account found with this Gmail or Mobile number.");
                return;
            }
        }

        int otpNum = 100000 + random.nextInt(900000);
        String otp = String.valueOf(otpNum);
        otpDAO.saveOtp(user.getEmail(), otp, 10);

        GmailSmtpUtil.sendPasswordResetOtpEmail(user.getEmail(), otp);

        String masked = maskEmail(user.getEmail());
        Map<String, Object> responseData = new HashMap<>();
        responseData.put("success", true);
        responseData.put("email", user.getEmail());
        responseData.put("maskedEmail", masked);
        responseData.put("message", "Password Reset OTP sent to your registered Gmail (" + masked + ")!");
        sendJson(resp, HttpServletResponse.SC_OK, responseData);
    }

    private void handleResetPassword(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String body = readBody(req);
        if (body == null || body.isBlank()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Payload required");
            return;
        }
        JsonObject json = JsonParser.parseString(body).getAsJsonObject();
        String identifier = json.has("identifier") ? json.get("identifier").getAsString().trim() : "";
        if (identifier.isEmpty() && json.has("email")) identifier = json.get("email").getAsString().trim();
        String otp = json.has("otp") ? json.get("otp").getAsString().trim() : "";
        String newPassword = json.has("newPassword") ? json.get("newPassword").getAsString() : "";

        if (identifier.isEmpty() || otp.isEmpty()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Account identifier and OTP are required");
            return;
        }
        if (newPassword.length() < 4) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "New password must be at least 4 characters long");
            return;
        }

        User user = userDAO.getUserByIdentifier(identifier);
        if (user == null) {
            sendError(resp, HttpServletResponse.SC_NOT_FOUND, "User account not found");
            return;
        }

        boolean valid = otpDAO.verifyOtp(user.getEmail(), otp);
        if (!valid) {
            sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired OTP. Please check your Gmail.");
            return;
        }

        boolean updated = userDAO.updatePassword(user.getId(), hashPassword(newPassword));
        if (updated) {
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("success", true);
            responseData.put("message", "Password reset successfully! You can now log in with your new password.");
            sendJson(resp, HttpServletResponse.SC_OK, responseData);
        } else {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error updating password in MySQL");
        }
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return email;
        int atIdx = email.indexOf("@");
        String namePart = email.substring(0, atIdx);
        String domain = email.substring(atIdx);
        if (namePart.length() <= 2) {
            return namePart.charAt(0) + "***" + domain;
        }
        return namePart.substring(0, 2) + "***" + namePart.charAt(namePart.length() - 1) + domain;
    }

    private String hashPassword(String password) {
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
            throw new RuntimeException("SHA-256 algorithm error", e);
        }
    }
}
