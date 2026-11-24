package com.busgo.servlet;

import com.busgo.dao.BusDAO;
import com.busgo.model.Bus;
import com.busgo.util.DBUtil;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;

/**
 * Java Servlet handling bus search, catalog browsing, and seat availability.
 * Mapped to /api/buses and /api/buses/*
 */
@WebServlet(name = "BusServlet", urlPatterns = {"/api/buses", "/api/buses/*"})
public class BusServlet extends BaseServlet {

    private final BusDAO busDAO = new BusDAO();

    @Override
    public void init() throws ServletException {
        super.init();
        // Auto-initialize MySQL tables and sample buses on servlet startup
        DBUtil.initDatabase();
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        setCorsHeaders(resp);
        String pathInfo = req.getPathInfo();

        try {
            // Case 1: GET /api/buses or GET /api/buses/
            if (pathInfo == null || pathInfo.equals("/") || pathInfo.isEmpty()) {
                String from = req.getParameter("from");
                String to = req.getParameter("to");
                if (from != null || to != null) {
                    List<Bus> buses = busDAO.searchBuses(from, to);
                    sendJson(resp, HttpServletResponse.SC_OK, buses);
                } else {
                    List<Bus> buses = busDAO.getAllBuses();
                    sendJson(resp, HttpServletResponse.SC_OK, buses);
                }
                return;
            }

            // Case 2: GET /api/buses/search?from=...&to=...
            if (pathInfo.equals("/search")) {
                String from = req.getParameter("from");
                String to = req.getParameter("to");
                List<Bus> buses = busDAO.searchBuses(from, to);
                sendJson(resp, HttpServletResponse.SC_OK, buses);
                return;
            }

            // Clean path components: /1/seats -> ["", "1", "seats"]
            String[] parts = pathInfo.split("/");

            // Case 3: GET /api/buses/{id}/seats?date=YYYY-MM-DD
            if (parts.length >= 3 && "seats".equalsIgnoreCase(parts[2])) {
                Long busId = Long.parseLong(parts[1]);
                String date = req.getParameter("date");
                int availableSeats = busDAO.getAvailableSeats(busId, date);
                sendJson(resp, HttpServletResponse.SC_OK, availableSeats);
                return;
            }

            // Case 4: GET /api/buses/{id}
            if (parts.length >= 2) {
                Long busId = Long.parseLong(parts[1]);
                Bus bus = busDAO.getBusById(busId);
                if (bus != null) {
                    sendJson(resp, HttpServletResponse.SC_OK, bus);
                } else {
                    sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Bus not found with ID: " + busId);
                }
                return;
            }

            sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Resource not found");
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid bus ID parameter");
        } catch (Exception e) {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Server error: " + e.getMessage());
        }
    }
}

