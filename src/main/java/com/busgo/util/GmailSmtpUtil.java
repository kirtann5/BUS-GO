package com.busgo.util;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Properties;

/**
 * Lightweight Pure Java SMTP Client for sending real OTP emails via Gmail (smtp.gmail.com:465).
 * Dynamically loads credentials from application.properties or environment variables.
 */
public class GmailSmtpUtil {

    private static final String SMTP_HOST = "smtp.gmail.com";
    private static final int SMTP_PORT = 465;

    public static class SmtpResult {
        public final boolean success;
        public final String message;

        public SmtpResult(boolean success, String message) {
            this.success = success;
            this.message = message;
        }
    }

    /**
     * Loads Gmail sender address from application.properties or environment.
     */
    public static String getSenderGmail() {
        String user = System.getenv("BUSGO_GMAIL_USER");
        if (user != null && !user.isBlank()) return user.trim();

        Properties props = loadProperties();
        String propUser = props.getProperty("mail.smtp.username");
        if (propUser != null && !propUser.isBlank()) return propUser.trim();

        return "";
    }

    /**
     * Loads Google 16-character App Password from application.properties or environment.
     */
    public static String getAppPassword() {
        String pass = System.getenv("BUSGO_GMAIL_PASS");
        if (pass != null && !pass.isBlank()) return pass.trim().replaceAll("\\s+", "");

        Properties props = loadProperties();
        String propPass = props.getProperty("mail.smtp.password");
        if (propPass != null && !propPass.isBlank()) return propPass.trim().replaceAll("\\s+", "");

        return "";
    }

    /**
     * Sends a real 6-digit verification OTP email to the recipient's Gmail inbox.
     */
    public static SmtpResult sendOtpEmail(String recipientEmail, String otp) {
        if (recipientEmail == null || !recipientEmail.contains("@")) {
            return new SmtpResult(false, "Invalid recipient email address");
        }
        recipientEmail = recipientEmail.trim().toLowerCase();
        String gmailUser = getSenderGmail();
        String appPassword = getAppPassword();

        if (gmailUser.isEmpty() || appPassword.isEmpty()) {
            String notice = "Gmail sender credentials not configured in application.properties. (Testing OTP: " + otp + ")";
            System.out.println(">>> [Real Gmail OTP]: " + notice);
            return new SmtpResult(false, notice);
        }

        try (SSLSocket socket = (SSLSocket) SSLSocketFactory.getDefault().createSocket(SMTP_HOST, SMTP_PORT);
             BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
             OutputStream out = socket.getOutputStream()) {

            socket.setSoTimeout(15000); // 15s timeout

            // Welcome banner
            readSmtpResponse(reader);

            // 1. EHLO
            sendSmtpCommand(out, "EHLO smtp.gmail.com");
            readSmtpResponse(reader);

            // 2. AUTH LOGIN
            sendSmtpCommand(out, "AUTH LOGIN");
            readSmtpResponse(reader);

            // 3. Send Base64 Username
            String b64User = Base64.getEncoder().encodeToString(gmailUser.getBytes(StandardCharsets.UTF_8));
            sendSmtpCommand(out, b64User);
            readSmtpResponse(reader);

            // 4. Send Base64 App Password
            String b64Pass = Base64.getEncoder().encodeToString(appPassword.getBytes(StandardCharsets.UTF_8));
            sendSmtpCommand(out, b64Pass);
            String authResp = readSmtpResponse(reader);

            if (!authResp.startsWith("235")) {
                String errMsg = "Google rejected credentials (" + authResp.trim() + "). Please ensure you are using a 16-character Google App Password (not your normal password).";
                System.err.println(">>> [Real Gmail OTP Error]: " + errMsg);
                return new SmtpResult(false, errMsg);
            }

            // 5. MAIL FROM
            sendSmtpCommand(out, "MAIL FROM:<" + gmailUser + ">");
            readSmtpResponse(reader);

            // 6. RCPT TO
            sendSmtpCommand(out, "RCPT TO:<" + recipientEmail + ">");
            String rcptResp = readSmtpResponse(reader);
            if (rcptResp.startsWith("5") || rcptResp.startsWith("4")) {
                System.err.println(">>> [Google SMTP RCPT Error]: " + rcptResp);
                return new SmtpResult(false, "Google SMTP recipient error: " + rcptResp);
            }

            // 7. DATA
            sendSmtpCommand(out, "DATA");
            readSmtpResponse(reader);

            // 8. HTML Email Content
            String emailContent = "From: BusGo Smart Bus <" + gmailUser + ">\r\n" +
                    "To: <" + recipientEmail + ">\r\n" +
                    "Subject: BusGo - Your Account Verification OTP: " + otp + "\r\n" +
                    "MIME-Version: 1.0\r\n" +
                    "Content-Type: text/html; charset=UTF-8\r\n" +
                    "\r\n" +
                    "<div style='font-family: Arial, sans-serif; max-width: 520px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;'>" +
                    "  <div style='text-align: center; margin-bottom: 20px;'>" +
                    "    <h2 style='color: #2563eb; margin: 0;'>🚍 BusGo Smart Bus System</h2>" +
                    "    <p style='color: #64748b; font-size: 14px; margin-top: 5px;'>Online Bus Reservation & Real-Time Tracking</p>" +
                    "  </div>" +
                    "  <p style='font-size: 16px; color: #1e293b;'>Hello,</p>" +
                    "  <p style='font-size: 15px; color: #334155;'>Thank you for signing up on BusGo. Your One-Time Password (OTP) for account verification is:</p>" +
                    "  <div style='text-align: center; margin: 25px 0;'>" +
                    "    <span style='display: inline-block; font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 12px 28px; border-radius: 8px; border: 2px dashed #3b82f6;'>" +
                    otp +
                    "    </span>" +
                    "  </div>" +
                    "  <p style='font-size: 13px; color: #64748b;'>This OTP is valid for <strong>1 minute</strong>. Please do not share this OTP with anyone.</p>" +
                    "  <div style='background: #f8fafc; border-left: 4px solid #2563eb; padding: 10px 15px; border-radius: 4px; margin: 20px 0; font-size: 13px; color: #475569;'>" +
                    "    <strong>Assigned Bus Driver:</strong> Captain Kirtan (📞 <a href='tel:+916264213958' style='color:#2563eb;text-decoration:none;'>+91 6264213958</a>)" +
                    "  </div>" +
                    "  <hr style='border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;'/>" +
                    "  <p style='font-size: 12px; color: #94a3b8; text-align: center;'>BusGo Team • Safe & Smart Travel</p>" +
                    "</div>\r\n" +
                    ".";

            sendSmtpCommand(out, emailContent);
            readSmtpResponse(reader);

            // 9. QUIT
            sendSmtpCommand(out, "QUIT");
            readSmtpResponse(reader);

            System.out.println(">>> [Real Gmail OTP] Live email successfully delivered to inbox: " + recipientEmail);
            return new SmtpResult(true, "Real OTP successfully delivered to your Gmail inbox (" + recipientEmail + ")!");

        } catch (Exception e) {
            System.err.println(">>> [Real Gmail OTP Failed]: " + e.getMessage());
            return new SmtpResult(false, "Could not deliver email: " + e.getMessage());
        }
    }

    /**
     * Sends a Password Reset OTP email to the user's Gmail address.
     */
    public static SmtpResult sendPasswordResetOtpEmail(String recipientEmail, String otp) {
        if (recipientEmail == null || !recipientEmail.contains("@")) {
            return new SmtpResult(false, "Invalid recipient email address");
        }
        recipientEmail = recipientEmail.trim().toLowerCase();
        String gmailUser = getSenderGmail();
        String appPassword = getAppPassword();

        if (gmailUser.isEmpty() || appPassword.isEmpty()) {
            String notice = "Gmail sender credentials not configured. (Testing Reset OTP: " + otp + ")";
            System.out.println(">>> [Password Reset OTP]: " + notice);
            return new SmtpResult(false, notice);
        }

        try (SSLSocket socket = (SSLSocket) SSLSocketFactory.getDefault().createSocket(SMTP_HOST, SMTP_PORT);
             BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
             OutputStream out = socket.getOutputStream()) {

            socket.setSoTimeout(15000);
            readSmtpResponse(reader);

            sendSmtpCommand(out, "EHLO smtp.gmail.com");
            readSmtpResponse(reader);

            sendSmtpCommand(out, "AUTH LOGIN");
            readSmtpResponse(reader);

            String b64User = Base64.getEncoder().encodeToString(gmailUser.getBytes(StandardCharsets.UTF_8));
            sendSmtpCommand(out, b64User);
            readSmtpResponse(reader);

            String b64Pass = Base64.getEncoder().encodeToString(appPassword.getBytes(StandardCharsets.UTF_8));
            sendSmtpCommand(out, b64Pass);
            String authResp = readSmtpResponse(reader);

            if (!authResp.startsWith("235")) {
                return new SmtpResult(false, "Gmail Authentication Failed for Reset Email: " + authResp);
            }

            sendSmtpCommand(out, "MAIL FROM:<" + gmailUser + ">");
            readSmtpResponse(reader);

            sendSmtpCommand(out, "RCPT TO:<" + recipientEmail + ">");
            String rcptResp = readSmtpResponse(reader);
            if (rcptResp.startsWith("5") || rcptResp.startsWith("4")) {
                System.err.println(">>> [Google SMTP RCPT Error]: " + rcptResp);
                return new SmtpResult(false, "Google SMTP recipient error: " + rcptResp);
            }

            sendSmtpCommand(out, "DATA");
            readSmtpResponse(reader);

            String emailContent = "From: BusGo Security Team <" + gmailUser + ">\r\n" +
                    "To: <" + recipientEmail + ">\r\n" +
                    "Subject: BusGo - Password Reset Verification OTP: " + otp + "\r\n" +
                    "MIME-Version: 1.0\r\n" +
                    "Content-Type: text/html; charset=UTF-8\r\n" +
                    "\r\n" +
                    "<div style='font-family: Arial, sans-serif; max-width: 520px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;'>" +
                    "  <div style='text-align: center; margin-bottom: 20px;'>" +
                    "    <h2 style='color: #FF6B35; margin: 0;'>🚍 BusGo Account Security</h2>" +
                    "    <p style='color: #64748b; font-size: 14px; margin-top: 5px;'>Password Reset Request</p>" +
                    "  </div>" +
                    "  <p style='font-size: 16px; color: #1e293b;'>Hello,</p>" +
                    "  <p style='font-size: 15px; color: #334155;'>We received a request to reset your BusGo account password. Your One-Time Password (OTP) for password reset is:</p>" +
                    "  <div style='text-align: center; margin: 25px 0;'>" +
                    "    <span style='display: inline-block; font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #FF6B35; background: #fff7ed; padding: 12px 28px; border-radius: 8px; border: 2px dashed #FF6B35;'>" +
                    otp +
                    "    </span>" +
                    "  </div>" +
                    "  <p style='font-size: 13px; color: #64748b;'>This OTP is valid for <strong>1 minute</strong>. If you did not request a password reset, please ignore this email.</p>" +
                    "  <div style='background: #f8fafc; border-left: 4px solid #FF6B35; padding: 10px 15px; border-radius: 4px; margin: 20px 0; font-size: 13px; color: #475569;'>" +
                    "    <strong>Security Notice:</strong> BusGo will never ask for your password or OTP over phone." +
                    "  </div>" +
                    "  <hr style='border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;'/>" +
                    "  <p style='font-size: 12px; color: #94a3b8; text-align: center;'>BusGo Smart Travel • Account Security Team</p>" +
                    "</div>\r\n" +
                    ".";

            sendSmtpCommand(out, emailContent);
            readSmtpResponse(reader);

            sendSmtpCommand(out, "QUIT");
            readSmtpResponse(reader);

            System.out.println(">>> [Password Reset OTP] Successfully delivered to: " + recipientEmail);
            return new SmtpResult(true, "Password Reset OTP successfully delivered to your Gmail (" + recipientEmail + ")!");

        } catch (Exception e) {
            System.err.println(">>> [Password Reset OTP Failed]: " + e.getMessage());
            return new SmtpResult(false, "Could not deliver email: " + e.getMessage());
        }
    }

    /**
     * Sends an official E-Ticket confirmation email to the passenger's Gmail inbox.
     */
    public static SmtpResult sendBookingConfirmationEmail(String recipientEmail, String pnr, String passengerName, 
                                                          String busOperator, String fromCity, String toCity, 
                                                          String travelDate, String seats, String fare, 
                                                          String pickupPoint, String dropPoint) {
        String gmailUser = getSenderGmail();
        String appPassword = getAppPassword();

        if (gmailUser.isEmpty() || appPassword.isEmpty() || recipientEmail == null || !recipientEmail.contains("@")) {
            return new SmtpResult(false, "Gmail credentials not configured");
        }
        recipientEmail = recipientEmail.trim().toLowerCase();

        try (SSLSocket socket = (SSLSocket) SSLSocketFactory.getDefault().createSocket(SMTP_HOST, SMTP_PORT);
             BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
             OutputStream out = socket.getOutputStream()) {

            socket.setSoTimeout(15000);
            readSmtpResponse(reader);

            sendSmtpCommand(out, "EHLO smtp.gmail.com");
            readSmtpResponse(reader);

            sendSmtpCommand(out, "AUTH LOGIN");
            readSmtpResponse(reader);

            String b64User = Base64.getEncoder().encodeToString(gmailUser.getBytes(StandardCharsets.UTF_8));
            sendSmtpCommand(out, b64User);
            readSmtpResponse(reader);

            String b64Pass = Base64.getEncoder().encodeToString(appPassword.getBytes(StandardCharsets.UTF_8));
            sendSmtpCommand(out, b64Pass);
            String authResp = readSmtpResponse(reader);
            if (!authResp.startsWith("235")) {
                return new SmtpResult(false, "Authentication rejected");
            }

            sendSmtpCommand(out, "MAIL FROM:<" + gmailUser + ">");
            readSmtpResponse(reader);

            sendSmtpCommand(out, "RCPT TO:<" + recipientEmail + ">");
            readSmtpResponse(reader);

            sendSmtpCommand(out, "DATA");
            readSmtpResponse(reader);

            String emailContent = "From: BusGo Smart Bus <" + gmailUser + ">\r\n" +
                    "To: <" + recipientEmail + ">\r\n" +
                    "Subject: BusGo E-Ticket Confirmed! PNR: " + pnr + " (" + fromCity + " to " + toCity + ")\r\n" +
                    "MIME-Version: 1.0\r\n" +
                    "Content-Type: text/html; charset=UTF-8\r\n" +
                    "\r\n" +
                    "<div style='font-family: Arial, sans-serif; max-width: 580px; margin: auto; padding: 25px; border: 1px solid #cbd5e1; border-radius: 14px; background: #ffffff; box-shadow: 0 4px 16px rgba(0,0,0,0.06);'>" +
                    "  <div style='background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 20px;'>" +
                    "    <h2 style='margin: 0; font-size: 24px;'>Booking Confirmed</h2>" +
                    "    <p style='margin: 5px 0 0; font-size: 14px; opacity: 0.9;'>Official BusGo Electronic Passenger Ticket</p>" +
                    "  </div>" +
                    "  <div style='background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 8px; padding: 14px; margin-bottom: 20px; text-align: center;'>" +
                    "    <span style='font-size: 12px; color: #64748b; text-transform: uppercase;'>Booking Reference / PNR</span><br/>" +
                    "    <strong style='font-size: 26px; color: #1e293b; letter-spacing: 2px;'>" + pnr + "</strong>" +
                    "  </div>" +
                    "  <table style='width: 100%; border-collapse: collapse; font-size: 14px; color: #334155; margin-bottom: 20px;'>" +
                    "    <tr style='border-bottom: 1px solid #f1f5f9;'><td style='padding: 8px 0; color: #64748b;'>Passenger Name:</td><td style='padding: 8px 0; font-weight: bold; text-align: right;'>" + passengerName + "</td></tr>" +
                    "    <tr style='border-bottom: 1px solid #f1f5f9;'><td style='padding: 8px 0; color: #64748b;'>Bus Operator:</td><td style='padding: 8px 0; font-weight: bold; text-align: right;'>" + busOperator + "</td></tr>" +
                    "    <tr style='border-bottom: 1px solid #f1f5f9;'><td style='padding: 8px 0; color: #64748b;'>Journey Route:</td><td style='padding: 8px 0; font-weight: bold; color: #2563eb; text-align: right;'>" + fromCity + " ➔ " + toCity + "</td></tr>" +
                    "    <tr style='border-bottom: 1px solid #f1f5f9;'><td style='padding: 8px 0; color: #64748b;'>Travel Date:</td><td style='padding: 8px 0; font-weight: bold; text-align: right;'>" + travelDate + "</td></tr>" +
                    "    <tr style='border-bottom: 1px solid #f1f5f9;'><td style='padding: 8px 0; color: #64748b;'>Booked Seats:</td><td style='padding: 8px 0; font-weight: bold; color: #dc2626; text-align: right;'>" + seats + "</td></tr>" +
                    "    <tr style='border-bottom: 1px solid #f1f5f9;'><td style='padding: 8px 0; color: #64748b;'>Pickup Point:</td><td style='padding: 8px 0; text-align: right;'>" + (pickupPoint != null && !pickupPoint.isEmpty() ? pickupPoint : "Central Bus Station") + "</td></tr>" +
                    "    <tr style='border-bottom: 1px solid #f1f5f9;'><td style='padding: 8px 0; color: #64748b;'>Dropping Point:</td><td style='padding: 8px 0; text-align: right;'>" + (dropPoint != null && !dropPoint.isEmpty() ? dropPoint : "City Center") + "</td></tr>" +
                    "    <tr><td style='padding: 10px 0; font-size: 16px; font-weight: bold;'>Total Fare Paid:</td><td style='padding: 10px 0; font-size: 18px; font-weight: bold; color: #16a34a; text-align: right;'>₹" + fare + "</td></tr>" +
                    "  </table>" +
                    "  <div style='background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 15px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: #1e40af;'>" +
                    "    <strong>Assigned Driver:</strong> Captain Kirtan &bull; Phone: <a href='tel:+916264213958' style='color:#1d4ed8; font-weight:bold;'>+91 6264213958</a><br/>" +
                    "    <span style='font-size:12px; color:#3b82f6;'>Please report to boarding point 15 minutes before departure.</span>" +
                    "  </div>" +
                    "  <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;'/>" +
                    "  <p style='font-size: 11px; color: #94a3b8; text-align: center; margin: 0;'>BusGo Smart Travel Technologies &bull; Have a pleasant and safe journey!</p>" +
                    "</div>\r\n" +
                    ".";

            sendSmtpCommand(out, emailContent);
            readSmtpResponse(reader);

            sendSmtpCommand(out, "QUIT");
            readSmtpResponse(reader);

            System.out.println(">>> [Real Gmail E-Ticket] Sent successfully to: " + recipientEmail);
            return new SmtpResult(true, "E-Ticket email delivered to " + recipientEmail);

        } catch (Exception e) {
            System.err.println(">>> [Real Gmail E-Ticket Failed]: " + e.getMessage());
            return new SmtpResult(false, "Could not send E-Ticket: " + e.getMessage());
        }
    }

    private static void sendSmtpCommand(OutputStream out, String command) throws Exception {
        out.write((command + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.flush();
    }

    private static String readSmtpResponse(BufferedReader reader) throws Exception {
        String line = reader.readLine();
        if (line == null) return "";
        while (line.length() >= 4 && line.charAt(3) == '-') {
            line = reader.readLine();
        }
        return line != null ? line : "";
    }

    private static Properties loadProperties() {
        Properties props = new Properties();
        // 1. Try classpath resource
        try (InputStream in = GmailSmtpUtil.class.getResourceAsStream("/application.properties")) {
            if (in != null) {
                props.load(in);
                return props;
            }
        } catch (Exception ignored) {
        }

        // 2. Try file path
        File f = new File("src/main/resources/application.properties");
        if (f.exists()) {
            try (FileInputStream fin = new FileInputStream(f)) {
                props.load(fin);
            } catch (Exception ignored) {
            }
        }
        return props;
    }
}
