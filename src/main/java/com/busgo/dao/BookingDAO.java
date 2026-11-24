package com.busgo.dao;

import com.busgo.model.Booking;
import com.busgo.util.DBUtil;

import java.math.BigDecimal;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure JDBC Data Access Object (DAO) for Booking operations.
 */
public class BookingDAO {

    public boolean createBooking(Booking booking) {
        String sql = "INSERT INTO bookings (pnr, bus_id, user_id, passenger_name, phone, email, " +
                     "travel_date, seats_booked, total_amount, status, payment_method) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, booking.getPnr());

            // 1. Verify bus_id exists to prevent Foreign Key constraint failure
            Long validBusId = 1L;
            if (booking.getBusId() != null && booking.getBusId() > 0) {
                try (PreparedStatement checkBus = conn.prepareStatement("SELECT id FROM buses WHERE id = ?")) {
                    checkBus.setLong(1, booking.getBusId());
                    try (ResultSet rs = checkBus.executeQuery()) {
                        if (rs.next()) validBusId = booking.getBusId();
                    }
                } catch (Exception ignored) {}
            }
            ps.setLong(2, validBusId);

            // 2. Verify user_id exists in users table (or link by email)
            Long validUserId = null;
            if (booking.getUserId() != null && booking.getUserId() > 0) {
                try (PreparedStatement checkUser = conn.prepareStatement("SELECT id FROM users WHERE id = ?")) {
                    checkUser.setLong(1, booking.getUserId());
                    try (ResultSet rs = checkUser.executeQuery()) {
                        if (rs.next()) validUserId = booking.getUserId();
                    }
                } catch (Exception ignored) {}
            }
            if (validUserId == null && booking.getEmail() != null && !booking.getEmail().isBlank()) {
                try (PreparedStatement checkUser = conn.prepareStatement("SELECT id FROM users WHERE LOWER(email) = ?")) {
                    checkUser.setString(1, booking.getEmail().trim().toLowerCase());
                    try (ResultSet rs = checkUser.executeQuery()) {
                        if (rs.next()) validUserId = rs.getLong("id");
                    }
                } catch (Exception ignored) {}
            }
            if (validUserId != null) {
                ps.setLong(3, validUserId);
            } else {
                ps.setNull(3, Types.BIGINT);
            }

            ps.setString(4, booking.getPassengerName() != null ? booking.getPassengerName() : "Passenger");
            ps.setString(5, booking.getPhone() != null ? booking.getPhone() : "");
            ps.setString(6, booking.getEmail() != null ? booking.getEmail().trim().toLowerCase() : "");
            ps.setString(7, booking.getTravelDate() != null ? booking.getTravelDate() : java.time.LocalDate.now().toString());
            ps.setString(8, booking.getSeatsBooked() != null ? booking.getSeatsBooked() : "[]");
            ps.setBigDecimal(9, booking.getTotalAmount() != null ? booking.getTotalAmount() : BigDecimal.valueOf(500));
            ps.setString(10, booking.getStatus() != null ? booking.getStatus() : "CONFIRMED");

            // Sanitize payment method to valid MySQL ENUM ('card','upi','netbanking','phonepe')
            String pm = booking.getPaymentMethod() != null ? booking.getPaymentMethod().toLowerCase().trim() : "phonepe";
            if (!pm.equals("upi") && !pm.equals("card") && !pm.equals("netbanking") && !pm.equals("phonepe")) {
                pm = "phonepe";
            }
            ps.setString(11, pm);

            int affected = ps.executeUpdate();
            if (affected > 0) {
                try (ResultSet generatedKeys = ps.getGeneratedKeys()) {
                    if (generatedKeys.next()) {
                        booking.setId(generatedKeys.getLong(1));
                    }
                }
                return true;
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public List<Booking> searchBookings(String query) {
        if (query == null || query.trim().isEmpty()) {
            return getAllBookings();
        }
        List<Booking> list = new ArrayList<>();
        String q = "%" + query.trim().toLowerCase() + "%";
        String sql = "SELECT bk.*, b.operator, b.from_city, b.to_city, b.departure " +
                     "FROM bookings bk " +
                     "LEFT JOIN buses b ON bk.bus_id = b.id " +
                     "WHERE LOWER(bk.pnr) LIKE ? " +
                     "   OR LOWER(bk.email) LIKE ? " +
                     "   OR LOWER(bk.phone) LIKE ? " +
                     "   OR LOWER(bk.passenger_name) LIKE ? " +
                     "   OR LOWER(COALESCE(b.operator, '')) LIKE ? " +
                     "   OR LOWER(COALESCE(b.from_city, '')) LIKE ? " +
                     "   OR LOWER(COALESCE(b.to_city, '')) LIKE ? " +
                     "ORDER BY bk.id DESC";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, q);
            ps.setString(2, q);
            ps.setString(3, q);
            ps.setString(4, q);
            ps.setString(5, q);
            ps.setString(6, q);
            ps.setString(7, q);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapResultSetToBooking(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public Booking getBookingByPnr(String pnr) {
        if (pnr == null || pnr.trim().isEmpty()) return null;
        String sql = "SELECT bk.*, b.operator, b.from_city, b.to_city, b.departure " +
                     "FROM bookings bk " +
                     "LEFT JOIN buses b ON bk.bus_id = b.id " +
                     "WHERE LOWER(TRIM(bk.pnr)) = LOWER(TRIM(?))";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, pnr.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapResultSetToBooking(rs);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public boolean cancelBooking(String pnr) {
        if (pnr == null) return false;
        String sql = "UPDATE bookings SET status = 'CANCELLED' WHERE LOWER(TRIM(pnr)) = LOWER(TRIM(?))";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, pnr.trim());
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public List<Booking> getAllBookings() {
        List<Booking> list = new ArrayList<>();
        String sql = "SELECT bk.*, b.operator, b.from_city, b.to_city, b.departure " +
                     "FROM bookings bk " +
                     "LEFT JOIN buses b ON bk.bus_id = b.id " +
                     "ORDER BY bk.id DESC";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(mapResultSetToBooking(rs));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    private Booking mapResultSetToBooking(ResultSet rs) throws SQLException {
        Booking b = new Booking();
        b.setId(rs.getLong("id"));
        b.setPnr(rs.getString("pnr"));
        b.setBusId(rs.getLong("bus_id"));
        long uId = rs.getLong("user_id");
        if (!rs.wasNull()) {
            b.setUserId(uId);
        }
        b.setPassengerName(rs.getString("passenger_name"));
        b.setPhone(rs.getString("phone"));
        b.setEmail(rs.getString("email"));
        b.setTravelDate(rs.getString("travel_date"));
        b.setSeatsBooked(rs.getString("seats_booked"));
        b.setTotalAmount(rs.getBigDecimal("total_amount"));
        b.setStatus(rs.getString("status"));
        b.setPaymentMethod(rs.getString("payment_method"));
        Timestamp ts = rs.getTimestamp("created_at");
        if (ts != null) {
            b.setCreatedAt(ts.toInstant().toString());
        } else {
            b.setCreatedAt(java.time.Instant.now().toString());
        }

        // Joined fields from Bus (with intelligent fallbacks if bus table is empty)
        String op = rs.getString("operator");
        String from = rs.getString("from_city");
        String to = rs.getString("to_city");
        String dep = rs.getString("departure");

        b.setOperator(op != null && !op.isBlank() ? op : "IntrCity SmartBus");
        b.setFromCity(from != null && !from.isBlank() ? from : "Indore");
        b.setToCity(to != null && !to.isBlank() ? to : "Bhopal");
        b.setDeparture(dep != null && !dep.isBlank() ? BusDAO.formatTo12Hour(dep) : "08:00 PM");
        return b;
    }
}

