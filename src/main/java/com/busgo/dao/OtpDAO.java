package com.busgo.dao;

import com.busgo.util.DBUtil;

import java.sql.*;

/**
 * Pure JDBC Data Access Object for OTP management and expiration checking.
 */
public class OtpDAO {

    public boolean saveOtp(String email, String otp, int validityMinutes) {
        String sql = "INSERT INTO otp_verifications (email, otp, expiry_time) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE)) " +
                     "ON DUPLICATE KEY UPDATE otp = VALUES(otp), expiry_time = VALUES(expiry_time), created_at = NOW()";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email.trim().toLowerCase());
            ps.setString(2, otp.trim());
            ps.setInt(3, validityMinutes);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean verifyOtp(String email, String otp) {
        String sql = "SELECT * FROM otp_verifications WHERE LOWER(email) = ? AND otp = ? AND expiry_time >= NOW()";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email.trim().toLowerCase());
            ps.setString(2, otp.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    // Valid OTP: delete after use to prevent replay
                    deleteOtp(email);
                    return true;
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public void deleteOtp(String email) {
        String sql = "DELETE FROM otp_verifications WHERE LOWER(email) = ?";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email.trim().toLowerCase());
            ps.executeUpdate();
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}

