package com.busgo.servlet;

import com.busgo.dao.BookingDAO;
import com.busgo.dao.BusDAO;
import com.busgo.model.Booking;
import com.busgo.model.Bus;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;

/**
 * Java Servlet handling seat reservations, PNR generation, and cancellations.
 * Mapped to /api/bookings and /api/bookings/*
 */
@WebServlet(name = "BookingServlet", urlPatterns = {"/api/bookings", "/api/bookings/*"})
public class BookingServlet extends BaseServlet {

    private final BookingDAO bookingDAO = new BookingDAO();
    private final BusDAO busDAO = new BusDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        setCorsHeaders(resp);
        String pathInfo = req.getPathInfo();

        try {
            // Case 1: GET /api/bookings or /api/bookings/
            if (pathInfo == null || pathInfo.equals("/") || pathInfo.isEmpty()) {
                List<Booking> list = bookingDAO.getAllBookings();
                sendJson(resp, HttpServletResponse.SC_OK, list);
                return;
            }

            // Clean path components: /pnr/BG123456 -> ["", "pnr", "BG123456"]
            String[] parts = pathInfo.split("/");

            // Case 2: GET /api/bookings/pnr/{pnr}
            if (parts.length >= 3 && "pnr".equalsIgnoreCase(parts[1])) {
                String pnr = parts[2].trim();
                Booking booking = bookingDAO.getBookingByPnr(pnr);
                if (booking != null) {
                    sendJson(resp, HttpServletResponse.SC_OK, booking);
                } else {
                    sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Booking not found for PNR: " + pnr);
                }
                return;
            }

            sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Endpoint not found");
        } catch (Exception e) {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Server error: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        setCorsHeaders(resp);
        String pathInfo = req.getPathInfo();

        try {
            // Case 1: POST /api/bookings/create
            if (pathInfo != null && pathInfo.contains("/create")) {
                handleCreateBooking(req, resp);
                return;
            }

            // Case 2: POST /api/bookings/cancel/{pnr}
            if (pathInfo != null && pathInfo.contains("/cancel/")) {
                handleCancelBooking(req, resp, pathInfo);
                return;
            }

            sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Endpoint not found");
        } catch (Exception e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Error creating booking: " + e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        setCorsHeaders(resp);
        String pathInfo = req.getPathInfo();

        // Support PUT /api/bookings/cancel/{pnr}
        if (pathInfo != null && pathInfo.contains("/cancel/")) {
            handleCancelBooking(req, resp, pathInfo);
        } else {
            sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Endpoint not found");
        }
    }

    private void handleCreateBooking(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String body = readBody(req);
        if (body == null || body.isBlank()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Request body is required");
            return;
        }

        JsonObject json = JsonParser.parseString(body).getAsJsonObject();

        Long busId = json.has("busId") ? json.get("busId").getAsLong() : null;
        if (busId == null) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "busId is required");
            return;
        }

        Bus bus = busDAO.getBusById(busId);
        if (bus == null) {
            sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Bus not found with ID: " + busId);
            return;
        }

        String passengerName = json.has("passengerName") ? json.get("passengerName").getAsString() : "Passenger";
        String phone = json.has("phone") ? json.get("phone").getAsString() : "";
        String email = json.has("email") ? json.get("email").getAsString() : "";
        String travelDate = json.has("travelDate") ? json.get("travelDate").getAsString() : "";
        String paymentMethod = json.has("paymentMethod") ? json.get("paymentMethod").getAsString() : "UPI";
        Long userId = (json.has("userId") && !json.get("userId").isJsonNull()) ? json.get("userId").getAsLong() : null;

        String seatsBooked = "[]";
        int seatCount = 1;
        if (json.has("seats") && json.get("seats").isJsonArray()) {
            seatsBooked = json.get("seats").toString();
            seatCount = Math.max(1, json.get("seats").getAsJsonArray().size());
        }

        // Calculate total amount
        BigDecimal total = bus.getPrice().multiply(BigDecimal.valueOf(seatCount));

        // Generate unique PNR
        String pnr = "BG" + (System.currentTimeMillis() % 100000000L) + (int) (Math.random() * 9000 + 1000);

        Booking booking = new Booking();
        booking.setPnr(pnr);
        booking.setBusId(busId);
        booking.setUserId(userId);
        booking.setPassengerName(passengerName);
        booking.setPhone(phone);
        booking.setEmail(email);
        booking.setTravelDate(travelDate);
        booking.setSeatsBooked(seatsBooked);
        booking.setTotalAmount(total);
        booking.setStatus("CONFIRMED");
        booking.setPaymentMethod(paymentMethod);

        boolean saved = bookingDAO.createBooking(booking);
        if (saved) {
            // Re-fetch populated booking with bus operator info
            Booking created = bookingDAO.getBookingByPnr(pnr);
            sendJson(resp, HttpServletResponse.SC_CREATED, created != null ? created : booking);
        } else {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Failed to save booking to database");
        }
    }

    private void handleCancelBooking(HttpServletRequest req, HttpServletResponse resp, String pathInfo) throws IOException {
        String[] parts = pathInfo.split("/");
        if (parts.length >= 3) {
            String pnr = parts[parts.length - 1].trim();
            boolean cancelled = bookingDAO.cancelBooking(pnr);
            if (cancelled) {
                Booking booking = bookingDAO.getBookingByPnr(pnr);
                sendJson(resp, HttpServletResponse.SC_OK, booking);
            } else {
                sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Booking not found for PNR: " + pnr);
            }
        } else {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid PNR in URL");
        }
    }
}

