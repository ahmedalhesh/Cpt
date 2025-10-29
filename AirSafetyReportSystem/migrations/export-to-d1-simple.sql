-- Exported from local SQLite database (SIMPLE VERSION)
-- Generated: 2025-10-29T20:09:25.558Z

PRAGMA foreign_keys = OFF;

-- Clear existing data
DELETE FROM notifications;
DELETE FROM reports;
DELETE FROM company_settings;
DELETE FROM users;

-- Users data
INSERT OR REPLACE INTO users (id, email, password, first_name, last_name, role, created_at, updated_at) VALUES ('77003930-2579-4fb7-adb5-d55106b57440', 'admin@airline.com', '$2b$12$X0LVssyj5.pKUDvO8bJmLuvvkyWWr3hb7x0EcauOjJVSXUuPrEWLi', 'Admin', 'User', 'admin', '2025-10-25 16:43:00', '2025-10-25 16:43:00');
INSERT OR REPLACE INTO users (id, email, password, first_name, last_name, role, created_at, updated_at) VALUES ('db060346-f6ed-43c1-9caf-cc3a87abae3d', 'demo@airline.com', '$2b$12$b.lhNIsUTMIBnQYSOm/PnOIVZm0uan6iKnrTbh9kdpSJBWD0f4A7C', 'Demo', 'User', 'captain', '2025-10-25 16:47:57', '2025-10-25 16:47:57');

-- Company settings data
INSERT OR REPLACE INTO company_settings (id, company_name, logo, email, phone, address, created_at, updated_at) VALUES ('a52a1be8-4521-4b88-995b-547a50f5da4b', 'Afriqiyah airways', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAMAAACahl6sAAAAKlBMVEVHcEwfn98Mkc4UmtYRl9MSl9QSl9QTltMRl9MTltUTl9QTltQSltQTl9TFi6JSAAAADXRSTlMACBUmO1RsgZSrxd7y99RnqQAAA+FJREFUeNrt3MtuHCEQBVAeBfXk/383iSMFZWGbmepug1Rn78UV0NO+xUwKIYQQQgghhBBCCCGEEEIIIYQQQgghBI+czlWhI7Oo2fhgpiJM2KHmYzI0EhtfUKHeStpaaaRjjTLumiY3Hi9S2i9MJRtvEYStYgwH400WptBwk17TT2s2LqEE6QcVHtPBWUDHdHCWZuN6ijU9rI+bSMvpQTj+ZzYuY1TTU2j8ZsLUG9RS0odcSoXWkUSHk/T80PlgbPWbl2ASc52Wku5X05raUGz/HbachvTtg582Uzqr47DspXa28TqdUTYCKI4omy7M+VFSbi9n0Zb2lIF0vEQg7QrwtSxc72mviEVUzUx/k7/lVYOa78timK/cE511fNtered5aY9pv+iQkoxVyh0W01RczyI1OZXXHpszzdXr4ttfwONdJmvNIpCNJQrpTQV1OAmt7DNYXHQujibRzaRXx2el9/OxkI3rKLdyTRbK6SXdxtWkf5ulLLTiWtM6kHEL6dX/kLSeFmUa95G+uMf8Z77IcPI3WBlIvQ9isHE7I/D9A6PPNqL+2qd20vf+32rjMcaQVhToyKo2/jDlWRMv5VBhIvyHiJhF7fGTP+Xyr9tcymFCvX0aOlfoxHrrafErTL3mtCDXhqwn1PCru5f1poP/vAwoNry4btKNdDZvFNioTTx8VabcSA+PMtXuWRgqaSNlsRp1dFjPAVJ3lONPv7Y0nX1gpKbtlPeyUE5XyBVa64hIfyBi/xisO7I8vr9qQxYdnzDhhabaV/P691dpJLZ+0RJymq6sRifMrselo3j3VaP+uhfYHO1urzdeTOXi377rTBDuOvraHHODu8NU1ItfJZuMcXdX7T+T1n+i4hWE67NIfeOyqJ8SXD3dNXQMDjyMW17O4lmUKk8XvP5XS8yOhvepLLmRvvHxiMPhthu9gGzja/3/9Dwc7r0NVzvr6tityHiaETi+6vRJt1p0ODxWixboxKJzmNBKmmYOZcLeAKD+BQCtd5x/63Btl1hKySlNM4fyN5V7gdaJxW48LX40d6tjdrDB/fecJkecvdpq/72zUy9al4YyHLa6B5vhmjCGZZOS+vwo8+3by6ikHVSUy6Kcv8kM8+bjNke1cOwcVNvGk5CTb/KXzrb3FNRR7R48OixvZ1E4f9o2W97dVNTz99fMcu6j2D9tm6Od87NYT+d/aW8W1udnmYtyfpa5KOdnmaOd87NwSVsDVN87y4Hv/NbSdPYvjPV0grrQXkKazg1jWNJJSkNWxxBiLxlaJ2b5wNQhx+9dhhBCCCGEEEIIIYQQQgghhBBCCCGEEEK4zC/+QpdqASUDfAAAAABJRU5ErkJggg==', NULL, '0913402222', 'libya', '2025-10-25 17:15:43', '2025-10-27T20:42:07.585Z');

-- Reports data
INSERT OR REPLACE INTO reports (id, report_type, status, submitted_by, is_anonymous, description, flight_number, aircraft_type, route, event_date_time, contributing_factors, corrective_actions, location, phase_of_flight, risk_level, extra_data, created_at, updated_at) VALUES ('72df495a-a769-408d-82a0-83a4993fa590', 'asr', 'submitted', 'db060346-f6ed-43c1-9caf-cc3a87abae3d', 0, 'Standard: UTC', NULL, NULL, ' / ', '1999-12-31T22:00:00.000Z', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-29 19:49:58', '2025-10-29 19:49:58');

-- Notifications data
INSERT OR REPLACE INTO notifications (id, user_id, title, message, type, is_read, related_report_id, created_at) VALUES ('c8a21370-daa9-4def-b854-6214b6f63e72', '77003930-2579-4fb7-adb5-d55106b57440', 'New Comment on Report', 'Demo User commented on report 12FD6: "شسبشببشسبشسب"', 'info', 1, NULL, '2025-10-28 19:23:55');
INSERT OR REPLACE INTO notifications (id, user_id, title, message, type, is_read, related_report_id, created_at) VALUES ('dea32008-a631-422a-8307-18fd6c8c6388', '77003930-2579-4fb7-adb5-d55106b57440', 'New Report Submitted', 'A new 72DF4 report has been submitted and requires review.', 'info', 0, '72df495a-a769-408d-82a0-83a4993fa590', '2025-10-29 19:49:58');

PRAGMA foreign_keys = ON;
