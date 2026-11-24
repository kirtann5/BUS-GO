package com.busgo.dao;

import com.busgo.model.User;
import com.busgo.util.DBUtil;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure JDBC Data Access Object (DAO) for User operations.
 * Supports login via either Gmail/Email OR Mobile Phone number.
 */
public class UserDAO {

    private static final java.util.List<User> memoryUsers = new java.util.concurrent.CopyOnWriteArrayList<>();
    private static final java.util.concurrent.atomic.AtomicLong idGen = new java.util.concurrent.atomic.AtomicLong(
            1000);

    public boolean register(User user) {
        if (user == null)
            return false;
        if (user.getId() == null) {
            user.setId(idGen.incrementAndGet());
        }
        // Cache in memory fallback store
        memoryUsers.removeIf(u -> u.getEmail() != null && u.getEmail().equalsIgnoreCase(user.getEmail()));
        memoryUsers.add(user);

        String sql = "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = DBUtil.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, user.getName());
            ps.setString(2, user.getEmail().trim().toLowerCase());
            ps.setString(3, user.getPhone().trim());
            ps.setString(4, user.getPasswordHash());
            ps.setString(5, user.getRole() != null ? user.getRole() : "USER");

            int affected = ps.executeUpdate();
            if (affected > 0) {
                try (ResultSet generatedKeys = ps.getGeneratedKeys()) {
                    if (generatedKeys.next()) {
                        user.setId(generatedKeys.getLong(1));
                    }
                }
                return true;
            }
        } catch (SQLException e) {
            System.err.println("MySQL offline for register, user registered in-memory: " + e.getMessage());
            return true; // Saved in memoryUsers fallback
        }
        return true;
    }

    /**
     * Authenticates user using EITHER Gmail/Email OR Mobile Number with Password.
     */
    public User loginByIdentifier(String identifier, String passwordHash) {
        if (identifier == null || passwordHash == null)
            return null;
        String clean = identifier.trim().toLowerCase();
        String raw = identifier.trim();

        String sql = "SELECT * FROM users WHERE (LOWER(email) = ? OR phone = ?) AND password_hash = ?";
        try (Connection conn = DBUtil.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, clean);
            ps.setString(2, raw);
            ps.setString(3, passwordHash);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapResultSetToUser(rs);
                }
            }
        } catch (SQLException e) {
            System.err.println("MySQL offline for login, checking memory: " + e.getMessage());
        }

        // Fallback: Check memoryUsers
        for (User u : memoryUsers) {
            if (u != null && u.getPasswordHash() != null && passwordHash.equals(u.getPasswordHash())) {
                if ((u.getEmail() != null && clean.equalsIgnoreCase(u.getEmail()))
                        || (u.getPhone() != null && raw.equals(u.getPhone()))) {
                    return u;
                }
            }
        }
        return null;
    }

    public User login(String email, String passwordHash) {
        return loginByIdentifier(email, passwordHash);
    }

    public boolean emailExists(String email) {
        if (email == null)
            return false;
        String sql = "SELECT COUNT(*) FROM users WHERE LOWER(email) = ?";
        try (Connection conn = DBUtil.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email.trim().toLowerCase());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean phoneExists(String phone) {
        if (phone == null)
            return false;
        String sql = "SELECT COUNT(*) FROM users WHERE phone = ?";
        try (Connection conn = DBUtil.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, phone.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public User getUserById(Long id) {
        String sql = "SELECT * FROM users WHERE id = ?";
        try (Connection conn = DBUtil.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapResultSetToUser(rs);
                }
            }
        } catch (SQLException e) {
            System.err.println("MySQL offline for getUserById: " + e.getMessage());
        }

        if (id != null) {
            for (User u : memoryUsers) {
                if (u != null && id.equals(u.getId())) {
                    return u;
                }
            }
        }
        return null;
    }

    public List<User> getAllUsers() {
        List<User> list = new ArrayList<>();
        String sql = "SELECT * FROM users ORDER BY id DESC";
        try (Connection conn = DBUtil.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql);
                ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(mapResultSetToUser(rs));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<User> searchUsers(String query) {
        if (query == null || query.trim().isEmpty()) {
            return getAllUsers();
        }
        List<User> list = new ArrayList<>();
        String q = "%" + query.trim().toLowerCase() + "%";
        String sql = "SELECT * FROM users " +
                "WHERE LOWER(name) LIKE ? " +
                "   OR LOWER(email) LIKE ? " +
                "   OR phone LIKE ? " +
                "   OR LOWER(role) LIKE ? " +
                "ORDER BY id DESC";
        try (Connection conn = DBUtil.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, q);
            ps.setString(2, q);
            ps.setString(3, q);
            ps.setString(4, q);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapResultSetToUser(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public User getUserByIdentifier(String identifier) {
        if (identifier == null || identifier.trim().isEmpty())
            return null;
        String raw = identifier.trim();
        String clean = raw.toLowerCase();

        // 1. Check users table
        String sql = "SELECT * FROM users WHERE LOWER(TRIM(email)) = ? OR TRIM(phone) = ?";
        try (Connection conn = DBUtil.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, clean);
            ps.setString(2, raw);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapResultSetToUser(rs);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }

        // 2. Fallback: Check bookings table for passenger details (shown in Admin
        // panel)
        String bookingSql = "SELECT passenger_name, email, phone FROM bookings WHERE LOWER(TRIM(email)) = ? OR TRIM(phone) = ? ORDER BY id DESC LIMIT 1";
        try (Connection conn = DBUtil.getConnection();
                PreparedStatement ps = conn.prepareStatement(bookingSql)) {
            ps.setString(1, clean);
            ps.setString(2, raw);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String pEmail = rs.getString("email");
                    String pPhone = rs.getString("phone");
                    String pName = rs.getString("passenger_name");
                    if (pEmail != null && !pEmail.trim().isEmpty()) {
                        User user = new User();
                        user.setName(pName != null && !pName.trim().isEmpty() ? pName.trim() : "Member");
                        user.setEmail(pEmail.trim().toLowerCase());
                        user.setPhone(pPhone != null && !pPhone.trim().isEmpty() ? pPhone.trim() : raw);
                        user.setRole("USER");
                        user.setPasswordHash(hashPassword("BusGo@123"));
                        register(user);
                        return user;
                    }
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }

        // 3. If identifier is a valid Gmail address, create a user instance so OTP can
        // be dispatched
        if (clean.contains("@") && clean.contains(".")) {
            User user = new User();
            user.setName("Member");
            user.setEmail(clean);
            user.setPhone("");
            user.setRole("USER");
            user.setPasswordHash(hashPassword("BusGo@123"));
            register(user);
            return user;
        }

        return null;
    }

    public static String hashPassword(String password) {
        if (password == null)
            return "";
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1)
                    hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return password;
        }
    }

    public boolean updatePassword(Long userId, String passwordHash) {
        if (userId == null || passwordHash == null)
            return false;
        String sql = "UPDATE users SET password_hash = ? WHERE id = ?";
        try (Connection conn = DBUtil.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, passwordHash);
            ps.setLong(2, userId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean updatePasswordByIdentifier(String identifier, String passwordHash) {
        if (identifier == null || passwordHash == null)
            return false;
        String raw = identifier.trim();
        String clean = raw.toLowerCase();
        String sql = "UPDATE users SET password_hash = ? WHERE LOWER(TRIM(email)) = ? OR TRIM(phone) = ?";
        try (Connection conn = DBUtil.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, passwordHash);
            ps.setString(2, clean);
            ps.setString(3, raw);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    private User mapResultSetToUser(ResultSet rs) throws SQLException {
        User u = new User();
        u.setId(rs.getLong("id"));
        u.setName(rs.getString("name"));
        u.setEmail(rs.getString("email"));
        u.setPhone(rs.getString("phone"));
        u.setPasswordHash(rs.getString("password_hash"));
        u.setRole(rs.getString("role"));
        Timestamp ts = rs.getTimestamp("created_at");
        if (ts != null) {
            u.setCreatedAt(ts.toInstant().toString());
        } else {
            u.setCreatedAt(java.time.Instant.now().toString());
        }
        return u;
    }
}
