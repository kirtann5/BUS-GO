package com.busgo.model;

import java.math.BigDecimal;

/**
 * Bus domain model POJO for Pure Java + JDBC.
 */
public class Bus {
    private Long id;
    private String operator;
    private String type; // ac, sleeper, volvo, ordinary
    private String fromCity;
    private String toCity;
    private String departure;
    private String arrival;
    private String duration;
    private BigDecimal price;
    private Integer totalSeats = 40;
    private Double rating = 4.0;
    private String amenities;
    private Boolean active = true;

    public Bus() {
    }

    public Bus(Long id, String operator, String type, String fromCity, String toCity,
               String departure, String arrival, String duration, BigDecimal price,
               Integer totalSeats, Double rating, String amenities, Boolean active) {
        this.id = id;
        this.operator = operator;
        this.type = type;
        this.fromCity = fromCity;
        this.toCity = toCity;
        this.departure = departure;
        this.arrival = arrival;
        this.duration = duration;
        this.price = price;
        this.totalSeats = totalSeats;
        this.rating = rating;
        this.amenities = amenities;
        this.active = active;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getFromCity() { return fromCity; }
    public void setFromCity(String fromCity) { this.fromCity = fromCity; }

    public String getToCity() { return toCity; }
    public void setToCity(String toCity) { this.toCity = toCity; }

    public String getDeparture() { return departure; }
    public void setDeparture(String departure) { this.departure = departure; }

    public String getArrival() { return arrival; }
    public void setArrival(String arrival) { this.arrival = arrival; }

    public String getDuration() { return duration; }
    public void setDuration(String duration) { this.duration = duration; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }

    public Integer getTotalSeats() { return totalSeats; }
    public void setTotalSeats(Integer totalSeats) { this.totalSeats = totalSeats; }

    public Double getRating() { return rating; }
    public void setRating(Double rating) { this.rating = rating; }

    public String getAmenities() { return amenities; }
    public void setAmenities(String amenities) { this.amenities = amenities; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
