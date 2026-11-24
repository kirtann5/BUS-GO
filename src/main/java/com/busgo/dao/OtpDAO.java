package com.busgo.dao;

import com.busgo.util.DBUtil;

import java.sql.*;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Pure JDBC Data Access Object for OTP management and expiration checking.
 * Includes resilient in-memory fallback so sign-up never fails if MySQL is temporarily offline.
 */
public class OtpDAO {

    private static class MemoryOtp {
        String otp;
        long expiryTimeMs;
        MemoryOtp(String otp, long expiryTimeMs) {
            this.otp = otp;
            this.expiryTimeMs = expiryTimeMs;
        }
    }

    private static final Map<String, MemoryOtp> memoryStore = new ConcurrentHashMap<>();

    public boolean saveOtp(String email, String otp, int validityMinutes) {
        if (email == null || otp == null) return false;
        String cleanEmail = email.trim().toLowerCase();
        long expiryMs = System.currentTimeMillis() + (validityMinutes * 60 * 1000L);

        // Always store in memory cache as guaranteed fallback
        memoryStore.put(cleanEmail, new MemoryOtp(otp.trim(), expiryMs));

        String sql = "INSERT INTO otp_verifications (email, otp, expiry_time) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE)) " +
                     "ON DUPLICATE KEY UPDATE otp = VALUES(otp), expiry_time = VALUES(expiry_time), created_at = NOW()";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, cleanEmail);
            ps.setString(2, otp.trim());
            ps.setInt(3, validityMinutes);
            ps.executeUpdate();
            return true;
        } catch (SQLException e) {
            System.err.println("MySQL offline for saveOtp, using resilient in-memory store: " + e.getMessage());
            // Return true because memoryStore has the valid OTP
            return true;
        }
    }

    public boolean verifyOtp(String email, String otp) {
        if (email == null || otp == null) return false;
        String cleanEmail = email.trim().toLowerCase();
        String cleanOtp = otp.trim();

        // 1. Check MySQL
        String sql = "SELECT * FROM otp_verifications WHERE LOWER(email) = ? AND otp = ? AND expiry_time >= NOW()";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, cleanEmail);
            ps.setString(2, cleanOtp);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    deleteOtp(cleanEmail);
                    memoryStore.remove(cleanEmail);
                    return true;
                }
            }
        } catch (SQLException e) {
            System.err.println("MySQL offline for verifyOtp, checking resilient in-memory store: " + e.getMessage());
        }

        // 2. Check in-memory store
        MemoryOtp mem = memoryStore.get(cleanEmail);
        if (mem != null) {
            if (System.currentTimeMillis() <= mem.expiryTimeMs && mem.otp.equals(cleanOtp)) {
                memoryStore.remove(cleanEmail);
                deleteOtp(cleanEmail);
                return true;
            } else if (System.currentTimeMillis() > mem.expiryTimeMs) {
                memoryStore.remove(cleanEmail);
            }
        }

        return false;
    }

    public void deleteOtp(String email) {
        if (email == null) return;
        String cleanEmail = email.trim().toLowerCase();
        memoryStore.remove(cleanEmail);

        String sql = "DELETE FROM otp_verifications WHERE LOWER(email) = ?";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, cleanEmail);
            ps.executeUpdate();
        } catch (SQLException ignored) {
        }
    }
}
