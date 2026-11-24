package com.busgo.model;

import java.math.BigDecimal;

/**
 * Booking domain model POJO for Pure Java + JDBC.
 */
public class Booking {
    private Long id;
    private String pnr;
    private Long busId;
    private Long userId;
    private String passengerName;
    private String phone;
    private String email;
    private String travelDate;
    private String seatsBooked;
    private BigDecimal totalAmount;
    private String status = "CONFIRMED"; // CONFIRMED, CANCELLED, PENDING
    private String paymentMethod = "UPI";
    private String createdAt;

    // Additional display fields joined from Bus
    private String operator;
    private String fromCity;
    private String toCity;
    private String departure;

    public Booking() {
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPnr() { return pnr; }
    public void setPnr(String pnr) { this.pnr = pnr; }

    public Long getBusId() { return busId; }
    public void setBusId(Long busId) { this.busId = busId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getPassengerName() { return passengerName; }
    public void setPassengerName(String passengerName) { this.passengerName = passengerName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getTravelDate() { return travelDate; }
    public void setTravelDate(String travelDate) { this.travelDate = travelDate; }

    public String getSeatsBooked() { return seatsBooked; }
    public void setSeatsBooked(String seatsBooked) { this.seatsBooked = seatsBooked; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }

    public String getFromCity() { return fromCity; }
    public void setFromCity(String fromCity) { this.fromCity = fromCity; }

    public String getToCity() { return toCity; }
    public void setToCity(String toCity) { this.toCity = toCity; }

    public String getDeparture() { return departure; }
    public void setDeparture(String departure) { this.departure = departure; }
}
