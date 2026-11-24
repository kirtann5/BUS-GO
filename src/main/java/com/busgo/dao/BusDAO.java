package com.busgo.dao;

import com.busgo.model.Bus;
import com.busgo.util.DBUtil;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure JDBC Data Access Object (DAO) for Bus operations.
 */
public class BusDAO {

    public List<Bus> getAllBuses() {
        List<Bus> list = new ArrayList<>();
        String sql = "SELECT * FROM buses WHERE active = TRUE ORDER BY price ASC";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(mapResultSetToBus(rs));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<Bus> searchBuses(String from, String to) {
        List<Bus> list = new ArrayList<>();
        String sql = "SELECT * FROM buses WHERE LOWER(from_city) LIKE LOWER(?) " +
                     "AND LOWER(to_city) LIKE LOWER(?) AND active = TRUE ORDER BY price ASC";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            String cleanFrom = (from != null ? from.split("\\(")[0].trim() : "");
            String cleanTo = (to != null ? to.split("\\(")[0].trim() : "");
            ps.setString(1, "%" + cleanFrom + "%");
            ps.setString(2, "%" + cleanTo + "%");
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapResultSetToBus(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public Bus getBusById(Long id) {
        String sql = "SELECT * FROM buses WHERE id = ?";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapResultSetToBus(rs);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public int getAvailableSeats(Long busId, String travelDate) {
        Bus bus = getBusById(busId);
        if (bus == null) return 0;

        String sql = "SELECT COUNT(*) FROM bookings WHERE bus_id = ? AND travel_date = ? AND status != 'CANCELLED'";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, busId);
            ps.setString(2, travelDate);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    int booked = rs.getInt(1);
                    return Math.max(0, bus.getTotalSeats() - booked);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return bus.getTotalSeats();
    }

    public static String formatTo12Hour(String timeStr) {
        if (timeStr == null || timeStr.isBlank()) return "08:00 PM";
        String s = timeStr.trim();
        if (s.toLowerCase().contains("am") || s.toLowerCase().contains("pm")) {
            return s;
        }
        try {
            String[] parts = s.split(":");
            int hours = Integer.parseInt(parts[0]);
            int minutes = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
            String ampm = hours >= 12 ? "PM" : "AM";
            int h12 = hours % 12;
            if (h12 == 0) h12 = 12;
            return String.format("%02d:%02d %s", h12, minutes, ampm);
        } catch (Exception e) {
            return s;
        }
    }

    private Bus mapResultSetToBus(ResultSet rs) throws SQLException {
        return new Bus(
                rs.getLong("id"),
                rs.getString("operator"),
                rs.getString("type"),
                rs.getString("from_city"),
                rs.getString("to_city"),
                formatTo12Hour(rs.getString("departure")),
                formatTo12Hour(rs.getString("arrival")),
                rs.getString("duration"),
                rs.getBigDecimal("price"),
                rs.getInt("total_seats"),
                rs.getDouble("rating"),
                rs.getString("amenities"),
                rs.getBoolean("active")
        );
    }
}

